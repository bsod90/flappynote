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

/**
 * Build targets from scale-degree indices. Indices may exceed the octave:
 * 7 = the octave, 8 = the 9th (re'), 9 = the 10th (mi'), etc. — the degree
 * wraps and the interval gains an octave per wrap.
 */
function degreeTargets(scaleManager, degreeIndices) {
  const degrees = scaleManager.getAllDegrees();
  const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());

  return degreeIndices.map((di) => {
    const octaves = Math.floor(di / 7);
    const base = degrees[di % 7];
    const midiNote = rootMidi + base.interval + octaves * 12;
    return {
      scaleDegree: di % 7,
      midiNote,
      frequency: FrequencyConverter.midiToFrequency(midiNote),
      label: base.label,
      degreeNumber: (di % 7) + 1,
      lyric: base.label,
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

export class NinthSlideExercise extends BaseExercise {
  constructor() {
    super();
    this.name = 'Ninth Slide (1→9→1)';
    this.description = 'Stepwise slide past the octave to the ninth and back — sustained travel through the break';
    this.scaleType = 'major';
    this.sustainDuration = 130;
  }

  generatePhases(scaleManager) {
    // 1-2-3-4-5-6-7-8-9-8-7-6-5-4-3-2-1
    const up = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const down = [7, 6, 5, 4, 3, 2, 1, 0];
    return [{
      label: 'Ninth slide',
      targets: degreeTargets(scaleManager, [...up, ...down]),
    }];
  }
}

export class ArpeggioTenthExercise extends BaseExercise {
  constructor() {
    super();
    this.name = 'Arpeggio to the Tenth (1-3-5-8-10)';
    this.description = 'Major arpeggio up to the tenth and back — wide leaps across the break';
    this.scaleType = 'major';
    this.sustainDuration = 200;
  }

  generatePhases(scaleManager) {
    // 1-3-5-8-10-8-5-3-1 (do mi sol do' mi' do' sol mi do)
    return [{
      label: 'Arpeggio to the tenth',
      targets: degreeTargets(scaleManager, [0, 2, 4, 7, 9, 7, 4, 2, 0]),
    }];
  }
}

export class OctaveBounceExercise extends BaseExercise {
  constructor() {
    super();
    this.name = 'Octave Bounce (1-8-1-8-1)';
    this.description = 'Repeated octave leaps — train the register switch both directions, back to back';
    this.scaleType = 'major';
    this.sustainDuration = 300;
  }

  generatePhases(scaleManager) {
    return [{
      label: 'Octave bounce',
      targets: degreeTargets(scaleManager, [0, 7, 0, 7, 0]),
    }];
  }
}

export class DescendingSirenExercise extends BaseExercise {
  constructor() {
    super();
    this.name = 'Descending Siren (8→1→8)';
    this.description = 'Start at the top in head voice, glide down and back up — the reverse approach to the break';
    this.scaleType = 'major';
    this.sustainDuration = 150;
  }

  generatePhases(scaleManager) {
    // 8-7-6-5-4-3-2-1-2-3-4-5-6-7-8
    const down = [7, 6, 5, 4, 3, 2, 1, 0];
    const up = [1, 2, 3, 4, 5, 6, 7];
    return [{
      label: 'Descending siren',
      targets: degreeTargets(scaleManager, [...down, ...up]),
    }];
  }
}
