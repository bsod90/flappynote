/**
 * SemitoneExercise - Semitone (minor second) interval exercises.
 *
 * Up: Do -> Di -> Do (+1 semitone)
 * Down: Do -> Ti -> Do (-1 semitone)
 */

import { BaseIntervalExercise } from './BaseIntervalExercise.js';

export class SemitoneUpExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 1,
      direction: 'up',
      intervalLabel: 'Di',
      name: 'Semitone Up',
      description: 'Minor second up: Do-Di-Do',
    });
  }
}

export class SemitoneDownExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 1,
      direction: 'down',
      intervalLabel: 'Ti',
      name: 'Semitone Down',
      description: 'Minor second down: Do-Ti-Do',
    });
  }
}
