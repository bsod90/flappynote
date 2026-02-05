/**
 * PianoRoll - Piano roll component for the Vocal Monitor
 * Renders piano keys on the left side and provides pitch-to-Y mapping
 */

import { FrequencyConverter } from '../../pitch-engine/index.js';

export class PianoRoll {
  constructor() {
    // Piano roll dimensions
    this.keyboardWidth = 80; // Width of piano keys sidebar (increased for labels)
    this.noteHeight = 0; // Calculated based on range

    // Note names for display
    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Solfege syllables for scale degrees (by semitones from root)
    this.solfegeByInterval = {
      0: 'Do',   // Root
      1: 'Ra',   // Minor 2nd
      2: 'Re',   // Major 2nd
      3: 'Me',   // Minor 3rd
      4: 'Mi',   // Major 3rd
      5: 'Fa',   // Perfect 4th
      6: 'Fi',   // Augmented 4th / Tritone
      7: 'Sol',  // Perfect 5th
      8: 'Le',   // Minor 6th
      9: 'La',   // Major 6th
      10: 'Te',  // Minor 7th
      11: 'Ti',  // Major 7th
    };

    // Color scheme by semitone interval (extracted from reference app)
    // These are used for both the key labels and the scale highlights
    this.intervalColors = {
      0: '#5B8BD5',  // 1 (Root) - Blue
      1: '#4CAF50',  // b2 - Green
      2: '#E040FB',  // 2 - Pink/Magenta
      3: '#26A69A',  // b3 - Teal
      4: '#F44336',  // 3 - Red
      5: '#2196F3',  // 4 - Blue
      6: '#FFEB3B',  // #4/b5 - Yellow (tritone)
      7: '#AB47BC',  // 5 - Purple
      8: '#66BB6A',  // b6 - Green
      9: '#EC407A',  // 6 - Pink
      10: '#00BCD4', // b7 - Cyan
      11: '#FF9800', // 7 - Orange
    };

    // Lighter versions for background highlights
    this.intervalHighlightColors = {
      0: 'rgba(91, 139, 213, 0.25)',   // 1 (Root)
      1: 'rgba(76, 175, 80, 0.2)',     // b2
      2: 'rgba(224, 64, 251, 0.2)',    // 2
      3: 'rgba(38, 166, 154, 0.2)',    // b3
      4: 'rgba(244, 67, 54, 0.2)',     // 3
      5: 'rgba(33, 150, 243, 0.2)',    // 4
      6: 'rgba(255, 235, 59, 0.25)',   // #4/b5
      7: 'rgba(171, 71, 188, 0.2)',    // 5
      8: 'rgba(102, 187, 106, 0.2)',   // b6
      9: 'rgba(236, 64, 122, 0.2)',    // 6
      10: 'rgba(0, 188, 212, 0.2)',    // b7
      11: 'rgba(255, 152, 0, 0.2)',    // 7
    };

    // Out-of-scale color (gray with hatching)
    this.outOfScaleColor = 'rgba(120, 120, 120, 0.08)';

    // Hatched pattern canvas (created lazily)
    this.hatchPattern = null;

    // Cache for current scale info
    this.cachedScaleInfo = null;
  }

  /**
   * Create hatched pattern for out-of-scale notes
   * @param {CanvasRenderingContext2D} ctx
   * @returns {CanvasPattern}
   */
  createHatchPattern(ctx) {
    if (this.hatchPattern) return this.hatchPattern;

    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 8;
    patternCanvas.height = 8;
    const patternCtx = patternCanvas.getContext('2d');

    // Draw diagonal lines
    patternCtx.strokeStyle = 'rgba(150, 150, 150, 0.15)';
    patternCtx.lineWidth = 1;
    patternCtx.beginPath();
    patternCtx.moveTo(0, 8);
    patternCtx.lineTo(8, 0);
    patternCtx.stroke();

    this.hatchPattern = ctx.createPattern(patternCanvas, 'repeat');
    return this.hatchPattern;
  }

  /**
   * Render the piano keyboard sidebar
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} height - Canvas height
   * @param {number} pitchRangeMin - Minimum MIDI note
   * @param {number} pitchRangeMax - Maximum MIDI note
   * @param {ScaleManager} scaleManager - Scale manager for solfege labels
   * @param {number|null} pressedKey - Currently pressed MIDI note
   */
  renderKeyboard(ctx, height, pitchRangeMin, pitchRangeMax, scaleManager, pressedKey = null) {
    const numNotes = pitchRangeMax - pitchRangeMin;
    this.noteHeight = height / numNotes;

    // Cache scale info for solfege labels
    let rootPitchClass = 0;
    let scalePitchClasses = new Map(); // pitch class -> interval from root

    if (scaleManager) {
      const scaleInfo = scaleManager.getScaleInfo();
      const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());
      rootPitchClass = rootMidi % 12;

      // Build map of pitch class to interval
      scaleInfo.degrees.forEach(degree => {
        const pitchClass = (rootPitchClass + (degree.interval % 12)) % 12;
        scalePitchClasses.set(pitchClass, degree.interval % 12);
      });
    }

    const blackKeyWidth = this.keyboardWidth * 0.45;

    // Draw white key backgrounds first
    for (let midi = pitchRangeMin; midi < pitchRangeMax; midi++) {
      const noteIndex = midi % 12;
      const isBlackKey = [1, 3, 6, 8, 10].includes(noteIndex);
      const y = this.midiToY(midi, height, pitchRangeMin, pitchRangeMax);
      const isPressed = midi === pressedKey;

      if (!isBlackKey) {
        // White key - highlight if pressed
        ctx.fillStyle = isPressed ? '#ffcc80' : '#ffffff';
        ctx.fillRect(0, y - this.noteHeight, this.keyboardWidth, this.noteHeight);

        // Border - highlight if pressed
        ctx.strokeStyle = isPressed ? '#ff9800' : '#ddd';
        ctx.lineWidth = isPressed ? 2 : 1;
        ctx.strokeRect(0, y - this.noteHeight, this.keyboardWidth, this.noteHeight);
      }
    }

    // Draw black keys on top
    for (let midi = pitchRangeMin; midi < pitchRangeMax; midi++) {
      const noteIndex = midi % 12;
      const isBlackKey = [1, 3, 6, 8, 10].includes(noteIndex);
      const y = this.midiToY(midi, height, pitchRangeMin, pitchRangeMax);
      const isPressed = midi === pressedKey;

      if (isBlackKey) {
        // Black key - highlight if pressed
        ctx.fillStyle = isPressed ? '#ff9800' : '#333';
        ctx.fillRect(0, y - this.noteHeight, blackKeyWidth, this.noteHeight);
      }
    }

    // Draw note labels for all notes
    const fontSize = Math.min(10, Math.max(7, this.noteHeight * 0.65));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textBaseline = 'middle';

    for (let midi = pitchRangeMin; midi < pitchRangeMax; midi++) {
      const noteIndex = midi % 12;
      const octave = Math.floor(midi / 12) - 1;
      const isBlackKey = [1, 3, 6, 8, 10].includes(noteIndex);
      const y = this.midiToY(midi, height, pitchRangeMin, pitchRangeMax);
      const centerY = y - this.noteHeight / 2;

      // Get note name
      const noteName = this.noteNames[noteIndex];

      // Calculate interval from root for this note
      const intervalFromRoot = (noteIndex - rootPitchClass + 12) % 12;

      // Check if this note is in the scale
      const isInScale = scalePitchClasses.has(noteIndex);
      const solfege = isInScale ? this.solfegeByInterval[intervalFromRoot] : null;

      // Get color for this interval
      const intervalColor = this.intervalColors[intervalFromRoot];

      if (isBlackKey) {
        // Black key: white note name on the left of the black key
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText(noteName, 3, centerY);

        // Solfege right-aligned (same position as white keys)
        if (solfege) {
          ctx.textAlign = 'right';
          ctx.fillStyle = intervalColor;
          ctx.fillText(solfege, this.keyboardWidth - 4, centerY);
        }
      } else {
        // White key: note name on the left, solfege on the right
        ctx.textAlign = 'left';
        ctx.fillStyle = '#666';
        ctx.fillText(`${noteName}${octave}`, 3, centerY);

        // Solfege right-aligned
        if (solfege) {
          ctx.textAlign = 'right';
          ctx.fillStyle = intervalColor;
          ctx.fillText(solfege, this.keyboardWidth - 4, centerY);
        }
      }
    }
  }

  /**
   * Render scale degree highlights on the main area
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Start X position
   * @param {number} width - Width of area to highlight
   * @param {number} height - Canvas height
   * @param {number} pitchRangeMin - Minimum MIDI note
   * @param {number} pitchRangeMax - Maximum MIDI note
   * @param {ScaleManager} scaleManager - Scale manager for degree info
   */
  renderScaleHighlights(ctx, x, width, height, pitchRangeMin, pitchRangeMax, scaleManager) {
    if (!scaleManager) return;

    const degrees = scaleManager.getAllDegrees();
    const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());
    const rootPitchClass = rootMidi % 12;

    // Create set of scale pitch classes
    const scalePitchClasses = new Set();
    degrees.forEach(degree => {
      const pitchClass = (rootPitchClass + (degree.interval % 12)) % 12;
      scalePitchClasses.add(pitchClass);
    });

    // Create hatch pattern for out-of-scale notes
    const hatchPattern = this.createHatchPattern(ctx);

    // Highlight all notes
    for (let midi = pitchRangeMin; midi < pitchRangeMax; midi++) {
      const pitchClass = midi % 12;
      const y = this.midiToY(midi, height, pitchRangeMin, pitchRangeMax);
      const intervalFromRoot = (pitchClass - rootPitchClass + 12) % 12;

      if (scalePitchClasses.has(pitchClass)) {
        // In-scale note: use interval-based color
        const color = this.intervalHighlightColors[intervalFromRoot];
        ctx.fillStyle = color;
        ctx.fillRect(x, y - this.noteHeight, width, this.noteHeight);
      } else {
        // Out-of-scale note: gray with hatching
        ctx.fillStyle = this.outOfScaleColor;
        ctx.fillRect(x, y - this.noteHeight, width, this.noteHeight);

        // Add hatch pattern overlay
        if (hatchPattern) {
          ctx.fillStyle = hatchPattern;
          ctx.fillRect(x, y - this.noteHeight, width, this.noteHeight);
        }
      }
    }
  }

  /**
   * Render scale highlights with timeline awareness
   * Renders different scale colors based on ScaleTimeline segments
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Start X position (main area, after keyboard)
   * @param {number} width - Width of area to highlight
   * @param {number} height - Canvas height
   * @param {number} pitchRangeMin - Minimum MIDI note
   * @param {number} pitchRangeMax - Maximum MIDI note
   * @param {ScaleTimeline} scaleTimeline - Timeline tracking key changes
   * @param {number} viewportStart - Viewport start time in ms
   * @param {number} viewportWidth - Viewport width in ms
   * @param {function} getScaleInfo - Function that takes (rootNote, scaleType) and returns scale info
   */
  renderScaleHighlightsWithTimeline(ctx, x, width, height, pitchRangeMin, pitchRangeMax,
    scaleTimeline, viewportStart, viewportWidth, getScaleInfo) {

    if (!scaleTimeline) return;

    // Get all segments within the viewport
    const segments = scaleTimeline.getSegmentsInRange(viewportStart, viewportStart + viewportWidth);

    if (segments.length === 0) return;

    // Time to X helper
    const timeToX = (time) => {
      const normX = (time - viewportStart) / viewportWidth;
      return x + normX * width;
    };

    // Create hatch pattern for out-of-scale notes
    const hatchPattern = this.createHatchPattern(ctx);

    // Render each segment with its own scale colors
    for (const segment of segments) {
      const segmentStartX = Math.max(x, timeToX(segment.startTime));
      const segmentEndX = Math.min(x + width, timeToX(segment.endTime));
      const segmentWidth = segmentEndX - segmentStartX;

      if (segmentWidth <= 0) continue;

      // Get scale info for this segment's key
      const scaleInfo = getScaleInfo(segment.rootNote, segment.scaleType);
      if (!scaleInfo) continue;

      const rootMidi = FrequencyConverter.noteNameToMidi(segment.rootNote);
      const rootPitchClass = rootMidi % 12;

      // Create set of scale pitch classes
      const scalePitchClasses = new Set();
      scaleInfo.degrees.forEach(degree => {
        const pitchClass = (rootPitchClass + (degree.interval % 12)) % 12;
        scalePitchClasses.add(pitchClass);
      });

      // Highlight all notes for this segment
      for (let midi = pitchRangeMin; midi < pitchRangeMax; midi++) {
        const pitchClass = midi % 12;
        const y = this.midiToY(midi, height, pitchRangeMin, pitchRangeMax);
        const intervalFromRoot = (pitchClass - rootPitchClass + 12) % 12;

        if (scalePitchClasses.has(pitchClass)) {
          // In-scale note: use interval-based color
          const color = this.intervalHighlightColors[intervalFromRoot];
          ctx.fillStyle = color;
          ctx.fillRect(segmentStartX, y - this.noteHeight, segmentWidth, this.noteHeight);
        } else {
          // Out-of-scale note: gray with hatching
          ctx.fillStyle = this.outOfScaleColor;
          ctx.fillRect(segmentStartX, y - this.noteHeight, segmentWidth, this.noteHeight);

          // Add hatch pattern overlay
          if (hatchPattern) {
            ctx.fillStyle = hatchPattern;
            ctx.fillRect(segmentStartX, y - this.noteHeight, segmentWidth, this.noteHeight);
          }
        }
      }
    }
  }

  /**
   * Render horizontal grid lines for pitch rows
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Start X position
   * @param {number} width - Width of grid
   * @param {number} height - Canvas height
   * @param {number} pitchRangeMin - Minimum MIDI note
   * @param {number} pitchRangeMax - Maximum MIDI note
   * @param {ScaleManager} scaleManager - Scale manager for root note info
   */
  renderGrid(ctx, x, width, height, pitchRangeMin, pitchRangeMax, scaleManager) {
    // Get root pitch class for Do highlighting
    let rootPitchClass = 0; // Default to C
    if (scaleManager) {
      const rootMidi = FrequencyConverter.noteNameToMidi(scaleManager.getRootNote());
      rootPitchClass = rootMidi % 12;
    }

    for (let midi = pitchRangeMin; midi <= pitchRangeMax; midi++) {
      const y = this.midiToY(midi, height, pitchRangeMin, pitchRangeMax);
      const noteIndex = midi % 12;

      // Bold line for Do (root note of current scale)
      if (noteIndex === rootPitchClass) {
        ctx.strokeStyle = 'rgba(91, 139, 213, 0.6)'; // Blue color matching root
        ctx.lineWidth = 3;
      }
      // Medium line for C notes (if not the root)
      else if (noteIndex === 0) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1.5;
      }
      // Thin lines for other notes
      else {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.lineWidth = 1;
      }

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + width, y);
      ctx.stroke();
    }
  }

  /**
   * Convert MIDI note to Y position
   * @param {number} midiNote
   * @param {number} height - Canvas height
   * @param {number} pitchRangeMin
   * @param {number} pitchRangeMax
   * @returns {number}
   */
  midiToY(midiNote, height, pitchRangeMin, pitchRangeMax) {
    const range = pitchRangeMax - pitchRangeMin;
    const normalized = (midiNote - pitchRangeMin) / range;
    // Invert so high pitches are at top
    return height - (normalized * height);
  }

  /**
   * Convert frequency to Y position
   * @param {number} frequency
   * @param {number} height - Canvas height
   * @param {number} pitchRangeMin
   * @param {number} pitchRangeMax
   * @returns {number}
   */
  frequencyToY(frequency, height, pitchRangeMin, pitchRangeMax) {
    const midiNote = FrequencyConverter.frequencyToMidi(frequency);
    return this.midiToY(midiNote, height, pitchRangeMin, pitchRangeMax);
  }

  /**
   * Get keyboard width
   * @returns {number}
   */
  getKeyboardWidth() {
    return this.keyboardWidth;
  }

  /**
   * Get note height
   * @returns {number}
   */
  getNoteHeight() {
    return this.noteHeight;
  }
}
