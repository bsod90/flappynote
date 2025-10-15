/**
 * GameState - Main game state and logic
 */

import { Ball } from './Ball.js';
import { Gate } from './Gate.js';
import { ScaleManager } from './ScaleManager.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

export class GameState {
  constructor(rootNote = 'C4', scaleType = 'major', direction = 'up') {
    this.scaleManager = new ScaleManager(rootNote, scaleType);
    this.ball = new Ball();
    this.gates = [];
    this.score = 0;
    this.currentGateIndex = 0;
    this.isPlaying = false;
    this.isGameOver = false;
    this.isSinging = false;
    this.currentPitch = null;
    this.lastSingingTime = 0;
    this.direction = direction; // 'up' or 'down'

    this.initializeGates();
  }

  /**
   * Initialize gates for all scale degrees
   */
  initializeGates() {
    this.gates = [];
    let degrees = this.scaleManager.getAllDegrees();

    // Reverse degrees if direction is down
    if (this.direction === 'down') {
      degrees = [...degrees].reverse();
    }

    const gateSpacing = GAME_CONFIG.getGateSpacing(degrees.length);
    const startX = GAME_CONFIG.getGateStartX();

    degrees.forEach((degreeInfo, index) => {
      const x = startX + (index * gateSpacing);

      // Calculate Y position based on pitch (higher pitch = higher position)
      // Map frequencies to canvas height in reverse (low y = high frequency)
      const allDegrees = this.scaleManager.getAllDegrees();
      const minFreq = this.scaleManager.getFrequency(0);
      const maxFreq = this.scaleManager.getFrequency(allDegrees.length - 1); // Last note in scale
      const normalizedPitch = (degreeInfo.frequency - minFreq) / (maxFreq - minFreq);

      // Map to canvas with generous margins (15% top, 20% bottom for more air)
      const topMargin = GAME_CONFIG.CANVAS_HEIGHT * 0.15;
      const bottomMargin = GAME_CONFIG.CANVAS_HEIGHT * 0.20;
      const availableHeight = GAME_CONFIG.CANVAS_HEIGHT - topMargin - bottomMargin;
      const targetY = GAME_CONFIG.CANVAS_HEIGHT - bottomMargin - (normalizedPitch * availableHeight);

      const gate = new Gate(
        x,
        targetY,
        degreeInfo.degree,
        degreeInfo.label,
        degreeInfo.frequency
      );

      this.gates.push(gate);
    });
  }

  /**
   * Start the game
   */
  start() {
    this.isPlaying = true;
    this.isGameOver = false;
    this.score = 0;
    this.currentGateIndex = 0;
    this.ball.reset();
    this.gates.forEach(gate => {
      gate.passed = false;
      gate.perfectPitch = false;
    });
  }

  /**
   * Pause the game
   */
  pause() {
    this.isPlaying = false;
  }

  /**
   * Reset the game
   */
  reset() {
    this.isPlaying = false;
    this.isGameOver = false;
    this.score = 0;
    this.currentGateIndex = 0;
    this.isSinging = false;
    this.currentPitch = null;
    this.ball.reset();
    this.initializeGates();
  }

  /**
   * Update game state
   * @param {number} deltaTime - Time since last update in ms
   */
  update(deltaTime) {
    if (!this.isPlaying || this.isGameOver) return;

    // New physics model: ball gravitates toward the pitch height you're singing
    if (this.currentPitch) {
      // Find which scale degree this pitch belongs to (ignoring octave)
      const scaleDegreeMatch = this.scaleManager.findScaleDegreeForFrequency(this.currentPitch.frequency);

      if (scaleDegreeMatch) {
        // Use the actual detected frequency for positioning
        const pitchY = this.calculateYFromPitch(scaleDegreeMatch.frequency);
        this.ball.floatToward(pitchY, this.isSinging);
      } else {
        // Pitch not in scale, use original frequency
        const pitchY = this.calculateYFromPitch(this.currentPitch.frequency);
        this.ball.floatToward(pitchY, false); // Don't move forward if not in scale
      }
    } else {
      // When not singing, ball falls with gravity
      this.ball.applyGravity();
    }

    this.ball.update();

    // Check collisions with gates
    this.checkGateCollisions();

    // Check win condition (only way to end the game)
    if (this.currentGateIndex >= this.gates.length) {
      this.win();
    }
  }

  /**
   * Calculate Y position from pitch frequency
   * Maps frequency to canvas height (higher pitch = higher position)
   * Supports frequencies beyond the base octave range
   */
  calculateYFromPitch(frequency) {
    // Get frequency range from scale
    const degrees = this.scaleManager.getAllDegrees();
    const minFreq = this.scaleManager.getFrequency(0); // First note
    const maxFreq = this.scaleManager.getFrequency(degrees.length - 1); // Last note

    // Allow frequencies outside the range (for octaves above/below)
    // Don't clamp - let it extend beyond if needed
    const normalizedPitch = (frequency - minFreq) / (maxFreq - minFreq);

    // Clamp the normalized value to prevent going off-screen
    const clampedNormalized = Math.max(0, Math.min(1, normalizedPitch));

    // Map to canvas height (inverted - high pitch = low Y value)
    // Use SAME margins as gates
    const topMargin = GAME_CONFIG.CANVAS_HEIGHT * 0.15;
    const bottomMargin = GAME_CONFIG.CANVAS_HEIGHT * 0.20;
    const availableHeight = GAME_CONFIG.CANVAS_HEIGHT - topMargin - bottomMargin;
    return GAME_CONFIG.CANVAS_HEIGHT - bottomMargin - (clampedNormalized * availableHeight);
  }

  /**
   * Check if we should apply lift force
   * @returns {boolean}
   */
  shouldApplyLift() {
    const timeSinceSinging = Date.now() - this.lastSingingTime;
    return timeSinceSinging < GAME_CONFIG.MINIMUM_SINGING_DURATION + 50;
  }

  /**
   * Check collisions with gates
   */
  checkGateCollisions() {
    if (this.currentGateIndex >= this.gates.length) return;

    const currentGate = this.gates[this.currentGateIndex];
    const ballPos = this.ball.getPosition();

    // Check if ball can pass through gate
    if (!currentGate.canPassThrough(ballPos.x, ballPos.y, this.ball.radius)) {
      // Instead of game over, bounce the ball back
      this.ball.bounceBack();
      return;
    }

    // Check if ball has passed through gate
    if (currentGate.hasPassedThrough(ballPos.x) && !currentGate.passed) {
      const isPerfect = currentGate.isPerfectlyAligned(ballPos.y);
      currentGate.markAsPassed(isPerfect);

      this.score += GAME_CONFIG.POINTS_PER_GATE;
      if (isPerfect) {
        this.score += GAME_CONFIG.PERFECT_PITCH_BONUS;
      }

      this.currentGateIndex++;
    }
  }

  /**
   * Handle pitch update from detector
   * @param {object|null} pitchData - Pitch data from detector
   */
  onPitchDetected(pitchData) {
    this.currentPitch = pitchData;

    if (!this.isPlaying || this.isGameOver) return;

    if (pitchData && this.currentGateIndex < this.gates.length) {
      const currentGate = this.gates[this.currentGateIndex];

      // Find which scale degree the sung pitch belongs to (ignoring octave)
      const scaleDegreeMatch = this.scaleManager.findScaleDegreeForFrequency(pitchData.frequency);

      if (scaleDegreeMatch && scaleDegreeMatch.degree === currentGate.scaleDegree) {
        // Singing the correct scale degree (any octave)
        this.isSinging = true;
        this.lastSingingTime = Date.now();
      } else {
        this.isSinging = false;
      }
    } else {
      this.isSinging = false;
    }
  }

  /**
   * Set root note and regenerate gates
   * @param {string} rootNote - New root note
   */
  setRootNote(rootNote) {
    this.scaleManager.setRootNote(rootNote);
    this.initializeGates();
  }

  /**
   * Set scale type and regenerate gates
   * @param {string} scaleType - New scale type
   */
  setScaleType(scaleType) {
    this.scaleManager.setScaleType(scaleType);
    this.initializeGates();
  }

  /**
   * Set direction and regenerate gates
   * @param {string} direction - 'up' or 'down'
   */
  setDirection(direction) {
    this.direction = direction;
    this.initializeGates();
  }

  /**
   * Get current target gate
   * @returns {Gate|null}
   */
  getCurrentTargetGate() {
    return this.gates[this.currentGateIndex] || null;
  }

  /**
   * Game over
   */
  gameOver() {
    this.isPlaying = false;
    this.isGameOver = true;
  }

  /**
   * Win condition
   */
  win() {
    this.isPlaying = false;
    this.isGameOver = true;
  }

  /**
   * Get game state for rendering
   * @returns {object}
   */
  getState() {
    return {
      ball: this.ball,
      gates: this.gates,
      score: this.score,
      isPlaying: this.isPlaying,
      isGameOver: this.isGameOver,
      isSinging: this.isSinging,
      currentPitch: this.currentPitch,
      currentGateIndex: this.currentGateIndex,
      targetGate: this.getCurrentTargetGate(),
      scaleInfo: this.scaleManager.getScaleInfo(),
    };
  }
}
