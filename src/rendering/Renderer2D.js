/**
 * Renderer2D - 2D Canvas implementation of the renderer
 */

import { Renderer } from './Renderer.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

export class Renderer2D extends Renderer {
  constructor(canvas) {
    super(canvas);
    this.ctx = null;
  }

  /**
   * Initialize the 2D renderer
   */
  initialize() {
    this.ctx = this.canvas.getContext('2d');

    // Flappy Bird style - disable anti-aliasing for pixelated look
    this.ctx.imageSmoothingEnabled = false;

    // Background animation
    this.scrollOffset = 0;

    // Camera offset for horizontal scrolling
    this.cameraX = 0;

    // Initial resize - do it synchronously
    this.handleResize();

    // Listen for window resize
    window.addEventListener('resize', () => {
      // Debounce resize to avoid excessive recalculations
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.handleResize(), 50);
    });
  }

  /**
   * Handle window resize - make canvas responsive
   */
  handleResize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // For mobile Chrome, rect.height can change when address bar shows/hides
    // Use the actual rect dimensions which are more stable
    const width = rect.width;
    const height = rect.height;

    // Set canvas internal size (accounting for device pixel ratio)
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    // Set canvas display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Store device pixel ratio for use in render loop
    this.dpr = dpr;

    // Update game config canvas dimensions for responsive layout
    // IMPORTANT: Use actual rendered dimensions, not viewport height
    GAME_CONFIG.CANVAS_WIDTH = width;
    GAME_CONFIG.CANVAS_HEIGHT = height;

    console.log(`Canvas resized: ${width}x${height}, DPR: ${dpr}`);
  }

  /**
   * Clear the canvas and draw Flappy Bird style background
   */
  clear() {
    // Save context state and apply DPR scaling
    this.ctx.save();
    this.ctx.scale(this.dpr || 1, this.dpr || 1);

    const width = GAME_CONFIG.CANVAS_WIDTH;
    const height = GAME_CONFIG.CANVAS_HEIGHT;

    // Sky gradient (bright blue like Flappy Bird)
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#4ec0ca');
    gradient.addColorStop(1, '#8ed6ff');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    // Animate clouds (wrap at a large number to avoid precision issues)
    this.scrollOffset += 0.5;
    if (this.scrollOffset > 10000) this.scrollOffset = 0;

    // Draw simple clouds
    this.drawClouds();

    // Draw ground at bottom
    this.drawGround();
  }

  /**
   * Draw simple clouds (continuous loop)
   */
  drawClouds() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const cloudY1 = GAME_CONFIG.CANVAS_HEIGHT * 0.15;
    const cloudY2 = GAME_CONFIG.CANVAS_HEIGHT * 0.35;

    // Draw multiple clouds across the screen with seamless wrapping
    this.drawCloudLayer(0.3, cloudY1, 60, 0);
    this.drawCloudLayer(0.5, cloudY2, 50, 400);
    this.drawCloudLayer(0.4, cloudY1 + 30, 55, 800);
  }

  /**
   * Draw a layer of clouds that wrap seamlessly
   */
  drawCloudLayer(speed, y, size, offset) {
    const cloudWidth = size * 2; // Approximate width of cloud
    const spacing = 600; // Fixed spacing between clouds
    const loopWidth = spacing; // Loop every 'spacing' pixels

    // Calculate base position (wraps seamlessly within loopWidth)
    const baseX = ((this.scrollOffset * speed + offset) % loopWidth);

    // Draw enough clouds to cover the screen
    const numClouds = Math.ceil(GAME_CONFIG.CANVAS_WIDTH / spacing) + 2;

    for (let i = -1; i < numClouds; i++) {
      const cloudX = baseX + (i * spacing) - cloudWidth;
      // Only draw if visible
      if (cloudX > -cloudWidth * 2 && cloudX < GAME_CONFIG.CANVAS_WIDTH + cloudWidth) {
        this.drawCloud(cloudX, y, size);
      }
    }
  }

  /**
   * Draw a single cloud
   */
  drawCloud(x, y, size) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    this.ctx.arc(x + size * 0.5, y, size * 0.6, 0, Math.PI * 2);
    this.ctx.arc(x + size, y, size * 0.5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Draw ground (Flappy Bird style)
   */
  drawGround() {
    const groundHeight = 40;
    const groundY = GAME_CONFIG.CANVAS_HEIGHT - groundHeight;

    // Ground base
    this.ctx.fillStyle = '#ded895';
    this.ctx.fillRect(0, groundY, GAME_CONFIG.CANVAS_WIDTH, groundHeight);

    // Ground top stripe
    this.ctx.fillStyle = '#c2c270';
    this.ctx.fillRect(0, groundY, GAME_CONFIG.CANVAS_WIDTH, 8);

    // Grass tufts
    this.ctx.fillStyle = '#a0a060';
    for (let i = 0; i < GAME_CONFIG.CANVAS_WIDTH; i += 30) {
      const offset = (i + this.scrollOffset * 2) % GAME_CONFIG.CANVAS_WIDTH;
      this.ctx.fillRect(offset, groundY + 8, 3, 6);
      this.ctx.fillRect(offset + 8, groundY + 8, 3, 6);
      this.ctx.fillRect(offset + 16, groundY + 8, 3, 6);
    }
  }

  /**
   * Update camera position to follow the ball
   * @param {Ball} ball - The ball to follow
   */
  updateCamera(ball) {
    // Keep ball centered on screen horizontally when scrolling is needed
    const targetCameraX = ball.x - GAME_CONFIG.CANVAS_WIDTH / 3;

    // Smoothly interpolate camera position
    this.cameraX = targetCameraX;

    // Don't scroll left of the start
    this.cameraX = Math.max(0, this.cameraX);
  }

  /**
   * Check if horizontal scrolling is needed
   * @param {array} gates - Array of gates
   * @returns {boolean}
   */
  needsScrolling(gates) {
    if (gates.length === 0) return false;

    // Only enable scrolling on narrow screens (mobile/tablet)
    if (GAME_CONFIG.CANVAS_WIDTH >= 769) return false;

    // Get the rightmost gate position
    const lastGate = gates[gates.length - 1];
    const rightmostX = lastGate.x + GAME_CONFIG.GATE_THICKNESS;

    // If gates extend beyond 70% of canvas width, enable scrolling
    return rightmostX > GAME_CONFIG.CANVAS_WIDTH * 0.7;
  }

  /**
   * Render the game state
   * @param {object} gameState - Current game state from GameState.getState()
   */
  render(gameState) {
    this.clear();

    // Check if we need horizontal scrolling
    const scrollingEnabled = this.needsScrolling(gameState.gates);

    // Update camera if scrolling is enabled and game is playing
    if (scrollingEnabled && gameState.isPlaying) {
      this.updateCamera(gameState.ball);
    } else {
      this.cameraX = 0; // Reset camera when not scrolling
    }

    // Apply camera transform
    this.ctx.save();
    this.ctx.translate(-this.cameraX, 0);

    // Draw gates
    gameState.gates.forEach(gate => {
      this.drawGate(gate);
    });

    // Draw ball
    this.drawBall(gameState.ball, gameState.isSinging);

    // Draw current target indicator
    if (gameState.targetGate && gameState.isPlaying) {
      this.drawTargetIndicator(gameState.targetGate);
    }

    // Restore camera transform
    this.ctx.restore();

    // Draw game over or win message (no camera offset)
    if (gameState.isGameOver) {
      this.drawGameOverMessage(gameState);
    }

    // Restore context state
    this.ctx.restore();
  }

  /**
   * Draw a gate (Flappy Bird pipe style)
   * @param {Gate} gate
   */
  drawGate(gate) {
    const data = gate.getRenderData();
    const holeBounds = gate.getHoleBounds();
    const pipeWidth = data.thickness;
    const capHeight = 25;
    const capWidth = pipeWidth + 10;

    // Pipe colors (bright green like Flappy Bird)
    const pipeColor = data.passed ? '#5fd95f' : '#5ac54f';
    const pipeDark = data.passed ? '#4db84d' : '#3e9e3e';
    const pipeLight = data.passed ? '#7ee67e' : '#6fd65f';
    const capColor = data.passed ? '#4db84d' : '#3e9e3e';

    // Draw TOP pipe
    if (holeBounds.top > 0) {
      const topPipeY = holeBounds.top - capHeight;

      // Top pipe body
      this.ctx.fillStyle = pipeColor;
      this.ctx.fillRect(data.x, 0, pipeWidth, holeBounds.top - capHeight);

      // Highlight on left
      this.ctx.fillStyle = pipeLight;
      this.ctx.fillRect(data.x, 0, pipeWidth * 0.15, holeBounds.top - capHeight);

      // Shadow on right
      this.ctx.fillStyle = pipeDark;
      this.ctx.fillRect(data.x + pipeWidth * 0.85, 0, pipeWidth * 0.15, holeBounds.top - capHeight);

      // Top pipe cap
      this.ctx.fillStyle = capColor;
      this.ctx.fillRect(data.x - 5, topPipeY, capWidth, capHeight);

      // Cap highlight
      this.ctx.fillStyle = pipeLight;
      this.ctx.fillRect(data.x - 5, topPipeY, capWidth * 0.15, capHeight);

      // Cap shadow
      this.ctx.fillStyle = pipeDark;
      this.ctx.fillRect(data.x - 5 + capWidth * 0.85, topPipeY, capWidth * 0.15, capHeight);
    }

    // Draw BOTTOM pipe
    if (holeBounds.bottom < GAME_CONFIG.CANVAS_HEIGHT) {
      const bottomPipeY = holeBounds.bottom + capHeight;

      // Bottom pipe cap
      this.ctx.fillStyle = capColor;
      this.ctx.fillRect(data.x - 5, holeBounds.bottom, capWidth, capHeight);

      // Cap highlight
      this.ctx.fillStyle = pipeLight;
      this.ctx.fillRect(data.x - 5, holeBounds.bottom, capWidth * 0.15, capHeight);

      // Cap shadow
      this.ctx.fillStyle = pipeDark;
      this.ctx.fillRect(data.x - 5 + capWidth * 0.85, holeBounds.bottom, capWidth * 0.15, capHeight);

      // Bottom pipe body
      this.ctx.fillStyle = pipeColor;
      this.ctx.fillRect(data.x, bottomPipeY, pipeWidth, GAME_CONFIG.CANVAS_HEIGHT - bottomPipeY);

      // Highlight on left
      this.ctx.fillStyle = pipeLight;
      this.ctx.fillRect(data.x, bottomPipeY, pipeWidth * 0.15, GAME_CONFIG.CANVAS_HEIGHT - bottomPipeY);

      // Shadow on right
      this.ctx.fillStyle = pipeDark;
      this.ctx.fillRect(data.x + pipeWidth * 0.85, bottomPipeY, pipeWidth * 0.15, GAME_CONFIG.CANVAS_HEIGHT - bottomPipeY);
    }

    // Draw degree label with white background
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.ctx.beginPath();
    this.ctx.roundRect(data.x + pipeWidth / 2 - 25, holeBounds.center - 18, 50, 36, 8);
    this.ctx.fill();

    // Draw degree label text
    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      data.degreeLabel,
      data.x + pipeWidth / 2,
      holeBounds.center
    );

    // Draw perfect pitch indicator
    if (data.perfectPitch) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = 'bold 16px Arial';
      this.ctx.strokeStyle = '#ff8c00';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText('Perfect!', data.x + pipeWidth / 2, holeBounds.center - 35);
      this.ctx.fillText('Perfect!', data.x + pipeWidth / 2, holeBounds.center - 35);
    }
  }

  /**
   * Draw the ball as a stylized musical note (eighth note)
   * @param {Ball} ball
   * @param {boolean} isSinging
   */
  drawBall(ball, isSinging) {
    const size = ball.radius;

    // Draw glow effect when singing
    if (isSinging) {
      const gradient = this.ctx.createRadialGradient(
        ball.x, ball.y + size * 0.3, 0,
        ball.x, ball.y + size * 0.3, size * 3
      );
      gradient.addColorStop(0, 'rgba(255, 223, 0, 0.6)');
      gradient.addColorStop(0.5, 'rgba(255, 193, 7, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 193, 7, 0)');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y + size * 0.3, size * 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Note head (filled oval) - positioned lower
    const headY = ball.y + size * 0.5;

    // Draw wings behind the note
    const wingFlap = Math.sin(Date.now() / 100) * 0.2;
    this.drawWing(ball.x - size * 0.6, headY, size, wingFlap, true);
    this.drawWing(ball.x + size * 0.6, headY, size, -wingFlap, false);

    // Note head
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.beginPath();
    this.ctx.ellipse(ball.x, headY, size * 0.7, size * 0.5, -0.3, 0, Math.PI * 2);
    this.ctx.fill();

    // Note head highlight
    this.ctx.fillStyle = '#34495e';
    this.ctx.beginPath();
    this.ctx.ellipse(ball.x - size * 0.2, headY - size * 0.1, size * 0.3, size * 0.2, -0.3, 0, Math.PI * 2);
    this.ctx.fill();

    // Note stem (vertical line going up)
    const stemWidth = size * 0.15;
    const stemHeight = size * 2.2;
    const stemX = ball.x + size * 0.5;
    const stemTop = headY - stemHeight;

    this.ctx.fillStyle = '#2c3e50';
    this.ctx.fillRect(stemX, stemTop, stemWidth, stemHeight);

    // Flag (eighth note flag - curved)
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.beginPath();
    this.ctx.moveTo(stemX + stemWidth, stemTop);
    this.ctx.bezierCurveTo(
      stemX + stemWidth + size * 0.8, stemTop,
      stemX + stemWidth + size * 1.0, stemTop + size * 0.6,
      stemX + stemWidth, stemTop + size * 1.0
    );
    this.ctx.lineTo(stemX + stemWidth, stemTop);
    this.ctx.fill();

    // Musical sparkles when singing
    if (isSinging) {
      const time = Date.now() / 100;
      this.drawMusicSparkle(ball.x - size, ball.y - size, size * 0.3, time);
      this.drawMusicSparkle(ball.x + size, ball.y, size * 0.25, time + 1);
      this.drawMusicSparkle(ball.x, ball.y - size * 1.5, size * 0.35, time + 2);
    }
  }

  /**
   * Draw a wing
   */
  drawWing(x, y, size, flapAngle, isLeft) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(flapAngle);

    // Wing shape (ellipse)
    const wingWidth = size * 0.8;
    const wingHeight = size * 0.4;

    // Wing shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.beginPath();
    this.ctx.ellipse(isLeft ? -2 : 2, 2, wingWidth, wingHeight, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Wing base (white)
    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, wingWidth, wingHeight, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Wing accent (light gray)
    this.ctx.fillStyle = '#e0e0e0';
    this.ctx.beginPath();
    this.ctx.ellipse(isLeft ? -wingWidth * 0.3 : wingWidth * 0.3, 0, wingWidth * 0.5, wingHeight * 0.7, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Wing outline
    this.ctx.strokeStyle = '#2c3e50';
    this.ctx.lineWidth = size * 0.05;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, wingWidth, wingHeight, 0, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Draw a musical sparkle/note symbol
   */
  drawMusicSparkle(x, y, size, time) {
    const alpha = (Math.sin(time) + 1) / 2 * 0.6 + 0.2;
    this.ctx.fillStyle = `rgba(255, 193, 7, ${alpha})`;
    this.ctx.font = `${size}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('♪', x, y);
  }

  /**
   * Draw target indicator for current gate
   * @param {Gate} gate
   */
  drawTargetIndicator(gate) {
    const holeBounds = gate.getHoleBounds();

    // Animated arrow pointing to target
    const arrowX = gate.x - 40;
    const bounce = Math.sin(Date.now() / 200) * 3;

    // Arrow background
    this.ctx.fillStyle = '#ffd700';
    this.ctx.beginPath();
    this.ctx.moveTo(arrowX + bounce, holeBounds.center);
    this.ctx.lineTo(arrowX - 15 + bounce, holeBounds.center - 10);
    this.ctx.lineTo(arrowX - 15 + bounce, holeBounds.center + 10);
    this.ctx.closePath();
    this.ctx.fill();

    // Arrow border
    this.ctx.strokeStyle = '#ff8c00';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw target line (dotted)
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([10, 10]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, holeBounds.center);
    this.ctx.lineTo(GAME_CONFIG.CANVAS_WIDTH, holeBounds.center);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  /**
   * Draw game over message (Flappy Bird style)
   * @param {object} gameState
   */
  drawGameOverMessage(gameState) {
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

    const won = gameState.currentGateIndex >= gameState.gates.length;
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;

    // Draw medal background panel
    this.ctx.fillStyle = '#f0e68c';
    this.ctx.strokeStyle = '#8B7355';
    this.ctx.lineWidth = 6;
    const panelWidth = 320;
    const panelHeight = 240;
    this.ctx.beginPath();
    this.ctx.roundRect(centerX - panelWidth/2, centerY - panelHeight/2, panelWidth, panelHeight, 15);
    this.ctx.fill();
    this.ctx.stroke();

    // Message title
    const message = won ? 'You Win!' : 'Game Over';
    const messageColor = won ? '#5ac54f' : '#e74c3c';

    // Title shadow
    this.ctx.fillStyle = '#000';
    this.ctx.font = 'bold 52px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(message, centerX + 3, centerY - 70 + 3);

    // Title text
    this.ctx.fillStyle = messageColor;
    this.ctx.fillText(message, centerX, centerY - 70);

    // Score panel
    this.ctx.fillStyle = '#fff';
    this.ctx.strokeStyle = '#8B7355';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.roundRect(centerX - 130, centerY - 10, 260, 60, 8);
    this.ctx.fill();
    this.ctx.stroke();

    // Score label
    this.ctx.fillStyle = '#666';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.fillText('SCORE', centerX, centerY + 5);

    // Score value
    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 32px Arial';
    this.ctx.fillText(gameState.score.toString(), centerX, centerY + 32);

    // Medal (if won)
    if (won) {
      this.drawMedal(centerX - 110, centerY - 5, '#ffd700', '#ff8c00');
    }
  }

  /**
   * Draw a medal
   */
  drawMedal(x, y, color, ribbonColor) {
    // Medal circle
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 20, 0, Math.PI * 2);
    this.ctx.fill();

    // Medal border
    this.ctx.strokeStyle = ribbonColor;
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Star in center
    this.ctx.fillStyle = ribbonColor;
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('★', x, y);

    // Ribbon
    this.ctx.fillStyle = ribbonColor;
    this.ctx.beginPath();
    this.ctx.moveTo(x - 10, y - 15);
    this.ctx.lineTo(x - 5, y - 30);
    this.ctx.lineTo(x, y - 20);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.moveTo(x + 10, y - 15);
    this.ctx.lineTo(x + 5, y - 30);
    this.ctx.lineTo(x, y - 20);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Resize the canvas
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.dpr = dpr;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.ctx = null;
  }
}
