/**
 * OnsetDetector - Auto-segment audio recordings into individual notes
 * Uses energy-based onset detection with adaptive thresholding and spectral flux
 */

export class OnsetDetector {
  /**
   * @param {object} options
   * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
   * @param {number} options.hopSize - Hop size in samples (default: 512)
   * @param {number} options.frameSize - Frame size in samples (default: 2048)
   * @param {number} options.energyThreshold - Minimum energy threshold (default: 0.01)
   * @param {number} options.onsetThreshold - Onset detection threshold multiplier (default: 1.5)
   * @param {number} options.minNoteDuration - Minimum note duration in seconds (default: 0.1)
   * @param {number} options.minSilenceDuration - Minimum silence between notes in seconds (default: 0.05)
   */
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 44100;
    this.hopSize = options.hopSize || 512;
    this.frameSize = options.frameSize || 2048;
    this.energyThreshold = options.energyThreshold || 0.01;
    this.onsetThreshold = options.onsetThreshold || 1.5;
    this.minNoteDuration = options.minNoteDuration || 0.1;
    this.minSilenceDuration = options.minSilenceDuration || 0.05;
  }

  /**
   * Detect note onsets and offsets in audio buffer
   * @param {Float32Array} buffer - Audio buffer
   * @returns {Array<{startTime, endTime, startSample, endSample}>} Detected notes
   */
  detectNotes(buffer) {
    // Handle buffers too short for analysis
    if (buffer.length < this.frameSize) {
      return [];
    }

    // Calculate energy envelope
    const energyEnvelope = this._calculateEnergyEnvelope(buffer);

    // Calculate spectral flux for more accurate onset detection
    const spectralFlux = this._calculateSpectralFlux(buffer);

    // Combine energy and spectral flux
    const onsetFunction = this._combineOnsetFunctions(energyEnvelope, spectralFlux);

    // Find onset peaks using adaptive thresholding
    const onsets = this._findOnsets(onsetFunction);

    // Find corresponding offsets
    const notes = this._findNoteRegions(onsets, energyEnvelope);

    // Filter by minimum duration
    return this._filterByDuration(notes);
  }

  /**
   * Calculate RMS energy envelope
   * @private
   */
  _calculateEnergyEnvelope(buffer) {
    const numFrames = Math.floor((buffer.length - this.frameSize) / this.hopSize) + 1;
    const envelope = new Float32Array(numFrames);

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopSize;
      const end = Math.min(start + this.frameSize, buffer.length);

      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += buffer[j] * buffer[j];
      }
      envelope[i] = Math.sqrt(sum / (end - start));
    }

    return envelope;
  }

  /**
   * Calculate spectral flux (half-wave rectified)
   * Spectral flux measures the change in spectral content between frames
   * @private
   */
  _calculateSpectralFlux(buffer) {
    const numFrames = Math.floor((buffer.length - this.frameSize) / this.hopSize) + 1;
    const flux = new Float32Array(numFrames);

    // Simple spectral flux using magnitude differences
    let prevMagnitudes = null;

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopSize;
      const frame = buffer.slice(start, start + this.frameSize);

      // Calculate magnitude spectrum using simple DFT for low frequencies
      const magnitudes = this._calculateMagnitudeSpectrum(frame);

      if (prevMagnitudes) {
        // Half-wave rectified spectral flux
        let fluxSum = 0;
        for (let j = 0; j < magnitudes.length; j++) {
          const diff = magnitudes[j] - prevMagnitudes[j];
          if (diff > 0) {
            fluxSum += diff;
          }
        }
        flux[i] = fluxSum;
      }

      prevMagnitudes = magnitudes;
    }

    return flux;
  }

  /**
   * Calculate magnitude spectrum using simple FFT approximation
   * @private
   */
  _calculateMagnitudeSpectrum(frame) {
    // Use subset of frequency bins for efficiency
    const numBins = 64;
    const magnitudes = new Float32Array(numBins);

    for (let k = 0; k < numBins; k++) {
      let real = 0;
      let imag = 0;

      for (let n = 0; n < frame.length; n++) {
        const angle = 2 * Math.PI * k * n / frame.length;
        real += frame[n] * Math.cos(angle);
        imag -= frame[n] * Math.sin(angle);
      }

      magnitudes[k] = Math.sqrt(real * real + imag * imag);
    }

    return magnitudes;
  }

  /**
   * Combine energy and spectral flux onset functions
   * @private
   */
  _combineOnsetFunctions(energy, flux) {
    const combined = new Float32Array(energy.length);

    // Normalize both functions
    const maxEnergy = Math.max(...energy) || 1;
    const maxFlux = Math.max(...flux) || 1;

    for (let i = 0; i < combined.length; i++) {
      const normEnergy = energy[i] / maxEnergy;
      const normFlux = flux[i] / maxFlux;
      // Weight spectral flux more heavily for onset detection
      combined[i] = 0.4 * normEnergy + 0.6 * normFlux;
    }

    return combined;
  }

  /**
   * Find onsets using adaptive thresholding
   * @private
   */
  _findOnsets(onsetFunction) {
    const onsets = [];
    const windowSize = Math.floor(0.1 * this.sampleRate / this.hopSize); // 100ms window

    for (let i = 1; i < onsetFunction.length - 1; i++) {
      // Calculate local mean for adaptive threshold
      const start = Math.max(0, i - windowSize);
      const end = Math.min(onsetFunction.length, i + windowSize);

      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += onsetFunction[j];
      }
      const localMean = sum / (end - start);

      // Check if current frame is a local maximum above threshold
      const threshold = Math.max(this.energyThreshold, localMean * this.onsetThreshold);

      if (onsetFunction[i] > threshold &&
          onsetFunction[i] > onsetFunction[i - 1] &&
          onsetFunction[i] > onsetFunction[i + 1]) {
        onsets.push({
          frameIndex: i,
          time: i * this.hopSize / this.sampleRate,
          sample: i * this.hopSize,
          strength: onsetFunction[i],
        });
      }
    }

    // Merge onsets that are too close together
    return this._mergeCloseOnsets(onsets);
  }

  /**
   * Merge onsets that are closer than minSilenceDuration
   * @private
   */
  _mergeCloseOnsets(onsets) {
    if (onsets.length === 0) return onsets;

    const merged = [onsets[0]];
    const minGap = this.minSilenceDuration;

    for (let i = 1; i < onsets.length; i++) {
      const lastOnset = merged[merged.length - 1];
      const currentOnset = onsets[i];

      if (currentOnset.time - lastOnset.time < minGap) {
        // Keep the stronger onset
        if (currentOnset.strength > lastOnset.strength) {
          merged[merged.length - 1] = currentOnset;
        }
      } else {
        merged.push(currentOnset);
      }
    }

    return merged;
  }

  /**
   * Find note regions (onset to offset)
   * @private
   */
  _findNoteRegions(onsets, energy) {
    const notes = [];
    const silenceThreshold = this.energyThreshold * 0.5;
    const minSilenceFrames = Math.floor(this.minSilenceDuration * this.sampleRate / this.hopSize);

    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i];
      const nextOnset = onsets[i + 1];

      // Find offset: either next onset or energy drop
      let endFrame = nextOnset ? nextOnset.frameIndex - 1 : energy.length - 1;

      // Look for energy drop before next onset
      let silenceCount = 0;
      for (let j = onset.frameIndex + 1; j <= endFrame; j++) {
        if (energy[j] < silenceThreshold) {
          silenceCount++;
          if (silenceCount >= minSilenceFrames) {
            endFrame = j - minSilenceFrames;
            break;
          }
        } else {
          silenceCount = 0;
        }
      }

      notes.push({
        startTime: onset.time,
        endTime: endFrame * this.hopSize / this.sampleRate,
        startSample: onset.sample,
        endSample: endFrame * this.hopSize,
        startFrame: onset.frameIndex,
        endFrame: endFrame,
      });
    }

    return notes;
  }

  /**
   * Filter notes by minimum duration
   * @private
   */
  _filterByDuration(notes) {
    return notes.filter(note => {
      const duration = note.endTime - note.startTime;
      return duration >= this.minNoteDuration;
    });
  }

  /**
   * Extract audio for a detected note
   * @param {Float32Array} buffer - Full audio buffer
   * @param {object} note - Note object from detectNotes
   * @returns {Float32Array} Audio segment for the note
   */
  extractNoteAudio(buffer, note) {
    const start = Math.max(0, note.startSample);
    const end = Math.min(buffer.length, note.endSample);
    return buffer.slice(start, end);
  }

  /**
   * Get timing information for evaluation
   * @param {Array} notes - Notes from detectNotes
   * @returns {Array<{startTime, endTime, duration}>} Simplified timing info
   */
  getNoteTiming(notes) {
    return notes.map(note => ({
      startTime: note.startTime,
      endTime: note.endTime,
      duration: note.endTime - note.startTime,
    }));
  }

  /**
   * Validate detected notes against expected count
   * @param {Array} notes - Detected notes
   * @param {number} expectedCount - Expected number of notes
   * @returns {object} Validation result
   */
  validate(notes, expectedCount) {
    return {
      detectedCount: notes.length,
      expectedCount,
      isCorrect: notes.length === expectedCount,
      difference: notes.length - expectedCount,
    };
  }
}
