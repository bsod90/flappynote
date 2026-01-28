/**
 * HybridPitchDetector - MPM + YIN hybrid pitch detection
 * Extracted from AudioAnalyzer for standalone use
 */

import Pitchfinder from 'pitchfinder';
import { PitchDetector as PitchyDetector } from 'pitchy';
import { BasePitchDetector } from './BasePitchDetector.js';

export class HybridPitchDetector extends BasePitchDetector {
  /**
   * @param {object} options
   * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
   * @param {number} options.bufferSize - Buffer size for detection (default: 2048)
   * @param {number} options.minFrequency - Minimum frequency to detect (default: 60)
   * @param {number} options.maxFrequency - Maximum frequency to detect (default: 1200)
   * @param {number} options.threshold - RMS threshold for silence detection (default: 0.005)
   * @param {number} options.clarityThreshold - Minimum clarity for MPM (default: 0.75)
   * @param {number} options.pitchHistorySize - Size of median filter window (default: 7)
   */
  constructor(options = {}) {
    super(options);

    this._name = 'hybrid';
    this.bufferSize = options.bufferSize || 2048;
    this.threshold = options.threshold || 0.005;
    this.clarityThreshold = options.clarityThreshold || 0.75; // Lowered for better voice onset
    this.pitchHistorySize = options.pitchHistorySize || 7; // Increased for stability

    // Octave jump prevention
    this.stablePitch = null;
    this.stablePitchFrames = 0;
    this.minStableFrames = 3;

    // Pitch detectors
    this.detectPitchMPM = null;
    this.detectPitchYIN = null;

    // State
    this.pitchHistory = [];
    this.lastClarity = 0;
    this.lastAlgorithm = null;
  }

  /**
   * Initialize the detector
   * @returns {Promise<void>}
   */
  async initialize() {
    // Initialize Pitchy (MPM) detector
    this.detectPitchMPM = PitchyDetector.forFloat32Array(this.bufferSize);

    // Initialize YIN detector
    this.detectPitchYIN = Pitchfinder.YIN({
      sampleRate: this.sampleRate,
      threshold: 0.15,
    });

    this._initialized = true;
  }

  /**
   * Detect pitch from audio buffer
   * @param {Float32Array} buffer - Audio buffer
   * @returns {{frequency: number|null, confidence: number, timestamp: number}}
   */
  detect(buffer) {
    if (!this._initialized) {
      throw new Error('Detector not initialized. Call initialize() first.');
    }

    const timestamp = Date.now();

    // Check if signal is strong enough
    const rms = this._calculateRMS(buffer);

    if (rms < this.threshold) {
      this.pitchHistory = [];
      this.lastClarity = 0;
      this.lastAlgorithm = null;
      return { frequency: null, confidence: 0, timestamp };
    }

    // Try MPM (Pitchy) first
    let rawFrequency = null;
    let clarity = 0;

    if (this.detectPitchMPM) {
      const [pitch, pitchClarity] = this.detectPitchMPM.findPitch(buffer, this.sampleRate);

      if (pitch && pitchClarity >= this.clarityThreshold) {
        rawFrequency = pitch;
        clarity = pitchClarity;
        this.lastAlgorithm = 'MPM';
      }
    }

    // Fall back to YIN if MPM failed
    if (!rawFrequency && this.detectPitchYIN) {
      const yinFreq = this.detectPitchYIN(buffer);
      if (yinFreq) {
        rawFrequency = yinFreq;
        clarity = 0.7; // Estimate YIN clarity
        this.lastAlgorithm = 'YIN';
      }
    }

    // No valid pitch detected
    if (!rawFrequency) {
      this.pitchHistory = [];
      this.lastClarity = 0;
      this.lastAlgorithm = null;
      return { frequency: null, confidence: 0, timestamp };
    }

    // Validate frequency range
    rawFrequency = this._validateFrequency(rawFrequency);
    if (!rawFrequency) {
      this.pitchHistory = [];
      this.lastClarity = 0;
      return { frequency: null, confidence: 0, timestamp };
    }

    // Apply octave correction
    rawFrequency = this._correctOctaveJump(rawFrequency);

    this.lastClarity = clarity;

    // Apply temporal smoothing
    const smoothedFrequency = this._applyTemporalSmoothing(rawFrequency);

    return {
      frequency: smoothedFrequency,
      confidence: clarity,
      timestamp,
      raw: rawFrequency,
      algorithm: this.lastAlgorithm,
    };
  }

  /**
   * Apply temporal smoothing using octave-aware median filter
   * @private
   */
  _applyTemporalSmoothing(frequency) {
    this.pitchHistory.push(frequency);

    while (this.pitchHistory.length > this.pitchHistorySize) {
      this.pitchHistory.shift();
    }

    if (this.pitchHistory.length < 3) {
      return frequency;
    }

    // Filter octave outliers before computing median
    const filtered = this._filterOctaveOutliers(this.pitchHistory);

    // Calculate median
    const sorted = [...filtered].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Filter out octave outliers from pitch history
   * @private
   */
  _filterOctaveOutliers(pitches) {
    if (pitches.length < 4) return pitches;

    const sorted = [...pitches].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const prelimMedian = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

    const filtered = pitches.filter(freq => {
      const ratio = freq / prelimMedian;
      return ratio > 0.7 && ratio < 1.4;
    });

    return filtered.length < 3 ? pitches : filtered;
  }

  /**
   * Reset the detector state (clear history)
   */
  reset() {
    this.pitchHistory = [];
    this.lastClarity = 0;
    this.lastAlgorithm = null;
    this.stablePitch = null;
    this.stablePitchFrames = 0;
  }

  /**
   * Correct octave jumps by comparing to stable pitch
   * @private
   * @param {number} frequency - Raw detected frequency
   * @returns {number} Corrected frequency
   */
  _correctOctaveJump(frequency) {
    if (this.stablePitch === null) {
      this.stablePitch = frequency;
      this.stablePitchFrames = 1;
      return frequency;
    }

    const ratio = frequency / this.stablePitch;

    // Check for octave jumps
    const isOctaveUp = ratio > 1.8 && ratio < 2.2;
    const isOctaveDown = ratio > 0.45 && ratio < 0.55;
    const isDoubleOctaveUp = ratio > 3.6 && ratio < 4.4;
    const isStable = ratio > 0.97 && ratio < 1.03;

    if (isStable) {
      this.stablePitchFrames++;
      this.stablePitch = this.stablePitch * 0.9 + frequency * 0.1;
      return frequency;
    }

    // Correct octave errors if we have stable pitch
    if (this.stablePitchFrames >= this.minStableFrames) {
      if (isOctaveUp) {
        const corrected = frequency / 2;
        if (corrected >= this.minFrequency) return corrected;
      } else if (isOctaveDown) {
        const corrected = frequency * 2;
        if (corrected <= this.maxFrequency) return corrected;
      } else if (isDoubleOctaveUp) {
        const corrected = frequency / 4;
        if (corrected >= this.minFrequency) return corrected;
      }
    }

    // Genuine pitch change - reset tracking
    const semitoneRatio = Math.abs(12 * Math.log2(ratio));
    if (semitoneRatio > 2) {
      this.stablePitch = frequency;
      this.stablePitchFrames = 1;
    }

    return frequency;
  }

  /**
   * Get detector info
   * @returns {object} Detector info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      bufferSize: this.bufferSize,
      threshold: this.threshold,
      clarityThreshold: this.clarityThreshold,
      lastClarity: this.lastClarity,
      lastAlgorithm: this.lastAlgorithm,
      historySize: this.pitchHistory.length,
    };
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.detectPitchMPM = null;
    this.detectPitchYIN = null;
    this.pitchHistory = [];
    super.dispose();
  }
}
