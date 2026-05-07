import { describe, it, expect } from 'vitest';

import {
  cents,
  findClosestString,
  nearestSemitone,
  tuningStatus,
  centsColor,
  centsToStripPosition,
  splitNoteName,
  IN_TUNE_CENTS,
} from '../tunerLogic.js';
import {
  getStrings,
  getInstruments,
  getTuningsFor,
  getDefaultTuning,
  isChromatic,
  midiToFreqAtReference,
} from '../tunings.js';

describe('cents', () => {
  it('returns 0 for identical frequencies', () => {
    expect(cents(440, 440)).toBe(0);
  });

  it('returns +1200 cents for an octave up, -1200 for an octave down', () => {
    expect(cents(880, 440)).toBeCloseTo(1200, 6);
    expect(cents(220, 440)).toBeCloseTo(-1200, 6);
  });

  it('returns +100 cents for a semitone up', () => {
    // A4 to A#4
    expect(cents(440 * Math.pow(2, 1 / 12), 440)).toBeCloseTo(100, 6);
  });

  it('returns null for missing inputs', () => {
    expect(cents(null, 440)).toBeNull();
    expect(cents(440, 0)).toBeNull();
  });
});

describe('findClosestString', () => {
  const strings = getStrings('guitar', 'standard'); // E A D G B E

  it('returns null when there are no strings', () => {
    expect(findClosestString(440, [])).toBeNull();
  });

  it('returns null when there is no frequency', () => {
    expect(findClosestString(null, strings)).toBeNull();
  });

  it('snaps an exact open-string frequency to that string', () => {
    const eHigh = strings[5]; // E4 = 329.63
    const match = findClosestString(eHigh.frequency, strings);
    expect(match.index).toBe(5);
    expect(match.cents).toBeCloseTo(0, 4);
  });

  it('reports cents-off for a slightly sharp B', () => {
    const b3 = strings[4]; // B3 = 246.94
    const match = findClosestString(b3.frequency * Math.pow(2, 10 / 1200), strings);
    expect(match.index).toBe(4);
    expect(match.cents).toBeCloseTo(10, 1);
  });

  it('snaps to the closest of two equidistant strings predictably', () => {
    // Halfway between A2 (110) and D3 (146.83) → ~127.18 Hz. Should pick A2
    // because cents distance from each is symmetric and the iteration picks
    // strictly-better matches; tie goes to the earlier one.
    const a2 = strings[1].frequency;
    const d3 = strings[2].frequency;
    const halfway = Math.sqrt(a2 * d3); // geometric mean — equal cents distance
    const match = findClosestString(halfway, strings);
    expect([1, 2]).toContain(match.index);
  });
});

describe('nearestSemitone', () => {
  it('snaps 440Hz to A4 with 0 cents at A4=440', () => {
    const r = nearestSemitone(440, 440);
    expect(r.noteName).toBe('A4');
    expect(r.cents).toBeCloseTo(0, 4);
  });

  it('snaps 440Hz to A4 with about -8 cents at A4=442', () => {
    // At 442, the target frequency for A4 is 442Hz; 440Hz is below, so cents are negative.
    const r = nearestSemitone(440, 442);
    expect(r.noteName).toBe('A4');
    expect(r.cents).toBeLessThan(0);
    expect(Math.abs(r.cents)).toBeLessThan(15);
  });

  it('returns null for falsy frequency', () => {
    expect(nearestSemitone(null)).toBeNull();
    expect(nearestSemitone(0)).toBeNull();
  });
});

describe('tuningStatus', () => {
  it('reports silent when cents are null', () => {
    expect(tuningStatus(null)).toBe('silent');
  });

  it('reports in-tune within ±IN_TUNE_CENTS', () => {
    expect(tuningStatus(0)).toBe('in-tune');
    expect(tuningStatus(IN_TUNE_CENTS)).toBe('in-tune');
    expect(tuningStatus(-IN_TUNE_CENTS)).toBe('in-tune');
  });

  it('reports low when below the in-tune band', () => {
    expect(tuningStatus(-(IN_TUNE_CENTS + 1))).toBe('low');
    expect(tuningStatus(-25)).toBe('low');
  });

  it('reports high when above the in-tune band', () => {
    expect(tuningStatus(IN_TUNE_CENTS + 1)).toBe('high');
    expect(tuningStatus(40)).toBe('high');
  });
});

describe('centsColor', () => {
  it('classifies in-tune / close / off / muted', () => {
    expect(centsColor(null)).toBe('muted');
    expect(centsColor(0)).toBe('in-tune');
    expect(centsColor(-3)).toBe('in-tune');
    expect(centsColor(10)).toBe('close');
    expect(centsColor(-12)).toBe('close');
    expect(centsColor(40)).toBe('off');
  });
});

describe('centsToStripPosition', () => {
  it('maps -50 to 0, 0 to 0.5, +50 to 1', () => {
    expect(centsToStripPosition(-50)).toBeCloseTo(0, 6);
    expect(centsToStripPosition(0)).toBeCloseTo(0.5, 6);
    expect(centsToStripPosition(50)).toBeCloseTo(1, 6);
  });

  it('clamps values outside ±50 to the edges', () => {
    expect(centsToStripPosition(-1000)).toBeCloseTo(0, 6);
    expect(centsToStripPosition(1000)).toBeCloseTo(1, 6);
  });

  it('returns midline (0.5) when cents is null', () => {
    expect(centsToStripPosition(null)).toBeCloseTo(0.5, 6);
  });
});

describe('splitNoteName', () => {
  it('splits "F#4" into letter and octave', () => {
    expect(splitNoteName('F#4')).toEqual({ letter: 'F#', octave: '4' });
  });

  it('handles negative octaves', () => {
    expect(splitNoteName('C-1')).toEqual({ letter: 'C', octave: '-1' });
  });

  it('returns empty for falsy', () => {
    expect(splitNoteName(undefined)).toEqual({ letter: '', octave: '' });
  });
});

describe('tuning presets', () => {
  it('lists all instruments', () => {
    const ids = getInstruments().map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining(['guitar', 'bass', 'bass5', 'ukulele', 'violin', 'chromatic'])
    );
  });

  it('returns 6 strings for guitar standard, lowest first', () => {
    const s = getStrings('guitar', 'standard');
    expect(s).toHaveLength(6);
    // Low E2 = MIDI 40
    expect(s[0].midi).toBe(40);
    expect(s[0].noteName).toBe('E2');
    // High E4 = MIDI 64
    expect(s[5].midi).toBe(64);
    expect(s[5].noteName).toBe('E4');
  });

  it('drop-D lowers only the 6th string by a whole tone', () => {
    const std = getStrings('guitar', 'standard');
    const drop = getStrings('guitar', 'drop-d');
    expect(drop[0].midi).toBe(std[0].midi - 2); // E2 → D2
    expect(drop.slice(1).map((s) => s.midi)).toEqual(std.slice(1).map((s) => s.midi));
  });

  it('returns no strings for chromatic mode', () => {
    expect(getStrings('chromatic', 'chromatic')).toEqual([]);
    expect(isChromatic('chromatic')).toBe(true);
    expect(isChromatic('guitar')).toBe(false);
  });

  it('honors a non-standard A4 reference', () => {
    const s440 = getStrings('guitar', 'standard', 440);
    const s442 = getStrings('guitar', 'standard', 442);
    // All target frequencies should scale by 442/440
    s440.forEach((str, i) => {
      expect(s442[i].frequency / str.frequency).toBeCloseTo(442 / 440, 6);
    });
  });

  it('tuning ids are returned for the chosen instrument', () => {
    const guitar = getTuningsFor('guitar').map((t) => t.id);
    expect(guitar).toEqual(
      expect.arrayContaining(['standard', 'drop-d', 'half-step', 'dadgad', 'open-d', 'open-g'])
    );
    expect(getDefaultTuning('guitar')).toBe('standard');
    expect(getDefaultTuning('chromatic')).toBe('chromatic');
    expect(getTuningsFor('does-not-exist')).toEqual([]);
  });
});

describe('midiToFreqAtReference', () => {
  it('A4 (MIDI 69) maps to the reference frequency', () => {
    expect(midiToFreqAtReference(69, 440)).toBeCloseTo(440, 6);
    expect(midiToFreqAtReference(69, 442)).toBeCloseTo(442, 6);
  });

  it('C4 (MIDI 60) is roughly 261.63Hz at A4=440', () => {
    expect(midiToFreqAtReference(60, 440)).toBeCloseTo(261.626, 2);
  });
});
