/**
 * AudioAnalyzer - Handles audio input and frequency analysis
 * Uses Pitchy (MPM algorithm) for improved pitch detection with harmonics-rich voices
 */

import Pitchfinder from 'pitchfinder';
import {PitchDetector as PitchyDetector} from 'pitchy';

export class AudioAnalyzer {
  constructor(options = {}) {
    this.bufferSize = options.bufferSize || 2048;
    this.minFrequency = options.minFrequency || 60;   // ~B1
    this.maxFrequency = options.maxFrequency || 1200; // ~D#6
    this.threshold = options.threshold || 0.005; // RMS threshold (very sensitive)

    // AGC (Automatic Gain Control) settings
    this.targetRMS = options.targetRMS || 0.12; // Target RMS level for normalization
    this.minGain = options.minGain || 1.0; // Minimum gain (no reduction)
    this.maxGain = options.maxGain || 12.0; // Maximum gain (12x amplification)
    this.agcSpeed = options.agcSpeed || 0.15; // How fast AGC adapts (0-1, higher = faster)
    this.currentGain = 3.5; // Starting gain

    // Temporal smoothing (median filter)
    this.pitchHistorySize = options.pitchHistorySize || 5; // Number of recent pitches to track
    this.pitchHistory = []; // Rolling window of recent pitch detections

    // Drone noise cancellation
    this.droneFrequencies = null; // Array of drone frequencies to filter out
    this.droneNotchFilters = []; // Notch filters for drone cancellation

    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.gainNode = null;
    this.highPassFilter = null; // High-pass filter to remove low frequencies
    this.scriptProcessor = null;

    this.isActive = false;

    // Debug info
    this.lastRMS = 0;
    this.rawFrequency = null; // Store raw frequency before smoothing
    this.lastClarity = 0; // Pitchy clarity score (0-1, higher is better)

    // Pitch detectors - use both YIN (fallback) and Pitchy (MPM - primary)
    this.detectPitchYIN = null; // YIN as fallback
    this.detectPitchMPM = null; // Pitchy MPM detector
  }

  /**
   * Initialize and start audio capture
   * @returns {Promise<void>}
   */
  async start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        }
      });

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.bufferSize * 2;

      this.microphone = this.audioContext.createMediaStreamSource(stream);

      // Create high-pass filter at 180Hz to remove low frequencies
      // This helps eliminate rumble and reduces drone interference
      this.highPassFilter = this.audioContext.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.value = 180; // Cut off below 180Hz
      this.highPassFilter.Q.value = 0.7; // Gentle slope

      // Create gain node for automatic gain control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.currentGain;

      // Connect: microphone → high-pass filter → gain → analyser
      this.microphone.connect(this.highPassFilter);
      this.highPassFilter.connect(this.gainNode);
      this.gainNode.connect(this.analyser);

      // Initialize pitch detectors
      // Pitchy (MPM) - primary detector, better at handling harmonics
      // Use Float32Array factory method with buffer size
      this.detectPitchMPM = PitchyDetector.forFloat32Array(this.bufferSize);

      // YIN - fallback detector for when MPM is uncertain
      this.detectPitchYIN = Pitchfinder.YIN({
        sampleRate: this.audioContext.sampleRate,
        threshold: 0.15, // Standard threshold
      });

      console.log('Pitch detectors initialized: MPM (primary) + YIN (fallback)');

      this.isActive = true;
    } catch (error) {
      throw new Error(`Failed to access microphone: ${error.message}`);
    }
  }

  /**
   * Stop audio capture and clean up resources
   */
  stop() {
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.highPassFilter) {
      this.highPassFilter.disconnect();
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    if (this.analyser) {
      this.analyser.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.isActive = false;

    // Clear pitch history
    this.pitchHistory = [];
    this.rawFrequency = null;
  }

  /**
   * Get current audio buffer for analysis
   * @returns {Float32Array} Time-domain audio data
   */
  getAudioBuffer() {
    if (!this.analyser) return null;

    const buffer = new Float32Array(this.bufferSize);
    this.analyser.getFloatTimeDomainData(buffer);
    return buffer;
  }

  /**
   * Detect pitch using hybrid MPM + YIN approach with clarity-based selection
   * @param {Float32Array} buffer - Audio buffer
   * @returns {number|null} Detected frequency in Hz, or null if no pitch detected
   */
  detectPitch(buffer) {
    if (!buffer || buffer.length === 0) return null;

    // Check if signal is strong enough
    const rms = this._calculateRMS(buffer);
    this.lastRMS = rms;

    // Update automatic gain control
    this._updateAGC(rms);

    if (rms < this.threshold) {
      // Clear history when no signal detected
      this.pitchHistory = [];
      this.rawFrequency = null;
      this.lastClarity = 0;
      return null;
    }

    // Try MPM (Pitchy) first - better at handling harmonics
    let rawFrequency = null;
    let clarity = 0;

    if (this.detectPitchMPM) {
      // Pitchy returns [pitch, clarity] where clarity is 0-1 (1 is best)
      // findPitch(input, sampleRate) - pass the sample rate as second param
      const [pitch, pitchClarity] = this.detectPitchMPM.findPitch(buffer, this.audioContext.sampleRate);

      // Only use MPM result if clarity is good and pitch is valid
      const MIN_CLARITY = 0.85; // High clarity threshold for MPM

      if (pitch && pitchClarity >= MIN_CLARITY) {
        rawFrequency = pitch;
        clarity = pitchClarity;
      }
    }

    // If MPM failed or low clarity, fall back to YIN
    if (!rawFrequency && this.detectPitchYIN) {
      const yinFreq = this.detectPitchYIN(buffer);
      if (yinFreq) {
        rawFrequency = yinFreq;
        clarity = 0.7; // Estimate YIN clarity as moderate
      }
    }

    // No valid pitch detected by either algorithm
    if (!rawFrequency) {
      this.pitchHistory = [];
      this.rawFrequency = null;
      this.lastClarity = 0;
      return null;
    }

    // Validate frequency is in expected range
    if (rawFrequency < this.minFrequency || rawFrequency > this.maxFrequency) {
      this.pitchHistory = [];
      this.rawFrequency = null;
      this.lastClarity = 0;
      return null;
    }

    // Store raw frequency and clarity for debug
    this.rawFrequency = rawFrequency;
    this.lastClarity = clarity;

    // Apply temporal smoothing (median filter)
    return this._applyTemporalSmoothing(rawFrequency);
  }

  /**
   * Apply temporal smoothing using median filter
   * Reduces pitch jumping by taking median of recent detections
   * @private
   * @param {number} frequency - Raw detected frequency
   * @returns {number} Smoothed frequency
   */
  _applyTemporalSmoothing(frequency) {
    // Add new frequency to history
    this.pitchHistory.push(frequency);

    // Keep history at configured size
    while (this.pitchHistory.length > this.pitchHistorySize) {
      this.pitchHistory.shift(); // Remove oldest
    }

    // If we don't have enough history yet, return raw frequency
    if (this.pitchHistory.length < 3) {
      return frequency;
    }

    // Calculate median of pitch history
    const sorted = [...this.pitchHistory].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    // Return median value
    if (sorted.length % 2 === 0) {
      // Even number: average of two middle values
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      // Odd number: middle value
      return sorted[mid];
    }
  }

  /**
   * Update automatic gain control based on input level
   * Adjusts gain to normalize audio to target RMS level
   * @private
   */
  _updateAGC(rms) {
    if (!this.gainNode || rms < 0.001) return; // Don't adjust for silence

    // Calculate desired gain to reach target RMS
    // If RMS is too low, increase gain. If too high, decrease gain.
    const desiredGain = (this.targetRMS / rms) * this.currentGain;

    // Clamp to min/max gain limits
    const clampedGain = Math.max(this.minGain, Math.min(this.maxGain, desiredGain));

    // Smoothly adjust current gain (prevents sudden jumps)
    this.currentGain += (clampedGain - this.currentGain) * this.agcSpeed;

    // Update the actual gain node
    this.gainNode.gain.value = this.currentGain;
  }

  /**
   * Calculate RMS (Root Mean Square) of buffer
   * @private
   */
  _calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Get sample rate
   * @returns {number} Sample rate in Hz
   */
  getSampleRate() {
    return this.audioContext ? this.audioContext.sampleRate : 44100;
  }

  /**
   * Enable drone noise cancellation
   * Creates notch filters at drone frequency and harmonics
   * @param {number} rootFrequency - Root frequency of the drone
   */
  enableDroneCancellation(rootFrequency) {
    if (!this.audioContext || !this.highPassFilter || !this.gainNode) return;

    // First, disable any existing drone cancellation
    this.disableDroneCancellation();

    // Define the drone frequencies we want to filter out
    // Include all drone harmonics: root, 1.5x (fifth), 2x (octave), 4x (2 octaves)
    this.droneFrequencies = [
      rootFrequency,        // Fundamental
      rootFrequency * 1.5,  // Perfect fifth (Sol)
      rootFrequency * 2,    // Octave above
      rootFrequency * 4,    // 2 octaves above
    ];

    // Create notch filters for each drone frequency
    const lastNode = this.highPassFilter; // Start from high-pass filter
    let currentNode = lastNode;

    this.droneFrequencies.forEach((freq, index) => {
      const notchFilter = this.audioContext.createBiquadFilter();
      notchFilter.type = 'notch';
      notchFilter.frequency.value = freq;
      notchFilter.Q.value = 15; // Very narrow, surgical notch (increased from 10)

      // Chain the filters: previous node → notch filter
      currentNode.disconnect();
      currentNode.connect(notchFilter);

      if (index === this.droneFrequencies.length - 1) {
        // Last filter connects to gain node
        notchFilter.connect(this.gainNode);
      }

      currentNode = notchFilter;
      this.droneNotchFilters.push(notchFilter);
    });

    console.log(`Drone cancellation enabled at ${rootFrequency.toFixed(1)}Hz and harmonics (${this.droneFrequencies.length} notches)`);
  }

  /**
   * Disable drone noise cancellation
   * Removes all notch filters
   */
  disableDroneCancellation() {
    if (this.droneNotchFilters.length === 0) return;

    // Disconnect all notch filters
    this.droneNotchFilters.forEach(filter => {
      try {
        filter.disconnect();
      } catch (e) {
        // Filter may already be disconnected
      }
    });

    // Reconnect high-pass filter directly to gain node
    if (this.highPassFilter && this.gainNode) {
      try {
        this.highPassFilter.disconnect();
        this.highPassFilter.connect(this.gainNode);
      } catch (e) {
        // May already be connected
      }
    }

    this.droneNotchFilters = [];
    this.droneFrequencies = null;
    console.log('Drone cancellation disabled');
  }

  /**
   * Get debug information
   * @returns {object} Debug stats
   */
  getDebugInfo() {
    return {
      rms: this.lastRMS,
      threshold: this.threshold,
      sampleRate: this.getSampleRate(),
      isActive: this.isActive,
      currentGain: this.currentGain,
      targetRMS: this.targetRMS,
      rawFrequency: this.rawFrequency,
      pitchHistorySize: this.pitchHistory.length,
      droneCancellationActive: this.droneNotchFilters.length > 0,
      droneFrequencies: this.droneFrequencies,
      clarity: this.lastClarity,
      algorithm: this.lastClarity > 0.85 ? 'MPM' : (this.lastClarity > 0 ? 'YIN' : 'none'),
    };
  }
}
