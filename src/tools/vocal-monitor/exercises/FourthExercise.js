/**
 * FourthExercise - Perfect fourth interval exercises.
 *
 * Up: Do -> Fa -> Do (+5 semitones)
 * Down: Do -> Sol -> Do (-5 semitones, down to Sol below)
 */

import { BaseIntervalExercise } from './BaseIntervalExercise.js';

export class FourthUpExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 5,
      direction: 'up',
      intervalLabel: 'Fa',
      name: 'Perfect Fourth Up',
      description: 'Perfect fourth up: Do-Fa-Do',
    });
  }
}

export class FourthDownExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 5,
      direction: 'down',
      intervalLabel: 'Sol',
      name: 'Perfect Fourth Down',
      description: 'Perfect fourth down: Do-Sol-Do',
    });
  }
}
