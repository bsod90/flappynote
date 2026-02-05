import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VocalMonitorState } from '../VocalMonitorState.js';
import { FrequencyConverter } from '../../../pitch-engine/index.js';

describe('VocalMonitorState', () => {
  let state;

  beforeEach(() => {
    state = new VocalMonitorState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('history preservation', () => {
    it('should NOT trim history entries older than 30 seconds', () => {
      state.start();

      const frameInterval = 33; // ~30Hz
      const totalDuration = 40000; // 40 seconds
      const frameCount = Math.floor(totalDuration / frameInterval);

      // Simulate 40s of pitch data
      for (let i = 0; i < frameCount; i++) {
        vi.advanceTimersByTime(frameInterval);
        state.onPitchDetected({
          frequency: 261.63, // C4
          confidence: 0.95,
          noteName: 'C4',
          midiNote: 60,
          centsOff: 0,
          rms: 0.02,
        });
      }

      // All entries should survive — no trimming
      expect(state.pitchHistory.length).toBe(frameCount);

      // Earliest entry should still exist (time near 33ms, the first frame)
      expect(state.pitchHistory[0].time).toBeLessThan(100);
    });
  });

  describe('octave-jump correction', () => {
    it('should correct 3rd harmonic in currentPitch', () => {
      state.start();

      const c4Freq = FrequencyConverter.midiToFrequency(60); // C4

      // Establish baseline with 6 pitches at C4
      for (let i = 0; i < 6; i++) {
        vi.advanceTimersByTime(33);
        state.onPitchDetected({
          frequency: c4Freq,
          confidence: 0.95,
          noteName: 'C4',
          midiNote: 60,
          centsOff: 0,
          rms: 0.02,
        });
      }

      // Send MIDI 79 (G5) — 19 semitones higher = 3rd harmonic error
      const g5Freq = FrequencyConverter.midiToFrequency(79);
      vi.advanceTimersByTime(33);
      state.onPitchDetected({
        frequency: g5Freq,
        confidence: 0.95,
        noteName: 'G5',
        midiNote: 79,
        centsOff: 0,
        rms: 0.02,
      });

      // currentPitch should be corrected back to MIDI 60 (C4)
      const correctedMidi = FrequencyConverter.frequencyToMidi(state.currentPitch.frequency);
      expect(Math.round(correctedMidi)).toBe(60);

      // Should be marked as harmonic-corrected
      expect(state.currentPitch.harmonicCorrected).toBe(19);
    });

    it('should provide corrected pitch suitable for exercise engine', () => {
      state.start();

      const c4Freq = FrequencyConverter.midiToFrequency(60);

      // Establish baseline
      for (let i = 0; i < 6; i++) {
        vi.advanceTimersByTime(33);
        state.onPitchDetected({
          frequency: c4Freq,
          confidence: 0.95,
          noteName: 'C4',
          midiNote: 60,
          centsOff: 0,
          rms: 0.02,
        });
      }

      // Send a 3rd harmonic error (MIDI 79)
      const g5Freq = FrequencyConverter.midiToFrequency(79);
      vi.advanceTimersByTime(33);
      const rawInput = {
        frequency: g5Freq,
        confidence: 0.95,
        noteName: 'G5',
        midiNote: 79,
        centsOff: 0,
        rms: 0.02,
      };
      state.onPitchDetected(rawInput);

      // Raw input was MIDI 79
      expect(Math.round(FrequencyConverter.frequencyToMidi(g5Freq))).toBe(79);

      // But currentPitch (what consumers should use) is corrected to MIDI 60
      const currentMidi = FrequencyConverter.frequencyToMidi(state.currentPitch.frequency);
      expect(Math.round(currentMidi)).toBe(60);
    });
  });
});
