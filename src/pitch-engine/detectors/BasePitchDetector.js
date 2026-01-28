/**
 * BasePitchDetector - Abstract interface for pitch detectors
 * All pitch detectors should extend this class
 */

export class BasePitchDetector {
  /**
   * @param {object} options
   * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
   * @param {number} options.minFrequency - Minimum frequency to detect (default: 60)
   * @param {number} options.maxFrequency - Maximum frequency to detect (default: 1200)
   */
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 44100;
    this.minFrequency = options.minFrequency || 60;
    this.maxFrequency = options.maxFrequency || 1200;

    this._initialized = false;
    this._name = 'base';
  }

  /**
   * Get detector name
   * @returns {string} Detector name
   */
  get name() {
    return this._name;
  }

  /**
   * Check if detector is initialized and ready
   * @returns {boolean} True if ready
   */
  get isReady() {
    return this._initialized;
  }

  /**
   * Initialize the detector
   * Override in subclass if async initialization is needed
   * @returns {Promise<void>}
   */
  async initialize() {
    this._initialized = true;
  }

  /**
   * Detect pitch from audio buffer
   * Must be overridden by subclass
   * @param {Float32Array} buffer - Audio buffer (single frame)
   * @returns {{frequency: number|null, confidence: number, timestamp: number}}
   */
  detect(buffer) {
    throw new Error('detect() must be implemented by subclass');
  }

  /**
   * Clean up resources
   * Override in subclass if cleanup is needed
   */
  dispose() {
    this._initialized = false;
  }

  /**
   * Get detector info for debugging
   * @returns {object} Detector info
   */
  getInfo() {
    return {
      name: this._name,
      sampleRate: this.sampleRate,
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
      isReady: this.isReady,
    };
  }

  /**
   * Validate frequency is within bounds
   * @protected
   * @param {number} frequency - Frequency to validate
   * @returns {number|null} Frequency if valid, null otherwise
   */
  _validateFrequency(frequency) {
    if (frequency === null || frequency === undefined) return null;
    if (frequency < this.minFrequency || frequency > this.maxFrequency) return null;
    return frequency;
  }

  /**
   * Calculate RMS of buffer
   * @protected
   * @param {Float32Array} buffer - Audio buffer
   * @returns {number} RMS value
   */
  _calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }
}
