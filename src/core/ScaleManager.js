/**
 * ScaleManager - Manages scale configuration and frequency calculations
 * Moved from src/game/ to src/core/ for shared use across tools
 */

import { SCALES, DEFAULT_SCALE } from '../config/scales.js';
import { FrequencyConverter } from '../pitch-engine/index.js';

export class ScaleManager {
  constructor(rootNote = 'C4', scaleType = DEFAULT_SCALE) {
    this.rootNote = rootNote;
    this.scaleType = scaleType;
    this.updateScale();
  }

  /**
   * Update the current scale
   */
  updateScale() {
    const scale = SCALES[this.scaleType] || SCALES[DEFAULT_SCALE];
    this.currentScale = scale;
    this.calculateFrequencies();
  }

  /**
   * Calculate frequencies for all scale degrees
   */
  calculateFrequencies() {
    const rootMidi = FrequencyConverter.noteNameToMidi(this.rootNote);
    this.frequencies = this.currentScale.intervals.map(interval => {
      return FrequencyConverter.midiToFrequency(rootMidi + interval);
    });
  }

  /**
   * Set root note
   * @param {string} rootNote - Note name (e.g., "C4")
   */
  setRootNote(rootNote) {
    this.rootNote = rootNote;
    this.updateScale();
  }

  /**
   * Set scale type
   * @param {string} scaleType - Scale type key
   */
  setScaleType(scaleType) {
    if (SCALES[scaleType]) {
      this.scaleType = scaleType;
      this.updateScale();
    }
  }

  /**
   * Get frequency for a specific scale degree
   * @param {number} degree - Scale degree (0-7)
   * @returns {number} Frequency in Hz
   */
  getFrequency(degree) {
    return this.frequencies[degree] || 0;
  }

  /**
   * Get label for a specific scale degree
   * @param {number} degree - Scale degree (0-7)
   * @returns {string} Degree label (e.g., "Do", "Re")
   */
  getDegreeLabel(degree) {
    return this.currentScale.degrees[degree] || '';
  }

  /**
   * Get all scale degrees with their frequencies and labels
   * @returns {Array} Array of scale degree objects
   */
  getAllDegrees() {
    return this.currentScale.intervals.map((interval, index) => ({
      degree: index,
      interval,
      frequency: this.frequencies[index],
      label: this.currentScale.degrees[index],
    }));
  }

  /**
   * Get scale name
   * @returns {string}
   */
  getScaleName() {
    return this.currentScale.name;
  }

  /**
   * Get root note name
   * @returns {string}
   */
  getRootNote() {
    return this.rootNote;
  }

  /**
   * Get available scale types
   * @returns {Array} Array of scale type keys
   */
  static getAvailableScales() {
    return Object.keys(SCALES);
  }

  /**
   * Get scale info for UI
   * @returns {object}
   */
  getScaleInfo() {
    return {
      rootNote: this.rootNote,
      scaleType: this.scaleType,
      scaleName: this.currentScale.name,
      degrees: this.getAllDegrees(),
    };
  }

  /**
   * Find which scale degree a frequency belongs to (ignoring octave)
   * Returns the closest matching degree based on frequency
   * @param {number} frequency - Input frequency
   * @returns {object|null} Object with degree, frequency, and label
   */
  findScaleDegreeForFrequency(frequency) {
    if (!frequency) return null;

    // Convert to MIDI to work with pitch classes
    const midiNote = FrequencyConverter.frequencyToMidi(frequency);
    const pitchClass = Math.round(midiNote) % 12; // 0-11, ignoring octave

    // Get root pitch class
    const rootMidi = FrequencyConverter.noteNameToMidi(this.rootNote);
    const rootPitchClass = rootMidi % 12;

    // Find ALL scale degrees that match this pitch class
    const matches = [];
    for (let i = 0; i < this.currentScale.intervals.length; i++) {
      const degreeInterval = this.currentScale.intervals[i];
      const degreePitchClass = (rootPitchClass + degreeInterval) % 12;

      if (degreePitchClass === pitchClass) {
        matches.push({
          degree: i,
          frequency: frequency,
          label: this.currentScale.degrees[i],
          degreeFrequency: this.frequencies[i],
        });
      }
    }

    if (matches.length === 0) return null;

    // If only one match, return it
    if (matches.length === 1) return matches[0];

    // If multiple matches (e.g., Do appears at 0 and 7), pick the closest by frequency
    let closest = matches[0];
    let minDiff = Math.abs(frequency - matches[0].degreeFrequency);

    for (let i = 1; i < matches.length; i++) {
      const diff = Math.abs(frequency - matches[i].degreeFrequency);
      if (diff < minDiff) {
        minDiff = diff;
        closest = matches[i];
      }
    }

    return closest;
  }

  /**
   * Get frequency range for the current scale
   * @returns {{min: number, max: number}}
   */
  getFrequencyRange() {
    const degrees = this.getAllDegrees();
    return {
      min: this.frequencies[0],
      max: this.frequencies[degrees.length - 1],
    };
  }

  /**
   * Convert frequency to normalized position (0-1) within scale range
   * Uses logarithmic scaling for musical accuracy
   * @param {number} frequency
   * @returns {number} Normalized position (0 = low, 1 = high)
   */
  frequencyToNormalizedPosition(frequency) {
    const range = this.getFrequencyRange();
    const epsilon = 0.001;
    const logMin = Math.log2(range.min + epsilon);
    const logMax = Math.log2(range.max + epsilon);
    const logFreq = Math.log2(frequency + epsilon);

    return (logFreq - logMin) / (logMax - logMin);
  }
}
