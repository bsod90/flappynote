/**
 * MinorTriad - Triad arpeggio pattern in minor scale.
 *
 * Pattern: 1-3-5-8-5-3-1 (Do-Me-Sol-Do-Sol-Me-Do)
 */

import { BaseExercise } from './BaseExercise.js';
import { FrequencyConverter } from '../../../pitch-engine/index.js';
import { TargetState } from '../ExerciseEngine.js';

export class MinorTriad extends BaseExercise {
  constructor() {
    super();
    this.name = 'Minor Triad';
    this.description = 'Minor triad arpeggio: Do-Me-Sol-Do-Sol-Me-Do';
    this.scaleType = 'minor'; // Locks scale to minor
    this.sustainDuration = 300; // 0.3 seconds - slightly longer for arpeggio
  }

  /**
   * Generate a single phase with the triad pattern
   * @param {ScaleManager} scaleManager
   * @returns {Array} Array with one phase containing all targets
   */
  generatePhases(scaleManager) {
    const degrees = scaleManager.getAllDegrees();
    const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());

    // Triad pattern: 1-3-5-8-5-3-1 (0-indexed: 0-2-4-7-4-2-0)
    // In a minor scale: Do(0)-Me(2)-Sol(4)-Do(7)-Sol(4)-Me(2)-Do(0)
    const pattern = [0, 2, 4, 7, 4, 2, 0];

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
      label: '1-3-5-8-5-3-1',
      targets: allTargets,
    }];
  }
}
