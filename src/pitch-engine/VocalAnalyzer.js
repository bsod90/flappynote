/**
 * VocalAnalyzer - Analyzes additional vocal parameters beyond pitch
 * Computes: vibrato, pitch stability, spectral centroid (brightness), HNR (breathiness)
 */

export class VocalAnalyzer {
  constructor(options = {}) {
    // Vibrato detection settings
    this.vibratoWindowSize = options.vibratoWindowSize || 15; // ~450ms at 30ms intervals
    this.vibratoMinRate = options.vibratoMinRate || 4; // Hz (cycles per second)
    this.vibratoMaxRate = options.vibratoMaxRate || 8; // Hz
    this.vibratoMinExtent = options.vibratoMinExtent || 15; // cents - minimum to count as vibrato

    // Pitch stability settings
    this.stabilityWindowSize = options.stabilityWindowSize || 10; // samples for stability calc

    // Analysis history
    this.pitchHistory = []; // Recent pitch values for vibrato detection
    this.maxHistorySize = 30; // Keep ~1 second of history

    // FFT settings for spectral analysis
    this.fftSize = options.fftSize || 2048;

    // Cached analysis results
    this.lastVibrato = { detected: false, rate: 0, extent: 0 };
    this.lastStability = 1.0; // 0-1, higher is more stable
    this.lastSpectralCentroid = 0.5; // 0-1 normalized brightness
    this.lastHNR = 1.0; // 0-1, higher is cleaner (less breathy)
  }

  /**
   * Analyze all vocal parameters from current audio state
   * @param {Float32Array} audioBuffer - Time-domain audio buffer
   * @param {number} frequency - Detected pitch frequency
   * @param {number} sampleRate - Audio sample rate
   * @param {AnalyserNode} analyser - Web Audio AnalyserNode for FFT
   * @returns {object} Analysis results
   */
  analyze(audioBuffer, frequency, sampleRate, analyser) {
    // Update pitch history for vibrato detection
    if (frequency) {
      this.pitchHistory.push({
        frequency,
        timestamp: Date.now()
      });

      // Trim history
      while (this.pitchHistory.length > this.maxHistorySize) {
        this.pitchHistory.shift();
      }
    }

    // Analyze vibrato from pitch history
    this.lastVibrato = this.analyzeVibrato();

    // Analyze pitch stability
    this.lastStability = this.analyzePitchStability();

    // Analyze spectral characteristics from FFT
    if (analyser && audioBuffer) {
      const fftData = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(fftData);

      this.lastSpectralCentroid = this.analyzeSpectralCentroid(fftData, sampleRate, analyser.fftSize);
      this.lastHNR = this.analyzeHNR(fftData, frequency, sampleRate, analyser.fftSize);
    }

    return {
      vibrato: this.lastVibrato,
      stability: this.lastStability,
      spectralCentroid: this.lastSpectralCentroid,
      hnr: this.lastHNR,
    };
  }

  /**
   * Analyze vibrato from pitch history
   * Detects periodic oscillation in pitch
   * @returns {object} { detected, rate (Hz), extent (cents) }
   */
  analyzeVibrato() {
    if (this.pitchHistory.length < this.vibratoWindowSize) {
      return { detected: false, rate: 0, extent: 0 };
    }

    // Get recent pitches
    const recentPitches = this.pitchHistory.slice(-this.vibratoWindowSize);

    // Convert to cents from mean
    const meanFreq = recentPitches.reduce((sum, p) => sum + p.frequency, 0) / recentPitches.length;
    const centsFromMean = recentPitches.map(p => 1200 * Math.log2(p.frequency / meanFreq));

    // Calculate extent (peak-to-peak in cents)
    const minCents = Math.min(...centsFromMean);
    const maxCents = Math.max(...centsFromMean);
    const extent = maxCents - minCents;

    // If extent is too small, no vibrato
    if (extent < this.vibratoMinExtent) {
      return { detected: false, rate: 0, extent: 0 };
    }

    // Count zero crossings to estimate frequency
    let zeroCrossings = 0;
    for (let i = 1; i < centsFromMean.length; i++) {
      if ((centsFromMean[i - 1] >= 0 && centsFromMean[i] < 0) ||
          (centsFromMean[i - 1] < 0 && centsFromMean[i] >= 0)) {
        zeroCrossings++;
      }
    }

    // Calculate time span
    const timeSpan = (recentPitches[recentPitches.length - 1].timestamp - recentPitches[0].timestamp) / 1000;
    if (timeSpan <= 0) {
      return { detected: false, rate: 0, extent: 0 };
    }

    // Estimate vibrato rate (zero crossings / 2 = cycles)
    const rate = (zeroCrossings / 2) / timeSpan;

    // Check if rate is in typical vibrato range
    const detected = rate >= this.vibratoMinRate && rate <= this.vibratoMaxRate && extent >= this.vibratoMinExtent;

    return {
      detected,
      rate: detected ? rate : 0,
      extent: detected ? extent : 0,
    };
  }

  /**
   * Analyze pitch stability
   * Returns a value 0-1 where 1 is perfectly stable
   * @returns {number} Stability score 0-1
   */
  analyzePitchStability() {
    if (this.pitchHistory.length < this.stabilityWindowSize) {
      return 1.0;
    }

    // Get recent pitches
    const recentPitches = this.pitchHistory.slice(-this.stabilityWindowSize);

    // Convert to cents from first pitch
    const baseFreq = recentPitches[0].frequency;
    const centsValues = recentPitches.map(p => 1200 * Math.log2(p.frequency / baseFreq));

    // Calculate standard deviation in cents
    const mean = centsValues.reduce((sum, c) => sum + c, 0) / centsValues.length;
    const variance = centsValues.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / centsValues.length;
    const stdDev = Math.sqrt(variance);

    // Convert to stability score (inverse of deviation)
    // 0 cents deviation = 1.0 stability
    // 50 cents deviation = ~0.5 stability
    // 100+ cents deviation = ~0 stability
    const stability = Math.max(0, 1 - (stdDev / 100));

    return stability;
  }

  /**
   * Analyze spectral centroid (brightness)
   * Higher values = brighter/more harmonics
   * @param {Float32Array} fftData - FFT magnitude data in dB
   * @param {number} sampleRate - Audio sample rate
   * @param {number} fftSize - FFT size
   * @returns {number} Normalized brightness 0-1
   */
  analyzeSpectralCentroid(fftData, sampleRate, fftSize) {
    if (!fftData || fftData.length === 0) {
      return this.lastSpectralCentroid; // Return smoothed value
    }

    const binFrequency = sampleRate / fftSize;

    // Only analyze voice-relevant frequency range (100Hz - 5000Hz)
    const minFreq = 100;
    const maxFreq = 5000;
    const minBin = Math.floor(minFreq / binFrequency);
    const maxBin = Math.min(fftData.length - 1, Math.ceil(maxFreq / binFrequency));

    // Find the peak magnitude for noise floor reference
    let peakDb = -Infinity;
    for (let i = minBin; i <= maxBin; i++) {
      if (fftData[i] > peakDb) peakDb = fftData[i];
    }

    // Noise floor threshold: ignore bins more than 40dB below peak
    const noiseFloor = peakDb - 40;

    // Convert dB to linear magnitude, only for bins above noise floor
    let totalMagnitude = 0;
    let weightedSum = 0;

    for (let i = minBin; i <= maxBin; i++) {
      if (fftData[i] < noiseFloor) continue;

      // FFT data is in dB, convert to linear
      const linear = Math.pow(10, fftData[i] / 20);
      const frequency = i * binFrequency;

      totalMagnitude += linear;
      weightedSum += frequency * linear;
    }

    if (totalMagnitude === 0) {
      return this.lastSpectralCentroid;
    }

    const centroid = weightedSum / totalMagnitude;

    // Normalize to 0-1 range
    // Typical vocal centroid: 500-2500 Hz for brightness perception
    const minCentroid = 400;
    const maxCentroid = 2500;
    const rawNormalized = Math.max(0, Math.min(1, (centroid - minCentroid) / (maxCentroid - minCentroid)));

    // Apply temporal smoothing to reduce jitter
    const smoothingFactor = 0.3; // Higher = more smoothing
    const smoothed = this.lastSpectralCentroid * smoothingFactor + rawNormalized * (1 - smoothingFactor);

    return smoothed;
  }

  /**
   * Analyze Harmonic-to-Noise Ratio (HNR)
   * Higher values = cleaner/less breathy tone
   * @param {Float32Array} fftData - FFT magnitude data in dB
   * @param {number} fundamentalFreq - Detected fundamental frequency
   * @param {number} sampleRate - Audio sample rate
   * @param {number} fftSize - FFT size
   * @returns {number} HNR score 0-1 (1 = pure tone, 0 = noisy/breathy)
   */
  analyzeHNR(fftData, fundamentalFreq, sampleRate, fftSize) {
    if (!fftData || fftData.length === 0 || !fundamentalFreq) {
      return this.lastHNR; // Return smoothed value
    }

    const binFrequency = sampleRate / fftSize;
    const fundamentalBin = Math.round(fundamentalFreq / binFrequency);

    // Limit analysis to relevant range (up to 8th harmonic or 5kHz)
    const maxAnalysisFreq = Math.min(fundamentalFreq * 10, 5000);
    const maxBin = Math.min(fftData.length - 1, Math.ceil(maxAnalysisFreq / binFrequency));

    // Find peak for noise floor reference
    let peakDb = -Infinity;
    for (let i = 1; i <= maxBin; i++) {
      if (fftData[i] > peakDb) peakDb = fftData[i];
    }
    const noiseFloor = peakDb - 50;

    // Find energy at harmonics vs total energy
    let harmonicEnergy = 0;
    let totalEnergy = 0;
    const numHarmonics = 8; // Check first 8 harmonics
    const binWidth = 2; // Look at ±2 bins around each harmonic

    for (let i = 1; i <= maxBin; i++) {
      if (fftData[i] < noiseFloor) continue;

      const linear = Math.pow(10, fftData[i] / 20);
      const energy = linear * linear;
      totalEnergy += energy;

      // Check if this bin is near a harmonic
      for (let h = 1; h <= numHarmonics; h++) {
        const harmonicBin = fundamentalBin * h;
        if (harmonicBin > maxBin) break;
        if (Math.abs(i - harmonicBin) <= binWidth) {
          harmonicEnergy += energy;
          break;
        }
      }
    }

    if (totalEnergy === 0) {
      return this.lastHNR;
    }

    // HNR as ratio of harmonic to total energy
    const hnrRatio = harmonicEnergy / totalEnergy;

    // Normalize - typical HNR ratios for voice are 0.2-0.8
    const rawNormalized = Math.max(0, Math.min(1, (hnrRatio - 0.1) / 0.7));

    // Apply temporal smoothing
    const smoothingFactor = 0.4;
    const smoothed = this.lastHNR * smoothingFactor + rawNormalized * (1 - smoothingFactor);

    return smoothed;
  }

  /**
   * Clear analysis history (call on silence)
   */
  reset() {
    this.pitchHistory = [];
    this.lastVibrato = { detected: false, rate: 0, extent: 0 };
    this.lastStability = 1.0;
    this.lastSpectralCentroid = 0.5;
    this.lastHNR = 1.0;
  }

  /**
   * Get current analysis results
   * @returns {object} Current analysis state
   */
  getAnalysis() {
    return {
      vibrato: this.lastVibrato,
      stability: this.lastStability,
      spectralCentroid: this.lastSpectralCentroid,
      hnr: this.lastHNR,
    };
  }
}
