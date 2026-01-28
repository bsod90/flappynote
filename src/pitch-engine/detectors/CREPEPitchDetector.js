/**
 * CREPEPitchDetector - ML-based pitch detection using CREPE via ml5.js
 * CREPE is a deep learning model for monophonic pitch estimation
 */

import { BasePitchDetector } from './BasePitchDetector.js';

/**
 * Loading states for the CREPE model
 */
export const CREPEState = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

export class CREPEPitchDetector extends BasePitchDetector {
  /**
   * @param {object} options
   * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
   * @param {number} options.minFrequency - Minimum frequency to detect (default: 60)
   * @param {number} options.maxFrequency - Maximum frequency to detect (default: 1200)
   * @param {string} options.modelSize - CREPE model size: 'tiny', 'small', 'medium', 'large', 'full' (default: 'tiny')
   * @param {function} options.onModelLoading - Callback when model starts loading
   * @param {function} options.onModelReady - Callback when model is ready
   * @param {function} options.onModelError - Callback when model fails to load
   */
  constructor(options = {}) {
    super(options);

    this._name = 'crepe';
    this.modelSize = options.modelSize || 'tiny';

    // Callbacks
    this.onModelLoading = options.onModelLoading || null;
    this.onModelReady = options.onModelReady || null;
    this.onModelError = options.onModelError || null;

    // State
    this.state = CREPEState.UNLOADED;
    this.ml5 = null;
    this.pitchModel = null;
    this.audioContext = null;
    this.lastError = null;

    // Detection state
    this.lastPitch = null;
    this.lastConfidence = 0;
  }

  /**
   * Get current loading state
   * @returns {string} Current state
   */
  get loadingState() {
    return this.state;
  }

  /**
   * Check if ready
   * @returns {boolean} True if model is loaded and ready
   */
  get isReady() {
    return this.state === CREPEState.READY;
  }

  /**
   * Initialize the CREPE model
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.state === CREPEState.READY) {
      return; // Already initialized
    }

    if (this.state === CREPEState.LOADING) {
      // Wait for existing load to complete
      return this._waitForReady();
    }

    this.state = CREPEState.LOADING;
    if (this.onModelLoading) {
      this.onModelLoading();
    }

    try {
      // Check if ml5 is available (loaded via CDN)
      if (typeof window !== 'undefined' && window.ml5) {
        this.ml5 = window.ml5;
      } else if (typeof globalThis !== 'undefined' && globalThis.ml5) {
        this.ml5 = globalThis.ml5;
      } else {
        throw new Error('ml5.js is not loaded. Include ml5.js via CDN before using CREPEPitchDetector.');
      }

      // Create audio context for CREPE
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate,
      });

      // Load CREPE pitch detection model
      await this._loadModel();

      this.state = CREPEState.READY;
      this._initialized = true;

      if (this.onModelReady) {
        this.onModelReady();
      }
    } catch (error) {
      this.state = CREPEState.ERROR;
      this.lastError = error;

      if (this.onModelError) {
        this.onModelError(error);
      }

      throw error;
    }
  }

  /**
   * Load the CREPE model
   * @private
   */
  async _loadModel() {
    return new Promise((resolve, reject) => {
      // ml5.js pitch detection uses CREPE under the hood
      // We need a MediaStream or AudioContext for initialization
      // For buffer-based detection, we'll create a dummy setup

      try {
        // Create oscillator for initial setup
        const oscillator = this.audioContext.createOscillator();
        oscillator.frequency.value = 440;
        oscillator.connect(this.audioContext.destination);

        // ml5 pitch detection
        this.pitchModel = this.ml5.pitchDetection(
          `/models/crepe-${this.modelSize}`, // Model path (will fallback to CDN)
          this.audioContext,
          oscillator,
          () => {
            oscillator.disconnect();
            resolve();
          }
        );
      } catch (error) {
        // If local model fails, try using ml5's built-in model loading
        try {
          // Alternative: use ml5's default CREPE loading
          this._useAlternativeLoading(resolve, reject);
        } catch (altError) {
          reject(error);
        }
      }
    });
  }

  /**
   * Alternative model loading approach
   * @private
   */
  _useAlternativeLoading(resolve, reject) {
    // Create a silent audio source for initialization
    const bufferSize = 1024;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.sampleRate);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Use a script processor for detection (deprecated but widely supported)
    const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    source.connect(processor);
    processor.connect(this.audioContext.destination);

    try {
      this.pitchModel = this.ml5.pitchDetection(
        'CREPE',
        this.audioContext,
        source,
        () => {
          processor.disconnect();
          source.disconnect();
          resolve();
        }
      );
    } catch (error) {
      reject(error);
    }
  }

  /**
   * Wait for model to be ready
   * @private
   */
  _waitForReady() {
    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (this.state === CREPEState.READY) {
          resolve();
        } else if (this.state === CREPEState.ERROR) {
          reject(this.lastError);
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }

  /**
   * Detect pitch from audio buffer
   * @param {Float32Array} buffer - Audio buffer
   * @returns {{frequency: number|null, confidence: number, timestamp: number}}
   */
  detect(buffer) {
    const timestamp = Date.now();

    if (!this.isReady) {
      return { frequency: null, confidence: 0, timestamp };
    }

    // Check for silence
    const rms = this._calculateRMS(buffer);
    if (rms < 0.005) {
      return { frequency: null, confidence: 0, timestamp };
    }

    // For real-time detection, CREPE uses callback-based API
    // For buffer-based detection, we need to use the internal model
    // This is a synchronous approximation - in production, use streaming API

    if (this.pitchModel && typeof this.pitchModel.getPitch === 'function') {
      // Use the async pitch getter if available
      // Note: This returns a Promise, but we need sync for the interface
      // In practice, use the streaming detection mode

      // Return last known pitch (updated asynchronously)
      return {
        frequency: this._validateFrequency(this.lastPitch),
        confidence: this.lastConfidence,
        timestamp,
      };
    }

    // Fallback: buffer-based detection not fully supported
    // CREPE is designed for streaming audio
    return {
      frequency: null,
      confidence: 0,
      timestamp,
      warning: 'CREPE requires streaming audio. Use startStream() instead.',
    };
  }

  /**
   * Start streaming pitch detection from an audio source
   * @param {MediaStream|MediaStreamTrack} audioSource - Audio source
   * @param {function} onPitch - Callback: (frequency, confidence, timestamp) => void
   * @returns {function} Stop function
   */
  startStream(audioSource, onPitch) {
    if (!this.isReady) {
      throw new Error('Detector not ready. Call initialize() first.');
    }

    const source = this.audioContext.createMediaStreamSource(
      audioSource instanceof MediaStream ? audioSource : new MediaStream([audioSource])
    );

    // Connect to ml5 pitch detection
    if (this.pitchModel) {
      const detectLoop = () => {
        if (!this._initialized) return;

        this.pitchModel.getPitch((error, frequency) => {
          if (error) {
            console.error('CREPE detection error:', error);
            return;
          }

          const confidence = frequency ? 0.9 : 0; // CREPE doesn't expose confidence directly
          this.lastPitch = frequency;
          this.lastConfidence = confidence;

          if (onPitch) {
            onPitch(
              this._validateFrequency(frequency),
              confidence,
              Date.now()
            );
          }

          // Continue detection loop
          if (this._initialized) {
            requestAnimationFrame(detectLoop);
          }
        });
      };

      detectLoop();
    }

    // Return stop function
    return () => {
      source.disconnect();
    };
  }

  /**
   * Get detector info
   * @returns {object} Detector info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      modelSize: this.modelSize,
      state: this.state,
      lastError: this.lastError?.message ?? null,
      hasML5: this.ml5 !== null,
    };
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.pitchModel = null;
    this.ml5 = null;
    this.audioContext = null;
    this.state = CREPEState.UNLOADED;
    this.lastPitch = null;
    this.lastConfidence = 0;

    super.dispose();
  }
}
