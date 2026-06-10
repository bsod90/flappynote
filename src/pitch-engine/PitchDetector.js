/**
 * PitchDetector - Main pitch detection module
 * Combines AudioAnalyzer and FrequencyConverter for complete pitch detection
 * Detection algorithm: hybrid MPM (pitchy) with YIN (pitchfinder) fallback
 */

import { AudioAnalyzer } from './AudioAnalyzer.js';
import { FrequencyConverter } from './FrequencyConverter.js';
import { HybridPitchDetector } from './detectors/HybridPitchDetector.js';
import { VocalAnalyzer } from './VocalAnalyzer.js';

/**
 * Available detector types. 'crepe' was removed — it was never a real CREPE
 * model (a plain autocorrelation stub gated on a TensorFlow.js CDN load) and
 * the hybrid detector outperforms it; the constant stays so stored options
 * resolve to the hybrid path.
 */
export const DetectorType = {
  HYBRID: 'hybrid',
};

export class PitchDetector {
  /**
   * @param {object} options
   * @param {string} options.detector - Detector type (only 'hybrid' is supported)
   * @param {function} options.onModelReady - Callback when the detector is ready
   * @param {number} options.bufferSize - Buffer size for detection (default: 2048)
   * @param {number} options.minFrequency - Minimum frequency to detect (default: 60)
   * @param {number} options.maxFrequency - Maximum frequency to detect (default: 1200)
   * @param {number} options.threshold - RMS threshold for silence, 0..1 (default: 0.005)
   * @param {number} options.updateInterval - Detection interval in ms (default: 50)
   * @param {function} options.onPitchDetected - Callback for pitch detection results
   */
  constructor(options = {}) {
    // Detector configuration (any stored legacy value resolves to hybrid)
    this.detectorType = DetectorType.HYBRID;
    this.fallbackEnabled = options.fallbackEnabled !== false;

    // Callbacks
    this.onModelLoading = options.onModelLoading || null;
    this.onModelReady = options.onModelReady || null;
    this.onModelError = options.onModelError || null;
    this.onPitchDetected = options.onPitchDetected || null;

    // Common options
    this.bufferSize = options.bufferSize || 2048;
    this.minFrequency = options.minFrequency || 60;
    this.maxFrequency = options.maxFrequency || 1200;
    this.threshold = options.threshold ?? 0.005;
    this.updateInterval = options.updateInterval || 50;

    // AudioAnalyzer for audio input (always used)
    this.analyzer = new AudioAnalyzer({
      bufferSize: this.bufferSize,
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
      threshold: this.threshold,
      highPassFreq: options.highPassFreq,
    });

    // Detector instances
    this.hybridDetector = null;
    this.activeDetector = null;

    // State
    this.isRunning = false;
    this.intervalId = null;
    this.currentPitch = null;
    this.detectorReady = false;

    // Vocal analysis (vibrato, stability, brightness, breathiness)
    this.vocalAnalyzer = new VocalAnalyzer();
    this.enableVocalAnalysis = options.enableVocalAnalysis !== false; // Enabled by default
  }

  /**
   * Initialize the pitch detector
   * @returns {Promise<void>}
   */
  async _initializeDetector() {
    const sampleRate = this.analyzer.getSampleRate();
    await this._initializeHybridDetector(sampleRate);
    this.detectorReady = true;

    if (this.onModelReady) {
      this.onModelReady();
    }
  }

  /**
   * Initialize hybrid detector
   * @private
   */
  async _initializeHybridDetector(sampleRate) {
    this.hybridDetector = new HybridPitchDetector({
      sampleRate,
      bufferSize: this.bufferSize,
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
      threshold: this.threshold, // same RMS semantics as AudioAnalyzer
    });

    await this.hybridDetector.initialize();
    this.activeDetector = this.hybridDetector;
  }

  /**
   * Start pitch detection
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) return;

    await this.analyzer.start();

    // Initialize detector if not done
    if (!this.detectorReady) {
      await this._initializeDetector();
    }

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

    let frequency = null;
    let confidence = 0;

    // Use the standalone detector or fall back to AudioAnalyzer
    if (this.activeDetector && this.activeDetector.isReady) {
      const result = this.activeDetector.detect(buffer);
      frequency = result?.frequency ?? null;
      confidence = result?.confidence ?? 0;
    } else {
      // Fallback to AudioAnalyzer's built-in detection
      frequency = this.analyzer.detectPitch(buffer);
      confidence = this.analyzer.lastClarity || 0;
    }

    if (frequency) {
      const noteInfo = FrequencyConverter.frequencyToNote(frequency);
      // Calculate RMS from buffer (volume level for visualization)
      const rms = this.analyzer.calculateRMS(buffer);
      this.currentPitch = {
        frequency,
        confidence,
        rms, // Volume level for visualization
        ...noteInfo,
        timestamp: Date.now(),
        detector: this.activeDetector?.name || 'analyzer',
      };

      // Run vocal analysis if enabled
      if (this.enableVocalAnalysis) {
        const analyserNode = this.analyzer.getAnalyserNode();
        const sampleRate = this.analyzer.getSampleRate();
        const vocalAnalysis = this.vocalAnalyzer.analyze(buffer, frequency, sampleRate, analyserNode);
        this.currentPitch.vocalAnalysis = vocalAnalysis;
      }

      if (this.onPitchDetected) {
        this.onPitchDetected(this.currentPitch);
      }
    } else {
      this.currentPitch = null;

      // Reset vocal analyzer on silence
      if (this.enableVocalAnalysis) {
        this.vocalAnalyzer.reset();
      }

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
   * Get information about the current detector
   * @returns {object} Detector info
   */
  getDetectorInfo() {
    return {
      type: this.detectorType,
      active: this.activeDetector?.name || 'none',
      ready: this.detectorReady,
      hybridReady: this.hybridDetector?.isReady ?? false,
    };
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
   * Enable drone noise cancellation
   * @param {number} frequency - Root frequency of the drone
   */
  enableDroneCancellation(frequency) {
    this.analyzer.enableDroneCancellation(frequency);
  }

  /**
   * Disable drone noise cancellation
   */
  disableDroneCancellation() {
    this.analyzer.disableDroneCancellation();
  }

  /**
   * Get debug information from analyzer
   * @returns {object} Debug stats
   */
  getDebugInfo() {
    return {
      ...this.analyzer.getDebugInfo(),
      detector: this.getDetectorInfo(),
    };
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stop();

    if (this.hybridDetector) {
      this.hybridDetector.dispose();
      this.hybridDetector = null;
    }

    this.activeDetector = null;
    this.detectorReady = false;
  }
}
