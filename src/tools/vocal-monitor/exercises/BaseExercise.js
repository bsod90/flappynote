/**
 * BaseExercise - Abstract base class for all exercise types.
 *
 * Defines the interface that all exercises must implement.
 */

export class BaseExercise {
  constructor() {
    // Exercise metadata
    this.name = 'Unnamed Exercise';
    this.description = '';

    // Scale type that this exercise requires (null = use user's selected scale)
    // If set to 'major' or 'minor', the scale selector will be locked
    this.scaleType = null;

    // Duration to sustain each target (ms)
    this.sustainDuration = 200;
  }

  /**
   * Check if this exercise locks the scale type
   * @returns {boolean}
   */
  locksScale() {
    return this.scaleType !== null;
  }

  /**
   * Get the scale type this exercise requires (if any)
   * @returns {string|null}
   */
  getRequiredScaleType() {
    return this.scaleType;
  }

  /**
   * Generate exercise phases with targets
   * Must be implemented by subclasses
   * @param {ScaleManager} scaleManager - Scale manager for note generation
   * @returns {Array<{label: string, targets: Array<object>}>}
   */
  generatePhases(scaleManager) {
    throw new Error('BaseExercise.generatePhases() must be implemented by subclass');
  }

  /**
   * Get exercise info for display
   * @returns {{name: string, description: string, scaleType: string|null, sustainDuration: number}}
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      scaleType: this.scaleType,
      sustainDuration: this.sustainDuration,
    };
  }
}
