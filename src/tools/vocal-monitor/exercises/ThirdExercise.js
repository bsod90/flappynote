/**
 * ThirdExercise - Third interval exercises.
 *
 * Minor Third Up: Do -> Me -> Do (+3 semitones)
 * Major Third Up: Do -> Mi -> Do (+4 semitones)
 * Minor Third Down: Do -> La -> Do (-3 semitones)
 * Major Third Down: Do -> Le -> Do (-4 semitones)
 */

import { BaseIntervalExercise } from './BaseIntervalExercise.js';

export class MinorThirdUpExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 3,
      direction: 'up',
      intervalLabel: 'Me',
      name: 'Minor Third Up',
      description: 'Minor third up: Do-Me-Do',
    });
  }
}

export class MajorThirdUpExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 4,
      direction: 'up',
      intervalLabel: 'Mi',
      name: 'Major Third Up',
      description: 'Major third up: Do-Mi-Do',
    });
  }
}

export class MinorThirdDownExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 3,
      direction: 'down',
      intervalLabel: 'La',
      name: 'Minor Third Down',
      description: 'Minor third down: Do-La-Do',
    });
  }
}

export class MajorThirdDownExercise extends BaseIntervalExercise {
  constructor() {
    super({
      intervalSemitones: 4,
      direction: 'down',
      intervalLabel: 'Le',
      name: 'Major Third Down',
      description: 'Major third down: Do-Le-Do',
    });
  }
}
