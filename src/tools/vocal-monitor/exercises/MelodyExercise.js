/**
 * MelodyExercise - sing-along exercise built from a melody definition
 * (see melodies.js). Targets are absolute semitone offsets from the chosen
 * root, each carrying one lyric syllable; phrase-ending notes hold longer.
 */

import { BaseExercise } from './BaseExercise.js';
import { FrequencyConverter } from '../../../pitch-engine/index.js';
import { TargetState } from '../ExerciseEngine.js';

const BASE_SUSTAIN_MS = 250;

export class MelodyExercise extends BaseExercise {
  /**
   * @param {object} melody - { name, scaleType, notes: [{ s, l, hold? }] }
   */
  constructor(melody) {
    super();
    this.melody = melody;
    this.name = melody.name;
    this.description = `Sing "${melody.name}" with lyrics`;
    this.scaleType = melody.scaleType ?? 'major';
    this.sustainDuration = BASE_SUSTAIN_MS;
  }

  generatePhases(scaleManager) {
    const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());

    const targets = this.melody.notes.map(({ s, l, hold }) => {
      const midiNote = rootMidi + s;
      return {
        midiNote,
        frequency: FrequencyConverter.midiToFrequency(midiNote),
        label: l,
        lyric: l,
        state: TargetState.WAITING,
        ...(hold ? { sustainDuration: BASE_SUSTAIN_MS * hold } : {}),
      };
    });

    return [{
      label: this.melody.name,
      targets,
    }];
  }
}

/**
 * Build a MelodyExercise subclass bound to one melody, so the registry's
 * `new ExerciseClass()` convention keeps working.
 */
export function melodyExerciseClass(melody) {
  return class BoundMelodyExercise extends MelodyExercise {
    constructor() {
      super(melody);
    }
  };
}
