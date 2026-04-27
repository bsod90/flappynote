/**
 * ChordSynth — Web Audio synthesizer for the Circle of Fifths.
 *
 * Supports block triads, block 7ths, and arpeggios. A simple subtractive
 * voice (sine + low-pass) shaped by an envelope, summed across the chord
 * tones. Designed for clarity rather than realism — the goal is ear-
 * training feedback, not production sound.
 */

import { CHORD_RECIPES } from './musicTheory.js';

// MIDI semitone for the *root* octave we voice the chord in. C4 = 60.
const ROOT_MIDI = 60;

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class ChordSynth {
  constructor() {
    this.audioContext = null;
    this.master = null;
    this.volume = 0.6;
    this.activeNotes = [];
    this._silentAudio = null;
    this._scheduledStop = null;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  ensureAudio() {
    this._ensureAudio();
    return this.audioContext;
  }

  /**
   * iOS-safe unlock — synchronous, must be called inside a user gesture
   * before any await.
   *
   * Important: do NOT recreate a 'suspended' context. On iOS, resume() is
   * async (50–150ms). If the user clicks rapidly, recreating each time would
   * abort the in-flight resume and start over — the context never wakes
   * until the user pauses long enough between clicks. Only recreate when the
   * context is genuinely 'closed'.
   */
  unlock() {
    if (this.audioContext && this.audioContext.state === 'closed') {
      this._recreateAudio();
    } else {
      this._ensureAudio();
    }
    const ctx = this.audioContext;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* noop */ }
    this._startSilentAudio();
  }

  /**
   * Play a chord. Returns a Promise that resolves when the chord finishes.
   *   chord: { semitones (0..11 root pc), type: major|minor|dim|dom|aug, quality? }
   *   options: { voicing: 'triad'|'seventh', articulation: 'block'|'arpeggio', duration: seconds }
   *
   * On iOS the AudioContext is often still 'suspended' when this is first
   * called from a gesture — resume() is async. We await it (with a short
   * timeout so we never hang) and schedule notes with a small lead so the
   * start time is always strictly in the future once the context wakes.
   */
  async playChord(chord, { voicing = 'triad', articulation = 'block', duration = 1.4 } = {}) {
    this._ensureAudio();
    const ctx = this.audioContext;
    if (ctx.state === 'suspended') {
      try {
        await Promise.race([
          ctx.resume(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('resume timeout')), 400)),
        ]);
      } catch { /* noop — proceed; lead time below covers brief slack */ }
    }

    this.stop(); // cut off any previous chord

    const recipe = CHORD_RECIPES[chord.type] ?? CHORD_RECIPES.major;
    const intervals = voicing === 'seventh' ? recipe.seventh : recipe.triad;
    // Lead time keeps the schedule strictly in the future — iOS occasionally
    // discards "schedule at past time" envelope events on a freshly-resumed
    // context.
    const start = ctx.currentTime + 0.04;
    const arpStep = articulation === 'arpeggio' ? 0.09 : 0;
    const noteDur = articulation === 'arpeggio'
      ? Math.max(0.35, duration - arpStep * intervals.length)
      : duration;

    intervals.forEach((semi, i) => {
      const midi = ROOT_MIDI + chord.semitones + semi;
      const freq = midiToFreq(midi);
      const noteStart = start + i * arpStep;
      this._playVoice(freq, noteStart, noteDur, 1 / Math.sqrt(intervals.length));
    });

    return new Promise((resolve) => {
      const stopAt = start + (intervals.length - 1) * arpStep + noteDur + 0.2;
      this._scheduledStop = setTimeout(resolve, (stopAt - ctx.currentTime) * 1000);
    });
  }

  /**
   * Play a sequence of chords with a fixed beat duration (seconds per chord).
   * Returns a Promise that resolves when the full sequence completes.
   */
  async playProgression(chords, { secondsPerChord = 1.2, voicing = 'triad', articulation = 'block' } = {}) {
    this._ensureAudio();
    const ctx = this.audioContext;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    this.stop();
    this._sequencePlaying = true;
    const stamp = Symbol();
    this._sequenceStamp = stamp;

    for (const chord of chords) {
      if (this._sequenceStamp !== stamp) return; // cancelled
      const recipe = CHORD_RECIPES[chord.type] ?? CHORD_RECIPES.major;
      const intervals = voicing === 'seventh' ? recipe.seventh : recipe.triad;
      const start = ctx.currentTime;
      const arpStep = articulation === 'arpeggio'
        ? Math.min(0.07, secondsPerChord / (intervals.length + 1))
        : 0;
      const noteDur = secondsPerChord - 0.05;
      intervals.forEach((semi, i) => {
        const midi = ROOT_MIDI + chord.semitones + semi;
        this._playVoice(midiToFreq(midi), start + i * arpStep, noteDur, 1 / Math.sqrt(intervals.length));
      });
      await new Promise((r) => setTimeout(r, secondsPerChord * 1000));
    }
    this._sequencePlaying = false;
  }

  stop() {
    if (this._scheduledStop) {
      clearTimeout(this._scheduledStop);
      this._scheduledStop = null;
    }
    this._sequenceStamp = null;
    this._sequencePlaying = false;
    const ctx = this.audioContext;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const v of this.activeNotes) {
      try {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setValueAtTime(v.gain.gain.value, t);
        v.gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.05);
        v.osc.stop(t + 0.06);
      } catch { /* noop */ }
    }
    this.activeNotes = [];
  }

  isPlayingSequence() {
    return !!this._sequencePlaying;
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
    this.master = null;
  }

  // ────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────

  _playVoice(frequency, start, duration, volMul = 1) {
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;

    // Add a soft second sine harmonic for body.
    const harm = ctx.createOscillator();
    harm.type = 'sine';
    harm.frequency.value = frequency * 2;

    const gain = ctx.createGain();
    const harmGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(6000, frequency * 6);
    filter.Q.value = 0.7;

    const peak = 0.42 * volMul;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(peak * 0.7, start + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0005, start + duration);

    harmGain.gain.setValueAtTime(0.0001, start);
    harmGain.gain.exponentialRampToValueAtTime(peak * 0.18, start + 0.02);
    harmGain.gain.exponentialRampToValueAtTime(0.0005, start + duration * 0.7);

    osc.connect(gain);
    harm.connect(harmGain);
    gain.connect(filter);
    harmGain.connect(filter);
    filter.connect(this.master);

    osc.start(start);
    harm.start(start);
    osc.stop(start + duration + 0.1);
    harm.stop(start + duration + 0.1);

    this.activeNotes.push({ osc, gain });
    this.activeNotes.push({ osc: harm, gain: harmGain });
  }

  _ensureAudio() {
    if (this.audioContext && this.audioContext.state !== 'closed') return;
    if (this.audioContext) {
      this.audioContext = null;
      this.master = null;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new Ctor();
    this.master = this.audioContext.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.audioContext.destination);
  }

  _recreateAudio() {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.master = null;
    }
    this._ensureAudio();
  }

  _startSilentAudio() {
    if (!this._silentAudio) {
      const sampleRate = 8000;
      const numSamples = sampleRate;
      const buffer = new ArrayBuffer(44 + numSamples);
      const view = new DataView(buffer);
      const writeString = (off, s) => {
        for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
      };
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numSamples, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true);
      writeString(36, 'data');
      view.setUint32(40, numSamples, true);
      for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 128);
      const blob = new Blob([buffer], { type: 'audio/wav' });
      const audio = new Audio(URL.createObjectURL(blob));
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
      audio.loop = true;
      audio.preload = 'auto';
      this._silentAudio = audio;
    }
    if (this._silentAudio.paused) this._silentAudio.play().catch(() => {});
  }
}
