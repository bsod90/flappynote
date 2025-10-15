import { describe, it, expect } from 'vitest';
import { FrequencyConverter } from '../FrequencyConverter.js';

describe('FrequencyConverter', () => {
  describe('frequencyToMidi', () => {
    it('should convert A4 (440 Hz) to MIDI 69', () => {
      const midi = FrequencyConverter.frequencyToMidi(440);
      expect(midi).toBeCloseTo(69, 2);
    });

    it('should convert C4 (261.63 Hz) to MIDI 60', () => {
      const midi = FrequencyConverter.frequencyToMidi(261.63);
      expect(midi).toBeCloseTo(60, 1);
    });

    it('should handle low frequencies', () => {
      const midi = FrequencyConverter.frequencyToMidi(32.7); // C1
      expect(midi).toBeCloseTo(24, 1);
    });

    it('should return 0 for invalid frequencies', () => {
      expect(FrequencyConverter.frequencyToMidi(0)).toBe(0);
      expect(FrequencyConverter.frequencyToMidi(-10)).toBe(0);
    });
  });

  describe('midiToFrequency', () => {
    it('should convert MIDI 69 to 440 Hz', () => {
      const freq = FrequencyConverter.midiToFrequency(69);
      expect(freq).toBeCloseTo(440, 2);
    });

    it('should convert MIDI 60 to ~261.63 Hz (C4)', () => {
      const freq = FrequencyConverter.midiToFrequency(60);
      expect(freq).toBeCloseTo(261.63, 2);
    });

    it('should handle octave relationships correctly', () => {
      const c3 = FrequencyConverter.midiToFrequency(48);
      const c4 = FrequencyConverter.midiToFrequency(60);
      expect(c4 / c3).toBeCloseTo(2, 2); // Octave = double frequency
    });
  });

  describe('midiToNoteName', () => {
    it('should convert MIDI 60 to C4', () => {
      expect(FrequencyConverter.midiToNoteName(60)).toBe('C4');
    });

    it('should convert MIDI 69 to A4', () => {
      expect(FrequencyConverter.midiToNoteName(69)).toBe('A4');
    });

    it('should handle sharps correctly', () => {
      expect(FrequencyConverter.midiToNoteName(61)).toBe('C#4');
      expect(FrequencyConverter.midiToNoteName(70)).toBe('A#4');
    });

    it('should handle different octaves', () => {
      expect(FrequencyConverter.midiToNoteName(72)).toBe('C5');
      expect(FrequencyConverter.midiToNoteName(48)).toBe('C3');
    });
  });

  describe('noteNameToMidi', () => {
    it('should convert C4 to MIDI 60', () => {
      expect(FrequencyConverter.noteNameToMidi('C4')).toBe(60);
    });

    it('should convert A4 to MIDI 69', () => {
      expect(FrequencyConverter.noteNameToMidi('A4')).toBe(69);
    });

    it('should handle sharps', () => {
      expect(FrequencyConverter.noteNameToMidi('C#4')).toBe(61);
      expect(FrequencyConverter.noteNameToMidi('F#3')).toBe(54);
    });

    it('should throw error for invalid note names', () => {
      expect(() => FrequencyConverter.noteNameToMidi('H4')).toThrow();
      expect(() => FrequencyConverter.noteNameToMidi('C')).toThrow();
      expect(() => FrequencyConverter.noteNameToMidi('invalid')).toThrow();
    });
  });

  describe('frequencyToNote', () => {
    it('should convert 440 Hz to A4 with 0 cents off', () => {
      const result = FrequencyConverter.frequencyToNote(440);
      expect(result.noteName).toBe('A4');
      expect(result.midiNote).toBe(69);
      expect(result.centsOff).toBeCloseTo(0, 1);
    });

    it('should detect cents offset for slightly off-pitch frequencies', () => {
      const result = FrequencyConverter.frequencyToNote(445); // Slightly sharp A4
      expect(result.noteName).toBe('A4');
      expect(result.centsOff).toBeGreaterThan(0);
    });

    it('should include frequency in result', () => {
      const result = FrequencyConverter.frequencyToNote(440);
      expect(result.frequency).toBe(440);
    });
  });

  describe('getCentsDifference', () => {
    it('should return 0 for identical frequencies', () => {
      const cents = FrequencyConverter.getCentsDifference(440, 440);
      expect(cents).toBeCloseTo(0, 2);
    });

    it('should return 100 cents for semitone difference', () => {
      const a4 = 440;
      const bb4 = FrequencyConverter.midiToFrequency(70); // A# = Bb
      const cents = FrequencyConverter.getCentsDifference(a4, bb4);
      expect(cents).toBeCloseTo(100, 1);
    });

    it('should return 1200 cents for octave difference', () => {
      const cents = FrequencyConverter.getCentsDifference(220, 440);
      expect(cents).toBeCloseTo(1200, 1);
    });

    it('should handle negative cents for flat notes', () => {
      const cents = FrequencyConverter.getCentsDifference(445, 440);
      expect(cents).toBeLessThan(0);
    });
  });

  describe('round-trip conversions', () => {
    it('should maintain accuracy through frequency->MIDI->frequency', () => {
      const originalFreq = 440;
      const midi = FrequencyConverter.frequencyToMidi(originalFreq);
      const backToFreq = FrequencyConverter.midiToFrequency(midi);
      expect(backToFreq).toBeCloseTo(originalFreq, 1);
    });

    it('should maintain accuracy through note->MIDI->note', () => {
      const notes = ['C4', 'G#3', 'A4', 'D5'];
      notes.forEach(note => {
        const midi = FrequencyConverter.noteNameToMidi(note);
        const backToNote = FrequencyConverter.midiToNoteName(midi);
        expect(backToNote).toBe(note);
      });
    });
  });
});
