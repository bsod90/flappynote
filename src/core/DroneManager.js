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
   */
  stopDrone() {
    this.tonePlayer.stopDrone();
    this.isDronePlaying = false;
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
  // Future chord/melody support methods
  // ==========================================

  /**
   * Start a chord (multiple frequencies)
   * Future implementation for interval training
   * @param {number[]} frequencies - Array of frequencies to play
   */
  startChord(frequencies) {
    // TODO: Implement chord support
    // For now, just play the root
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
  stop() {
    this.tonePlayer.stop();
    this.isDronePlaying = false;
    this.currentDroneFrequency = null;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stop();
  }
}
