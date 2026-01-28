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
   * @param {number} options.clarityThreshold - Minimum clarity for MPM (default: 0.85)
   * @param {number} options.pitchHistorySize - Size of median filter window (default: 5)
   */
  constructor(options = {}) {
    super(options);

    this._name = 'hybrid';
    this.bufferSize = options.bufferSize || 2048;
    this.threshold = options.threshold || 0.005;
    this.clarityThreshold = options.clarityThreshold || 0.85;
    this.pitchHistorySize = options.pitchHistorySize || 5;

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
   * Apply temporal smoothing using median filter
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

    // Calculate median
    const sorted = [...this.pitchHistory].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Reset the detector state (clear history)
   */
  reset() {
    this.pitchHistory = [];
    this.lastClarity = 0;
    this.lastAlgorithm = null;
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
