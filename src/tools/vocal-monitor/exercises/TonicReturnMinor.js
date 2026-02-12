/**
 * TonicReturnMinor - Scale degree exercise with double tonic return after each step.
 *
 * Pattern: 1-2-1-1-3-1-1-4-1-1-5-1-1-6-1-1-7-1-1-8
 * Returns to double tonic after each ascending scale degree.
 * Uses natural minor scale.
 */

import { BaseExercise } from './BaseExercise.js';
import { FrequencyConverter } from '../../../pitch-engine/index.js';
import { TargetState } from '../ExerciseEngine.js';

export class TonicReturnMinor extends BaseExercise {
  constructor() {
    super();
    this.name = 'Tonic Return (Minor)';
    this.description = 'Double tonic return after each scale degree: 1-2-1-1-3-1-1-4-...';
    this.scaleType = 'minor';
    this.sustainDuration = 300;
  }

  /**
   * Generate the tonic return pattern with double tonic.
   * Pattern: 1-2-1-1-3-1-1-4-1-1-5-1-1-6-1-1-7-1-1-8
   * @param {number} degreeCount - Number of degrees in the scale
   * @returns {number[]} Array of scale degree indices
   */
  static generateTonicReturnPattern(degreeCount) {
    const pattern = [0]; // Start with tonic
    for (let i = 1; i < degreeCount; i++) {
      pattern.push(i); // Scale degree
      if (i < degreeCount - 1) {
        pattern.push(0); // Tonic
        pattern.push(0); // Double tonic
      }
    }
    return pattern;
  }

  /**
   * Generate a single phase with the tonic return pattern
   * @param {ScaleManager} scaleManager
   * @returns {Array} Array with one phase containing all targets
   */
  generatePhases(scaleManager) {
    const degrees = scaleManager.getAllDegrees();
    const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());
    const degreeCount = Math.min(8, degrees.length);

    const pattern = TonicReturnMinor.generateTonicReturnPattern(degreeCount);
    const targets = [];

    for (const di of pattern) {
      const degree = degrees[di];
      const midiNote = rootMidi + degree.interval;
      const frequency = FrequencyConverter.midiToFrequency(midiNote);

      targets.push({
        scaleDegree: di,
        midiNote,
        frequency,
        label: degree.label,
        degreeNumber: di + 1,
        lyric: degree.label,
        state: TargetState.WAITING,
      });
    }

    // Build label showing the pattern (1-2-1-3-1-4-1-5-1-6-1-7-1-8)
    const label = pattern.map(d => d + 1).join('-');

    return [{
      label,
      targets,
    }];
  }
}
