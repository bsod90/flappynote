/**
 * VocalMonitorState - State management for the Vocal Monitor tool
 * Handles pitch history, auto-scroll, and time-based data
 */

import { FrequencyConverter } from '../../pitch-engine/index.js';

export class VocalMonitorState {
  constructor() {
    // Pitch history (array of {time, frequency, confidence, noteName, centsOff})
    this.pitchHistory = [];
    this.maxHistoryDuration = 30000; // Keep 30 seconds of history

    // Time tracking
    this.startTime = null;
    this.currentTime = 0;
    this.isRecording = false;

    // Auto-scroll state
    this.lastSingingTime = 0;
    this.silenceThreshold = 500; // ms of silence before pausing scroll
    this.isAutoScrolling = false;

    // Pitch range (MIDI note numbers)
    // Default to a practical vocal range: E2-E5 (covers bass to soprano)
    this.pitchRangeMin = 40; // E2
    this.pitchRangeMax = 76; // E5

    // Viewport (in milliseconds)
    this.viewportWidth = 10000; // Show 10 seconds of data
    this.viewportStart = 0; // Start of visible window

    // Current pitch info
    this.currentPitch = null;
    this.isSinging = false;

    // Adaptive RMS tracking for volume-based line thickness
    this.rmsMin = 0.01; // Will adapt down
    this.rmsMax = 0.03; // Will adapt up
    this.rmsAdaptSpeed = 0.05; // How fast to adapt (0-1)

    // Octave-jump filter state
    this.recentPitches = []; // Last N pitches for filtering
    this.recentPitchesMaxSize = 8; // Increased for less aggressive filtering
    this.octaveJumpThresholdCents = 1100; // ~11 semitones, just under an octave
    this.lastStablePitch = null;
    this.stablePitchCount = 0;
    this.stablePitchThreshold = 3; // Need 3 similar pitches to establish baseline

    // Current scale context (for timeline-aware rendering)
    this.currentScaleContext = null; // { rootNote, scaleType }
  }

  /**
   * Start recording
   */
  start() {
    // If we have existing history, continue from where we left off
    // This prevents diagonal lines when restarting without clearing
    if (this.pitchHistory.length > 0) {
      const lastPoint = this.pitchHistory[this.pitchHistory.length - 1];
      // Add a small gap (100ms) to visually separate sessions
      const timeOffset = lastPoint.time + 100;
      this.startTime = Date.now() - timeOffset;
      this.currentTime = timeOffset;
    } else {
      this.startTime = Date.now();
      this.currentTime = 0;
    }
    this.isRecording = true;
    this.isAutoScrolling = true;
    this.resetOctaveFilter(); // Reset filter on new session
  }

  /**
   * Stop recording
   */
  stop() {
    this.isRecording = false;
    this.isAutoScrolling = false;
  }

  /**
   * Clear all data
   */
  clear() {
    this.pitchHistory = [];
    this.startTime = Date.now();
    this.currentTime = 0;
    this.viewportStart = 0;
    this.currentPitch = null;
    this.isSinging = false;
    this.resetOctaveFilter();
  }

  /**
   * Handle pitch detected
   * @param {object|null} pitchData
   */
  onPitchDetected(pitchData) {
    if (!this.isRecording) return;

    const now = Date.now();
    const elapsedTime = now - this.startTime;

    this.currentTime = elapsedTime;

    if (pitchData && pitchData.frequency) {
      // Apply octave-jump correction
      const correctedPitchData = this.correctOctaveJump(pitchData);

      // Extract vocal analysis data if available
      const vocalAnalysis = correctedPitchData.vocalAnalysis || null;

      // Update adaptive RMS range
      const rms = correctedPitchData.rms || 0;
      if (rms > 0) {
        this.updateRMSRange(rms);
      }

      // Calculate normalized RMS (0-1) based on adaptive range
      const normalizedRMS = this.getNormalizedRMS(rms);

      this.currentPitch = {
        ...correctedPitchData,
        normalizedRMS: normalizedRMS,
      };
      this.isSinging = true;
      this.lastSingingTime = now;

      // Add to history
      this.pitchHistory.push({
        time: elapsedTime,
        frequency: correctedPitchData.frequency,
        confidence: correctedPitchData.confidence || 0,
        rms: rms,
        normalizedRMS: normalizedRMS, // Adaptive normalized volume (0-1)
        noteName: correctedPitchData.noteName,
        centsOff: correctedPitchData.centsOff,
        midiNote: correctedPitchData.midiNote,
        // Vocal analysis parameters
        stability: vocalAnalysis?.stability ?? 1.0,
        brightness: vocalAnalysis?.spectralCentroid ?? 0.5,
        breathiness: 1 - (vocalAnalysis?.hnr ?? 0.5), // Invert HNR so higher = more breathy
        // Scale context for timeline-aware rendering
        scaleContext: this.currentScaleContext ? { ...this.currentScaleContext } : null,
      });

    } else {
      this.currentPitch = pitchData;
      this.isSinging = false;

      // Reset octave filter on extended silence (but keep scrolling)
      if (now - this.lastSingingTime > this.silenceThreshold) {
        this.resetOctaveFilter();
      }
    }

    // Update viewport for auto-scroll
    if (this.isAutoScrolling) {
      this.viewportStart = Math.max(0, elapsedTime - this.viewportWidth + 1000);
    }
  }

  /**
   * Correct octave jumps and harmonic detection errors in pitch detection
   * @param {object} pitchData - Original pitch data
   * @returns {object} - Corrected pitch data
   */
  correctOctaveJump(pitchData) {
    const frequency = pitchData.frequency;
    const midiNote = FrequencyConverter.frequencyToMidi(frequency);

    // Update recent pitches for baseline calculation
    this.recentPitches.push(midiNote);
    if (this.recentPitches.length > this.recentPitchesMaxSize) {
      this.recentPitches.shift();
    }

    // Need enough history to make decisions (require more samples for less aggressive filtering)
    if (this.recentPitches.length < 4) {
      return pitchData;
    }

    // Calculate median of recent pitches (more robust than mean)
    const sortedRecent = [...this.recentPitches].sort((a, b) => a - b);
    const medianPitch = sortedRecent[Math.floor(sortedRecent.length / 2)];

    // Check if current pitch is a harmonic error
    const diffFromMedian = midiNote - medianPitch;
    const absDiff = Math.abs(diffFromMedian);

    // Harmonic jumps to correct (NOT octaves - those could be intentional):
    // - 19 semitones = octave + fifth (3rd harmonic) - common pitch detection error
    // - 28 semitones = 2 octaves + major 3rd (5th harmonic)
    //
    // We intentionally DON'T correct:
    // - 12 semitones (1 octave) - singers often practice octave jumps
    // - 24 semitones (2 octaves) - also intentional

    let correction = 0;

    // Check for 2 octaves + third (27-29 semitones) - 5th harmonic error
    if (absDiff >= 27 && absDiff <= 29) {
      correction = diffFromMedian > 0 ? -28 : 28;
    }
    // Check for octave + fifth (18-20 semitones) - 3rd harmonic (Sol detection error)
    else if (absDiff >= 18 && absDiff <= 20) {
      correction = diffFromMedian > 0 ? -19 : 19;
    }

    if (correction !== 0) {
      const correctedMidi = midiNote + correction;
      const correctedFrequency = FrequencyConverter.midiToFrequency(correctedMidi);
      const noteInfo = FrequencyConverter.frequencyToNote(correctedFrequency);

      // Update the recent pitch to the corrected value
      this.recentPitches[this.recentPitches.length - 1] = correctedMidi;

      return {
        ...pitchData,
        frequency: correctedFrequency,
        noteName: noteInfo.noteName,
        midiNote: noteInfo.midiNote,
        centsOff: noteInfo.centsOff,
        harmonicCorrected: Math.abs(correction),
      };
    }

    return pitchData;
  }

  /**
   * Update adaptive RMS range based on observed values
   * @param {number} rms - Current RMS value
   */
  updateRMSRange(rms) {
    // Expand range quickly, contract slowly
    if (rms < this.rmsMin) {
      // New minimum - adapt quickly
      this.rmsMin = this.rmsMin * 0.7 + rms * 0.3;
    } else if (rms > this.rmsMax) {
      // New maximum - adapt quickly
      this.rmsMax = this.rmsMax * 0.7 + rms * 0.3;
    } else {
      // Within range - slowly contract toward observed values
      // This helps adapt if user gets quieter/louder over time
      const rangeMid = (this.rmsMin + this.rmsMax) / 2;
      if (rms < rangeMid) {
        // Slowly raise minimum
        this.rmsMin = this.rmsMin * 0.995 + rms * 0.005;
      } else {
        // Slowly lower maximum
        this.rmsMax = this.rmsMax * 0.995 + rms * 0.005;
      }
    }

    // Ensure minimum range span to avoid division issues
    const minSpan = 0.01;
    if (this.rmsMax - this.rmsMin < minSpan) {
      this.rmsMax = this.rmsMin + minSpan;
    }
  }

  /**
   * Get normalized RMS (0-1) based on adaptive range
   * @param {number} rms - Current RMS value
   * @returns {number} Normalized value 0-1
   */
  getNormalizedRMS(rms) {
    if (rms <= this.rmsMin) return 0;
    if (rms >= this.rmsMax) return 1;

    // Linear interpolation within observed range
    return (rms - this.rmsMin) / (this.rmsMax - this.rmsMin);
  }

  /**
   * Reset octave filter state (call on silence)
   */
  resetOctaveFilter() {
    this.recentPitches = [];
    this.lastStablePitch = null;
    this.stablePitchCount = 0;
  }

  /**
   * Trim old history entries
   * @param {number} currentTime
   */
  trimHistory(currentTime) {
    const cutoffTime = currentTime - this.maxHistoryDuration;
    while (this.pitchHistory.length > 0 && this.pitchHistory[0].time < cutoffTime) {
      this.pitchHistory.shift();
    }
  }

  /**
   * Get pitch history within viewport
   * @returns {Array}
   */
  getVisibleHistory() {
    const viewportEnd = this.viewportStart + this.viewportWidth;
    return this.pitchHistory.filter(
      p => p.time >= this.viewportStart && p.time <= viewportEnd
    );
  }

  /**
   * Set pitch range
   * @param {number} min - MIDI note number
   * @param {number} max - MIDI note number
   */
  setPitchRange(min, max) {
    this.pitchRangeMin = min;
    this.pitchRangeMax = max;
  }

  /**
   * Set current scale context (for timeline-aware rendering)
   * @param {string} rootNote - Root note with octave (e.g., "C3")
   * @param {string} scaleType - Scale type (e.g., "major")
   */
  setScaleContext(rootNote, scaleType) {
    this.currentScaleContext = { rootNote, scaleType };
  }

  /**
   * Get pitch range as frequencies
   * @returns {{min: number, max: number}}
   */
  getPitchRangeFrequencies() {
    return {
      min: FrequencyConverter.midiToFrequency(this.pitchRangeMin),
      max: FrequencyConverter.midiToFrequency(this.pitchRangeMax),
    };
  }

  /**
   * Convert frequency to normalized Y position (0-1)
   * @param {number} frequency
   * @returns {number}
   */
  frequencyToNormalizedY(frequency) {
    const midiNote = FrequencyConverter.frequencyToMidi(frequency);
    const range = this.pitchRangeMax - this.pitchRangeMin;
    return (midiNote - this.pitchRangeMin) / range;
  }

  /**
   * Convert time to normalized X position (0-1) within viewport
   * @param {number} time
   * @returns {number}
   */
  timeToNormalizedX(time) {
    return (time - this.viewportStart) / this.viewportWidth;
  }

  /**
   * Scroll viewport by offset
   * @param {number} offsetMs - Milliseconds to scroll (negative = left, positive = right)
   */
  scrollViewport(offsetMs) {
    const newStart = this.viewportStart + offsetMs;
    const maxStart = Math.max(0, this.currentTime - this.viewportWidth + 1000);
    this.viewportStart = Math.max(0, Math.min(maxStart, newStart));
    this.isAutoScrolling = false; // Manual scroll disables auto-scroll
  }

  /**
   * Jump to the current time and resume auto-scrolling
   */
  jumpToFront() {
    this.viewportStart = Math.max(0, this.currentTime - this.viewportWidth + 1000);
    this.isAutoScrolling = true;
  }

  /**
   * Get state for rendering
   * @returns {object}
   */
  getState() {
    return {
      pitchHistory: this.getVisibleHistory(),
      currentPitch: this.currentPitch,
      isSinging: this.isSinging,
      isRecording: this.isRecording,
      isAutoScrolling: this.isAutoScrolling,
      currentTime: this.currentTime,
      viewportStart: this.viewportStart,
      viewportWidth: this.viewportWidth,
      pitchRangeMin: this.pitchRangeMin,
      pitchRangeMax: this.pitchRangeMax,
      // Adaptive volume tracking
      rmsMin: this.rmsMin,
      rmsMax: this.rmsMax,
    };
  }
}
