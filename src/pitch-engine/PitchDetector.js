/**
 * PitchDetector - Main pitch detection module
 * Combines AudioAnalyzer and FrequencyConverter for complete pitch detection
 */

import { AudioAnalyzer } from './AudioAnalyzer.js';
import { FrequencyConverter } from './FrequencyConverter.js';

export class PitchDetector {
  constructor(options = {}) {
    this.analyzer = new AudioAnalyzer({
      bufferSize: options.bufferSize || 2048,
      minFrequency: options.minFrequency || 60,
      maxFrequency: options.maxFrequency || 1200,
      threshold: options.threshold || 0.1,
    });

    this.updateInterval = options.updateInterval || 50; // ms
    this.onPitchDetected = options.onPitchDetected || null;

    this.isRunning = false;
    this.intervalId = null;
    this.currentPitch = null;
  }

  /**
   * Start pitch detection
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) return;

    await this.analyzer.start();
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this._detectAndNotify();
    }, this.updateInterval);
  }

  /**
   * Stop pitch detection
   */
  stop() {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.analyzer.stop();
    this.isRunning = false;
    this.currentPitch = null;
  }

  /**
   * Detect pitch and notify callback
   * @private
   */
  _detectAndNotify() {
    const buffer = this.analyzer.getAudioBuffer();
    if (!buffer) return;

    const frequency = this.analyzer.detectPitch(buffer);

    if (frequency) {
      const noteInfo = FrequencyConverter.frequencyToNote(frequency);
      this.currentPitch = {
        frequency,
        ...noteInfo,
        timestamp: Date.now(),
      };

      if (this.onPitchDetected) {
        this.onPitchDetected(this.currentPitch);
      }
    } else {
      this.currentPitch = null;
      if (this.onPitchDetected) {
        this.onPitchDetected(null);
      }
    }
  }

  /**
   * Get current detected pitch
   * @returns {object|null} Current pitch info or null
   */
  getCurrentPitch() {
    return this.currentPitch;
  }

  /**
   * Get frequency for a specific scale degree relative to root note
   * @param {string} rootNote - Root note name (e.g., "C4")
   * @param {number} degree - Scale degree (0-7, where 0 is root)
   * @param {string} scaleType - Scale type ("major", "minor", etc.)
   * @returns {number} Target frequency in Hz
   */
  static getScaleDegreeFrequency(rootNote, degree, scaleType = 'major') {
    const scales = {
      major: [0, 2, 4, 5, 7, 9, 11, 12],
      minor: [0, 2, 3, 5, 7, 8, 10, 12],
      dorian: [0, 2, 3, 5, 7, 9, 10, 12],
      mixolydian: [0, 2, 4, 5, 7, 9, 10, 12],
    };

    const intervals = scales[scaleType] || scales.major;
    const rootMidi = FrequencyConverter.noteNameToMidi(rootNote);
    const targetMidi = rootMidi + intervals[degree];

    return FrequencyConverter.midiToFrequency(targetMidi);
  }

  /**
   * Check if current pitch matches target frequency within tolerance
   * @param {number} targetFrequency - Target frequency in Hz
   * @param {number} toleranceCents - Tolerance in cents (default 50)
   * @returns {boolean} True if pitch matches
   */
  isPitchMatching(targetFrequency, toleranceCents = 50) {
    if (!this.currentPitch) return false;

    const cents = FrequencyConverter.getCentsDifference(
      targetFrequency,
      this.currentPitch.frequency
    );

    return Math.abs(cents) <= toleranceCents;
  }

  /**
   * Get cents difference from target
   * @param {number} targetFrequency - Target frequency in Hz
   * @returns {number|null} Cents difference or null if no pitch detected
   */
  getCentsFromTarget(targetFrequency) {
    if (!this.currentPitch) return null;

    return FrequencyConverter.getCentsDifference(
      targetFrequency,
      this.currentPitch.frequency
    );
  }

  /**
   * Get debug information from analyzer
   * @returns {object} Debug stats
   */
  getDebugInfo() {
    return this.analyzer.getDebugInfo();
  }
}
