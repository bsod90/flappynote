/**
 * TestSignalGenerator - Generates synthetic test signals with known ground truth
 * Used for evaluating pitch detection algorithms without requiring real audio
 */

export class TestSignalGenerator {
  /**
   * @param {object} options
   * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
   */
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 44100;
  }

  /**
   * Generate a pure sine wave at a given frequency
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {number} amplitude - Amplitude 0-1 (default: 0.8)
   * @returns {object} { buffer: Float32Array, groundTruth: Array<{time, frequency}> }
   */
  generateSineWave(frequency, duration, amplitude = 0.8) {
    const numSamples = Math.floor(this.sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    const groundTruth = [];

    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      buffer[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
    }

    // Ground truth: constant frequency throughout
    const frameInterval = 0.01; // 10ms frames
    for (let t = 0; t < duration; t += frameInterval) {
      groundTruth.push({ time: t, frequency });
    }

    return { buffer, groundTruth };
  }

  /**
   * Generate a sine wave with harmonics (simulates voice)
   * @param {number} fundamental - Fundamental frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {Array<number>} harmonicAmplitudes - Relative amplitudes for harmonics [h1, h2, h3, ...]
   * @param {number} amplitude - Overall amplitude 0-1 (default: 0.8)
   * @returns {object} { buffer: Float32Array, groundTruth: Array<{time, frequency}> }
   */
  generateWithHarmonics(fundamental, duration, harmonicAmplitudes = [1, 0.5, 0.25, 0.125], amplitude = 0.8) {
    const numSamples = Math.floor(this.sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    const groundTruth = [];

    // Normalize harmonic amplitudes
    const totalAmplitude = harmonicAmplitudes.reduce((sum, a) => sum + a, 0);
    const normalizedAmplitudes = harmonicAmplitudes.map(a => a / totalAmplitude);

    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      let sample = 0;

      for (let h = 0; h < normalizedAmplitudes.length; h++) {
        const harmonic = h + 1; // 1st harmonic = fundamental
        sample += normalizedAmplitudes[h] * Math.sin(2 * Math.PI * fundamental * harmonic * t);
      }

      buffer[i] = amplitude * sample;
    }

    // Ground truth: fundamental frequency
    const frameInterval = 0.01;
    for (let t = 0; t < duration; t += frameInterval) {
      groundTruth.push({ time: t, frequency: fundamental });
    }

    return { buffer, groundTruth };
  }

  /**
   * Generate a musical scale (discrete notes)
   * @param {string} scaleName - Scale name: 'major', 'minor', 'chromatic'
   * @param {number} rootFrequency - Root frequency in Hz
   * @param {number} noteDuration - Duration per note in seconds
   * @param {number} amplitude - Amplitude 0-1 (default: 0.8)
   * @returns {object} { buffer: Float32Array, groundTruth: Array<{time, frequency, noteName}> }
   */
  generateScale(scaleName, rootFrequency, noteDuration = 0.5, amplitude = 0.8) {
    const scales = {
      major: [0, 2, 4, 5, 7, 9, 11, 12],        // W W H W W W H
      minor: [0, 2, 3, 5, 7, 8, 10, 12],        // W H W W H W W
      chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      pentatonic: [0, 2, 4, 7, 9, 12],
      blues: [0, 3, 5, 6, 7, 10, 12],
    };

    const intervals = scales[scaleName] || scales.major;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    const numNotes = intervals.length;
    const totalDuration = numNotes * noteDuration;
    const numSamples = Math.floor(this.sampleRate * totalDuration);
    const buffer = new Float32Array(numSamples);
    const groundTruth = [];

    for (let noteIndex = 0; noteIndex < numNotes; noteIndex++) {
      const semitones = intervals[noteIndex];
      const noteFrequency = rootFrequency * Math.pow(2, semitones / 12);
      const startSample = Math.floor(noteIndex * noteDuration * this.sampleRate);
      const endSample = Math.floor((noteIndex + 1) * noteDuration * this.sampleRate);

      // Apply envelope to avoid clicks
      const attackSamples = Math.floor(0.01 * this.sampleRate);
      const releaseSamples = Math.floor(0.01 * this.sampleRate);

      for (let i = startSample; i < endSample && i < numSamples; i++) {
        const t = i / this.sampleRate;
        const localIndex = i - startSample;
        const noteLength = endSample - startSample;

        // Envelope
        let envelope = 1;
        if (localIndex < attackSamples) {
          envelope = localIndex / attackSamples;
        } else if (localIndex > noteLength - releaseSamples) {
          envelope = (noteLength - localIndex) / releaseSamples;
        }

        buffer[i] = amplitude * envelope * Math.sin(2 * Math.PI * noteFrequency * t);
      }

      // Ground truth for this note
      const noteStartTime = noteIndex * noteDuration;
      const frameInterval = 0.01;
      for (let t = noteStartTime + 0.02; t < noteStartTime + noteDuration - 0.02; t += frameInterval) {
        groundTruth.push({
          time: t,
          frequency: noteFrequency,
          noteName: noteNames[semitones % 12],
          noteIndex,
        });
      }
    }

    return { buffer, groundTruth, numNotes };
  }

  /**
   * Generate a frequency sweep (glissando)
   * @param {number} startFrequency - Starting frequency in Hz
   * @param {number} endFrequency - Ending frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {boolean} logarithmic - Use logarithmic sweep (default: true)
   * @param {number} amplitude - Amplitude 0-1 (default: 0.8)
   * @returns {object} { buffer: Float32Array, groundTruth: Array<{time, frequency}> }
   */
  generateSweep(startFrequency, endFrequency, duration, logarithmic = true, amplitude = 0.8) {
    const numSamples = Math.floor(this.sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    const groundTruth = [];

    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      const progress = t / duration;

      let frequency;
      if (logarithmic) {
        // Logarithmic sweep - perceptually linear
        frequency = startFrequency * Math.pow(endFrequency / startFrequency, progress);
      } else {
        // Linear sweep
        frequency = startFrequency + (endFrequency - startFrequency) * progress;
      }

      phase += 2 * Math.PI * frequency / this.sampleRate;
      buffer[i] = amplitude * Math.sin(phase);
    }

    // Ground truth at each frame
    const frameInterval = 0.01;
    for (let t = 0; t < duration; t += frameInterval) {
      const progress = t / duration;
      let frequency;
      if (logarithmic) {
        frequency = startFrequency * Math.pow(endFrequency / startFrequency, progress);
      } else {
        frequency = startFrequency + (endFrequency - startFrequency) * progress;
      }
      groundTruth.push({ time: t, frequency });
    }

    return { buffer, groundTruth };
  }

  /**
   * Add noise to a signal at a specified SNR
   * @param {Float32Array} buffer - Input signal
   * @param {number} snrDb - Signal-to-noise ratio in dB
   * @returns {Float32Array} Noisy signal
   */
  addNoise(buffer, snrDb) {
    const noisyBuffer = new Float32Array(buffer.length);

    // Calculate signal power
    let signalPower = 0;
    for (let i = 0; i < buffer.length; i++) {
      signalPower += buffer[i] * buffer[i];
    }
    signalPower /= buffer.length;

    // Calculate noise power from SNR
    const snrLinear = Math.pow(10, snrDb / 10);
    const noisePower = signalPower / snrLinear;
    const noiseAmplitude = Math.sqrt(noisePower);

    // Add Gaussian noise
    for (let i = 0; i < buffer.length; i++) {
      // Box-Muller transform for Gaussian noise
      const u1 = Math.random();
      const u2 = Math.random();
      const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      noisyBuffer[i] = buffer[i] + noiseAmplitude * gaussian;
    }

    return noisyBuffer;
  }

  /**
   * Generate a comprehensive test suite
   * @returns {Array<object>} Array of test cases with name, buffer, groundTruth
   */
  generateTestSuite() {
    const tests = [];

    // Pure sine waves at various frequencies
    const sineFrequencies = [220, 330, 440, 523.25, 659.25]; // A3, E4, A4, C5, E5
    for (const freq of sineFrequencies) {
      const result = this.generateSineWave(freq, 1.0);
      tests.push({
        name: `sine_${Math.round(freq)}Hz`,
        type: 'sine',
        ...result,
      });
    }

    // Sine with harmonics (simulating voice)
    const voiceFrequencies = [220, 330, 440];
    for (const freq of voiceFrequencies) {
      const result = this.generateWithHarmonics(freq, 1.0, [1, 0.6, 0.3, 0.15, 0.08]);
      tests.push({
        name: `voice_${Math.round(freq)}Hz`,
        type: 'voice',
        ...result,
      });
    }

    // Musical scales
    const scaleTypes = ['major', 'minor', 'chromatic'];
    for (const scale of scaleTypes) {
      const result = this.generateScale(scale, 261.63, 0.4); // C4
      tests.push({
        name: `scale_${scale}_C4`,
        type: 'scale',
        ...result,
      });
    }

    // Frequency sweeps
    const sweeps = [
      { start: 220, end: 440, name: 'sweep_A3_A4' },
      { start: 330, end: 660, name: 'sweep_E4_E5' },
    ];
    for (const sweep of sweeps) {
      const result = this.generateSweep(sweep.start, sweep.end, 2.0);
      tests.push({
        name: sweep.name,
        type: 'sweep',
        ...result,
      });
    }

    // Noisy versions of a reference signal
    const referenceSignal = this.generateWithHarmonics(440, 1.0);
    const snrLevels = [30, 20, 10];
    for (const snr of snrLevels) {
      const noisyBuffer = this.addNoise(referenceSignal.buffer, snr);
      tests.push({
        name: `noisy_440Hz_${snr}dB`,
        type: 'noisy',
        buffer: noisyBuffer,
        groundTruth: referenceSignal.groundTruth,
        snr,
      });
    }

    return tests;
  }

  /**
   * Extract a frame from a buffer for pitch detection
   * @param {Float32Array} buffer - Full audio buffer
   * @param {number} time - Start time in seconds
   * @param {number} frameSize - Frame size in samples (default: 2048)
   * @returns {Float32Array} Frame buffer
   */
  extractFrame(buffer, time, frameSize = 2048) {
    const startSample = Math.floor(time * this.sampleRate);
    const endSample = Math.min(startSample + frameSize, buffer.length);
    return buffer.slice(startSample, endSample);
  }

  /**
   * Generate frames from a buffer with ground truth
   * @param {Float32Array} buffer - Full audio buffer
   * @param {Array} groundTruth - Ground truth array
   * @param {number} frameSize - Frame size in samples (default: 2048)
   * @param {number} hopSize - Hop size in samples (default: 512)
   * @returns {Array<{frame, time, expectedFrequency}>}
   */
  generateFrames(buffer, groundTruth, frameSize = 2048, hopSize = 512) {
    const frames = [];

    for (let startSample = 0; startSample + frameSize <= buffer.length; startSample += hopSize) {
      const time = startSample / this.sampleRate;
      const frame = buffer.slice(startSample, startSample + frameSize);

      // Find closest ground truth entry
      let expectedFrequency = null;
      let minTimeDiff = Infinity;
      for (const gt of groundTruth) {
        const timeDiff = Math.abs(gt.time - time);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          expectedFrequency = gt.frequency;
        }
      }

      frames.push({ frame, time, expectedFrequency });
    }

    return frames;
  }
}
