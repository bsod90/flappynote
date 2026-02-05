/**
 * RollingKeyManager - Manages the rolling key feature for exercises.
 *
 * Instead of repeating exercises in one key, the exercise advances through keys
 * like practicing with a teacher: C major → D major → E major → ...
 */

import { FrequencyConverter } from '../../pitch-engine/index.js';

export class RollingKeyManager {
  constructor() {
    // Mode: 'static' (stay in one key) or 'rolling' (advance through keys)
    this.mode = 'static';

    // Range of root notes (MIDI note numbers)
    this.lowestRoot = 48;  // C3
    this.highestRoot = 67; // G4

    // Direction of key advancement
    this.direction = 'ascending'; // 'ascending' or 'descending'

    // Step type for advancing
    this.stepType = 'semitone'; // 'semitone', 'wholeTone', or 'scaleDegree'

    // Current root note (MIDI)
    this.currentRootMidi = 48;

    // Whether we've completed the full range
    this._isComplete = false;

    // Count of full range traversals (wraps)
    this._wrapCount = 0;

    // For scaleDegree stepping, we need the scale intervals
    this._scaleIntervals = [0, 2, 4, 5, 7, 9, 11]; // Major scale by default
  }

  /**
   * Configure the rolling key manager
   * @param {object} options
   * @param {string} options.mode - 'static' or 'rolling'
   * @param {number} options.lowestRoot - Lowest root note (MIDI)
   * @param {number} options.highestRoot - Highest root note (MIDI)
   * @param {string} options.direction - 'ascending' or 'descending'
   * @param {string} options.stepType - 'semitone', 'wholeTone', or 'scaleDegree'
   */
  configure(options) {
    if (options.mode !== undefined) this.mode = options.mode;
    if (options.lowestRoot !== undefined) this.lowestRoot = options.lowestRoot;
    if (options.highestRoot !== undefined) this.highestRoot = options.highestRoot;
    if (options.direction !== undefined) this.direction = options.direction;
    if (options.stepType !== undefined) this.stepType = options.stepType;
  }

  /**
   * Set the scale intervals for scaleDegree stepping
   * @param {number[]} intervals - Array of semitone intervals from root
   */
  setScaleIntervals(intervals) {
    this._scaleIntervals = intervals;
  }

  /**
   * Reset to the starting position
   * @param {number} [startingRoot] - Optional starting root note (MIDI). If not provided, uses lowest/highest based on direction.
   */
  reset(startingRoot) {
    this._isComplete = false;
    this._wrapCount = 0;

    if (startingRoot !== undefined) {
      this.currentRootMidi = startingRoot;
    } else {
      // Start from the beginning based on direction
      this.currentRootMidi = this.direction === 'ascending'
        ? this.lowestRoot
        : this.highestRoot;
    }
  }

  /**
   * Get the current root note as a string (e.g., "C3", "D#4")
   * @returns {string}
   */
  getCurrentRootNote() {
    return FrequencyConverter.midiToNoteName(this.currentRootMidi);
  }

  /**
   * Get the current root note as MIDI number
   * @returns {number}
   */
  getCurrentRootMidi() {
    return this.currentRootMidi;
  }

  /**
   * Get the step size in semitones based on stepType
   * @returns {number}
   */
  _getStepSize() {
    switch (this.stepType) {
      case 'wholeTone':
        return 2;
      case 'scaleDegree':
        // Find current position in scale, advance to next scale degree
        return this._getScaleDegreeStep();
      case 'semitone':
      default:
        return 1;
    }
  }

  /**
   * Get the step size for scale degree stepping
   * @returns {number}
   */
  _getScaleDegreeStep() {
    const pitchClass = this.currentRootMidi % 12;

    // Find current position in the scale relative to the lowest root
    const lowestPitchClass = this.lowestRoot % 12;
    const currentInterval = (pitchClass - lowestPitchClass + 12) % 12;

    // Find the next scale degree
    const currentIndex = this._scaleIntervals.indexOf(currentInterval);

    if (this.direction === 'ascending') {
      if (currentIndex === -1 || currentIndex === this._scaleIntervals.length - 1) {
        // Not in scale or at the last degree, jump to first degree of next octave
        const firstDegree = this._scaleIntervals[0];
        return 12 - currentInterval + firstDegree;
      }
      return this._scaleIntervals[currentIndex + 1] - currentInterval;
    } else {
      if (currentIndex === -1 || currentIndex === 0) {
        // Not in scale or at first degree, jump to last degree of previous octave
        const lastDegree = this._scaleIntervals[this._scaleIntervals.length - 1];
        return -(currentInterval + 12 - lastDegree);
      }
      return this._scaleIntervals[currentIndex - 1] - currentInterval;
    }
  }

  /**
   * Advance to the next key in the sequence
   * @returns {boolean} True if successfully advanced, false if at the end of range
   */
  advanceToNextKey() {
    if (this.mode === 'static') {
      return false;
    }

    const step = this._getStepSize();
    const nextMidi = this.direction === 'ascending'
      ? this.currentRootMidi + step
      : this.currentRootMidi - step;

    // Wrap around at range boundaries
    if (this.direction === 'ascending' && nextMidi > this.highestRoot) {
      this.currentRootMidi = this.lowestRoot;
      this._wrapCount++;
      return true;
    }
    if (this.direction === 'descending' && nextMidi < this.lowestRoot) {
      this.currentRootMidi = this.highestRoot;
      this._wrapCount++;
      return true;
    }

    this.currentRootMidi = nextMidi;
    return true;
  }

  /**
   * Check if we've completed the full range
   * @returns {boolean}
   */
  isComplete() {
    return this._isComplete;
  }

  /**
   * Get the number of times the key range has wrapped around
   * @returns {number}
   */
  getWrapCount() {
    return this._wrapCount;
  }

  /**
   * Check if rolling mode is enabled
   * @returns {boolean}
   */
  isRolling() {
    return this.mode === 'rolling';
  }

  /**
   * Get progress through the key range (0-1)
   * @returns {number}
   */
  getProgress() {
    if (this.mode === 'static') {
      return 1; // Always "complete" in static mode
    }

    const range = this.highestRoot - this.lowestRoot;
    if (range <= 0) return 1;

    if (this.direction === 'ascending') {
      return (this.currentRootMidi - this.lowestRoot) / range;
    } else {
      return (this.highestRoot - this.currentRootMidi) / range;
    }
  }

  /**
   * Get the total number of keys in the range (approximate for scale degree stepping)
   * @returns {number}
   */
  getTotalKeys() {
    const range = this.highestRoot - this.lowestRoot;
    switch (this.stepType) {
      case 'wholeTone':
        return Math.floor(range / 2) + 1;
      case 'scaleDegree':
        // Approximate: range / average scale step
        const avgStep = 12 / this._scaleIntervals.length;
        return Math.floor(range / avgStep) + 1;
      case 'semitone':
      default:
        return range + 1;
    }
  }

  /**
   * Get the current key index (0-based)
   * @returns {number}
   */
  getCurrentKeyIndex() {
    if (this.direction === 'ascending') {
      switch (this.stepType) {
        case 'wholeTone':
          return Math.floor((this.currentRootMidi - this.lowestRoot) / 2);
        case 'semitone':
        default:
          return this.currentRootMidi - this.lowestRoot;
      }
    } else {
      switch (this.stepType) {
        case 'wholeTone':
          return Math.floor((this.highestRoot - this.currentRootMidi) / 2);
        case 'semitone':
        default:
          return this.highestRoot - this.currentRootMidi;
      }
    }
  }

  /**
   * Get state for UI display
   * @returns {object}
   */
  getState() {
    return {
      mode: this.mode,
      lowestRoot: this.lowestRoot,
      highestRoot: this.highestRoot,
      direction: this.direction,
      stepType: this.stepType,
      currentRootMidi: this.currentRootMidi,
      currentRootNote: this.getCurrentRootNote(),
      isComplete: this._isComplete,
      wrapCount: this._wrapCount,
      progress: this.getProgress(),
      totalKeys: this.getTotalKeys(),
      currentKeyIndex: this.getCurrentKeyIndex(),
    };
  }
}
