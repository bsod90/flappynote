/**
 * FifthExercise - Perfect fifth interval exercises.
 *
 * Up: Do -> Sol -> Do (+7 semitones)
 * Down: Do -> Fa -> Do (-7 semitones, down to Fa below)
 */

import { BaseIntervalExercise } from './BaseIntervalExercise.js';

export class FifthUpExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 7,
      direction: 'up',
      intervalLabel: 'Sol',
      name: 'Perfect Fifth Up',
      description: 'Perfect fifth up: Do-Sol-Do',
    });
  }
}

export class FifthDownExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 7,
      direction: 'down',
      intervalLabel: 'Fa',
      name: 'Perfect Fifth Down',
      description: 'Perfect fifth down: Do-Fa-Do',
    });
  }
}
