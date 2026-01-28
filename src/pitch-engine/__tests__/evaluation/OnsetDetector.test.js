import { describe, it, expect, beforeEach } from 'vitest';
import { OnsetDetector } from '../../evaluation/OnsetDetector.js';
import { TestSignalGenerator } from '../../evaluation/TestSignalGenerator.js';

describe('OnsetDetector', () => {
  let detector;
  let generator;

  beforeEach(() => {
    detector = new OnsetDetector({ sampleRate: 44100 });
    generator = new TestSignalGenerator({ sampleRate: 44100 });
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const defaultDetector = new OnsetDetector();
      expect(defaultDetector.sampleRate).toBe(44100);
      expect(defaultDetector.hopSize).toBe(512);
      expect(defaultDetector.frameSize).toBe(2048);
    });

    it('should accept custom options', () => {
      const customDetector = new OnsetDetector({
        sampleRate: 48000,
        hopSize: 256,
        minNoteDuration: 0.2,
      });
      expect(customDetector.sampleRate).toBe(48000);
      expect(customDetector.hopSize).toBe(256);
      expect(customDetector.minNoteDuration).toBe(0.2);
    });
  });

  describe('detectNotes', () => {
    it('should detect notes in a scale', () => {
      // Generate a major scale with 8 distinct notes
      const { buffer } = generator.generateScale('major', 261.63, 0.4);

      const notes = detector.detectNotes(buffer);

      // Should detect approximately 8 notes (may vary due to envelope)
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array for silence', () => {
      const silentBuffer = new Float32Array(44100); // 1 second of silence
      const notes = detector.detectNotes(silentBuffer);
      expect(notes.length).toBe(0);
    });

    it('should handle single sustained note', () => {
      // A sustained sine wave without clear onset may not be detected
      // since onset detection looks for energy changes
      const { buffer } = generator.generateSineWave(440, 1.0);
      const notes = detector.detectNotes(buffer);

      // May detect 0-1 notes depending on energy envelope
      expect(notes.length).toBeGreaterThanOrEqual(0);
      expect(notes.length).toBeLessThanOrEqual(2);
    });

    it('should return notes with correct structure', () => {
      const { buffer } = generator.generateScale('major', 261.63, 0.5);
      const notes = detector.detectNotes(buffer);

      if (notes.length > 0) {
        const note = notes[0];
        expect(note).toHaveProperty('startTime');
        expect(note).toHaveProperty('endTime');
        expect(note).toHaveProperty('startSample');
        expect(note).toHaveProperty('endSample');
        expect(typeof note.startTime).toBe('number');
        expect(typeof note.endTime).toBe('number');
      }
    });

    it('should order notes chronologically', () => {
      const { buffer } = generator.generateScale('chromatic', 261.63, 0.3);
      const notes = detector.detectNotes(buffer);

      for (let i = 1; i < notes.length; i++) {
        expect(notes[i].startTime).toBeGreaterThanOrEqual(notes[i - 1].startTime);
      }
    });

    it('should not return overlapping notes', () => {
      const { buffer } = generator.generateScale('major', 261.63, 0.4);
      const notes = detector.detectNotes(buffer);

      for (let i = 1; i < notes.length; i++) {
        expect(notes[i].startTime).toBeGreaterThanOrEqual(notes[i - 1].endTime);
      }
    });
  });

  describe('extractNoteAudio', () => {
    it('should extract correct portion of buffer', () => {
      const { buffer } = generator.generateScale('major', 261.63, 0.5);
      const notes = detector.detectNotes(buffer);

      if (notes.length > 0) {
        const noteAudio = detector.extractNoteAudio(buffer, notes[0]);

        expect(noteAudio).toBeInstanceOf(Float32Array);
        expect(noteAudio.length).toBe(notes[0].endSample - notes[0].startSample);
      }
    });

    it('should handle notes at buffer boundaries', () => {
      const buffer = new Float32Array(44100);
      // Fill with sine wave
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0.8 * Math.sin(2 * Math.PI * 440 * i / 44100);
      }

      const note = {
        startSample: 0,
        endSample: 22050,
        startTime: 0,
        endTime: 0.5,
      };

      const extracted = detector.extractNoteAudio(buffer, note);
      expect(extracted.length).toBe(22050);
    });
  });

  describe('getNoteTiming', () => {
    it('should return simplified timing info', () => {
      const { buffer } = generator.generateScale('major', 261.63, 0.4);
      const notes = detector.detectNotes(buffer);
      const timing = detector.getNoteTiming(notes);

      expect(timing.length).toBe(notes.length);

      if (timing.length > 0) {
        expect(timing[0]).toHaveProperty('startTime');
        expect(timing[0]).toHaveProperty('endTime');
        expect(timing[0]).toHaveProperty('duration');
        expect(timing[0].duration).toBeCloseTo(
          timing[0].endTime - timing[0].startTime,
          5
        );
      }
    });
  });

  describe('validate', () => {
    it('should validate correct count', () => {
      const notes = [
        { startTime: 0, endTime: 0.5 },
        { startTime: 0.6, endTime: 1.0 },
      ];

      const result = detector.validate(notes, 2);

      expect(result.isCorrect).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should detect over-detection', () => {
      const notes = [
        { startTime: 0, endTime: 0.3 },
        { startTime: 0.4, endTime: 0.6 },
        { startTime: 0.7, endTime: 1.0 },
      ];

      const result = detector.validate(notes, 2);

      expect(result.isCorrect).toBe(false);
      expect(result.difference).toBe(1);
    });

    it('should detect under-detection', () => {
      const notes = [{ startTime: 0, endTime: 0.5 }];

      const result = detector.validate(notes, 3);

      expect(result.isCorrect).toBe(false);
      expect(result.difference).toBe(-2);
    });
  });

  describe('edge cases', () => {
    it('should handle very short buffer', () => {
      const shortBuffer = new Float32Array(100);
      const notes = detector.detectNotes(shortBuffer);
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should respect minNoteDuration', () => {
      const customDetector = new OnsetDetector({
        sampleRate: 44100,
        minNoteDuration: 0.3,
      });

      // Generate scale with short notes
      const { buffer } = generator.generateScale('major', 261.63, 0.2);
      const notes = customDetector.detectNotes(buffer);

      // All detected notes should be >= minNoteDuration
      for (const note of notes) {
        const duration = note.endTime - note.startTime;
        expect(duration).toBeGreaterThanOrEqual(0.3);
      }
    });

    it('should handle noisy signal', () => {
      const { buffer: clean } = generator.generateScale('major', 261.63, 0.4);
      const noisy = generator.addNoise(clean, 15); // 15dB SNR

      const notes = detector.detectNotes(noisy);

      // Should still detect some notes even with noise
      expect(notes.length).toBeGreaterThan(0);
    });
  });

  describe('integration with scale generator', () => {
    it('should detect approximately correct number of notes for major scale', () => {
      const { buffer, numNotes } = generator.generateScale('major', 261.63, 0.5);
      const notes = detector.detectNotes(buffer);

      // Allow some tolerance for onset detection errors
      expect(notes.length).toBeGreaterThanOrEqual(numNotes - 2);
      expect(notes.length).toBeLessThanOrEqual(numNotes + 2);
    });

    it('should detect notes in chromatic scale', () => {
      const { buffer, numNotes } = generator.generateScale('chromatic', 261.63, 0.3);
      const notes = detector.detectNotes(buffer);

      // Chromatic scale has 13 notes
      expect(numNotes).toBe(13);
      expect(notes.length).toBeGreaterThan(5); // At least some notes detected
    });
  });
});
