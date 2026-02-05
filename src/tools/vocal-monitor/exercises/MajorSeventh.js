/**
 * MajorSeventh - Seventh chord arpeggio pattern in major scale.
 *
 * Pattern: 1-3-5-7-8-7-5-3-1 (Do-Mi-Sol-Ti-Do-Ti-Sol-Mi-Do)
 */

import { BaseExercise } from './BaseExercise.js';
import { FrequencyConverter } from '../../../pitch-engine/index.js';
import { TargetState } from '../ExerciseEngine.js';

export class MajorSeventh extends BaseExercise {
  constructor() {
    super();
    this.name = 'Major Seventh';
    this.description = 'Major seventh arpeggio: Do-Mi-Sol-Ti-Do-Ti-Sol-Mi-Do';
    this.scaleType = 'major'; // Locks scale to major
    this.sustainDuration = 300; // 0.3 seconds
  }

  /**
   * Generate a single phase with the seventh chord pattern
   * @param {ScaleManager} scaleManager
   * @returns {Array} Array with one phase containing all targets
   */
  generatePhases(scaleManager) {
    const degrees = scaleManager.getAllDegrees();
    const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());

    // Seventh pattern: 1-3-5-7-8-7-5-3-1 (0-indexed: 0-2-4-6-7-6-4-2-0)
    // In a major scale: Do(0)-Mi(2)-Sol(4)-Ti(6)-Do(7)-Ti(6)-Sol(4)-Mi(2)-Do(0)
    const pattern = [0, 2, 4, 6, 7, 6, 4, 2, 0];

    const allTargets = [];

    for (const di of pattern) {
      const degree = degrees[di];
      const midiNote = rootMidi + degree.interval;
      const frequency = FrequencyConverter.midiToFrequency(midiNote);

      allTargets.push({
        scaleDegree: di,
        midiNote,
        frequency,
        label: degree.label,
        degreeNumber: di + 1,
        lyric: degree.label,
        state: TargetState.WAITING,
      });
    }

    return [{
      label: '1-3-5-7-8-7-5-3-1',
      targets: allTargets,
    }];
  }
}
