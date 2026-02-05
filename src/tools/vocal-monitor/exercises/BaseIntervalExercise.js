/**
 * BaseIntervalExercise - Base class for interval exercises.
 *
 * Interval exercises are NOT scale-bound - they work with any scale
 * and use semitone intervals from the current root note.
 */

import { BaseExercise } from './BaseExercise.js';
import { FrequencyConverter } from '../../../pitch-engine/index.js';
import { TargetState } from '../ExerciseEngine.js';

export class BaseIntervalExercise extends BaseExercise {
  /**
   * @param {object} config
   * @param {number} config.intervalSemitones - Interval size in semitones
   * @param {string} config.direction - 'up' or 'down'
   * @param {string} config.intervalLabel - Label for the interval note (e.g., 'Re', 'Fa')
   * @param {string} config.name - Exercise name
   * @param {string} config.description - Exercise description
   */
  constructor({ intervalSemitones, direction, intervalLabel, name, description }) {
    super();
    this.name = name;
    this.description = description;
    this.scaleType = null; // NOT scale-bound - works with any scale
    this.sustainDuration = 400; // 0.4 seconds for intervals

    this.intervalSemitones = intervalSemitones;
    this.direction = direction; // 'up' or 'down'
    this.intervalLabel = intervalLabel;
  }

  /**
   * Generate a single phase with the interval pattern
   * Pattern: Root -> Interval -> Root
   * @param {ScaleManager} scaleManager
   * @returns {Array} Array with one phase containing all targets
   */
  generatePhases(scaleManager) {
    const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());
    const rootDegree = scaleManager.getAllDegrees()[0]; // Get root label (Do)

    // Calculate interval offset
    const offset = this.direction === 'down'
      ? -this.intervalSemitones
      : this.intervalSemitones;

    const intervalMidi = rootMidi + offset;

    // Create targets: Root -> Interval -> Root
    const allTargets = [];

    // Root (start)
    allTargets.push({
      scaleDegree: 0,
      midiNote: rootMidi,
      frequency: FrequencyConverter.midiToFrequency(rootMidi),
      label: rootDegree.label,
      degreeNumber: 1,
      lyric: rootDegree.label,
      state: TargetState.WAITING,
    });

    // Interval
    allTargets.push({
      scaleDegree: -1, // Not a scale degree
      midiNote: intervalMidi,
      frequency: FrequencyConverter.midiToFrequency(intervalMidi),
      label: this.intervalLabel,
      degreeNumber: 0, // Not a scale degree
      lyric: this.intervalLabel,
      state: TargetState.WAITING,
    });

    // Root (end)
    allTargets.push({
      scaleDegree: 0,
      midiNote: rootMidi,
      frequency: FrequencyConverter.midiToFrequency(rootMidi),
      label: rootDegree.label,
      degreeNumber: 1,
      lyric: rootDegree.label,
      state: TargetState.WAITING,
    });

    const directionSymbol = this.direction === 'up' ? '↑' : '↓';
    return [{
      label: `Do-${this.intervalLabel}-Do ${directionSymbol}`,
      targets: allTargets,
    }];
  }
}
