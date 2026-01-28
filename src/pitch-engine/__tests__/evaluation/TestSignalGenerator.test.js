import { describe, it, expect, beforeEach } from 'vitest';
import { TestSignalGenerator } from '../../evaluation/TestSignalGenerator.js';

describe('TestSignalGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new TestSignalGenerator({ sampleRate: 44100 });
  });

  describe('constructor', () => {
    it('should use default sample rate of 44100', () => {
      const defaultGen = new TestSignalGenerator();
      expect(defaultGen.sampleRate).toBe(44100);
    });

    it('should accept custom sample rate', () => {
      const customGen = new TestSignalGenerator({ sampleRate: 48000 });
      expect(customGen.sampleRate).toBe(48000);
    });
  });

  describe('generateSineWave', () => {
    it('should generate correct buffer length', () => {
      const { buffer } = generator.generateSineWave(440, 1.0);
      expect(buffer.length).toBe(44100);
    });

    it('should generate ground truth entries', () => {
      const { groundTruth } = generator.generateSineWave(440, 1.0);
      expect(groundTruth.length).toBeGreaterThan(0);
      expect(groundTruth[0]).toHaveProperty('time');
      expect(groundTruth[0]).toHaveProperty('frequency');
    });

    it('should set constant frequency in ground truth', () => {
      const { groundTruth } = generator.generateSineWave(440, 1.0);
      for (const entry of groundTruth) {
        expect(entry.frequency).toBe(440);
      }
    });

    it('should generate valid audio samples', () => {
      const { buffer } = generator.generateSineWave(440, 0.1, 0.5);
      // All samples should be in range [-0.5, 0.5] for amplitude 0.5
      for (const sample of buffer) {
        expect(sample).toBeGreaterThanOrEqual(-0.55);
        expect(sample).toBeLessThanOrEqual(0.55);
      }
    });

    it('should generate sine wave with correct period', () => {
      const frequency = 440;
      const { buffer } = generator.generateSineWave(frequency, 0.1, 1.0);

      // Count zero crossings (should be ~2 per period)
      let zeroCrossings = 0;
      for (let i = 1; i < buffer.length; i++) {
        if ((buffer[i - 1] < 0 && buffer[i] >= 0) || (buffer[i - 1] >= 0 && buffer[i] < 0)) {
          zeroCrossings++;
        }
      }

      const expectedCrossings = Math.floor(frequency * 0.1 * 2);
      expect(zeroCrossings).toBeCloseTo(expectedCrossings, -1);
    });
  });

  describe('generateWithHarmonics', () => {
    it('should generate buffer with harmonics', () => {
      const { buffer } = generator.generateWithHarmonics(220, 1.0, [1, 0.5, 0.25]);
      expect(buffer.length).toBe(44100);
    });

    it('should set fundamental frequency in ground truth', () => {
      const { groundTruth } = generator.generateWithHarmonics(220, 1.0);
      for (const entry of groundTruth) {
        expect(entry.frequency).toBe(220);
      }
    });

    it('should generate complex waveform with harmonics', () => {
      const { buffer: pureBuffer } = generator.generateSineWave(220, 0.1);
      const { buffer: harmonicBuffer } = generator.generateWithHarmonics(220, 0.1, [1, 0.5, 0.25]);

      // Harmonic signal should have different shape (not identical to pure sine)
      let difference = 0;
      for (let i = 0; i < pureBuffer.length; i++) {
        difference += Math.abs(pureBuffer[i] - harmonicBuffer[i]);
      }
      expect(difference / pureBuffer.length).toBeGreaterThan(0.01);
    });
  });

  describe('generateScale', () => {
    it('should generate major scale with 8 notes', () => {
      const { buffer, groundTruth, numNotes } = generator.generateScale('major', 261.63, 0.5);
      expect(numNotes).toBe(8);
      expect(buffer.length).toBe(Math.floor(8 * 0.5 * 44100));
    });

    it('should generate chromatic scale with 13 notes', () => {
      const { numNotes } = generator.generateScale('chromatic', 261.63, 0.3);
      expect(numNotes).toBe(13);
    });

    it('should include note information in ground truth', () => {
      const { groundTruth } = generator.generateScale('major', 261.63, 0.5);
      const firstEntry = groundTruth[0];
      expect(firstEntry).toHaveProperty('noteName');
      expect(firstEntry).toHaveProperty('noteIndex');
    });

    it('should generate octave relationship for root and final note', () => {
      const { groundTruth } = generator.generateScale('major', 261.63, 0.5);
      const rootNotes = groundTruth.filter(e => e.noteIndex === 0);
      const octaveNotes = groundTruth.filter(e => e.noteIndex === 7);

      expect(rootNotes.length).toBeGreaterThan(0);
      expect(octaveNotes.length).toBeGreaterThan(0);

      const ratio = octaveNotes[0].frequency / rootNotes[0].frequency;
      expect(ratio).toBeCloseTo(2.0, 2);
    });

    it('should default to major scale for unknown scale type', () => {
      const { numNotes: majorNotes } = generator.generateScale('major', 261.63);
      const { numNotes: unknownNotes } = generator.generateScale('unknown', 261.63);
      expect(unknownNotes).toBe(majorNotes);
    });
  });

  describe('generateSweep', () => {
    it('should generate correct buffer length', () => {
      const { buffer } = generator.generateSweep(220, 440, 2.0);
      expect(buffer.length).toBe(Math.floor(2.0 * 44100));
    });

    it('should have increasing frequency in ground truth (logarithmic)', () => {
      const { groundTruth } = generator.generateSweep(220, 440, 1.0, true);
      for (let i = 1; i < groundTruth.length; i++) {
        expect(groundTruth[i].frequency).toBeGreaterThan(groundTruth[i - 1].frequency);
      }
    });

    it('should start and end at correct frequencies', () => {
      const { groundTruth } = generator.generateSweep(220, 440, 1.0);
      expect(groundTruth[0].frequency).toBeCloseTo(220, 0);
      // Last entry might not be exactly at 440 due to frame interval, but should be close
      expect(groundTruth[groundTruth.length - 1].frequency).toBeGreaterThan(430);
      expect(groundTruth[groundTruth.length - 1].frequency).toBeLessThanOrEqual(440);
    });

    it('should support linear sweep', () => {
      const { groundTruth } = generator.generateSweep(200, 400, 1.0, false);

      // Linear sweep should have constant frequency increments
      const firstDiff = groundTruth[1].frequency - groundTruth[0].frequency;
      const midIndex = Math.floor(groundTruth.length / 2);
      const midDiff = groundTruth[midIndex + 1].frequency - groundTruth[midIndex].frequency;

      expect(firstDiff).toBeCloseTo(midDiff, 0);
    });
  });

  describe('addNoise', () => {
    it('should return buffer of same length', () => {
      const { buffer } = generator.generateSineWave(440, 1.0);
      const noisyBuffer = generator.addNoise(buffer, 20);
      expect(noisyBuffer.length).toBe(buffer.length);
    });

    it('should add different noise each time', () => {
      const { buffer } = generator.generateSineWave(440, 0.1);
      const noisy1 = generator.addNoise(buffer, 20);
      const noisy2 = generator.addNoise(buffer, 20);

      let difference = 0;
      for (let i = 0; i < noisy1.length; i++) {
        difference += Math.abs(noisy1[i] - noisy2[i]);
      }
      expect(difference).toBeGreaterThan(0);
    });

    it('should add more noise at lower SNR', () => {
      const { buffer } = generator.generateSineWave(440, 0.5);
      const noisy30dB = generator.addNoise(buffer, 30);
      const noisy10dB = generator.addNoise(buffer, 10);

      let diff30 = 0;
      let diff10 = 0;
      for (let i = 0; i < buffer.length; i++) {
        diff30 += Math.abs(buffer[i] - noisy30dB[i]);
        diff10 += Math.abs(buffer[i] - noisy10dB[i]);
      }

      // Lower SNR = more noise = greater difference
      expect(diff10).toBeGreaterThan(diff30);
    });
  });

  describe('generateTestSuite', () => {
    it('should return array of test cases', () => {
      const tests = generator.generateTestSuite();
      expect(Array.isArray(tests)).toBe(true);
      expect(tests.length).toBeGreaterThan(0);
    });

    it('should include various test types', () => {
      const tests = generator.generateTestSuite();
      const types = new Set(tests.map(t => t.type));

      expect(types.has('sine')).toBe(true);
      expect(types.has('voice')).toBe(true);
      expect(types.has('scale')).toBe(true);
      expect(types.has('sweep')).toBe(true);
      expect(types.has('noisy')).toBe(true);
    });

    it('should include name and required fields for each test', () => {
      const tests = generator.generateTestSuite();
      for (const test of tests) {
        expect(test).toHaveProperty('name');
        expect(test).toHaveProperty('buffer');
        expect(test).toHaveProperty('groundTruth');
        expect(test.buffer).toBeInstanceOf(Float32Array);
        expect(Array.isArray(test.groundTruth)).toBe(true);
      }
    });
  });

  describe('extractFrame', () => {
    it('should extract correct frame size', () => {
      const { buffer } = generator.generateSineWave(440, 1.0);
      const frame = generator.extractFrame(buffer, 0.5, 2048);
      expect(frame.length).toBe(2048);
    });

    it('should extract from correct position', () => {
      const { buffer } = generator.generateSineWave(440, 1.0);
      const frame1 = generator.extractFrame(buffer, 0, 1024);
      const frame2 = generator.extractFrame(buffer, 0.5, 1024);

      // Frames from different positions should be different
      let different = false;
      for (let i = 0; i < frame1.length; i++) {
        if (frame1[i] !== frame2[i]) {
          different = true;
          break;
        }
      }
      expect(different).toBe(true);
    });

    it('should handle frame at end of buffer', () => {
      const { buffer } = generator.generateSineWave(440, 0.1);
      const frame = generator.extractFrame(buffer, 0.09, 2048);
      expect(frame.length).toBeLessThanOrEqual(2048);
    });
  });

  describe('generateFrames', () => {
    it('should generate array of frames', () => {
      const { buffer, groundTruth } = generator.generateSineWave(440, 0.5);
      const frames = generator.generateFrames(buffer, groundTruth, 2048, 1024);

      expect(Array.isArray(frames)).toBe(true);
      expect(frames.length).toBeGreaterThan(0);
    });

    it('should include frame, time, and expected frequency', () => {
      const { buffer, groundTruth } = generator.generateSineWave(440, 0.5);
      const frames = generator.generateFrames(buffer, groundTruth);

      for (const f of frames) {
        expect(f).toHaveProperty('frame');
        expect(f).toHaveProperty('time');
        expect(f).toHaveProperty('expectedFrequency');
        expect(f.frame).toBeInstanceOf(Float32Array);
      }
    });

    it('should assign correct expected frequencies', () => {
      const { buffer, groundTruth } = generator.generateSineWave(440, 0.5);
      const frames = generator.generateFrames(buffer, groundTruth);

      for (const f of frames) {
        expect(f.expectedFrequency).toBe(440);
      }
    });
  });
});
