/**
 * Peak-based onset detector that works for both percussion (drum pad, clap,
 * stick on practice pad) AND sustained-tail instruments (guitar, piano).
 *
 * Each call computes the peak absolute amplitude in the buffer and fires
 * when:
 *   - peak > absolute threshold, AND
 *   - peak > riseRatio × envelope-from-the-previous-frame, AND
 *   - more than `refractoryMs` since the last onset.
 *
 * The envelope is a fast-attack / exponential-release follower:
 *   env_n = max(peak, env_{n-1} * envDecay)
 *
 * This is the key change from a slow EMA "ambient" tracker. An EMA averages
 * a sustained tail into the floor and keeps it elevated, so subsequent
 * plucks during the tail can't beat the rise ratio. The envelope follower
 * jumps to the transient, then decays back toward zero in ~100ms — by the
 * next pluck, even mid-tail, the envelope is low enough that a fresh
 * transient stands out cleanly.
 *
 * Peak (vs RMS) responds well to short, sharp attacks where the burst
 * duration is much shorter than the analysis buffer.
 */
export class OnsetDetector {
  constructor({
    threshold = 0.008, // absolute peak floor (0..1)
    riseRatio = 2.2,   // current peak must exceed this × envelope (prev frame)
    refractoryMs = 10, // short enough to resolve flam grace + main as separate onsets
    envDecay = 0.55,   // per-buffer envelope decay; ~85ms to fall to 10% (1024-sample buffer @ 44.1kHz)
  } = {}) {
    this.threshold = threshold;
    this.riseRatio = riseRatio;
    this.refractoryMs = refractoryMs;
    this.envDecay = envDecay;

    this.envelope = 0;
    this.lastOnsetTime = -Infinity;
    this.lastPeak = 0; // exposed for level metering
  }

  reset() {
    this.envelope = 0;
    this.lastOnsetTime = -Infinity;
    this.lastPeak = 0;
  }

  /**
   * Process a buffer of samples; return an onset (or null) detected within.
   * `blockTime` is the AudioContext time at the END of the buffer; the onset
   * timestamp is estimated from the peak sample's position.
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
    const estTime = blockTime - (samples.length - peakIdx) / sampleRate;

    // Compare against the envelope BEFORE updating it — otherwise the
    // current peak is folded into its own reference.
    const prevEnv = this.envelope;

    let onset = null;
    const passesAbs = peak > this.threshold;
    const passesRise = prevEnv <= 1e-6 || peak > this.riseRatio * prevEnv;
    const sinceLast = (estTime - this.lastOnsetTime) * 1000;
    if (passesAbs && passesRise && sinceLast > this.refractoryMs) {
      onset = { time: estTime, energy: peak };
      this.lastOnsetTime = estTime;
    }

    // Fast-attack / exponential-release envelope follower
    this.envelope = Math.max(peak, this.envelope * this.envDecay);

    return onset;
  }
}
