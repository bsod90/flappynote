/**
 * VocalMonitorRenderer - Canvas renderer for the Vocal Monitor
 * Renders piano roll background with pitch trace overlay
 */

import { PianoRoll } from './PianoRoll.js';
import { FrequencyConverter } from '../../pitch-engine/index.js';

export class VocalMonitorRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = null;
    this.pianoRoll = new PianoRoll();

    this.dpr = 1;
    this.width = 0;
    this.height = 0;

    this.onResize = null;
    this.resizeObserver = null;
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
   * Handle canvas resize
   */
  handleResize(width, height) {
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
   */
  render(state, scaleManager, pressedKey = null) {
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
    this.pianoRoll.renderScaleHighlights(
      this.ctx,
      mainAreaX,
      mainAreaWidth,
      this.height,
      state.pitchRangeMin,
      state.pitchRangeMax,
      scaleManager
    );

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

    // Render pitch trace
    this.renderPitchTrace(mainAreaX, mainAreaWidth, state);

    // Render current pitch indicator
    if (state.currentPitch && state.isSinging) {
      this.renderCurrentPitchIndicator(mainAreaX, mainAreaWidth, state);
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
   * Render the pitch trace line
   */
  renderPitchTrace(x, width, state) {
    const { pitchHistory, pitchRangeMin, pitchRangeMax, viewportStart, viewportWidth } = state;

    if (pitchHistory.length < 2) return;

    // Draw pitch line segments
    this.ctx.strokeStyle = '#ff6b35';
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    let lastPoint = null;
    let lastMidi = null;
    const maxTimeGap = 150; // Max gap in ms before breaking line
    const maxPitchGap = 7; // Max semitones jump before breaking line (a fifth)

    for (let i = 0; i < pitchHistory.length; i++) {
      const point = pitchHistory[i];
      const normalizedX = (point.time - viewportStart) / viewportWidth;
      const pixelX = x + normalizedX * width;

      const midiNote = FrequencyConverter.frequencyToMidi(point.frequency);
      // Add 0.5 to center the pitch line within the note's row (not at the boundary)
      const normalizedY = (midiNote + 0.5 - pitchRangeMin) / (pitchRangeMax - pitchRangeMin);
      const pixelY = this.height - normalizedY * this.height;

      // Line width based on confidence
      const lineWidth = 2 + point.confidence * 6;

      if (lastPoint && lastMidi !== null) {
        const timeDiff = point.time - lastPoint.time;
        const pitchDiff = Math.abs(midiNote - lastMidi);

        // Only draw line if both time and pitch gaps are within limits
        if (timeDiff < maxTimeGap && pitchDiff < maxPitchGap) {
          this.ctx.beginPath();
          this.ctx.lineWidth = lineWidth;
          this.ctx.moveTo(lastPoint.x, lastPoint.y);
          this.ctx.lineTo(pixelX, pixelY);
          this.ctx.stroke();
        }
      }

      lastPoint = { x: pixelX, y: pixelY, time: point.time };
      lastMidi = midiNote;
    }

    // Draw glow effect
    if (pitchHistory.length > 0) {
      this.ctx.globalAlpha = 0.3;
      this.ctx.strokeStyle = '#ffaa88';
      this.ctx.lineWidth = 8;

      this.ctx.beginPath();
      let firstPoint = true;
      let prevMidi = null;

      for (let i = 0; i < pitchHistory.length; i++) {
        const point = pitchHistory[i];
        const normalizedX = (point.time - viewportStart) / viewportWidth;
        const pixelX = x + normalizedX * width;

        const midiNote = FrequencyConverter.frequencyToMidi(point.frequency);
        // Add 0.5 to center within note row
        const normalizedY = (midiNote + 0.5 - pitchRangeMin) / (pitchRangeMax - pitchRangeMin);
        const pixelY = this.height - normalizedY * this.height;

        if (firstPoint) {
          this.ctx.moveTo(pixelX, pixelY);
          firstPoint = false;
        } else {
          const prevPoint = pitchHistory[i - 1];
          const timeDiff = point.time - prevPoint.time;
          const pitchDiff = prevMidi !== null ? Math.abs(midiNote - prevMidi) : 0;

          if (timeDiff < maxTimeGap && pitchDiff < maxPitchGap) {
            this.ctx.lineTo(pixelX, pixelY);
          } else {
            this.ctx.moveTo(pixelX, pixelY);
          }
        }
        prevMidi = midiNote;
      }

      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
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
    this.ctx = null;
  }
}
