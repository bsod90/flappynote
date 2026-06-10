/**
 * Real-time onset detector for percussive and plucked input.
 *
 * Each incoming block is split into short sub-frames (~3ms) and an onset
 * fires on the first sub-frame whose peak:
 *   - exceeds the absolute threshold, AND
 *   - exceeds riseRatio × the loudest sub-frame in the immediately
 *     preceding reference window (~12ms, spanning block boundaries), AND
 *   - lands more than `refractoryMs` after the previous onset.
 *
 * Why sub-frames instead of the old whole-block peak + envelope follower:
 *   - Onset timestamps come from the sub-frame where the attack actually
 *     starts (≈3ms resolution) rather than the loudest sample, which for
 *     slow attacks (bowed/ramped notes) sits 20-50ms late.
 *   - The rise test compares against a *short* window just before the
 *     candidate, so it measures attack sharpness. Slow swells (tremolo,
 *     6-10Hz amplitude modulation) never double their level within 12ms
 *     and are rejected; real strikes do and fire — even mid-tail of a
 *     previous note, because the tail level right before the strike is
 *     what's in the reference window.
 *
 * The sustained-tail problem the old envelope follower had (a hot envelope
 * masking quick second hits) disappears: the reference window only spans
 * ~12ms, so by the next strike it holds the local tail level, not the
 * previous strike's peak.
 */

const SUB_FRAME_SIZE = 128; // ~2.9ms at 44.1kHz
const REF_WINDOW_SUBFRAMES = 4; // ~12ms reference window for the rise test
const HISTORY_SUBFRAMES = 12; // keep ~35ms so the window spans block reads

export class OnsetDetector {
  constructor({
    threshold = 0.008, // absolute peak floor (0..1)
    riseRatio = 2.2,   // sub-frame peak must exceed this × reference window
    refractoryMs = 10, // short enough to resolve flam grace + main as separate onsets
  } = {}) {
    this.threshold = threshold;
    this.riseRatio = riseRatio;
    this.refractoryMs = refractoryMs;

    this.lastOnsetTime = -Infinity;
    this.lastPeak = 0; // exposed for level metering

    this._subPeakHistory = []; // most recent sub-frame peaks, oldest first
  }

  reset() {
    this.lastOnsetTime = -Infinity;
    this.lastPeak = 0;
    this._subPeakHistory = [];
  }

  /**
   * Process a buffer of samples; return an onset (or null) detected within.
   * `blockTime` is the AudioContext time at the END of the buffer; the onset
   * timestamp comes from the sub-frame where the attack starts.
   */
  process(samples, blockTime, sampleRate) {
    const len = samples.length;
    let blockPeak = 0;
    let onset = null;

    for (let start = 0; start < len; start += SUB_FRAME_SIZE) {
      const end = Math.min(start + SUB_FRAME_SIZE, len);
      let subPeak = 0;
      for (let i = start; i < end; i++) {
        const a = Math.abs(samples[i]);
        if (a > subPeak) subPeak = a;
      }
      if (subPeak > blockPeak) blockPeak = subPeak;

      if (!onset) {
        // Reference: loudest sub-frame in the short window just before this one
        const hist = this._subPeakHistory;
        let ref = 0;
        for (let i = Math.max(0, hist.length - REF_WINDOW_SUBFRAMES); i < hist.length; i++) {
          if (hist[i] > ref) ref = hist[i];
        }

        const estTime = blockTime - (len - start) / sampleRate;
        const passesAbs = subPeak > this.threshold;
        const passesRise = ref <= 1e-6 || subPeak > this.riseRatio * ref;
        const sinceLastMs = (estTime - this.lastOnsetTime) * 1000;

        if (passesAbs && passesRise && sinceLastMs > this.refractoryMs) {
          onset = { time: estTime, energy: subPeak };
          this.lastOnsetTime = estTime;
        }
      }

      this._subPeakHistory.push(subPeak);
    }

    // Trim history to the configured span
    if (this._subPeakHistory.length > HISTORY_SUBFRAMES) {
      this._subPeakHistory.splice(0, this._subPeakHistory.length - HISTORY_SUBFRAMES);
    }

    this.lastPeak = blockPeak;
    return onset;
  }
}
