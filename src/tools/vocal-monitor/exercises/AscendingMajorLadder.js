/**
 * AscendingMajorLadder - Ascending scale degree patterns in major scale.
 *
 * Generates ladders starting from the root:
 *   1, 1-2-1, 1-2-3-2-1, ... up to 1-2-3-4-5-6-7-8-7-6-5-4-3-2-1
 */

import { BaseExercise } from './BaseExercise.js';
import { FrequencyConverter } from '../../../pitch-engine/index.js';
import { TargetState } from '../ExerciseEngine.js';

export class AscendingMajorLadder extends BaseExercise {
  constructor() {
    super();
    this.name = 'Ascending Major Ladder';
    this.description = 'Ascending patterns through the major scale';
    this.scaleType = 'major'; // Locks scale to major
    this.sustainDuration = 300; // 0.3 seconds
  }

  /**
   * Generate degree indices for a given ladder number (1-based).
   * Ladder 1: [0]
   * Ladder 2: [0, 1, 0]
   * Ladder N: [0, 1, ..., N-1, ..., 1, 0]
   * @param {number} ladderNum - 1-based ladder number
   * @returns {number[]} Array of scale degree indices
   */
  static generateLadderPattern(ladderNum) {
    if (ladderNum <= 1) return [0];

    const ascending = [];
    for (let i = 0; i < ladderNum; i++) {
      ascending.push(i);
    }
    const descending = [];
    for (let i = ladderNum - 2; i >= 0; i--) {
      descending.push(i);
    }
    return [...ascending, ...descending];
  }

  /**
   * Generate a single phase with all targets in one continuous sequence
   * @param {ScaleManager} scaleManager
   * @returns {Array} Array with one phase containing all targets
   */
  generatePhases(scaleManager) {
    const degrees = scaleManager.getAllDegrees();
    const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());
    const ladderCount = Math.min(8, degrees.length);

    // Concatenate all ladders into one sequence
    const allTargets = [];

    for (let ladder = 1; ladder <= ladderCount; ladder++) {
      // Insert rest between ladders (not before the first)
      if (ladder > 1) {
        allTargets.push({ rest: true, restDuration: 500, state: TargetState.WAITING });
      }

      const degreeIndices = AscendingMajorLadder.generateLadderPattern(ladder);

      for (const di of degreeIndices) {
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
          ladder, // Track which ladder this belongs to
          state: TargetState.WAITING,
        });
      }
    }

    // Build label showing all ladders
    const ladderLabels = [];
    for (let i = 1; i <= ladderCount; i++) {
      ladderLabels.push(AscendingMajorLadder.generateLadderPattern(i).map(d => d + 1).join('-'));
    }
    const label = ladderLabels.join(', ');

    return [{
      label,
      targets: allTargets,
    }];
  }
}
