/**
 * AudioAnalyzer - Handles audio input and frequency analysis
 * Uses YIN algorithm via pitchfinder library for robust pitch detection
 */

import Pitchfinder from 'pitchfinder';

export class AudioAnalyzer {
  constructor(options = {}) {
    this.bufferSize = options.bufferSize || 2048;
    this.minFrequency = options.minFrequency || 60;   // ~B1
    this.maxFrequency = options.maxFrequency || 1200; // ~D#6
    this.threshold = options.threshold || 0.005; // RMS threshold (very sensitive)

    // AGC (Automatic Gain Control) settings
    this.targetRMS = options.targetRMS || 0.12; // Target RMS level for normalization (increased from 0.08)
    this.minGain = options.minGain || 1.0; // Minimum gain (no reduction)
    this.maxGain = options.maxGain || 12.0; // Maximum gain (12x amplification, up from 8x)
    this.agcSpeed = options.agcSpeed || 0.15; // How fast AGC adapts (0-1, higher = faster)
    this.currentGain = 3.5; // Starting gain (increased from 2.5)

    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.gainNode = null;
    this.scriptProcessor = null;

    this.isActive = false;

    // Debug info
    this.lastRMS = 0;
    this.lastCorrelation = 0;

    // Initialize YIN pitch detector
    this.detectPitchYIN = Pitchfinder.YIN({
      sampleRate: 44100, // Will be updated when audio context is created
      threshold: 0.15, // YIN threshold (0.1-0.15 is good for singing)
    });
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

      // Create gain node for automatic gain control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.currentGain;

      // Connect: microphone → gain → analyser
      this.microphone.connect(this.gainNode);
      this.gainNode.connect(this.analyser);

      // Reinitialize YIN with actual sample rate
      this.detectPitchYIN = Pitchfinder.YIN({
        sampleRate: this.audioContext.sampleRate,
        threshold: 0.15, // YIN threshold (0.1-0.15 is good for singing)
      });

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
   * Detect pitch using YIN algorithm
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
      return null;
    }

    // Use YIN algorithm for pitch detection
    const frequency = this.detectPitchYIN(buffer);

    // YIN returns null if no pitch detected
    if (!frequency) {
      return null;
    }

    // Validate frequency is in expected range
    if (frequency < this.minFrequency || frequency > this.maxFrequency) {
      return null;
    }

    return frequency;
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
    };
  }
}
