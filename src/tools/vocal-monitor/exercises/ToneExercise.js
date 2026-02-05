/**
 * ToneExercise - Whole tone (major second) interval exercises.
 *
 * Up: Do -> Re -> Do (+2 semitones)
 * Down: Do -> Te -> Do (-2 semitones)
 */

import { BaseIntervalExercise } from './BaseIntervalExercise.js';

export class ToneUpExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 2,
      direction: 'up',
      intervalLabel: 'Re',
      name: 'Whole Tone Up',
      description: 'Major second up: Do-Re-Do',
    });
  }
}

export class ToneDownExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 2,
      direction: 'down',
      intervalLabel: 'Te',
      name: 'Whole Tone Down',
      description: 'Major second down: Do-Te-Do',
    });
  }
}
