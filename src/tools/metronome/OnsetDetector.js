/**
 * Peak-based onset detector tuned for percussive transients (drum pad, clap,
 * stick on practice pad). Each call computes the peak absolute amplitude in
 * the buffer and fires when:
 *   - peak > absolute threshold, AND
 *   - peak > riseRatio × ambient peak (slow EMA), AND
 *   - more than `refractoryMs` since the last onset.
 *
 * Peak (vs RMS) responds well to short, sharp attacks where the burst
 * duration is much shorter than the analysis buffer.
 */
export class OnsetDetector {
  constructor({
    threshold = 0.008, // absolute peak floor (0..1)
    riseRatio = 2.8,   // current peak must exceed this × ambient peak
    refractoryMs = 10, // short enough to resolve flam grace + main as separate onsets
    smoothing = 0.92,  // ambient EMA smoothing (closer to 1 = slower)
  } = {}) {
    this.threshold = threshold;
    this.riseRatio = riseRatio;
    this.refractoryMs = refractoryMs;
    this.smoothing = smoothing;

    this.ambientPeak = 0;
    this.lastOnsetTime = -Infinity;
    this.lastPeak = 0; // exposed for level metering
  }

  reset() {
    this.ambientPeak = 0;
    this.lastOnsetTime = -Infinity;
    this.lastPeak = 0;
  }

  /**
   * Process a buffer of samples; return an onset (or null) detected within.
   * `blockTime` is the AudioContext time at the END of the buffer; the onset
   * timestamp is estimated as the buffer midpoint.
   */
  process(samples, blockTime, sampleRate) {
    let peak = 0;
    let peakIdx = 0;
    for (let i = 0; i < samples.length; i++) {
      const a = Math.abs(samples[i]);
      if (a > peak) {
        peak = a;
        peakIdx = i;
      }
    }
    this.lastPeak = peak;

    // Sample-accurate onset time: blockTime corresponds to the END of the
    // buffer, so the peak sample sits (length - peakIdx) samples in the past.
    // Beats midpoint guessing by ~±11.6ms (at 1024 samples / 44.1kHz).
    const estTime = blockTime - (samples.length - peakIdx) / sampleRate;

    let onset = null;
    const passesAbs = peak > this.threshold;
    const passesRise = this.ambientPeak <= 1e-6 || peak > this.riseRatio * this.ambientPeak;
    const sinceLast = (estTime - this.lastOnsetTime) * 1000;
    if (passesAbs && passesRise && sinceLast > this.refractoryMs) {
      onset = { time: estTime, energy: peak };
      this.lastOnsetTime = estTime;
    }

    // Update ambient — slower around an onset so the floor doesn't jump.
    const a = onset ? Math.min(0.99, this.smoothing + 0.05) : this.smoothing;
    this.ambientPeak = a * this.ambientPeak + (1 - a) * peak;

    return onset;
  }
}
