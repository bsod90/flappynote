/**
 * VocalMonitorRenderer - Canvas renderer for the Vocal Monitor
 * Renders piano roll background with pitch trace overlay
 */

import { PianoRoll } from './PianoRoll.js';
import { ExerciseRenderer } from './ExerciseRenderer.js';
import { FrequencyConverter } from '../../pitch-engine/index.js';

export class VocalMonitorRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = null;
    this.pianoRoll = new PianoRoll();
    this.exerciseRenderer = new ExerciseRenderer();

    this.dpr = 1;
    this.width = 0;
    this.height = 0;

    this.onResize = null;
    this.resizeObserver = null;
    this.resizeDebounceTimer = null;
    this.pendingResize = null;
  }

  /**
   * Initialize the renderer
   */
  initialize() {
    this.ctx = this.canvas.getContext('2d');

    return new Promise(resolve => {
      this.resizeObserver = new ResizeObserver(entries => {
        requestAnimationFrame(() => {
          for (const entry of entries) {
            const contentBoxSize = entry.contentBoxSize?.[0];
            if (contentBoxSize) {
              this.handleResize(contentBoxSize.inlineSize, contentBoxSize.blockSize);
            } else {
              this.handleResize(entry.contentRect.width, entry.contentRect.height);
            }
          }
          resolve();
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
    });
  }

  /**
   * Handle canvas resize (debounced to avoid clearing canvas during CSS transitions)
   */
  handleResize(width, height) {
    this.pendingResize = { width, height };

    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = setTimeout(() => {
      if (this.pendingResize) {
        this._applyResize(this.pendingResize.width, this.pendingResize.height);
        this.pendingResize = null;
      }
    }, 50);
  }

  /**
   * Apply the actual canvas resize
   */
  _applyResize(width, height) {
    if (!width || !height || width < 10 || height < 10) return;

    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.width = width;
    this.height = height;

    if (this.onResize) {
      this.onResize(width, height);
    }
  }

  /**
   * Render the vocal monitor
   * @param {object} state - State from VocalMonitorState.getState()
   * @param {ScaleManager} scaleManager - Scale manager for highlights
   * @param {number|null} pressedKey - Currently pressed piano key (MIDI note)
   * @param {object|null} exerciseState - From ExerciseEngine.getState()
   * @param {boolean} showLyrics - Whether to show solfege on exercise targets
   * @param {ScaleTimeline|null} scaleTimeline - Timeline tracking key changes for historical scale rendering
   */
  render(state, scaleManager, pressedKey = null, exerciseState = null, showLyrics = true, scaleTimeline = null) {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.scale(this.dpr, this.dpr);

    // Clear with background color
    this.ctx.fillStyle = '#f5f5f5';
    this.ctx.fillRect(0, 0, this.width, this.height);

    const keyboardWidth = this.pianoRoll.getKeyboardWidth();
    const mainAreaX = keyboardWidth;
    const mainAreaWidth = this.width - keyboardWidth;

    // Render scale highlights first (background)
    // Use timeline-aware rendering when key changes exist
    if (scaleTimeline && scaleTimeline.keyChanges.length > 0) {
      this.pianoRoll.renderScaleHighlightsWithTimeline(
        this.ctx,
        mainAreaX,
        mainAreaWidth,
        this.height,
        state.pitchRangeMin,
        state.pitchRangeMax,
        scaleTimeline,
        state.viewportStart,
        state.viewportWidth,
        (rootNote, scaleType) => scaleManager.getScaleInfoForKey(rootNote, scaleType)
      );
    } else {
      this.pianoRoll.renderScaleHighlights(
        this.ctx,
        mainAreaX,
        mainAreaWidth,
        this.height,
        state.pitchRangeMin,
        state.pitchRangeMax,
        scaleManager
      );
    }

    // Render grid
    this.pianoRoll.renderGrid(
      this.ctx,
      mainAreaX,
      mainAreaWidth,
      this.height,
      state.pitchRangeMin,
      state.pitchRangeMax,
      scaleManager
    );

    // Render time grid (vertical lines)
    this.renderTimeGrid(mainAreaX, mainAreaWidth, state);

    // Render pending/current exercise targets (under pitch trace, as guides)
    if (exerciseState) {
      this.exerciseRenderer.render(
        this.ctx, exerciseState, mainAreaX, mainAreaWidth, this.height,
        state.pitchRangeMin, state.pitchRangeMax,
        state.viewportStart, state.viewportWidth,
        state.currentTime, showLyrics, 'pending'
      );
    }

    // Render pitch trace
    this.renderPitchTrace(mainAreaX, mainAreaWidth, state);

    // Render current pitch indicator
    if (state.currentPitch && state.isSinging) {
      this.renderCurrentPitchIndicator(mainAreaX, mainAreaWidth, state);
    }

    // Render hit targets (on top of pitch trace for review)
    if (exerciseState) {
      this.exerciseRenderer.render(
        this.ctx, exerciseState, mainAreaX, mainAreaWidth, this.height,
        state.pitchRangeMin, state.pitchRangeMax,
        state.viewportStart, state.viewportWidth,
        state.currentTime, showLyrics, 'hit'
      );
    }

    // Render exercise hit effects (particles on top)
    if (exerciseState) {
      this.exerciseRenderer.renderHitEffects(
        this.ctx, exerciseState, mainAreaX, mainAreaWidth, this.height,
        state.pitchRangeMin, state.pitchRangeMax,
        state.viewportStart, state.viewportWidth,
        state.currentTime
      );
    }

    // Render piano keyboard last (on top)
    this.pianoRoll.renderKeyboard(
      this.ctx,
      this.height,
      state.pitchRangeMin,
      state.pitchRangeMax,
      scaleManager,
      pressedKey
    );

    // Render exercise progress UI (after keyboard, before playhead)
    if (exerciseState) {
      this.exerciseRenderer.renderProgressUI(
        this.ctx, exerciseState, mainAreaX, mainAreaWidth
      );
    }

    // Render playhead line
    this.renderPlayhead(mainAreaX, mainAreaWidth, state);

    this.ctx.restore();
  }

  /**
   * Render vertical time grid
   */
  renderTimeGrid(x, width, state) {
    const { viewportStart, viewportWidth } = state;

    // Draw vertical lines every second
    const secondInterval = 1000;
    const startSecond = Math.ceil(viewportStart / secondInterval) * secondInterval;

    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.lineWidth = 1;
    this.ctx.font = '10px Arial';
    this.ctx.fillStyle = '#999';
    this.ctx.textAlign = 'center';

    for (let time = startSecond; time < viewportStart + viewportWidth; time += secondInterval) {
      const normalizedX = (time - viewportStart) / viewportWidth;
      const pixelX = x + normalizedX * width;

      this.ctx.beginPath();
      this.ctx.moveTo(pixelX, 0);
      this.ctx.lineTo(pixelX, this.height);
      this.ctx.stroke();

      // Time label
      const seconds = Math.floor(time / 1000);
      this.ctx.fillText(`${seconds}s`, pixelX, this.height - 5);
    }
  }

  /**
   * Get color based on brightness (spectral centroid)
   * Cool colors (blue/purple) for dark, warm colors (orange/yellow) for bright
   * @param {number} brightness - 0-1 normalized brightness
   * @returns {string} CSS color string
   */
  getBrightnessColor(brightness) {
    // Interpolate from cool (dark tone) to warm (bright tone)
    // Dark: #6b7aff (cool blue-purple)
    // Mid: #ff6b35 (orange - default)
    // Bright: #ffd93d (warm yellow)

    if (brightness < 0.5) {
      // Dark to mid range
      const t = brightness * 2; // 0-1 within this range
      const r = Math.round(107 + (255 - 107) * t);
      const g = Math.round(122 + (107 - 122) * t);
      const b = Math.round(255 + (53 - 255) * t);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Mid to bright range
      const t = (brightness - 0.5) * 2; // 0-1 within this range
      const r = Math.round(255);
      const g = Math.round(107 + (217 - 107) * t);
      const b = Math.round(53 + (61 - 53) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  /**
   * Get line width based on normalized volume
   * Range: baseWidth/2 to baseWidth*2
   * @param {number} normalizedRMS - Pre-normalized RMS (0-1) from adaptive tracking
   * @param {number} baseWidth - Base line width
   * @returns {number} Scaled line width
   */
  getVolumeBasedLineWidth(normalizedRMS, baseWidth = 4) {
    // normalizedRMS is already 0-1 from VocalMonitorState's adaptive tracking
    const clamped = Math.min(1, Math.max(0, normalizedRMS));
    // Scale from 0.5x to 2x base width
    const scale = 0.5 + clamped * 1.5;
    return baseWidth * scale;
  }

  /**
   * Render the pitch trace line with vocal analysis visualization
   */
  renderPitchTrace(x, width, state) {
    const { pitchHistory, pitchRangeMin, pitchRangeMax, viewportStart, viewportWidth } = state;

    if (pitchHistory.length < 2) return;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    let lastPoint = null;
    let lastMidi = null;
    const maxTimeGap = 150; // Max gap in ms before breaking line
    const maxPitchGap = 7; // Max semitones jump before breaking line (a fifth)
    const baseLineWidth = 4; // Base line width for volume scaling

    // First pass: Draw glow effect based on brightness
    this.ctx.globalAlpha = 0.25;
    for (let i = 1; i < pitchHistory.length; i++) {
      const point = pitchHistory[i];
      const prevPoint = pitchHistory[i - 1];

      const normalizedX = (point.time - viewportStart) / viewportWidth;
      const pixelX = x + normalizedX * width;
      const prevNormalizedX = (prevPoint.time - viewportStart) / viewportWidth;
      const prevPixelX = x + prevNormalizedX * width;

      const midiNote = FrequencyConverter.frequencyToMidi(point.frequency);
      const prevMidiNote = FrequencyConverter.frequencyToMidi(prevPoint.frequency);

      const normalizedY = (midiNote + 0.5 - pitchRangeMin) / (pitchRangeMax - pitchRangeMin);
      const pixelY = this.height - normalizedY * this.height;
      const prevNormalizedY = (prevMidiNote + 0.5 - pitchRangeMin) / (pitchRangeMax - pitchRangeMin);
      const prevPixelY = this.height - prevNormalizedY * this.height;

      const timeDiff = point.time - prevPoint.time;
      const pitchDiff = Math.abs(midiNote - prevMidiNote);

      if (timeDiff < maxTimeGap && pitchDiff < maxPitchGap) {
        // Glow color based on brightness
        const brightness = point.brightness ?? 0.5;
        this.ctx.strokeStyle = this.getBrightnessColor(brightness);
        // Glow width scales with volume too
        const glowWidth = this.getVolumeBasedLineWidth(point.normalizedRMS || 0, baseLineWidth) * 3;
        this.ctx.lineWidth = glowWidth;

        this.ctx.beginPath();
        this.ctx.moveTo(prevPixelX, prevPixelY);
        this.ctx.lineTo(pixelX, pixelY);
        this.ctx.stroke();
      }
    }
    this.ctx.globalAlpha = 1;

    // Second pass: Draw main pitch line with color based on brightness, width based on volume
    for (let i = 0; i < pitchHistory.length; i++) {
      const point = pitchHistory[i];
      const normalizedX = (point.time - viewportStart) / viewportWidth;
      const pixelX = x + normalizedX * width;

      const midiNote = FrequencyConverter.frequencyToMidi(point.frequency);
      const normalizedY = (midiNote + 0.5 - pitchRangeMin) / (pitchRangeMax - pitchRangeMin);
      const pixelY = this.height - normalizedY * this.height;

      // Line width based on volume (adaptive normalized RMS)
      const lineWidth = this.getVolumeBasedLineWidth(point.normalizedRMS || 0, baseLineWidth);

      // Color based on brightness
      const brightness = point.brightness ?? 0.5;
      const lineColor = this.getBrightnessColor(brightness);

      if (lastPoint && lastMidi !== null) {
        const timeDiff = point.time - lastPoint.time;
        const pitchDiff = Math.abs(midiNote - lastMidi);

        if (timeDiff < maxTimeGap && pitchDiff < maxPitchGap) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = lineColor;
          this.ctx.lineWidth = lineWidth;
          this.ctx.moveTo(lastPoint.x, lastPoint.y);
          this.ctx.lineTo(pixelX, pixelY);
          this.ctx.stroke();
        }
      }

      lastPoint = { x: pixelX, y: pixelY, time: point.time };
      lastMidi = midiNote;
    }

    // Draw breathiness indicators (more prominent)
    this.renderBreathinessIndicators(x, width, state);
  }

  /**
   * Render breathiness indicators as a fuzzy/airy effect around the pitch line
   */
  renderBreathinessIndicators(x, width, state) {
    const { pitchHistory, pitchRangeMin, pitchRangeMax, viewportStart, viewportWidth } = state;

    if (pitchHistory.length < 1) return;

    // Higher threshold - only show for noticeably breathy sounds
    const breathinessThreshold = 0.4;

    for (let i = 0; i < pitchHistory.length; i++) {
      const point = pitchHistory[i];
      const breathiness = point.breathiness ?? 0;

      if (breathiness < breathinessThreshold) continue;

      const normalizedX = (point.time - viewportStart) / viewportWidth;
      const pixelX = x + normalizedX * width;

      const midiNote = FrequencyConverter.frequencyToMidi(point.frequency);
      const normalizedY = (midiNote + 0.5 - pitchRangeMin) / (pitchRangeMax - pitchRangeMin);
      const pixelY = this.height - normalizedY * this.height;

      // Breathiness intensity (0-1 above threshold)
      const intensity = (breathiness - breathinessThreshold) / (1 - breathinessThreshold);

      // Draw scattered particles for airy effect (toned down)
      const numDots = Math.floor(2 + intensity * 8); // 2-10 dots
      const maxRadius = 6 + intensity * 8; // Smaller spread

      for (let d = 0; d < numDots; d++) {
        // Use deterministic pseudo-random based on point time and index
        const seed = point.time * 1000 + d * 137;
        const angle = ((seed * 0.618033988749) % 1) * Math.PI * 2;
        const radiusFactor = ((seed * 0.314159265359) % 1);
        const radius = 3 + radiusFactor * maxRadius;

        const dotX = pixelX + Math.cos(angle) * radius;
        const dotY = pixelY + Math.sin(angle) * radius;

        // Dot size and alpha vary with distance and breathiness
        const distanceFactor = 1 - (radius / (maxRadius + 3));
        const dotSize = 1 + distanceFactor * 1.5 + intensity * 1;
        const dotAlpha = (0.15 + intensity * 0.35) * (0.3 + distanceFactor * 0.5);

        // Color: subtle cyan for airy feel
        this.ctx.fillStyle = `rgba(150, 200, 230, ${dotAlpha})`;
        this.ctx.beginPath();
        this.ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Add a subtle hazy glow only for very breathy sounds
      if (intensity > 0.5) {
        const glowAlpha = (intensity - 0.5) * 0.15;
        const gradient = this.ctx.createRadialGradient(pixelX, pixelY, 0, pixelX, pixelY, maxRadius);
        gradient.addColorStop(0, `rgba(150, 200, 230, ${glowAlpha})`);
        gradient.addColorStop(1, 'rgba(150, 200, 230, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(pixelX, pixelY, maxRadius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  /**
   * Render current pitch indicator
   */
  renderCurrentPitchIndicator(x, width, state) {
    const { currentPitch, pitchRangeMin, pitchRangeMax, currentTime, viewportStart, viewportWidth } = state;

    if (!currentPitch || !currentPitch.frequency) return;

    const normalizedX = (currentTime - viewportStart) / viewportWidth;
    const pixelX = x + normalizedX * width;

    const midiNote = FrequencyConverter.frequencyToMidi(currentPitch.frequency);
    // Add 0.5 to center within note row
    const normalizedY = (midiNote + 0.5 - pitchRangeMin) / (pitchRangeMax - pitchRangeMin);
    const pixelY = this.height - normalizedY * this.height;

    // Draw indicator circle
    const radius = 8;

    // Outer glow
    const gradient = this.ctx.createRadialGradient(pixelX, pixelY, 0, pixelX, pixelY, radius * 3);
    gradient.addColorStop(0, 'rgba(255, 107, 53, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 107, 53, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 107, 53, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(pixelX, pixelY, radius * 3, 0, Math.PI * 2);
    this.ctx.fill();

    // Inner circle
    this.ctx.fillStyle = '#ff6b35';
    this.ctx.beginPath();
    this.ctx.arc(pixelX, pixelY, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // White center
    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.arc(pixelX, pixelY, radius * 0.4, 0, Math.PI * 2);
    this.ctx.fill();

    // Note name label
    const noteLabel = `${currentPitch.noteName}`;
    const centsLabel = currentPitch.centsOff >= 0 ? `+${currentPitch.centsOff.toFixed(0)}` : currentPitch.centsOff.toFixed(0);

    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    // Background for label
    const labelWidth = this.ctx.measureText(noteLabel + ' ' + centsLabel + '¢').width + 10;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.beginPath();
    this.ctx.roundRect(pixelX + radius + 5, pixelY - 10, labelWidth, 20, 4);
    this.ctx.fill();

    // Label text
    this.ctx.fillStyle = '#fff';
    this.ctx.fillText(`${noteLabel} ${centsLabel}¢`, pixelX + radius + 10, pixelY);
  }

  /**
   * Render playhead line
   */
  renderPlayhead(x, width, state) {
    if (!state.isRecording) return;

    const { currentTime, viewportStart, viewportWidth } = state;
    const normalizedX = (currentTime - viewportStart) / viewportWidth;
    const pixelX = x + normalizedX * width;

    // Only draw if within viewport
    if (normalizedX < 0 || normalizedX > 1) return;

    this.ctx.strokeStyle = 'rgba(255, 107, 53, 0.5)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    this.ctx.beginPath();
    this.ctx.moveTo(pixelX, 0);
    this.ctx.lineTo(pixelX, this.height);
    this.ctx.stroke();

    this.ctx.setLineDash([]);
  }

  /**
   * Get canvas dimensions
   */
  getDimensions() {
    return { width: this.width, height: this.height };
  }

  /**
   * Get keyboard width
   */
  getKeyboardWidth() {
    return this.pianoRoll.getKeyboardWidth();
  }

  /**
   * Dispose of resources
   */
  dispose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }
    this.ctx = null;
  }
}
