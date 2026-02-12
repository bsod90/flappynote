/**
 * Exercise Types Index
 *
 * Exports all exercise types and a registry for lookup by key.
 */

export { BaseExercise } from './BaseExercise.js';
export { BaseIntervalExercise } from './BaseIntervalExercise.js';

// Ladder exercises
export { AscendingMajorLadder } from './AscendingMajorLadder.js';
export { AscendingMinorLadder } from './AscendingMinorLadder.js';
export { DescendingMajorLadder } from './DescendingMajorLadder.js';
export { DescendingMinorLadder } from './DescendingMinorLadder.js';
export { TonicReturnMajor } from './TonicReturnMajor.js';
export { TonicReturnMinor } from './TonicReturnMinor.js';

// Triad and seventh exercises
export { MajorTriad } from './MajorTriad.js';
export { MinorTriad } from './MinorTriad.js';
export { MajorSeventh } from './MajorSeventh.js';
export { MinorSeventh } from './MinorSeventh.js';

// Interval exercises
export { SemitoneUpExercise, SemitoneDownExercise } from './SemitoneExercise.js';
export { ToneUpExercise, ToneDownExercise } from './ToneExercise.js';
export { MinorThirdUpExercise, MajorThirdUpExercise, MinorThirdDownExercise, MajorThirdDownExercise } from './ThirdExercise.js';
export { FourthUpExercise, FourthDownExercise } from './FourthExercise.js';
export { FifthUpExercise, FifthDownExercise } from './FifthExercise.js';

// Legacy export for backwards compatibility
export { AscendingMajorLadder as ScaleDegreePatternExercise } from './AscendingMajorLadder.js';

/**
 * Exercise registry for lookup by key
 */
import { AscendingMajorLadder } from './AscendingMajorLadder.js';
import { AscendingMinorLadder } from './AscendingMinorLadder.js';
import { DescendingMajorLadder } from './DescendingMajorLadder.js';
import { DescendingMinorLadder } from './DescendingMinorLadder.js';
import { TonicReturnMajor } from './TonicReturnMajor.js';
import { TonicReturnMinor } from './TonicReturnMinor.js';
import { MajorTriad } from './MajorTriad.js';
import { MinorTriad } from './MinorTriad.js';
import { MajorSeventh } from './MajorSeventh.js';
import { MinorSeventh } from './MinorSeventh.js';
import { SemitoneUpExercise, SemitoneDownExercise } from './SemitoneExercise.js';
import { ToneUpExercise, ToneDownExercise } from './ToneExercise.js';
import { MinorThirdUpExercise, MajorThirdUpExercise, MinorThirdDownExercise, MajorThirdDownExercise } from './ThirdExercise.js';
import { FourthUpExercise, FourthDownExercise } from './FourthExercise.js';
import { FifthUpExercise, FifthDownExercise } from './FifthExercise.js';

export const ExerciseRegistry = {
  // Ladders
  ascendingMajorLadder: AscendingMajorLadder,
  ascendingMinorLadder: AscendingMinorLadder,
  descendingMajorLadder: DescendingMajorLadder,
  descendingMinorLadder: DescendingMinorLadder,
  tonicReturnMajor: TonicReturnMajor,
  tonicReturnMinor: TonicReturnMinor,

  // Triads & Sevenths
  majorTriad: MajorTriad,
  minorTriad: MinorTriad,
  majorSeventh: MajorSeventh,
  minorSeventh: MinorSeventh,

  // Intervals
  semitoneUp: SemitoneUpExercise,
  semitoneDown: SemitoneDownExercise,
  toneUp: ToneUpExercise,
  toneDown: ToneDownExercise,
  minorThirdUp: MinorThirdUpExercise,
  majorThirdUp: MajorThirdUpExercise,
  minorThirdDown: MinorThirdDownExercise,
  majorThirdDown: MajorThirdDownExercise,
  fourthUp: FourthUpExercise,
  fourthDown: FourthDownExercise,
  fifthUp: FifthUpExercise,
  fifthDown: FifthDownExercise,
};

/**
 * Get exercise class by key
 * @param {string} key - Exercise type key
 * @returns {typeof BaseExercise|null}
 */
export function getExerciseClass(key) {
  return ExerciseRegistry[key] || null;
}

/**
 * Create exercise instance by key
 * @param {string} key - Exercise type key
 * @returns {BaseExercise|null}
 */
export function createExercise(key) {
  const ExerciseClass = getExerciseClass(key);
  return ExerciseClass ? new ExerciseClass() : null;
}

/**
 * Get all available exercise types
 * @returns {Array<{key: string, name: string, scaleType: string|null}>}
 */
export function getAvailableExercises() {
  return Object.entries(ExerciseRegistry).map(([key, ExerciseClass]) => {
    const instance = new ExerciseClass();
    return {
      key,
      name: instance.name,
      scaleType: instance.scaleType,
    };
  });
}
