/**
 * PitchDetector - Main pitch detection module
 * Combines AudioAnalyzer and FrequencyConverter for complete pitch detection
 * Supports multiple detection algorithms: 'hybrid' (MPM+YIN) and 'crepe' (ML-based)
 */

import { AudioAnalyzer } from './AudioAnalyzer.js';
import { FrequencyConverter } from './FrequencyConverter.js';
import { HybridPitchDetector } from './detectors/HybridPitchDetector.js';
import { TFCREPEDetector, TFCREPEState } from './detectors/TFCREPEDetector.js';

/**
 * Available detector types
 */
export const DetectorType = {
  HYBRID: 'hybrid',
  CREPE: 'crepe',
};

export class PitchDetector {
  /**
   * @param {object} options
   * @param {string} options.detector - Detector type: 'hybrid' (default) or 'crepe'
   * @param {boolean} options.fallbackEnabled - Use hybrid if CREPE fails to load (default: true)
   * @param {function} options.onModelLoading - Callback when CREPE model starts loading
   * @param {function} options.onModelReady - Callback when CREPE model is ready
   * @param {function} options.onModelError - Callback when CREPE model fails to load
   * @param {number} options.bufferSize - Buffer size for detection (default: 2048)
   * @param {number} options.minFrequency - Minimum frequency to detect (default: 60)
   * @param {number} options.maxFrequency - Maximum frequency to detect (default: 1200)
   * @param {number} options.threshold - RMS threshold for silence (default: 0.1)
   * @param {number} options.updateInterval - Detection interval in ms (default: 50)
   * @param {function} options.onPitchDetected - Callback for pitch detection results
   */
  constructor(options = {}) {
    // Detector configuration
    this.detectorType = options.detector || DetectorType.HYBRID;
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
    this.threshold = options.threshold || 0.1;
    this.updateInterval = options.updateInterval || 50;

    // AudioAnalyzer for audio input (always used)
    this.analyzer = new AudioAnalyzer({
      bufferSize: this.bufferSize,
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
      threshold: this.threshold,
    });

    // Detector instances
    this.hybridDetector = null;
    this.crepeDetector = null;
    this.activeDetector = null;

    // State
    this.isRunning = false;
    this.intervalId = null;
    this.currentPitch = null;
    this.detectorReady = false;
  }

  /**
   * Initialize the pitch detector
   * @returns {Promise<void>}
   */
  async _initializeDetector() {
    const sampleRate = this.analyzer.getSampleRate();

    if (this.detectorType === DetectorType.CREPE) {
      try {
        if (this.onModelLoading) {
          this.onModelLoading();
        }

        this.crepeDetector = new TFCREPEDetector({
          sampleRate,
          minFrequency: this.minFrequency,
          maxFrequency: this.maxFrequency,
          onModelLoading: this.onModelLoading,
          onModelReady: this.onModelReady,
          onModelError: this.onModelError,
        });

        await this.crepeDetector.initialize();
        this.activeDetector = this.crepeDetector;

        console.log('CREPE detector initialized (TensorFlow.js)');

        if (this.onModelReady) {
          this.onModelReady();
        }
      } catch (error) {
        console.warn('CREPE initialization failed:', error.message);

        if (this.onModelError) {
          this.onModelError(error);
        }

        if (this.fallbackEnabled) {
          console.log('Falling back to hybrid detector');
          await this._initializeHybridDetector(sampleRate);
        } else {
          throw error;
        }
      }
    } else {
      await this._initializeHybridDetector(sampleRate);
    }

    this.detectorReady = true;
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
      threshold: this.threshold * 0.05, // Convert to RMS threshold
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
      this.currentPitch = {
        frequency,
        confidence,
        ...noteInfo,
        timestamp: Date.now(),
        detector: this.activeDetector?.name || 'analyzer',
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
   * Switch to a different detector
   * @param {string} detectorType - 'hybrid' or 'crepe'
   * @returns {Promise<void>}
   */
  async switchDetector(detectorType) {
    if (detectorType === this.detectorType) return;

    this.detectorType = detectorType;
    this.detectorReady = false;

    if (this.isRunning) {
      // Re-initialize with new detector
      await this._initializeDetector();
    }
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
      crepeReady: this.crepeDetector?.isReady ?? false,
      crepeState: this.crepeDetector?.loadingState ?? TFCREPEState.UNLOADED,
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

    if (this.crepeDetector) {
      this.crepeDetector.dispose();
      this.crepeDetector = null;
    }

    this.activeDetector = null;
    this.detectorReady = false;
  }
}
