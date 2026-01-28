/**
 * PitchContext - Shared pitch detection with subscription pattern
 * Wraps PitchDetector and allows multiple tools to subscribe to pitch updates
 */

import { PitchDetector, DetectorType } from '../pitch-engine/index.js';

export class PitchContext {
  constructor(options = {}) {
    this.options = {
      updateInterval: 30,
      threshold: 0.0001,
      bufferSize: 8192,
      detector: DetectorType.CREPE, // Use CREPE detector (TensorFlow.js based)
      ...options,
    };

    this.pitchDetector = null;
    this.subscribers = new Set();
    this.currentPitch = null;
    this.isRunning = false;

    // Model loading callbacks
    this.onModelLoading = options.onModelLoading || null;
    this.onModelReady = options.onModelReady || null;
    this.onModelError = options.onModelError || null;
  }

  /**
   * Initialize the pitch detector
   */
  initialize() {
    if (this.pitchDetector) return;

    this.pitchDetector = new PitchDetector({
      detector: this.options.detector,
      updateInterval: this.options.updateInterval,
      threshold: this.options.threshold,
      bufferSize: this.options.bufferSize,
      onPitchDetected: (pitchData) => this.handlePitchDetected(pitchData),
      onModelLoading: this.onModelLoading,
      onModelReady: this.onModelReady,
      onModelError: this.onModelError,
    });
  }

  /**
   * Start pitch detection
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) return;

    if (!this.pitchDetector) {
      this.initialize();
    }

    await this.pitchDetector.start();
    this.isRunning = true;
  }

  /**
   * Stop pitch detection
   */
  stop() {
    if (!this.isRunning) return;

    if (this.pitchDetector) {
      this.pitchDetector.stop();
    }
    this.isRunning = false;
    this.currentPitch = null;
  }

  /**
   * Handle pitch detected from detector
   * @param {object|null} pitchData
   */
  handlePitchDetected(pitchData) {
    this.currentPitch = pitchData;
    this.notifySubscribers(pitchData);
  }

  /**
   * Subscribe to pitch updates
   * @param {function} callback - Called with pitchData on each update
   * @returns {function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of pitch update
   * @param {object|null} pitchData
   */
  notifySubscribers(pitchData) {
    this.subscribers.forEach(callback => {
      try {
        callback(pitchData);
      } catch (error) {
        console.error('PitchContext subscriber error:', error);
      }
    });
  }

  /**
   * Get current pitch
   * @returns {object|null}
   */
  getCurrentPitch() {
    return this.currentPitch;
  }

  /**
   * Enable drone noise cancellation
   * @param {number} frequency - Drone frequency to cancel
   */
  enableDroneCancellation(frequency) {
    if (this.pitchDetector) {
      this.pitchDetector.enableDroneCancellation(frequency);
    }
  }

  /**
   * Disable drone noise cancellation
   */
  disableDroneCancellation() {
    if (this.pitchDetector) {
      this.pitchDetector.disableDroneCancellation();
    }
  }

  /**
   * Get debug info from pitch detector
   * @returns {object}
   */
  getDebugInfo() {
    if (this.pitchDetector) {
      return this.pitchDetector.getDebugInfo();
    }
    return {};
  }

  /**
   * Get detector info
   * @returns {object}
   */
  getDetectorInfo() {
    if (this.pitchDetector) {
      return this.pitchDetector.getDetectorInfo();
    }
    return { type: 'none', ready: false };
  }

  /**
   * Check if pitch detection is running
   * @returns {boolean}
   */
  getIsRunning() {
    return this.isRunning;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stop();
    if (this.pitchDetector) {
      this.pitchDetector.dispose();
      this.pitchDetector = null;
    }
    this.subscribers.clear();
  }
}
