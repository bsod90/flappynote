/**
 * ExerciseRenderer - All exercise-related canvas drawing.
 * Receives exercise state + coordinate params from VocalMonitorRenderer.
 */

import { EngineState, TargetState } from './ExerciseEngine.js';
import { PianoRoll } from './PianoRoll.js';

export class ExerciseRenderer {
  constructor() {
    this.pianoRoll = new PianoRoll();

    // Particle system for hit effects
    this.particles = [];

    // Glow rings for hit effects
    this.glowRings = [];
  }

  /**
   * Render exercise targets (call after time grid, before pitch trace)
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} exerciseState - From ExerciseEngine.getState()
   * @param {number} mainAreaX - X offset for main area (after keyboard)
   * @param {number} mainAreaWidth - Width of main area
   * @param {number} height - Canvas height
   * @param {number} pitchRangeMin - Minimum MIDI note
   * @param {number} pitchRangeMax - Maximum MIDI note
   * @param {number} viewportStart - Viewport start time in ms
   * @param {number} viewportWidth - Viewport width in ms
   * @param {number} currentTime - Current elapsed time in ms
   * @param {boolean} showLyrics - Whether to show solfege text on targets
   * @param {string} renderMode - 'all', 'pending', or 'hit' (default: 'all')
   */
  render(ctx, exerciseState, mainAreaX, mainAreaWidth, height,
    pitchRangeMin, pitchRangeMax, viewportStart, viewportWidth,
    currentTime, showLyrics, renderMode = 'all') {

    if (!exerciseState || exerciseState.engineState === EngineState.IDLE) return;

    // When PAUSED, only render hit targets (history), not pending targets
    const isPaused = exerciseState.engineState === EngineState.PAUSED;
    if (isPaused && renderMode === 'pending') return;

    const phase = exerciseState.currentPhase;
    if (!phase) return;

    const noteHeight = height / (pitchRangeMax - pitchRangeMin);

    // Calculate playhead X position
    const playheadNormX = (currentTime - viewportStart) / viewportWidth;
    const playheadX = mainAreaX + playheadNormX * mainAreaWidth;

    // Time to X helper
    const timeToX = (time) => {
      const normX = (time - viewportStart) / viewportWidth;
      return mainAreaX + normX * mainAreaWidth;
    };

    // Time per pixel for the main area
    const msPerPixel = viewportWidth / mainAreaWidth;

    // Draw targets
    const { currentTargetIndex, sustainFraction } = exerciseState;
    const targets = phase.targets;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];

      // Skip rest targets (not visualized)
      if (target.rest) continue;

      const isCurrent = i === currentTargetIndex;
      const isHit = target.state === TargetState.HIT;

      // Filter based on renderMode
      if (renderMode === 'pending' && isHit) continue;
      if (renderMode === 'hit' && !isHit) continue;

      // Calculate target rectangle
      const targetWidth = exerciseState.sustainDuration / msPerPixel;
      const gapWidth = 10; // pixels between targets

      let x, y;

      if (isHit && target.hitTime != null) {
        // Hit targets: positioned at their actual hit time (fixed in history)
        x = timeToX(target.hitTime) - targetWidth;

        // Y position: align with the TARGET note lane (not the sung frequency)
        // The pitch trace already shows where the user actually sang
        const midiY = this.pianoRoll.midiToY(target.midiNote, height, pitchRangeMin, pitchRangeMax);
        y = midiY - noteHeight;
      } else if (isCurrent) {
        // Current target: at the playhead
        x = playheadX;
        const midiY = this.pianoRoll.midiToY(target.midiNote, height, pitchRangeMin, pitchRangeMax);
        y = midiY - noteHeight;
      } else {
        // Future targets: to the right of playhead (skip rest targets in step count)
        let stepsForward = 0;
        for (let j = currentTargetIndex; j < i; j++) {
          if (!targets[j].rest) stepsForward++;
        }
        x = playheadX + stepsForward * (targetWidth + gapWidth);
        const midiY = this.pianoRoll.midiToY(target.midiNote, height, pitchRangeMin, pitchRangeMax);
        y = midiY - noteHeight;
      }

      // Skip if completely outside viewport
      if (x + targetWidth < mainAreaX || x > mainAreaX + mainAreaWidth) continue;

      // Draw target rectangle
      this._drawTarget(ctx, target, x, y, targetWidth, noteHeight,
        isCurrent, isHit, sustainFraction, currentTime, showLyrics);
    }

    // Draw archived hit targets from previous phases/key changes
    if (renderMode !== 'pending' && exerciseState.hitHistory) {
      const targetWidth = exerciseState.sustainDuration / msPerPixel;

      for (const target of exerciseState.hitHistory) {
        if (target.hitTime == null) continue;

        const x = timeToX(target.hitTime) - targetWidth;
        // Skip if completely outside viewport
        if (x + targetWidth < mainAreaX || x > mainAreaX + mainAreaWidth) continue;

        const midiY = this.pianoRoll.midiToY(target.midiNote, height, pitchRangeMin, pitchRangeMax);
        const y = midiY - noteHeight;

        this._drawTarget(ctx, target, x, y, targetWidth, noteHeight,
          false, true, 0, currentTime, showLyrics);
      }
    }
  }

  /**
   * Draw a single target rectangle
   */
  _drawTarget(ctx, target, x, y, width, height, isCurrent, isHit,
    sustainFraction, currentTime, showLyrics) {

    ctx.save();

    // Pop animation for recently hit targets
    let scale = 1;
    const popDuration = 200; // ms
    if (isHit && target.hitAnimationStart != null) {
      const elapsed = currentTime - target.hitAnimationStart;
      if (elapsed < popDuration) {
        // Ease out bounce: scale up then back to 1
        const t = elapsed / popDuration;
        const bounce = Math.sin(t * Math.PI) * 0.3; // peaks at 0.3 (130% scale)
        scale = 1 + bounce;
      }
    }

    // Apply scale transform around center
    if (scale !== 1) {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.translate(-centerX, -centerY);
    }

    if (isHit) {
      // Hit target: green
      ctx.fillStyle = 'rgba(76, 175, 80, 0.35)';
      ctx.strokeStyle = 'rgba(76, 175, 80, 0.7)';
    } else if (isCurrent) {
      // Current target: brighter yellow with pulse
      const pulse = 0.8 + 0.2 * Math.sin(currentTime / 200);
      ctx.fillStyle = `rgba(255, 220, 50, ${0.35 * pulse})`;
      ctx.strokeStyle = `rgba(255, 220, 50, ${0.7 * pulse})`;
    } else {
      // Upcoming target: semi-transparent yellow
      ctx.fillStyle = 'rgba(255, 220, 50, 0.15)';
      ctx.strokeStyle = 'rgba(255, 220, 50, 0.35)';
    }

    // Draw background
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.fill();
    ctx.stroke();

    // Draw sustain progress fill for current target
    if (isCurrent && sustainFraction > 0) {
      ctx.fillStyle = 'rgba(255, 220, 50, 0.4)';
      ctx.beginPath();
      ctx.roundRect(x, y, width * sustainFraction, height, 3);
      ctx.fill();
    }

    // Draw lyrics (solfege)
    if (showLyrics && target.lyric) {
      const fontSize = Math.min(14, Math.max(9, height * 0.6));
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isHit ? 'rgba(76, 175, 80, 0.9)' : 'rgba(100, 80, 0, 0.8)';
      ctx.fillText(target.lyric, x + width / 2, y + height / 2);
    }

    ctx.restore();
  }

  /**
   * Render hit effects (call after current pitch indicator)
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} exerciseState
   * @param {number} mainAreaX
   * @param {number} mainAreaWidth
   * @param {number} height
   * @param {number} pitchRangeMin
   * @param {number} pitchRangeMax
   * @param {number} viewportStart
   * @param {number} viewportWidth
   * @param {number} currentTime
   */
  renderHitEffects(ctx, exerciseState, mainAreaX, mainAreaWidth, height,
    pitchRangeMin, pitchRangeMax, viewportStart, viewportWidth, currentTime) {

    if (!exerciseState || exerciseState.engineState === EngineState.IDLE) return;

    // Process hit effects from engine state to create particles/rings
    this._processHitEffects(exerciseState, height, pitchRangeMin, pitchRangeMax,
      mainAreaX, mainAreaWidth, viewportStart, viewportWidth, currentTime);

    // Render particles
    this._renderParticles(ctx, currentTime);

    // Render glow rings
    this._renderGlowRings(ctx, currentTime);
  }

  /**
   * Check for new hit effects and spawn particles
   */
  _processHitEffects(exerciseState, height, pitchRangeMin, pitchRangeMax,
    mainAreaX, mainAreaWidth, viewportStart, viewportWidth, currentTime) {

    const noteHeight = height / (pitchRangeMax - pitchRangeMin);

    for (const effect of exerciseState.hitEffects) {
      // Only process effects we haven't spawned particles for
      if (effect._spawned) continue;
      effect._spawned = true;

      // Calculate position
      const midiY = this.pianoRoll.midiToY(effect.midiNote, height, pitchRangeMin, pitchRangeMax);
      const playheadNormX = (currentTime - viewportStart) / viewportWidth;
      const centerX = mainAreaX + playheadNormX * mainAreaWidth;
      const centerY = midiY - noteHeight / 2;

      // Spawn particles
      const numParticles = 12 + Math.floor(Math.random() * 9); // 12-20
      for (let i = 0; i < numParticles; i++) {
        const angle = (Math.PI * 2 * i) / numParticles + (Math.random() - 0.5) * 0.5;
        const speed = 40 + Math.random() * 60; // pixels per second
        this.particles.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          spawnTime: currentTime,
          duration: 500, // ms
          size: 2 + Math.random() * 2,
        });
      }

      // Spawn glow ring
      this.glowRings.push({
        x: centerX,
        y: centerY,
        spawnTime: currentTime,
        duration: 400,
        maxRadius: 30,
      });
    }
  }

  /**
   * Render particles
   */
  _renderParticles(ctx, currentTime) {
    ctx.save();

    this.particles = this.particles.filter(p => {
      const elapsed = currentTime - p.spawnTime;
      if (elapsed >= p.duration) return false;

      const t = elapsed / p.duration;
      p.life = 1 - t;

      // Update position
      const seconds = elapsed / 1000;
      const px = p.x + p.vx * seconds;
      const py = p.y + p.vy * seconds;

      // Draw particle
      const alpha = p.life * 0.8;
      ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();

      return true;
    });

    ctx.restore();
  }

  /**
   * Render glow rings
   */
  _renderGlowRings(ctx, currentTime) {
    ctx.save();

    this.glowRings = this.glowRings.filter(ring => {
      const elapsed = currentTime - ring.spawnTime;
      if (elapsed >= ring.duration) return false;

      const t = elapsed / ring.duration;
      const radius = ring.maxRadius * t;
      const alpha = (1 - t) * 0.4;

      ctx.strokeStyle = `rgba(255, 220, 50, ${alpha})`;
      ctx.lineWidth = 3 * (1 - t);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      return true;
    });

    ctx.restore();
  }

  /**
   * Render phase label and progress bar (call after keyboard, before playhead)
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} exerciseState
   * @param {number} mainAreaX
   * @param {number} mainAreaWidth
   * @param {number} height
   */
  renderProgressUI(ctx, exerciseState, mainAreaX, mainAreaWidth) {
    // Only show progress when actively running (not when paused/reviewing)
    if (!exerciseState || exerciseState.engineState !== EngineState.ACTIVE) return;

    const { currentTarget, progress } = exerciseState;
    if (!currentTarget) return;

    ctx.save();

    // Progress label at top of main area
    const labelY = 20;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Show current target number and ladder info
    const targetNum = progress.targetIndex + 1;
    const totalTargets = progress.targetCount;
    const ladderNum = currentTarget.ladder || 1;
    const labelText = `Ladder ${ladderNum} • Target ${targetNum}/${totalTargets}`;
    const labelWidth = ctx.measureText(labelText).width + 20;
    const labelX = mainAreaX + mainAreaWidth / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(labelX - labelWidth / 2, labelY - 12, labelWidth, 24, 6);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(labelText, labelX, labelY);

    // Progress bar below the label
    const barY = labelY + 18;
    const barHeight = 4;
    const barWidth = Math.min(200, mainAreaWidth * 0.3);
    const barX = labelX - barWidth / 2;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 2);
    ctx.fill();

    // Fill
    const fillWidth = barWidth * progress.overallFraction;
    if (fillWidth > 0) {
      ctx.fillStyle = 'rgba(255, 220, 50, 0.8)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillWidth, barHeight, 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
