/**
 * Gate - Obstacles with holes corresponding to scale degrees
 * Copied from src/game/Gate.js for tool isolation
 */

import { GAME_CONFIG } from '../../config/gameConfig.js';

export class Gate {
  constructor(x, targetY, scaleDegree, degreeLabel, targetFrequency) {
    this.x = x;
    this.y = targetY;  // Alias for consistency
    this.targetY = targetY;
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
   */
  canPassThrough(ballX, ballY, ballRadius) {
    const isAtGate = ballX + ballRadius > this.x &&
                     ballX - ballRadius < this.x + this.thickness;

    if (!isAtGate) return true;

    const holeTop = this.targetY - this.holeHeight / 2 - GAME_CONFIG.HOLE_TOLERANCE;
    const holeBottom = this.targetY + this.holeHeight / 2 + GAME_CONFIG.HOLE_TOLERANCE;

    return ballY - ballRadius > holeTop && ballY + ballRadius < holeBottom;
  }

  /**
   * Check if ball has passed through
   */
  hasPassedThrough(ballX) {
    return ballX > this.x + this.thickness;
  }

  /**
   * Get hole bounds
   */
  getHoleBounds() {
    return {
      top: this.targetY - this.holeHeight / 2,
      bottom: this.targetY + this.holeHeight / 2,
      center: this.targetY,
    };
  }

  /**
   * Check if ball is perfectly aligned
   */
  isPerfectlyAligned(ballY) {
    return Math.abs(ballY - this.targetY) < 10;
  }

  /**
   * Mark gate as passed
   */
  markAsPassed(perfect = false) {
    this.passed = true;
    this.perfectPitch = perfect;
  }

  /**
   * Get render data
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
