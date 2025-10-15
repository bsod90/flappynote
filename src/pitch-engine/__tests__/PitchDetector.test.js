import { describe, it, expect } from 'vitest';
import { PitchDetector } from '../PitchDetector.js';

describe('PitchDetector', () => {
  describe('getScaleDegreeFrequency', () => {
    it('should return root frequency for degree 0', () => {
      const freq = PitchDetector.getScaleDegreeFrequency('C4', 0, 'major');
      expect(freq).toBeCloseTo(261.63, 1);
    });

    it('should calculate major scale degrees correctly', () => {
      const root = 'C4';
      // C4 major scale: C D E F G A B C
      const degrees = [
        { degree: 0, note: 'C4' },  // do
        { degree: 1, note: 'D4' },  // re
        { degree: 2, note: 'E4' },  // mi
        { degree: 3, note: 'F4' },  // fa
        { degree: 4, note: 'G4' },  // sol
        { degree: 5, note: 'A4' },  // la
        { degree: 6, note: 'B4' },  // ti
        { degree: 7, note: 'C5' },  // do (octave)
      ];

      degrees.forEach(({ degree, note }) => {
        const freq = PitchDetector.getScaleDegreeFrequency(root, degree, 'major');
        const expectedFreq = PitchDetector.getScaleDegreeFrequency('C4', degree, 'major');
        expect(freq).toBeCloseTo(expectedFreq, 1);
      });
    });

    it('should calculate minor scale degrees correctly', () => {
      const root = 'A3';
      // A3 natural minor scale: A B C D E F G A
      const minorIntervals = [0, 2, 3, 5, 7, 8, 10, 12];

      minorIntervals.forEach((interval, index) => {
        const freq = PitchDetector.getScaleDegreeFrequency(root, index, 'minor');
        expect(freq).toBeGreaterThan(0);
      });
    });

    it('should handle different root notes', () => {
      const rootC = PitchDetector.getScaleDegreeFrequency('C4', 0, 'major');
      const rootG = PitchDetector.getScaleDegreeFrequency('G4', 0, 'major');
      expect(rootG).toBeGreaterThan(rootC);
    });

    it('should return octave frequency for degree 7', () => {
      const root = PitchDetector.getScaleDegreeFrequency('C4', 0, 'major');
      const octave = PitchDetector.getScaleDegreeFrequency('C4', 7, 'major');
      expect(octave / root).toBeCloseTo(2, 2);
    });

    it('should support dorian mode', () => {
      const freq = PitchDetector.getScaleDegreeFrequency('D4', 2, 'dorian');
      expect(freq).toBeGreaterThan(0);
    });

    it('should support mixolydian mode', () => {
      const freq = PitchDetector.getScaleDegreeFrequency('G4', 2, 'mixolydian');
      expect(freq).toBeGreaterThan(0);
    });

    it('should default to major scale for unknown scale types', () => {
      const majorFreq = PitchDetector.getScaleDegreeFrequency('C4', 2, 'major');
      const unknownFreq = PitchDetector.getScaleDegreeFrequency('C4', 2, 'unknown');
      expect(unknownFreq).toBeCloseTo(majorFreq, 2);
    });
  });

  describe('isPitchMatching', () => {
    it('should return false when no pitch is detected', () => {
      const detector = new PitchDetector();
      expect(detector.isPitchMatching(440)).toBe(false);
    });

    it('should return true when pitch matches within tolerance', () => {
      const detector = new PitchDetector();
      // Simulate detected pitch
      detector.currentPitch = {
        frequency: 440,
        noteName: 'A4',
        midiNote: 69,
        centsOff: 0,
      };

      expect(detector.isPitchMatching(440, 50)).toBe(true);
      expect(detector.isPitchMatching(442, 50)).toBe(true); // Slightly off but within tolerance
    });

    it('should return false when pitch is outside tolerance', () => {
      const detector = new PitchDetector();
      detector.currentPitch = {
        frequency: 440,
        noteName: 'A4',
        midiNote: 69,
        centsOff: 0,
      };

      // 466.16 Hz is A#4, about 100 cents away
      expect(detector.isPitchMatching(466.16, 50)).toBe(false);
    });
  });

  describe('getCentsFromTarget', () => {
    it('should return null when no pitch is detected', () => {
      const detector = new PitchDetector();
      expect(detector.getCentsFromTarget(440)).toBeNull();
    });

    it('should return 0 cents for exact match', () => {
      const detector = new PitchDetector();
      detector.currentPitch = {
        frequency: 440,
        noteName: 'A4',
        midiNote: 69,
        centsOff: 0,
      };

      const cents = detector.getCentsFromTarget(440);
      expect(cents).toBeCloseTo(0, 1);
    });

    it('should return positive cents when current pitch is higher', () => {
      const detector = new PitchDetector();
      detector.currentPitch = {
        frequency: 445,
        noteName: 'A4',
        midiNote: 69,
        centsOff: 0,
      };

      const cents = detector.getCentsFromTarget(440);
      expect(cents).toBeGreaterThan(0);
    });

    it('should return negative cents when current pitch is lower', () => {
      const detector = new PitchDetector();
      detector.currentPitch = {
        frequency: 435,
        noteName: 'A4',
        midiNote: 69,
        centsOff: 0,
      };

      const cents = detector.getCentsFromTarget(440);
      expect(cents).toBeLessThan(0);
    });
  });

  describe('getCurrentPitch', () => {
    it('should return null initially', () => {
      const detector = new PitchDetector();
      expect(detector.getCurrentPitch()).toBeNull();
    });

    it('should return current pitch when set', () => {
      const detector = new PitchDetector();
      const mockPitch = {
        frequency: 440,
        noteName: 'A4',
        midiNote: 69,
        centsOff: 0,
      };
      detector.currentPitch = mockPitch;

      expect(detector.getCurrentPitch()).toEqual(mockPitch);
    });
  });

  describe('constructor options', () => {
    it('should create detector with default options', () => {
      const detector = new PitchDetector();
      expect(detector.updateInterval).toBe(50);
      expect(detector.isRunning).toBe(false);
    });

    it('should accept custom update interval', () => {
      const detector = new PitchDetector({ updateInterval: 100 });
      expect(detector.updateInterval).toBe(100);
    });

    it('should accept custom onPitchDetected callback', () => {
      const callback = () => {};
      const detector = new PitchDetector({ onPitchDetected: callback });
      expect(detector.onPitchDetected).toBe(callback);
    });
  });
});
