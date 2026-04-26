/**
 * MicListener — opens the microphone and feeds time-domain samples into an
 * OnsetDetector at RAF cadence. Shares the metronome's AudioContext so the
 * onset timestamps align with the engine's beat times.
 *
 * Browser AEC is OFF by default: it aggressively flattens percussive
 * transients (drum-pad hits get suppressed). Headphones are recommended in
 * the UI to avoid the metronome bleeding back into the mic.
 *
 * Each frame fires:
 *   - `onLevel({ time, peak })` — current peak amplitude (for live waveform)
 *   - `onOnset({ time, energy })` — when the detector flags a hit
 */

import { OnsetDetector } from './OnsetDetector.js';

export class MicListener {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.timeBuffer = null;
    this.detector = null;
    this.rafId = null;
    this.onOnset = () => {};
    this.onLevel = () => {};
    this.onLost = () => {};
  }

  async start({ onOnset, onLevel, onLost, threshold, echoCancellation = false } = {}) {
    if (this.stream) return;
    this.onOnset = onOnset ?? (() => {});
    this.onLevel = onLevel ?? (() => {});
    this.onLost = onLost ?? (() => {});

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    // If the mic stream dies (page backgrounded long enough, permission
    // revoked, device unplugged) the analyser quietly returns silence.
    // Notify so the page can rebuild a fresh listener.
    for (const track of this.stream.getAudioTracks()) {
      track.addEventListener('ended', () => {
        try { this.onLost(); } catch (e) { console.error(e); }
      });
    }

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024; // ~23ms at 44.1kHz
    this.analyser.smoothingTimeConstant = 0;
    this.timeBuffer = new Float32Array(this.analyser.fftSize);
    this.source.connect(this.analyser);

    this.detector = new OnsetDetector(threshold ? { threshold } : undefined);

    const loop = () => {
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(this.timeBuffer);
      const now = this.audioContext.currentTime;
      const onset = this.detector.process(
        this.timeBuffer,
        now,
        this.audioContext.sampleRate
      );
      try {
        this.onLevel({ time: now, peak: this.detector.lastPeak });
      } catch (e) { console.error('onLevel threw', e); }
      if (onset) {
        try { this.onOnset(onset); } catch (e) { console.error('onOnset threw', e); }
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  setThreshold(threshold) {
    if (this.detector) this.detector.threshold = threshold;
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.source) this.source.disconnect();
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
    }
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.detector = null;
  }
}
