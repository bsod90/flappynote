/**
 * DescendingMajorLadder - Descending scale degree patterns in major scale.
 *
 * Generates ladders starting from the octave (8th degree):
 *   8, 8-7-8, 8-7-6-7-8, ... down to 8-7-6-5-4-3-2-1-2-3-4-5-6-7-8
 */

import { BaseExercise } from './BaseExercise.js';
import { FrequencyConverter } from '../../../pitch-engine/index.js';
import { TargetState } from '../ExerciseEngine.js';

export class DescendingMajorLadder extends BaseExercise {
  constructor() {
    super();
    this.name = 'Descending Major Ladder';
    this.description = 'Descending patterns through the major scale';
    this.scaleType = 'major'; // Locks scale to major
    this.sustainDuration = 300; // 0.3 seconds
  }

  /**
   * Generate degree indices for a given descending ladder number (1-based).
   * Ladder 1: [7] (8th degree, 0-indexed as 7)
   * Ladder 2: [7, 6, 7]
   * Ladder N: [7, 6, ..., 7-(N-1), ..., 6, 7]
   * @param {number} ladderNum - 1-based ladder number
   * @param {number} maxDegree - Maximum degree index (default 7 for octave)
   * @returns {number[]} Array of scale degree indices
   */
  static generateDescendingLadderPattern(ladderNum, maxDegree = 7) {
    if (ladderNum <= 1) return [maxDegree];

    const descending = [];
    for (let i = maxDegree; i > maxDegree - ladderNum; i--) {
      descending.push(i);
    }
    const ascending = [];
    for (let i = maxDegree - ladderNum + 2; i <= maxDegree; i++) {
      ascending.push(i);
    }
    return [...descending, ...ascending];
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

    // For descending, the octave is the last element in the degrees array
    // degrees array has indices 0-7 for an 8-note scale (Do-Re-Mi-Fa-Sol-La-Ti-Do)
    // The octave (high Do) is at index 7 = degrees.length - 1
    const octaveIndex = degrees.length - 1;

    // Concatenate all ladders into one sequence
    const allTargets = [];

    for (let ladder = 1; ladder <= ladderCount; ladder++) {
      // Insert rest between ladders (not before the first)
      if (ladder > 1) {
        allTargets.push({ rest: true, restDuration: 500, state: TargetState.WAITING });
      }

      const degreeIndices = DescendingMajorLadder.generateDescendingLadderPattern(ladder, octaveIndex);

      for (const di of degreeIndices) {
        let midiNote, label, degree;

        if (di === octaveIndex) {
          // Octave - same pitch class as root but one octave higher
          midiNote = rootMidi + 12;
          label = 'Do'; // Solfege for octave
          degree = { interval: 12, label: 'Do' };
        } else if (di >= 0 && di < degrees.length) {
          degree = degrees[di];
          midiNote = rootMidi + degree.interval;
          label = degree.label;
        } else {
          continue; // Skip invalid indices
        }

        const frequency = FrequencyConverter.midiToFrequency(midiNote);

        allTargets.push({
          scaleDegree: di,
          midiNote,
          frequency,
          label,
          degreeNumber: di + 1,
          lyric: label,
          ladder,
          state: TargetState.WAITING,
        });
      }
    }

    // Build label showing all ladders (using 1-based degree numbers)
    const ladderLabels = [];
    for (let i = 1; i <= ladderCount; i++) {
      const pattern = DescendingMajorLadder.generateDescendingLadderPattern(i, octaveIndex);
      ladderLabels.push(pattern.map(d => d + 1).join('-'));
    }
    const label = ladderLabels.join(', ');

    return [{
      label,
      targets: allTargets,
    }];
  }
}
