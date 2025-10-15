/**
 * Gate - Obstacles with holes corresponding to scale degrees
 */

import { GAME_CONFIG } from '../config/gameConfig.js';

export class Gate {
  constructor(x, targetY, scaleDegree, degreeLabel, targetFrequency) {
    this.x = x;
    this.targetY = targetY;  // Center of the hole
    this.scaleDegree = scaleDegree;
    this.degreeLabel = degreeLabel;
    this.targetFrequency = targetFrequency;

    this.width = GAME_CONFIG.GATE_WIDTH;
    this.thickness = GAME_CONFIG.GATE_THICKNESS;
    this.holeHeight = GAME_CONFIG.HOLE_HEIGHT;
    this.color = GAME_CONFIG.GATE_COLOR;

    this.passed = false;
    this.perfectPitch = false;
  }

  /**
   * Check if a ball can pass through the gate
   * @param {number} ballX - Ball x position
   * @param {number} ballY - Ball y position
   * @param {number} ballRadius - Ball radius
   * @returns {boolean} True if ball can pass through
   */
  canPassThrough(ballX, ballY, ballRadius) {
    // Check if ball is at gate's x position
    const isAtGate = ballX + ballRadius > this.x &&
                     ballX - ballRadius < this.x + this.thickness;

    if (!isAtGate) return true; // Not at gate yet, or already passed

    // Check if ball is within hole bounds
    const holeTop = this.targetY - this.holeHeight / 2 - GAME_CONFIG.HOLE_TOLERANCE;
    const holeBottom = this.targetY + this.holeHeight / 2 + GAME_CONFIG.HOLE_TOLERANCE;

    return ballY - ballRadius > holeTop && ballY + ballRadius < holeBottom;
  }

  /**
   * Check if ball has passed through this gate
   * @param {number} ballX - Ball x position
   * @returns {boolean} True if ball has passed
   */
  hasPassedThrough(ballX) {
    return ballX > this.x + this.thickness;
  }

  /**
   * Get the hole bounds
   * @returns {{top: number, bottom: number, center: number}}
   */
  getHoleBounds() {
    return {
      top: this.targetY - this.holeHeight / 2,
      bottom: this.targetY + this.holeHeight / 2,
      center: this.targetY,
    };
  }

  /**
   * Check if ball is in perfect position (centered in hole)
   * @param {number} ballY - Ball y position
   * @returns {boolean}
   */
  isPerfectlyAligned(ballY) {
    return Math.abs(ballY - this.targetY) < 10;
  }

  /**
   * Mark gate as passed
   * @param {boolean} perfect - Whether it was a perfect pass
   */
  markAsPassed(perfect = false) {
    this.passed = true;
    this.perfectPitch = perfect;
  }

  /**
   * Get render data for this gate
   * @returns {object}
   */
  getRenderData() {
    return {
      x: this.x,
      targetY: this.targetY,
      width: this.width,
      thickness: this.thickness,
      holeHeight: this.holeHeight,
      color: this.color,
      degreeLabel: this.degreeLabel,
      passed: this.passed,
      perfectPitch: this.perfectPitch,
    };
  }
}
