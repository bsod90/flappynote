/**
 * FlappyRenderer - 2D Canvas renderer for Flappy Note game
 * Adapted from src/rendering/Renderer2D.js for tool isolation
 */

import { GAME_CONFIG } from '../../config/gameConfig.js';

export class FlappyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = null;
    this.onResize = null;
    this.initialResizeResolve = null;
    this.resizeStabilizationTimer = null;
    this.scrollOffset = 0;
    this.cameraX = 0;
    this.dpr = 1;
  }

  /**
   * Initialize the renderer
   */
  initialize() {
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    const initialResizePromise = new Promise(resolve => {
      this.initialResizeResolve = resolve;
    });

    this.resizeObserver = new ResizeObserver(entries => {
      if (this.resizeRAF) {
        cancelAnimationFrame(this.resizeRAF);
      }

      this.resizeRAF = requestAnimationFrame(() => {
        for (const entry of entries) {
          const contentBoxSize = entry.contentBoxSize?.[0];

          if (contentBoxSize) {
            this.handleResize(contentBoxSize.inlineSize, contentBoxSize.blockSize);
          } else {
            this.handleResize(entry.contentRect.width, entry.contentRect.height);
          }
        }
      });
    });

    // Observe the parent container instead of canvas
    // This ensures we detect fullscreen changes properly
    const container = this.canvas.parentElement;
    if (container) {
      this.resizeObserver.observe(container);
    } else {
      this.resizeObserver.observe(this.canvas);
    }

    return initialResizePromise;
  }

  /**
   * Handle resize
   */
  handleResize(width, height) {
    if (!width || !height) {
      const rect = this.canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }

    if (width < 100 || height < 100) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const dimensionsChanged = this.canvas.width !== width * dpr || this.canvas.height !== height * dpr;

    if (dimensionsChanged) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.dpr = dpr;
    }

    GAME_CONFIG.CANVAS_WIDTH = width;
    GAME_CONFIG.CANVAS_HEIGHT = height;

    if (this.initialResizeResolve) {
      if (this.resizeStabilizationTimer) {
        clearTimeout(this.resizeStabilizationTimer);
      }

      this.resizeStabilizationTimer = setTimeout(() => {
        if (this.initialResizeResolve) {
          const resolve = this.initialResizeResolve;
          this.initialResizeResolve = null;
          this.resizeStabilizationTimer = null;
          resolve();
        }
      }, 300);
    }

    if (this.onResize) {
      requestAnimationFrame(() => {
        this.onResize(width, height);
      });
    }
  }

  /**
   * Clear canvas and draw background
   */
  clear() {
    this.ctx.save();
    this.ctx.scale(this.dpr || 1, this.dpr || 1);

    const width = GAME_CONFIG.CANVAS_WIDTH;
    const height = GAME_CONFIG.CANVAS_HEIGHT;

    // Sky gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#4ec0ca');
    gradient.addColorStop(1, '#8ed6ff');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    this.scrollOffset += 0.5;
    if (this.scrollOffset > 10000) this.scrollOffset = 0;

    this.drawClouds();
    this.drawGround();
  }

  drawClouds() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const cloudY1 = GAME_CONFIG.CANVAS_HEIGHT * 0.15;
    const cloudY2 = GAME_CONFIG.CANVAS_HEIGHT * 0.35;

    this.drawCloudLayer(0.3, cloudY1, 60, 0);
    this.drawCloudLayer(0.5, cloudY2, 50, 400);
    this.drawCloudLayer(0.4, cloudY1 + 30, 55, 800);
  }

  drawCloudLayer(speed, y, size, offset) {
    const cloudWidth = size * 2;
    const spacing = 600;
    const loopWidth = spacing;
    const baseX = ((this.scrollOffset * speed + offset) % loopWidth);
    const numClouds = Math.ceil(GAME_CONFIG.CANVAS_WIDTH / spacing) + 2;

    for (let i = -1; i < numClouds; i++) {
      const cloudX = baseX + (i * spacing) - cloudWidth;
      if (cloudX > -cloudWidth * 2 && cloudX < GAME_CONFIG.CANVAS_WIDTH + cloudWidth) {
        this.drawCloud(cloudX, y, size);
      }
    }
  }

  drawCloud(x, y, size) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    this.ctx.arc(x + size * 0.5, y, size * 0.6, 0, Math.PI * 2);
    this.ctx.arc(x + size, y, size * 0.5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawGround() {
    const groundHeight = 40;
    const groundY = GAME_CONFIG.CANVAS_HEIGHT - groundHeight;

    this.ctx.fillStyle = '#ded895';
    this.ctx.fillRect(0, groundY, GAME_CONFIG.CANVAS_WIDTH, groundHeight);

    this.ctx.fillStyle = '#c2c270';
    this.ctx.fillRect(0, groundY, GAME_CONFIG.CANVAS_WIDTH, 8);

    this.ctx.fillStyle = '#a0a060';
    for (let i = 0; i < GAME_CONFIG.CANVAS_WIDTH; i += 30) {
      const offset = (i + this.scrollOffset * 2) % GAME_CONFIG.CANVAS_WIDTH;
      this.ctx.fillRect(offset, groundY + 8, 3, 6);
      this.ctx.fillRect(offset + 8, groundY + 8, 3, 6);
      this.ctx.fillRect(offset + 16, groundY + 8, 3, 6);
    }
  }

  updateCamera(ball) {
    const targetCameraX = ball.x - GAME_CONFIG.CANVAS_WIDTH / 3;
    this.cameraX = Math.max(0, targetCameraX);
  }

  needsScrolling(gates) {
    if (gates.length === 0) return false;
    if (GAME_CONFIG.CANVAS_WIDTH >= 769) return false;

    const lastGate = gates[gates.length - 1];
    const rightmostX = lastGate.x + GAME_CONFIG.GATE_THICKNESS;

    return rightmostX > GAME_CONFIG.CANVAS_WIDTH * 0.7;
  }

  /**
   * Render the game state
   */
  render(gameState) {
    this.clear();

    const scrollingEnabled = this.needsScrolling(gameState.gates);

    if (scrollingEnabled && gameState.isPlaying) {
      this.updateCamera(gameState.ball);
    } else {
      this.cameraX = 0;
    }

    this.ctx.save();
    this.ctx.translate(-this.cameraX, 0);

    if (gameState.pitchTrace && gameState.pitchTrace.length > 1) {
      this.drawPitchTrace(gameState.pitchTrace);
    }

    if (gameState.perfectHits && gameState.perfectHits.length > 0) {
      gameState.perfectHits.forEach(hit => {
        this.drawPerfectHitHighlight(hit);
      });
    }

    gameState.gates.forEach(gate => {
      this.drawGate(gate);
    });

    this.drawBall(gameState.ball, gameState.isSinging);

    if (gameState.showPitchGuidance && gameState.targetGate && gameState.ball) {
      this.drawPitchGuidance(gameState.ball, gameState.targetGate);
    }

    if (gameState.targetGate && gameState.isPlaying) {
      this.drawTargetIndicator(gameState.targetGate);
    }

    this.ctx.restore();

    if (gameState.isGameOver) {
      this.drawGameOverMessage(gameState, gameState.pitchTrace, gameState.gates);
    }

    this.ctx.restore();
  }

  drawGate(gate) {
    const data = gate.getRenderData();
    const holeBounds = gate.getHoleBounds();
    const pipeWidth = data.thickness;
    const capHeight = 25;
    const capWidth = pipeWidth + 10;

    const pipeColor = data.passed ? '#5fd95f' : '#5ac54f';
    const pipeDark = data.passed ? '#4db84d' : '#3e9e3e';
    const pipeLight = data.passed ? '#7ee67e' : '#6fd65f';
    const capColor = data.passed ? '#4db84d' : '#3e9e3e';

    // Top pipe
    if (holeBounds.top > 0) {
      const topPipeY = holeBounds.top - capHeight;

      this.ctx.fillStyle = pipeColor;
      this.ctx.fillRect(data.x, 0, pipeWidth, holeBounds.top - capHeight);

      this.ctx.fillStyle = pipeLight;
      this.ctx.fillRect(data.x, 0, pipeWidth * 0.15, holeBounds.top - capHeight);

      this.ctx.fillStyle = pipeDark;
      this.ctx.fillRect(data.x + pipeWidth * 0.85, 0, pipeWidth * 0.15, holeBounds.top - capHeight);

      this.ctx.fillStyle = capColor;
      this.ctx.fillRect(data.x - 5, topPipeY, capWidth, capHeight);

      this.ctx.fillStyle = pipeLight;
      this.ctx.fillRect(data.x - 5, topPipeY, capWidth * 0.15, capHeight);

      this.ctx.fillStyle = pipeDark;
      this.ctx.fillRect(data.x - 5 + capWidth * 0.85, topPipeY, capWidth * 0.15, capHeight);
    }

    // Bottom pipe
    if (holeBounds.bottom < GAME_CONFIG.CANVAS_HEIGHT) {
      const bottomPipeY = holeBounds.bottom + capHeight;

      this.ctx.fillStyle = capColor;
      this.ctx.fillRect(data.x - 5, holeBounds.bottom, capWidth, capHeight);

      this.ctx.fillStyle = pipeLight;
      this.ctx.fillRect(data.x - 5, holeBounds.bottom, capWidth * 0.15, capHeight);

      this.ctx.fillStyle = pipeDark;
      this.ctx.fillRect(data.x - 5 + capWidth * 0.85, holeBounds.bottom, capWidth * 0.15, capHeight);

      this.ctx.fillStyle = pipeColor;
      this.ctx.fillRect(data.x, bottomPipeY, pipeWidth, GAME_CONFIG.CANVAS_HEIGHT - bottomPipeY);

      this.ctx.fillStyle = pipeLight;
      this.ctx.fillRect(data.x, bottomPipeY, pipeWidth * 0.15, GAME_CONFIG.CANVAS_HEIGHT - bottomPipeY);

      this.ctx.fillStyle = pipeDark;
      this.ctx.fillRect(data.x + pipeWidth * 0.85, bottomPipeY, pipeWidth * 0.15, GAME_CONFIG.CANVAS_HEIGHT - bottomPipeY);
    }

    // Degree label
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.ctx.beginPath();
    this.ctx.roundRect(data.x + pipeWidth / 2 - 25, holeBounds.center - 18, 50, 36, 8);
    this.ctx.fill();

    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(data.degreeLabel, data.x + pipeWidth / 2, holeBounds.center);

    if (data.perfectPitch) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = 'bold 16px Arial';
      this.ctx.strokeStyle = '#ff8c00';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText('Perfect!', data.x + pipeWidth / 2, holeBounds.center - 35);
      this.ctx.fillText('Perfect!', data.x + pipeWidth / 2, holeBounds.center - 35);
    }
  }

  drawBall(ball, isSinging) {
    const size = ball.radius;

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

    const headY = ball.y + size * 0.5;

    const wingFlap = Math.sin(Date.now() / 100) * 0.2;
    this.drawWing(ball.x - size * 0.6, headY, size, wingFlap, true);
    this.drawWing(ball.x + size * 0.6, headY, size, -wingFlap, false);

    // Note head
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.beginPath();
    this.ctx.ellipse(ball.x, headY, size * 0.7, size * 0.5, -0.3, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#34495e';
    this.ctx.beginPath();
    this.ctx.ellipse(ball.x - size * 0.2, headY - size * 0.1, size * 0.3, size * 0.2, -0.3, 0, Math.PI * 2);
    this.ctx.fill();

    // Stem
    const stemWidth = size * 0.15;
    const stemHeight = size * 2.2;
    const stemX = ball.x + size * 0.5;
    const stemTop = headY - stemHeight;

    this.ctx.fillStyle = '#2c3e50';
    this.ctx.fillRect(stemX, stemTop, stemWidth, stemHeight);

    // Flag
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

    if (isSinging) {
      const time = Date.now() / 100;
      this.drawMusicSparkle(ball.x - size, ball.y - size, size * 0.3, time);
      this.drawMusicSparkle(ball.x + size, ball.y, size * 0.25, time + 1);
      this.drawMusicSparkle(ball.x, ball.y - size * 1.5, size * 0.35, time + 2);
    }
  }

  drawWing(x, y, size, flapAngle, isLeft) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(flapAngle);

    const wingWidth = size * 0.8;
    const wingHeight = size * 0.4;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.beginPath();
    this.ctx.ellipse(isLeft ? -2 : 2, 2, wingWidth, wingHeight, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, wingWidth, wingHeight, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#e0e0e0';
    this.ctx.beginPath();
    this.ctx.ellipse(isLeft ? -wingWidth * 0.3 : wingWidth * 0.3, 0, wingWidth * 0.5, wingHeight * 0.7, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = '#2c3e50';
    this.ctx.lineWidth = size * 0.05;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, wingWidth, wingHeight, 0, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawMusicSparkle(x, y, size, time) {
    const alpha = (Math.sin(time) + 1) / 2 * 0.6 + 0.2;
    this.ctx.fillStyle = `rgba(255, 193, 7, ${alpha})`;
    this.ctx.font = `${size}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('♪', x, y);
  }

  drawPitchGuidance(ball, targetGate) {
    const holeBounds = targetGate.getHoleBounds();
    const ballY = ball.y;
    const targetY = holeBounds.center;

    const needsToGoUp = ballY > targetY;
    const needsToGoDown = ballY < targetY;

    const distanceFromTarget = Math.abs(ballY - targetY);
    if (distanceFromTarget < 30) return;

    const time = Date.now() / 300;
    const bounce = Math.sin(time * 2) * 5;

    const chevronSize = 20;
    const chevronSpacing = 15;
    const numChevrons = 3;

    for (let i = 0; i < numChevrons; i++) {
      const alpha = 0.8 - (i * 0.2);
      const offset = i * chevronSpacing;

      if (needsToGoUp) {
        this.drawChevron(ball.x, ballY - ball.radius - 25 - offset + bounce, chevronSize, 'up', alpha);
      } else if (needsToGoDown) {
        this.drawChevron(ball.x, ballY + ball.radius + 25 + offset - bounce, chevronSize, 'down', alpha);
      }
    }
  }

  drawChevron(x, y, size, direction, alpha) {
    this.ctx.save();
    this.ctx.translate(x, y);

    this.ctx.strokeStyle = `rgba(255, 140, 0, ${alpha})`;
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    if (direction === 'up') {
      this.ctx.moveTo(-size / 2, size / 4);
      this.ctx.lineTo(0, -size / 4);
      this.ctx.lineTo(size / 2, size / 4);
    } else {
      this.ctx.moveTo(-size / 2, -size / 4);
      this.ctx.lineTo(0, size / 4);
      this.ctx.lineTo(size / 2, -size / 4);
    }
    this.ctx.stroke();

    this.ctx.strokeStyle = `rgba(255, 193, 7, ${alpha * 0.5})`;
    this.ctx.lineWidth = 6;
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawPitchTrace(pitchTrace) {
    if (pitchTrace.length < 2) return;

    this.ctx.strokeStyle = 'rgba(255, 193, 7, 0.3)';
    this.ctx.lineWidth = 8;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(pitchTrace[0].x, pitchTrace[0].y);

    for (let i = 1; i < pitchTrace.length; i++) {
      this.ctx.lineTo(pitchTrace[i].x, pitchTrace[i].y);
    }

    this.ctx.stroke();

    this.ctx.strokeStyle = 'rgba(255, 223, 0, 0.15)';
    this.ctx.lineWidth = 16;
    this.ctx.stroke();
  }

  drawPerfectHitHighlight(hit) {
    const time = Date.now() / 200;
    const pulseScale = 1 + Math.sin(time) * 0.2;

    const gradient = this.ctx.createRadialGradient(hit.x, hit.y, 0, hit.x, hit.y, 25 * pulseScale);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 193, 7, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 193, 7, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(hit.x, hit.y, 25 * pulseScale, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(255, 223, 0, 0.9)';
    this.ctx.beginPath();
    this.ctx.arc(hit.x, hit.y, 8 * pulseScale, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawTargetIndicator(gate) {
    const holeBounds = gate.getHoleBounds();
    const arrowX = gate.x - 40;
    const bounce = Math.sin(Date.now() / 200) * 3;

    this.ctx.fillStyle = '#ffd700';
    this.ctx.beginPath();
    this.ctx.moveTo(arrowX + bounce, holeBounds.center);
    this.ctx.lineTo(arrowX - 15 + bounce, holeBounds.center - 10);
    this.ctx.lineTo(arrowX - 15 + bounce, holeBounds.center + 10);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.strokeStyle = '#ff8c00';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([10, 10]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, holeBounds.center);
    this.ctx.lineTo(GAME_CONFIG.CANVAS_WIDTH, holeBounds.center);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  drawGameOverMessage(gameState, pitchTrace, gates) {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

    const won = gameState.currentGateIndex >= gameState.gates.length;
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;

    this.ctx.fillStyle = '#f0e68c';
    this.ctx.strokeStyle = '#8B7355';
    this.ctx.lineWidth = 6;
    const panelWidth = 320;
    const panelHeight = 240;
    this.ctx.beginPath();
    this.ctx.roundRect(centerX - panelWidth/2, centerY - panelHeight/2, panelWidth, panelHeight, 15);
    this.ctx.fill();
    this.ctx.stroke();

    if (pitchTrace && pitchTrace.length > 1 && gates && gates.length > 0) {
      this.drawMiniatureTrace(centerX, centerY, pitchTrace, gates);
    }

    const message = won ? 'Tada! 🎉' : 'Game Over';
    const messageColor = won ? '#5ac54f' : '#e74c3c';

    this.ctx.fillStyle = '#000';
    this.ctx.font = 'bold 52px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(message, centerX + 3, centerY - 70 + 3);

    this.ctx.fillStyle = messageColor;
    this.ctx.fillText(message, centerX, centerY - 70);

    this.ctx.fillStyle = '#fff';
    this.ctx.strokeStyle = '#8B7355';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.roundRect(centerX - 130, centerY - 10, 260, 60, 8);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#666';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.fillText('SCORE', centerX, centerY + 5);

    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 32px Arial';
    this.ctx.fillText(gameState.score.toString(), centerX, centerY + 32);

    if (won) {
      this.drawMedal(centerX - 110, centerY - 5, '#ffd700', '#ff8c00');
    }
  }

  drawMiniatureTrace(centerX, centerY, pitchTrace, gates) {
    if (pitchTrace.length < 2 || gates.length === 0) return;

    const minX = Math.min(...pitchTrace.map(p => p.x));
    const maxX = Math.max(...pitchTrace.map(p => p.x));
    const minY = Math.min(...pitchTrace.map(p => p.y));
    const maxY = Math.max(...pitchTrace.map(p => p.y));

    const miniWidth = 200;
    const miniHeight = 80;
    const miniX = centerX - miniWidth / 2;
    const miniY = centerY + 60;

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.strokeStyle = '#8B7355';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.roundRect(miniX, miniY, miniWidth, miniHeight, 5);
    this.ctx.fill();
    this.ctx.stroke();

    const scaleX = miniWidth / (maxX - minX || 1);
    const scaleY = miniHeight / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY) * 0.8;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 193, 7, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    const firstPoint = this.scaleMiniaturePoint(pitchTrace[0], minX, minY, scale, miniX, miniY, miniWidth, miniHeight);
    this.ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < pitchTrace.length; i++) {
      const point = this.scaleMiniaturePoint(pitchTrace[i], minX, minY, scale, miniX, miniY, miniWidth, miniHeight);
      this.ctx.lineTo(point.x, point.y);
    }

    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.fillStyle = '#666';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Your pitch trace', centerX, miniY + miniHeight + 5);
  }

  scaleMiniaturePoint(point, minX, minY, scale, miniX, miniY, miniWidth, miniHeight) {
    const scaledX = (point.x - minX) * scale;
    const scaledY = (point.y - minY) * scale;

    return {
      x: miniX + scaledX + miniWidth * 0.1,
      y: miniY + scaledY + miniHeight * 0.1
    };
  }

  drawMedal(x, y, color, ribbonColor) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 20, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = ribbonColor;
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    this.ctx.fillStyle = ribbonColor;
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('★', x, y);

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

  dispose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.resizeRAF) {
      cancelAnimationFrame(this.resizeRAF);
      this.resizeRAF = null;
    }

    this.ctx = null;
  }
}
