/**
 * Ball - The game ball controlled by pitch
 */

import { GAME_CONFIG } from '../config/gameConfig.js';

export class Ball {
  constructor(x = GAME_CONFIG.BALL_START_X, y = GAME_CONFIG.BALL_START_Y) {
    this.x = x;
    this.y = y;
    this.velocityX = 0;
    this.velocityY = 0;
    this.radius = GAME_CONFIG.BALL_RADIUS;
    this.color = GAME_CONFIG.BALL_COLOR;
  }

  /**
   * Apply gravity to the ball
   */
  applyGravity() {
    this.velocityY += GAME_CONFIG.GRAVITY;

    // Limit max velocity
    if (this.velocityY > GAME_CONFIG.MAX_VELOCITY_Y) {
      this.velocityY = GAME_CONFIG.MAX_VELOCITY_Y;
    }
  }

  /**
   * Float toward target height (when singing any pitch)
   * @param {number} targetY - Target Y position to float toward
   * @param {boolean} matchingTarget - Whether the pitch matches the target (for forward movement)
   */
  floatToward(targetY, matchingTarget = false) {
    // Calculate distance to target
    const distanceToTarget = targetY - this.y;

    // Apply force proportional to distance (spring-like behavior)
    // Smoother, more gradual force
    const floatForce = distanceToTarget * 0.08;

    // Apply the force with limits
    const maxForce = 2;
    this.velocityY += Math.max(-maxForce, Math.min(maxForce, floatForce));

    // Gradually build up forward velocity when matching target
    if (matchingTarget) {
      // Smoothly accelerate forward
      this.velocityX += 0.1;
      if (this.velocityX > GAME_CONFIG.FORWARD_VELOCITY) {
        this.velocityX = GAME_CONFIG.FORWARD_VELOCITY;
      }
    } else {
      // Gradually slow down when not matching
      this.velocityX *= 0.96;
    }

    // Lighter damping for smoother movement
    this.velocityY *= 0.94;

    // Cap maximum velocity
    const maxVelocity = 6;
    if (Math.abs(this.velocityY) > maxVelocity) {
      this.velocityY = Math.sign(this.velocityY) * maxVelocity;
    }
  }

  /**
   * Apply lift force (when singing) - DEPRECATED, kept for compatibility
   */
  applyLift() {
    // This method is deprecated but kept to avoid breaking changes
    this.velocityY += GAME_CONFIG.LIFT_FORCE;
    this.velocityX = GAME_CONFIG.FORWARD_VELOCITY;
  }

  /**
   * Update ball position
   */
  update() {
    // Apply drag to horizontal movement
    this.velocityX *= GAME_CONFIG.DRAG;

    // Update position
    this.x += this.velocityX;
    this.y += this.velocityY;

    // Prevent ball from going off top
    if (this.y < this.radius) {
      this.y = this.radius;
      this.velocityY = Math.max(0, this.velocityY);
    }

    // Prevent ball from going off bottom
    // Don't reset velocity to allow floatToward physics to work
    if (this.y > GAME_CONFIG.CANVAS_HEIGHT - this.radius) {
      this.y = GAME_CONFIG.CANVAS_HEIGHT - this.radius;
      // Only zero out downward velocity, allow upward velocity
      if (this.velocityY > 0) {
        this.velocityY = 0;
      }
    }
  }

  /**
   * Reset ball to starting position
   */
  reset() {
    this.x = GAME_CONFIG.BALL_START_X;
    this.y = GAME_CONFIG.BALL_START_Y;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  /**
   * Get ball position as an object
   * @returns {{x: number, y: number}}
   */
  getPosition() {
    return { x: this.x, y: this.y };
  }

  /**
   * Check if ball is out of bounds (game over)
   * @returns {boolean}
   */
  isOutOfBounds() {
    return this.x < -this.radius * 2 ||
           this.x > GAME_CONFIG.CANVAS_WIDTH + this.radius * 2;
  }

  /**
   * Bounce the ball back (educational mode - no game over)
   */
  bounceBack() {
    // Reverse horizontal velocity and reduce it
    this.velocityX = -Math.abs(this.velocityX) * 0.5;

    // Add small upward bounce
    this.velocityY = Math.min(this.velocityY, -2);

    // Move ball back a bit to prevent getting stuck
    this.x -= 10;
  }
}
