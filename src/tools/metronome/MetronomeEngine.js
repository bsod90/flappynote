/**
 * MetronomeEngine
 *
 * Web Audio lookahead scheduler. Runs a setInterval at ~25ms that schedules
 * any clicks falling in the next ~120ms window via AudioContext.currentTime.
 * This avoids drift even when the browser tab is throttled in the background.
 *
 * Beat callbacks fire close to audible time so the UI's beat indicator stays
 * synced with what the user hears.
 */

import { getClickBuffers } from './clickSamples.js';

const SCHEDULE_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

/**
 * Beat type enum used in accent patterns and onBeat callbacks.
 */
export const BeatKind = {
  ACCENT: 'accent',
  REGULAR: 'regular',
  SILENT: 'silent',
};

export class MetronomeEngine {
  constructor({ onBeat } = {}) {
    this.onBeat = onBeat ?? (() => {});

    this.audioContext = null;
    this.masterGain = null;

    // Live config — mutate via setters
    this.bpm = 120;
    this.beatsPerBar = 4;
    this.beatUnit = 4; // 4 = quarter; 8 = eighth (affects note value but not scheduling rate yet)
    this.accentPattern = ['accent', 'regular', 'regular', 'regular']; // length === beatsPerBar
    this.timbre = 'woodblock';
    this.volume = 0.8;
    this.skipPattern = { playBars: 4, skipBars: 0 }; // 0 skip = always play
    this.subdivision = 1; // 1 = quarters, 2 = eighths, 3 = triplets, 4 = sixteenths
    this.subVolume = 0.5; // gain multiplier for subdivisions (relative to main click)

    this.isRunning = false;
    this.nextBeatTime = 0; // AudioContext time of the next scheduled beat
    this.nextBeatIndex = 0; // 0-based index within current bar
    this.barCounter = 0;
    this.schedulerTimer = null;

    // Pending UI beat events: { time, beatIndex, barNumber, kind }
    this._pendingBeats = [];
    this._uiTimer = null;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Configuration setters (safe to call while running)
  // ──────────────────────────────────────────────────────────────────────

  setBpm(bpm) {
    this.bpm = clamp(bpm, 20, 300);
  }

  setTimeSignature(beatsPerBar, beatUnit) {
    this.beatsPerBar = clamp(beatsPerBar | 0, 1, 16);
    this.beatUnit = beatUnit | 0;
    // Resize accent pattern to match
    if (this.accentPattern.length !== this.beatsPerBar) {
      const next = [];
      for (let i = 0; i < this.beatsPerBar; i++) {
        next.push(this.accentPattern[i] ?? (i === 0 ? BeatKind.ACCENT : BeatKind.REGULAR));
      }
      this.accentPattern = next;
    }
    if (this.nextBeatIndex >= this.beatsPerBar) this.nextBeatIndex = 0;
  }

  setAccentPattern(pattern) {
    if (!Array.isArray(pattern) || pattern.length !== this.beatsPerBar) return;
    this.accentPattern = [...pattern];
  }

  setTimbre(key) {
    this.timbre = key;
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }

  setSkipPattern(playBars, skipBars) {
    this.skipPattern = {
      playBars: clamp(playBars | 0, 1, 64),
      skipBars: clamp(skipBars | 0, 0, 64),
    };
  }

  setSubdivision(n) {
    this.subdivision = clamp(n | 0, 1, 6);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────────────────

  async start() {
    if (this.isRunning) return;
    this._ensureAudio();
    // unlock() (called synchronously in the play-tap gesture) handles
    // recreating the context if it was stuck after device sleep. Here we
    // only need to await resume() with a timeout so a slow Safari resume
    // doesn't make us hang indefinitely — the scheduler can still run and
    // start visualization even if audio is briefly delayed.
    if (this.audioContext.state === 'suspended') {
      try {
        await Promise.race([
          this.audioContext.resume(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('resume timeout')), 600)),
        ]);
      } catch { /* keep going — scheduler ticks against currentTime regardless */ }
    }
    this.isRunning = true;
    this.nextBeatIndex = 0;
    this.barCounter = 0;
    // Schedule the first beat slightly in the future so we never miss it
    this.nextBeatTime = this.audioContext.currentTime + 0.06;
    this._pendingBeats = [];
    this._scheduler();
    this.schedulerTimer = setInterval(() => this._scheduler(), SCHEDULE_INTERVAL_MS);
    this._uiTimer = requestAnimationFrame(() => this._flushUiBeats());
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this._uiTimer) {
      cancelAnimationFrame(this._uiTimer);
      this._uiTimer = null;
    }
    this._pendingBeats = [];
  }

  dispose() {
    this.stop();
    if (this._silentAudio) {
      this._silentAudio.pause();
      try { URL.revokeObjectURL(this._silentAudio.src); } catch { /* noop */ }
      this._silentAudio = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.masterGain = null;
  }

  /** Returns AudioContext.currentTime, or 0 if no context yet. */
  now() {
    return this.audioContext?.currentTime ?? 0;
  }

  /**
   * Lazily create the AudioContext (without starting playback) so callers
   * like the mic listener can attach against the same context for sample-
   * accurate timing alignment.
   */
  ensureAudio() {
    this._ensureAudio();
    return this.audioContext;
  }

  /**
   * iOS-safe audio unlock. Must be called synchronously from inside a user
   * gesture (no awaits before it).
   *
   * Two distinct iOS issues this addresses:
   *   1. AudioContext starts "suspended" — resume() + a buffer source start
   *      inside a gesture wakes it up.
   *   2. Audio session category. By default iOS treats AudioContext as
   *      "ambient" audio, which is muted when the hardware silent switch
   *      is on. A live HTMLAudioElement with `playsinline` promotes the
   *      session to "media playback", which overrides the silent switch.
   *      (This is why listen-back works without this — getUserMedia
   *      switches the session to "playAndRecord" with the same effect.)
   */
  unlock() {
    // After the device sleeps + wakes, the existing AudioContext can land
    // in a state where resume() never resolves. Since unlock() is called
    // synchronously in a user gesture (the only time iOS lets us spin up
    // a fresh AudioContext with output), aggressively recreate it whenever
    // it isn't already 'running' — cheap, and guarantees a known-good ctx.
    if (this.audioContext && this.audioContext.state !== 'running') {
      this._recreateAudio();
    } else {
      this._ensureAudio();
    }
    const ctx = this.audioContext;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* noop */ }
    this._startSilentAudio();
  }

  _startSilentAudio() {
    if (!this._silentAudio) {
      // Generate a 1s silent 8-bit PCM WAV in-memory so we don't ship a
      // bundled silent file. Looped, this keeps the audio session alive
      // for the page lifetime.
      const sampleRate = 8000;
      const numSamples = sampleRate;
      const buffer = new ArrayBuffer(44 + numSamples);
      const view = new DataView(buffer);
      const writeString = (offset, s) => {
        for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
      };
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numSamples, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);  // PCM
      view.setUint16(22, 1, true);  // mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate, true);
      view.setUint16(32, 1, true);  // block align
      view.setUint16(34, 8, true);  // bits per sample
      writeString(36, 'data');
      view.setUint32(40, numSamples, true);
      // 0x80 = digital silence in unsigned 8-bit PCM
      for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 128);

      const blob = new Blob([buffer], { type: 'audio/wav' });
      const audio = new Audio(URL.createObjectURL(blob));
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
      audio.loop = true;
      audio.preload = 'auto';
      this._silentAudio = audio;
    }
    if (this._silentAudio.paused) {
      this._silentAudio.play().catch(() => {});
    }
  }

  /** Best-guess output latency in seconds (for hit-vs-beat compensation). */
  getOutputLatency() {
    if (!this.audioContext) return 0;
    return this.audioContext.outputLatency || this.audioContext.baseLatency || 0;
  }

  /**
   * Distinct two-tone "interval transition" signal — a quick rising chime
   * that's audibly different from the click pattern. Plays through the
   * existing master gain so it follows the user's volume.
   */
  playIntervalBeep() {
    this._ensureAudio();
    const ctx = this.audioContext;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    this._beepTone(t, 880, 0.16, 0.7);
    this._beepTone(t + 0.18, 1320, 0.2, 0.65);
  }

  /**
   * Subtle "5 seconds to go" cue — a single short low tone. Quieter than
   * playIntervalBeep so it reads as a heads-up rather than a transition.
   */
  playIntervalWarning() {
    this._ensureAudio();
    const ctx = this.audioContext;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this._beepTone(ctx.currentTime, 520, 0.12, 0.28);
  }

  _beepTone(when, freq, dur, peak) {
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0005, when + dur);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────────

  _ensureAudio() {
    if (this.audioContext && this.audioContext.state !== 'closed') return;
    if (this.audioContext) {
      this.audioContext = null;
      this.masterGain = null;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new Ctor();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.audioContext.destination);
  }

  _recreateAudio() {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.masterGain = null;
    }
    this._ensureAudio();
  }

  _scheduler() {
    if (!this.isRunning) return;
    const now = this.audioContext.currentTime;
    const horizon = now + SCHEDULE_AHEAD_S;
    const beatDur = 60 / this.bpm;

    while (this.nextBeatTime < horizon) {
      const kind = this._kindForBeat(this.nextBeatIndex, this.barCounter);
      const skipped = this._isSkippedBar(this.barCounter);
      if (kind !== BeatKind.SILENT && !skipped) {
        this._scheduleClick(this.nextBeatTime, kind, 1.0);
      }

      // Schedule subdivisions inside this beat (silent beats stay silent)
      if (this.subdivision > 1 && kind !== BeatKind.SILENT && !skipped) {
        const subDur = beatDur / this.subdivision;
        for (let s = 1; s < this.subdivision; s++) {
          this._scheduleClick(
            this.nextBeatTime + s * subDur,
            BeatKind.REGULAR,
            this.subVolume
          );
        }
      }

      this._pendingBeats.push({
        time: this.nextBeatTime,
        beatIndex: this.nextBeatIndex,
        barNumber: this.barCounter,
        kind,
        skipped,
      });

      // Advance
      this.nextBeatTime += beatDur;
      this.nextBeatIndex += 1;
      if (this.nextBeatIndex >= this.beatsPerBar) {
        this.nextBeatIndex = 0;
        this.barCounter += 1;
      }
    }
  }

  _kindForBeat(beatIndex, _barNumber) {
    return this.accentPattern[beatIndex] ?? BeatKind.REGULAR;
  }

  _isSkippedBar(barNumber) {
    const { playBars, skipBars } = this.skipPattern;
    if (skipBars <= 0) return false;
    const cycle = playBars + skipBars;
    const mod = ((barNumber % cycle) + cycle) % cycle;
    return mod >= playBars;
  }

  _scheduleClick(when, kind, gainScale = 1) {
    const buffers = getClickBuffers(this.audioContext, this.timbre);
    const buf = kind === BeatKind.ACCENT ? buffers.accent : buffers.regular;
    const src = this.audioContext.createBufferSource();
    src.buffer = buf;
    if (gainScale !== 1) {
      const g = this.audioContext.createGain();
      g.gain.value = gainScale;
      src.connect(g);
      g.connect(this.masterGain);
    } else {
      src.connect(this.masterGain);
    }
    src.start(when);
  }

  /**
   * Drains queued beats whose audio time has passed, emitting onBeat() at the
   * right moment. Runs on RAF so the UI ticks aligned with display refresh.
   */
  _flushUiBeats() {
    if (!this.isRunning) return;
    const now = this.audioContext.currentTime;
    while (this._pendingBeats.length && this._pendingBeats[0].time <= now) {
      const beat = this._pendingBeats.shift();
      try {
        this.onBeat(beat);
      } catch (e) {
        console.error('onBeat handler threw:', e);
      }
    }
    this._uiTimer = requestAnimationFrame(() => this._flushUiBeats());
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
