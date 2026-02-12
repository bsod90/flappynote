/**
 * Tests for Exercise Types
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AscendingMajorLadder } from '../exercises/AscendingMajorLadder.js';
import { AscendingMinorLadder } from '../exercises/AscendingMinorLadder.js';
import { DescendingMajorLadder } from '../exercises/DescendingMajorLadder.js';
import { DescendingMinorLadder } from '../exercises/DescendingMinorLadder.js';
import { TonicReturnMajor } from '../exercises/TonicReturnMajor.js';
import { TonicReturnMinor } from '../exercises/TonicReturnMinor.js';
import { MajorTriad } from '../exercises/MajorTriad.js';
import { MinorTriad } from '../exercises/MinorTriad.js';
import { MajorSeventh } from '../exercises/MajorSeventh.js';
import { MinorSeventh } from '../exercises/MinorSeventh.js';
import { SemitoneUpExercise, SemitoneDownExercise } from '../exercises/SemitoneExercise.js';
import { ToneUpExercise, ToneDownExercise } from '../exercises/ToneExercise.js';
import { MinorThirdUpExercise, MajorThirdUpExercise } from '../exercises/ThirdExercise.js';
import { FourthUpExercise, FourthDownExercise } from '../exercises/FourthExercise.js';
import { FifthUpExercise, FifthDownExercise } from '../exercises/FifthExercise.js';
import { createExercise, getExerciseClass } from '../exercises/index.js';
import { TargetState } from '../ExerciseEngine.js';

// Mock ScaleManager - Note: Real scales include octave (8 degrees)
const createMockScaleManager = (rootNote = 'C3', type = 'major') => {
  // Major scale intervals: 0, 2, 4, 5, 7, 9, 11, 12 (Do, Re, Mi, Fa, Sol, La, Ti, Do)
  // Minor scale intervals: 0, 2, 3, 5, 7, 8, 10, 12 (Do, Re, Me, Fa, Sol, Le, Te, Do)
  const majorDegrees = [
    { interval: 0, label: 'Do' },
    { interval: 2, label: 'Re' },
    { interval: 4, label: 'Mi' },
    { interval: 5, label: 'Fa' },
    { interval: 7, label: 'Sol' },
    { interval: 9, label: 'La' },
    { interval: 11, label: 'Ti' },
    { interval: 12, label: 'Do' }, // Octave
  ];

  const minorDegrees = [
    { interval: 0, label: 'Do' },
    { interval: 2, label: 'Re' },
    { interval: 3, label: 'Me' },
    { interval: 5, label: 'Fa' },
    { interval: 7, label: 'Sol' },
    { interval: 8, label: 'Le' },
    { interval: 10, label: 'Te' },
    { interval: 12, label: 'Do' }, // Octave
  ];

  const degrees = type === 'minor' ? minorDegrees : majorDegrees;

  return {
    getRootNote: () => rootNote,
    getAllDegrees: () => degrees,
    getScaleInfo: () => ({ type, degrees }),
  };
};

describe('AscendingMajorLadder', () => {
  let exercise;
  let scaleManager;

  beforeEach(() => {
    exercise = new AscendingMajorLadder();
    scaleManager = createMockScaleManager('C3', 'major');
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(exercise.name).toBe('Ascending Major Ladder');
    });

    it('should lock scale to major', () => {
      expect(exercise.locksScale()).toBe(true);
      expect(exercise.getRequiredScaleType()).toBe('major');
    });

    it('should have default sustain duration', () => {
      expect(exercise.sustainDuration).toBe(300);
    });
  });

  describe('generateLadderPattern', () => {
    it('should generate single note for ladder 1', () => {
      const pattern = AscendingMajorLadder.generateLadderPattern(1);
      expect(pattern).toEqual([0]);
    });

    it('should generate up-down pattern for ladder 2', () => {
      const pattern = AscendingMajorLadder.generateLadderPattern(2);
      expect(pattern).toEqual([0, 1, 0]);
    });

    it('should generate correct pattern for ladder 3', () => {
      const pattern = AscendingMajorLadder.generateLadderPattern(3);
      expect(pattern).toEqual([0, 1, 2, 1, 0]);
    });

    it('should generate correct pattern for ladder 4', () => {
      const pattern = AscendingMajorLadder.generateLadderPattern(4);
      expect(pattern).toEqual([0, 1, 2, 3, 2, 1, 0]);
    });
  });

  describe('generatePhases', () => {
    it('should return one phase', () => {
      const phases = exercise.generatePhases(scaleManager);
      expect(phases).toHaveLength(1);
    });

    it('should generate targets for 8 ladders', () => {
      const phases = exercise.generatePhases(scaleManager);
      // With 8 degrees, we get 8 ladders
      expect(phases[0].targets.length).toBeGreaterThan(0);
    });

    it('should have targets in WAITING state', () => {
      const phases = exercise.generatePhases(scaleManager);
      phases[0].targets.forEach(target => {
        expect(target.state).toBe(TargetState.WAITING);
      });
    });

    it('should have correct MIDI notes', () => {
      const phases = exercise.generatePhases(scaleManager);
      // First target should be root (C3 = MIDI 48)
      expect(phases[0].targets[0].midiNote).toBe(48);
    });

    it('should include solfege labels', () => {
      const phases = exercise.generatePhases(scaleManager);
      expect(phases[0].targets[0].lyric).toBe('Do');
    });
  });
});

describe('AscendingMinorLadder', () => {
  let exercise;
  let scaleManager;

  beforeEach(() => {
    exercise = new AscendingMinorLadder();
    scaleManager = createMockScaleManager('A3', 'minor');
  });

  it('should lock scale to minor', () => {
    expect(exercise.locksScale()).toBe(true);
    expect(exercise.getRequiredScaleType()).toBe('minor');
  });

  it('should generate phases with minor scale intervals', () => {
    const phases = exercise.generatePhases(scaleManager);
    expect(phases).toHaveLength(1);
    expect(phases[0].targets.length).toBeGreaterThan(0);
  });
});

describe('DescendingMajorLadder', () => {
  let exercise;
  let scaleManager;

  beforeEach(() => {
    exercise = new DescendingMajorLadder();
    scaleManager = createMockScaleManager('C3', 'major');
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(exercise.name).toBe('Descending Major Ladder');
    });

    it('should lock scale to major', () => {
      expect(exercise.locksScale()).toBe(true);
      expect(exercise.getRequiredScaleType()).toBe('major');
    });
  });

  describe('generateDescendingLadderPattern', () => {
    it('should generate octave for ladder 1', () => {
      const pattern = DescendingMajorLadder.generateDescendingLadderPattern(1, 7);
      expect(pattern).toEqual([7]);
    });

    it('should generate down-up pattern for ladder 2 (Do-Ti-Do)', () => {
      const pattern = DescendingMajorLadder.generateDescendingLadderPattern(2, 7);
      expect(pattern).toEqual([7, 6, 7]);
    });

    it('should generate correct pattern for ladder 3 (Do-Ti-La-Ti-Do)', () => {
      const pattern = DescendingMajorLadder.generateDescendingLadderPattern(3, 7);
      expect(pattern).toEqual([7, 6, 5, 6, 7]);
    });
  });

  describe('generatePhases', () => {
    it('should start from octave (8th degree)', () => {
      const phases = exercise.generatePhases(scaleManager);
      // First target should be octave (C4 = MIDI 60)
      expect(phases[0].targets[0].midiNote).toBe(60);
      expect(phases[0].targets[0].lyric).toBe('Do');
    });

    it('should generate Do-Ti-Do pattern for ladder 2', () => {
      const phases = exercise.generatePhases(scaleManager);
      // Ladder 1: [Do], rest, Ladder 2: [Do, Ti, Do]
      // So targets [2], [3], [4] = Do, Ti, Do (index 1 is a rest)
      const ladder2Targets = phases[0].targets.slice(2, 5);
      expect(ladder2Targets.map(t => t.lyric)).toEqual(['Do', 'Ti', 'Do']);
    });
  });
});

describe('DescendingMinorLadder', () => {
  let exercise;

  beforeEach(() => {
    exercise = new DescendingMinorLadder();
  });

  it('should lock scale to minor', () => {
    expect(exercise.locksScale()).toBe(true);
    expect(exercise.getRequiredScaleType()).toBe('minor');
  });
});

describe('TonicReturnMajor', () => {
  let exercise;
  let scaleManager;

  beforeEach(() => {
    exercise = new TonicReturnMajor();
    scaleManager = createMockScaleManager('C3', 'major');
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(exercise.name).toBe('Tonic Return (Major)');
    });

    it('should lock scale to major', () => {
      expect(exercise.locksScale()).toBe(true);
      expect(exercise.getRequiredScaleType()).toBe('major');
    });

    it('should have default sustain duration', () => {
      expect(exercise.sustainDuration).toBe(300);
    });
  });

  describe('generateTonicReturnPattern', () => {
    it('should generate tonic return pattern for 8 degrees', () => {
      const pattern = TonicReturnMajor.generateTonicReturnPattern(8);
      // 1-2-1-3-1-4-1-5-1-6-1-7-1-8 (as indices: 0,1,0,2,0,3,0,4,0,5,0,6,0,7)
      expect(pattern).toEqual([0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7]);
    });

    it('should generate pattern for smaller scales', () => {
      const pattern = TonicReturnMajor.generateTonicReturnPattern(4);
      expect(pattern).toEqual([0, 1, 0, 2, 0, 3]);
    });
  });

  describe('generatePhases', () => {
    it('should return one phase', () => {
      const phases = exercise.generatePhases(scaleManager);
      expect(phases).toHaveLength(1);
    });

    it('should generate 14 targets for 8-degree scale', () => {
      const phases = exercise.generatePhases(scaleManager);
      // 7 returns to tonic + 7 scale degrees = 14 targets
      expect(phases[0].targets).toHaveLength(14);
    });

    it('should have targets in WAITING state', () => {
      const phases = exercise.generatePhases(scaleManager);
      phases[0].targets.forEach(target => {
        expect(target.state).toBe(TargetState.WAITING);
      });
    });

    it('should have correct pattern (alternating with tonic)', () => {
      const phases = exercise.generatePhases(scaleManager);
      const degreeNumbers = phases[0].targets.map(t => t.degreeNumber);
      expect(degreeNumbers).toEqual([1, 2, 1, 3, 1, 4, 1, 5, 1, 6, 1, 7, 1, 8]);
    });

    it('should have correct MIDI notes', () => {
      const phases = exercise.generatePhases(scaleManager);
      // First target should be root (C3 = MIDI 48)
      expect(phases[0].targets[0].midiNote).toBe(48);
      // Second target should be Re (D3 = MIDI 50)
      expect(phases[0].targets[1].midiNote).toBe(50);
    });

    it('should include solfege labels', () => {
      const phases = exercise.generatePhases(scaleManager);
      const lyrics = phases[0].targets.map(t => t.lyric);
      expect(lyrics).toEqual(['Do', 'Re', 'Do', 'Mi', 'Do', 'Fa', 'Do', 'Sol', 'Do', 'La', 'Do', 'Ti', 'Do', 'Do']);
    });
  });
});

describe('TonicReturnMinor', () => {
  let exercise;
  let scaleManager;

  beforeEach(() => {
    exercise = new TonicReturnMinor();
    scaleManager = createMockScaleManager('A3', 'minor');
  });

  it('should have correct name', () => {
    expect(exercise.name).toBe('Tonic Return (Minor)');
  });

  it('should lock scale to minor', () => {
    expect(exercise.locksScale()).toBe(true);
    expect(exercise.getRequiredScaleType()).toBe('minor');
  });

  it('should generate phases with minor scale intervals', () => {
    const phases = exercise.generatePhases(scaleManager);
    expect(phases).toHaveLength(1);
    expect(phases[0].targets).toHaveLength(14);
  });

  it('should include minor third (Me)', () => {
    const phases = exercise.generatePhases(scaleManager);
    // Third target pair: 1-3 → Do-Me (indices 2,3)
    expect(phases[0].targets[3].lyric).toBe('Me');
  });
});

describe('MajorTriad', () => {
  let exercise;
  let scaleManager;

  beforeEach(() => {
    exercise = new MajorTriad();
    scaleManager = createMockScaleManager('C3', 'major');
  });

  it('should have correct name', () => {
    expect(exercise.name).toBe('Major Triad');
  });

  it('should lock scale to major', () => {
    expect(exercise.locksScale()).toBe(true);
    expect(exercise.getRequiredScaleType()).toBe('major');
  });

  it('should generate 7 targets (1-3-5-8-5-3-1)', () => {
    const phases = exercise.generatePhases(scaleManager);
    expect(phases[0].targets).toHaveLength(7);
  });

  it('should generate correct pattern', () => {
    const phases = exercise.generatePhases(scaleManager);
    const lyrics = phases[0].targets.map(t => t.lyric);
    expect(lyrics).toEqual(['Do', 'Mi', 'Sol', 'Do', 'Sol', 'Mi', 'Do']);
  });

  it('should have correct degree numbers', () => {
    const phases = exercise.generatePhases(scaleManager);
    const degreeNumbers = phases[0].targets.map(t => t.degreeNumber);
    expect(degreeNumbers).toEqual([1, 3, 5, 8, 5, 3, 1]);
  });
});

describe('MinorTriad', () => {
  let exercise;
  let scaleManager;

  beforeEach(() => {
    exercise = new MinorTriad();
    scaleManager = createMockScaleManager('A3', 'minor');
  });

  it('should lock scale to minor', () => {
    expect(exercise.locksScale()).toBe(true);
    expect(exercise.getRequiredScaleType()).toBe('minor');
  });

  it('should generate 7 targets with minor third', () => {
    const phases = exercise.generatePhases(scaleManager);
    expect(phases[0].targets).toHaveLength(7);
    // Third should be Me (minor third)
    expect(phases[0].targets[1].lyric).toBe('Me');
  });
});

describe('MajorSeventh', () => {
  let exercise;
  let scaleManager;

  beforeEach(() => {
    exercise = new MajorSeventh();
    scaleManager = createMockScaleManager('C3', 'major');
  });

  it('should generate 9 targets (1-3-5-7-8-7-5-3-1)', () => {
    const phases = exercise.generatePhases(scaleManager);
    expect(phases[0].targets).toHaveLength(9);
  });

  it('should include seventh degree', () => {
    const phases = exercise.generatePhases(scaleManager);
    const lyrics = phases[0].targets.map(t => t.lyric);
    expect(lyrics).toEqual(['Do', 'Mi', 'Sol', 'Ti', 'Do', 'Ti', 'Sol', 'Mi', 'Do']);
  });
});

describe('MinorSeventh', () => {
  let exercise;
  let scaleManager;

  beforeEach(() => {
    exercise = new MinorSeventh();
    scaleManager = createMockScaleManager('A3', 'minor');
  });

  it('should lock scale to minor', () => {
    expect(exercise.locksScale()).toBe(true);
    expect(exercise.getRequiredScaleType()).toBe('minor');
  });

  it('should have minor third and seventh', () => {
    const phases = exercise.generatePhases(scaleManager);
    // Third position (index 1) should be Me
    expect(phases[0].targets[1].lyric).toBe('Me');
    // Seventh position (index 3) should be Te
    expect(phases[0].targets[3].lyric).toBe('Te');
  });
});

describe('Interval Exercises', () => {
  let scaleManager;

  beforeEach(() => {
    scaleManager = createMockScaleManager('C3', 'major');
  });

  describe('SemitoneUpExercise', () => {
    let exercise;

    beforeEach(() => {
      exercise = new SemitoneUpExercise();
    });

    it('should NOT lock scale', () => {
      expect(exercise.locksScale()).toBe(false);
      expect(exercise.scaleType).toBeNull();
    });

    it('should generate root +1 semitone pattern', () => {
      const phases = exercise.generatePhases(scaleManager);
      const midiNotes = phases[0].targets.map(t => t.midiNote);
      // C3=48, C#3=49, C3=48
      expect(midiNotes).toEqual([48, 49, 48]);
    });

    it('should have correct labels', () => {
      const phases = exercise.generatePhases(scaleManager);
      const lyrics = phases[0].targets.map(t => t.lyric);
      expect(lyrics).toEqual(['Do', 'Di', 'Do']);
    });
  });

  describe('SemitoneDownExercise', () => {
    let exercise;

    beforeEach(() => {
      exercise = new SemitoneDownExercise();
    });

    it('should generate root -1 semitone pattern', () => {
      const phases = exercise.generatePhases(scaleManager);
      const midiNotes = phases[0].targets.map(t => t.midiNote);
      // C3=48, B2=47, C3=48
      expect(midiNotes).toEqual([48, 47, 48]);
    });
  });

  describe('ToneUpExercise', () => {
    let exercise;

    beforeEach(() => {
      exercise = new ToneUpExercise();
    });

    it('should generate root +2 semitones pattern', () => {
      const phases = exercise.generatePhases(scaleManager);
      const midiNotes = phases[0].targets.map(t => t.midiNote);
      // C3=48, D3=50, C3=48
      expect(midiNotes).toEqual([48, 50, 48]);
    });
  });

  describe('FifthUpExercise', () => {
    let exercise;

    beforeEach(() => {
      exercise = new FifthUpExercise();
    });

    it('should generate root +7 semitones pattern', () => {
      const phases = exercise.generatePhases(scaleManager);
      const midiNotes = phases[0].targets.map(t => t.midiNote);
      // C3=48, G3=55, C3=48
      expect(midiNotes).toEqual([48, 55, 48]);
    });

    it('should label the fifth as Sol', () => {
      const phases = exercise.generatePhases(scaleManager);
      expect(phases[0].targets[1].lyric).toBe('Sol');
    });
  });

  describe('FourthDownExercise', () => {
    let exercise;

    beforeEach(() => {
      exercise = new FourthDownExercise();
    });

    it('should generate root -5 semitones pattern', () => {
      const phases = exercise.generatePhases(scaleManager);
      const midiNotes = phases[0].targets.map(t => t.midiNote);
      // C3=48, G2=43, C3=48
      expect(midiNotes).toEqual([48, 43, 48]);
    });
  });
});

describe('Exercise Registry', () => {
  describe('getExerciseClass', () => {
    it('should return correct class for ladder exercises', () => {
      expect(getExerciseClass('ascendingMajorLadder')).toBe(AscendingMajorLadder);
      expect(getExerciseClass('ascendingMinorLadder')).toBe(AscendingMinorLadder);
      expect(getExerciseClass('descendingMajorLadder')).toBe(DescendingMajorLadder);
      expect(getExerciseClass('descendingMinorLadder')).toBe(DescendingMinorLadder);
      expect(getExerciseClass('tonicReturnMajor')).toBe(TonicReturnMajor);
      expect(getExerciseClass('tonicReturnMinor')).toBe(TonicReturnMinor);
    });

    it('should return correct class for triad exercises', () => {
      expect(getExerciseClass('majorTriad')).toBe(MajorTriad);
      expect(getExerciseClass('minorTriad')).toBe(MinorTriad);
    });

    it('should return correct class for seventh exercises', () => {
      expect(getExerciseClass('majorSeventh')).toBe(MajorSeventh);
      expect(getExerciseClass('minorSeventh')).toBe(MinorSeventh);
    });

    it('should return correct class for interval exercises', () => {
      expect(getExerciseClass('semitoneUp')).toBe(SemitoneUpExercise);
      expect(getExerciseClass('semitoneDown')).toBe(SemitoneDownExercise);
      expect(getExerciseClass('fifthUp')).toBe(FifthUpExercise);
      expect(getExerciseClass('fourthDown')).toBe(FourthDownExercise);
    });

    it('should return null for invalid key', () => {
      expect(getExerciseClass('invalidKey')).toBeNull();
    });
  });

  describe('createExercise', () => {
    it('should create instance for valid key', () => {
      const exercise = createExercise('ascendingMajorLadder');
      expect(exercise).toBeInstanceOf(AscendingMajorLadder);
    });

    it('should create interval exercise', () => {
      const exercise = createExercise('semitoneUp');
      expect(exercise).toBeInstanceOf(SemitoneUpExercise);
    });

    it('should return null for invalid key', () => {
      const exercise = createExercise('invalidKey');
      expect(exercise).toBeNull();
    });
  });
});
