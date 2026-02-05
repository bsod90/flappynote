/**
 * ScaleTimeline - Tracks key changes over time for timeline-aware scale rendering.
 *
 * With rolling keys, when the key changes from C to D, we want the historical C section
 * to maintain its C-colored scale highlights, while the new D section shows D colors.
 */

export class ScaleTimeline {
  constructor() {
    // Array of key changes sorted by time: [{time, rootNote, scaleType}]
    this.keyChanges = [];

    // Initial key (used before any explicit key change)
    this.initialKey = { rootNote: 'C3', scaleType: 'major' };
  }

  /**
   * Set the initial key (before any key changes)
   * @param {string} rootNote - Root note with octave (e.g., "C3")
   * @param {string} scaleType - Scale type (e.g., "major", "minor")
   */
  setInitialKey(rootNote, scaleType) {
    this.initialKey = { rootNote, scaleType };
  }

  /**
   * Add a key change at a specific time
   * @param {number} time - Time in milliseconds when the key change occurred
   * @param {string} rootNote - New root note with octave (e.g., "D3")
   * @param {string} scaleType - Scale type (e.g., "major", "minor")
   */
  addKeyChange(time, rootNote, scaleType) {
    // Insert in sorted order by time
    const newChange = { time, rootNote, scaleType };

    // Find insertion point
    let insertIndex = this.keyChanges.length;
    for (let i = 0; i < this.keyChanges.length; i++) {
      if (this.keyChanges[i].time > time) {
        insertIndex = i;
        break;
      }
      // If same time exists, update it
      if (this.keyChanges[i].time === time) {
        this.keyChanges[i] = newChange;
        return;
      }
    }

    this.keyChanges.splice(insertIndex, 0, newChange);
  }

  /**
   * Get the key (root note and scale type) at a specific time
   * Uses binary search for efficiency
   * @param {number} time - Time in milliseconds
   * @returns {{rootNote: string, scaleType: string}}
   */
  getKeyAtTime(time) {
    if (this.keyChanges.length === 0) {
      return { ...this.initialKey };
    }

    // Binary search for the most recent key change at or before the given time
    let left = 0;
    let right = this.keyChanges.length - 1;
    let result = null;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);

      if (this.keyChanges[mid].time <= time) {
        result = this.keyChanges[mid];
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    if (result) {
      return { rootNote: result.rootNote, scaleType: result.scaleType };
    }

    // Time is before any key change
    return { ...this.initialKey };
  }

  /**
   * Get all scale segments within a time range
   * Each segment represents a continuous period with the same key
   * @param {number} startTime - Start of range in milliseconds
   * @param {number} endTime - End of range in milliseconds
   * @returns {Array<{startTime: number, endTime: number, rootNote: string, scaleType: string}>}
   */
  getSegmentsInRange(startTime, endTime) {
    if (startTime >= endTime) {
      return [];
    }

    const segments = [];

    // Get the key at the start of the range
    const startKey = this.getKeyAtTime(startTime);
    let currentSegment = {
      startTime,
      endTime: endTime,
      rootNote: startKey.rootNote,
      scaleType: startKey.scaleType,
    };

    // Find all key changes within the range
    for (const change of this.keyChanges) {
      if (change.time <= startTime) {
        continue; // Already accounted for in startKey
      }

      if (change.time >= endTime) {
        break; // Beyond our range
      }

      // Close the current segment at this key change
      currentSegment.endTime = change.time;
      segments.push(currentSegment);

      // Start a new segment
      currentSegment = {
        startTime: change.time,
        endTime: endTime,
        rootNote: change.rootNote,
        scaleType: change.scaleType,
      };
    }

    // Add the final segment
    segments.push(currentSegment);

    return segments;
  }

  /**
   * Get all key changes
   * @returns {Array<{time: number, rootNote: string, scaleType: string}>}
   */
  getAllKeyChanges() {
    return [...this.keyChanges];
  }

  /**
   * Get the number of key changes
   * @returns {number}
   */
  getKeyChangeCount() {
    return this.keyChanges.length;
  }

  /**
   * Clear all key changes (reset timeline)
   */
  clear() {
    this.keyChanges = [];
  }

  /**
   * Reset to initial state
   * @param {string} rootNote - Initial root note with octave
   * @param {string} scaleType - Initial scale type
   */
  reset(rootNote, scaleType) {
    this.keyChanges = [];
    this.initialKey = { rootNote, scaleType };
  }
}
