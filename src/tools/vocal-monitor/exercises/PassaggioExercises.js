/**
 * Passaggio (register transition) exercises.
 *
 * Classic vocal pedagogy drills adapted to the discrete-target engine:
 *   - Siren: a continuous scale run up and over the break and back down,
 *     short sustains so the voice keeps moving like a glide
 *   - Fifth slide: stepwise 1→5→1, the bottom half of the siren — good for
 *     warming up the transition without crossing it
 *   - Octave leap: 1-8-1 jumps that force a clean register switch, longer
 *     sustains to settle each side of the break
 *
 * Combine with rolling key to walk these through your passaggio range.
 */

import { BaseExercise } from './BaseExercise.js';
import { FrequencyConverter } from '../../../pitch-engine/index.js';
import { TargetState } from '../ExerciseEngine.js';

function degreeTargets(scaleManager, degreeIndices) {
  const degrees = scaleManager.getAllDegrees();
  const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());

  return degreeIndices.map((di) => {
    const degree = degrees[di];
    const midiNote = rootMidi + degree.interval;
    return {
      scaleDegree: di,
      midiNote,
      frequency: FrequencyConverter.midiToFrequency(midiNote),
      label: degree.label,
      degreeNumber: di + 1,
      lyric: degree.label,
      state: TargetState.WAITING,
    };
  });
}

export class SirenExercise extends BaseExercise {
  constructor() {
    super();
    this.name = 'Siren (Scale Run)';
    this.description = 'Glide up the full scale and back down — smooth through the break';
    this.scaleType = 'major';
    this.sustainDuration = 150; // keep the voice moving
  }

  generatePhases(scaleManager) {
    // 1-2-3-4-5-6-7-8-7-6-5-4-3-2-1
    const up = [0, 1, 2, 3, 4, 5, 6, 7];
    const down = [6, 5, 4, 3, 2, 1, 0];
    return [{
      label: 'Siren',
      targets: degreeTargets(scaleManager, [...up, ...down]),
    }];
  }
}

export class FifthSlideExercise extends BaseExercise {
  constructor() {
    super();
    this.name = 'Fifth Slide (1→5→1)';
    this.description = 'Stepwise slide up to the fifth and back';
    this.scaleType = 'major';
    this.sustainDuration = 150;
  }

  generatePhases(scaleManager) {
    return [{
      label: 'Fifth slide',
      targets: degreeTargets(scaleManager, [0, 1, 2, 3, 4, 3, 2, 1, 0]),
    }];
  }
}

export class OctaveLeapExercise extends BaseExercise {
  constructor() {
    super();
    this.name = 'Octave Leap (1-8-1)';
    this.description = 'Leap a full octave and back — clean register switches';
    this.scaleType = 'major';
    this.sustainDuration = 400; // settle on each side of the break
  }

  generatePhases(scaleManager) {
    return [{
      label: 'Octave leap',
      targets: degreeTargets(scaleManager, [0, 7, 0]),
    }];
  }
}
