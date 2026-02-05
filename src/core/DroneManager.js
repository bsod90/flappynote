/**
 * DroneManager - Extended audio manager for drone, chords, and melodies
 * Extends TonePlayer functionality with preparation for future chord/melody support
 */

import { TonePlayer } from '../audio/TonePlayer.js';

export class DroneManager {
  constructor() {
    this.tonePlayer = new TonePlayer();
    this.currentDroneFrequency = null;
    this.isDronePlaying = false;
    this.isChordMode = false;
    this.currentChordType = null;
  }

  /**
   * Initialize audio context
   */
  initialize() {
    this.tonePlayer.initialize();
  }

  /**
   * Play a single reference tone
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @returns {Promise}
   */
  playTone(frequency, duration = 0.5) {
    return this.tonePlayer.playTone(frequency, duration);
  }

  /**
   * Play a sequence of tones
   * @param {Array<{frequency: number, duration: number}>} sequence
   * @returns {Promise}
   */
  playSequence(sequence) {
    return this.tonePlayer.playSequence(sequence);
  }

  /**
   * Start the root drone
   * @param {number} frequency - Root note frequency
   */
  startDrone(frequency) {
    this.tonePlayer.startDrone(frequency);
    this.currentDroneFrequency = frequency;
    this.isDronePlaying = true;
  }

  /**
   * Stop the drone
   * @returns {Promise} Resolves when drone fully stops
   */
  async stopDrone() {
    if (!this.isDronePlaying || this._isStopping) {
      return;
    }

    this._isStopping = true;
    await this.tonePlayer.stopDrone();

    this.isDronePlaying = false;
    this._isStopping = false;
    this.currentDroneFrequency = null;
  }

  /**
   * Update drone frequency (for root note changes)
   * @param {number} frequency - New root frequency
   */
  updateDroneFrequency(frequency) {
    if (this.isDronePlaying) {
      this.tonePlayer.updateDroneFrequency(frequency);
      this.currentDroneFrequency = frequency;
    }
  }

  /**
   * Get current drone frequency
   * @returns {number|null}
   */
  getDroneFrequency() {
    return this.currentDroneFrequency;
  }

  /**
   * Check if drone is playing
   * @returns {boolean}
   */
  getIsDronePlaying() {
    return this.isDronePlaying;
  }

  // ==========================================
  // Chord drone support
  // ==========================================

  /**
   * Start playing a chord drone (root, third, fifth)
   * @param {number} rootFrequency - Root note frequency
   * @param {string} chordType - 'major' or 'minor'
   */
  startChordDrone(rootFrequency, chordType = 'major') {
    this.tonePlayer.startChordDrone(rootFrequency, chordType);
    this.currentDroneFrequency = rootFrequency;
    this.isDronePlaying = true;
    this.isChordMode = true;
    this.currentChordType = chordType;
  }

  /**
   * Stop the chord drone
   * @returns {Promise} Resolves when chord drone fully stops
   */
  async stopChordDrone() {
    if (!this.isDronePlaying || !this.isChordMode || this._isChordStopping) {
      return;
    }

    this._isChordStopping = true;
    await this.tonePlayer.stopChordDrone();

    this.isDronePlaying = false;
    this.isChordMode = false;
    this._isChordStopping = false;
    this.currentDroneFrequency = null;
    this.currentChordType = null;
  }

  /**
   * Switch from root drone to chord drone (async, waits for stop)
   * @param {number} rootFrequency - Root note frequency
   * @param {string} chordType - 'major' or 'minor'
   */
  async switchToChordDrone(rootFrequency, chordType = 'major') {
    await this.stopDrone();
    this.startChordDrone(rootFrequency, chordType);
  }

  /**
   * Switch from chord drone to root drone (async, waits for stop)
   * @param {number} frequency - Root note frequency
   */
  async switchToRootDrone(frequency) {
    await this.stopChordDrone();
    this.startDrone(frequency);
  }

  /**
   * Update chord drone frequency and type
   * @param {number} rootFrequency - New root frequency
   * @param {string} chordType - 'major' or 'minor'
   */
  updateChordDroneFrequency(rootFrequency, chordType = 'major') {
    if (this.isDronePlaying && this.isChordMode) {
      this.tonePlayer.updateChordDroneFrequency(rootFrequency, chordType);
      this.currentDroneFrequency = rootFrequency;
      this.currentChordType = chordType;
    }
  }

  /**
   * Check if in chord drone mode
   * @returns {boolean}
   */
  isInChordMode() {
    return this.isChordMode === true;
  }

  /**
   * Get current chord type
   * @returns {string|null}
   */
  getChordType() {
    return this.currentChordType || null;
  }

  // ==========================================
  // Future melody support methods
  // ==========================================

  /**
   * Start a chord (multiple frequencies)
   * Legacy method - use startChordDrone instead
   * @param {number[]} frequencies - Array of frequencies to play
   */
  startChord(frequencies) {
    // For backwards compatibility
    if (frequencies.length > 0) {
      this.startDrone(frequencies[0]);
    }
  }

  /**
   * Play a target note briefly
   * Future implementation for pitch matching exercises
   * @param {number} frequency - Target frequency
   * @param {number} duration - Duration in seconds
   */
  playTargetNote(frequency, duration = 1.0) {
    return this.playTone(frequency, duration);
  }

  /**
   * Queue a melody sequence
   * Future implementation for melodic exercises
   * @param {Array<{frequency: number, duration: number}>} notes
   */
  queueMelody(notes) {
    return this.playSequence(notes);
  }

  /**
   * Stop all sounds
   */
  async stop() {
    await this.tonePlayer.stop();
    this.isDronePlaying = false;
    this.isChordMode = false;
    this.currentDroneFrequency = null;
    this.currentChordType = null;
  }

  /**
   * Clean up resources
   */
  async dispose() {
    await this.stop();
  }
}
