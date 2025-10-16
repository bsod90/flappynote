/**
 * GameState - Main game state and logic
 */

import { Ball } from './Ball.js';
import { Gate } from './Gate.js';
import { ScaleManager } from './ScaleManager.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

export class GameState {
  constructor(rootNote = 'C4', scaleType = 'major', direction = 'up') {
    this.scaleManager = new ScaleManager(rootNote, scaleType);
    this.ball = new Ball();
    this.gates = [];
    this.score = 0;
    this.currentGateIndex = 0;
    this.isPlaying = false;
    this.isGameOver = false;
    this.isSinging = false;
    this.currentPitch = null;
    this.lastSingingTime = 0;
    this.direction = direction; // 'up' or 'down'

    // Timer and accuracy tracking
    this.startTime = null;
    this.elapsedTime = 0;
    this.totalAccuracy = 0;
    this.accuracyCount = 0;

    // Pitch trace for visualizing accuracy
    this.pitchTrace = [];
    this.perfectHits = []; // Store positions where perfect pitch was hit

    // Pitch guidance (show arrows when off-pitch)
    this.offPitchStartTime = null; // When user started being off-pitch
    this.showPitchGuidance = false; // Whether to show up/down arrows

    this.initializeGates();
  }

  /**
   * Initialize gates for all scale degrees
   */
  initializeGates() {
    this.gates = [];
    let degrees = this.scaleManager.getAllDegrees();

    // Handle direction
    if (this.direction === 'down') {
      degrees = [...degrees].reverse();
    } else if (this.direction === 'random') {
      // Shuffle the degrees array
      degrees = this.shuffleArray([...degrees]);
    }

    const gateSpacing = GAME_CONFIG.getGateSpacing(degrees.length);
    const startX = GAME_CONFIG.getGateStartX();

    degrees.forEach((degreeInfo, index) => {
      const x = startX + (index * gateSpacing);

      // Calculate Y position based on pitch (higher pitch = higher position)
      // Use logarithmic scaling for musical pitch (octaves are exponential)
      const allDegrees = this.scaleManager.getAllDegrees();
      const minFreq = this.scaleManager.getFrequency(0);
      const maxFreq = this.scaleManager.getFrequency(allDegrees.length - 1); // Last note in scale

      // Logarithmic normalization (same as calculateYFromPitch)
      const epsilon = 0.001;
      const logMin = Math.log2(minFreq + epsilon);
      const logMax = Math.log2(maxFreq + epsilon);
      const logFreq = Math.log2(degreeInfo.frequency + epsilon);
      const normalizedPitch = (logFreq - logMin) / (logMax - logMin);

      // Map to canvas with margins (adjust for mobile vs desktop)
      const isMobile = GAME_CONFIG.CANVAS_WIDTH < 769;
      // Detect Chrome mobile (different viewport behavior than Safari)
      const isChromeMobile = isMobile && /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);

      // Use percentage-based margins that scale with canvas height
      // This ensures gates maintain relative position when canvas height changes
      const topMarginPct = isMobile ? 0.05 : 0.15;
      const bottomMarginPct = isChromeMobile ? 0.20 : (isMobile ? 0.14 : 0.20);

      const topMargin = GAME_CONFIG.CANVAS_HEIGHT * topMarginPct;
      const bottomMargin = GAME_CONFIG.CANVAS_HEIGHT * bottomMarginPct;
      const availableHeight = GAME_CONFIG.CANVAS_HEIGHT - topMargin - bottomMargin;
      const targetY = GAME_CONFIG.CANVAS_HEIGHT - bottomMargin - (normalizedPitch * availableHeight);

      const gate = new Gate(
        x,
        targetY,
        degreeInfo.degree,
        degreeInfo.label,
        degreeInfo.frequency
      );

      this.gates.push(gate);
    });
  }

  /**
   * Start the game
   */
  start() {
    this.isPlaying = true;
    this.isGameOver = false;
    this.score = 0;
    this.currentGateIndex = 0;
    this.startTime = Date.now();
    this.elapsedTime = 0;
    this.totalAccuracy = 0;
    this.accuracyCount = 0;
    this.pitchTrace = [];
    this.perfectHits = [];
    this.ball.reset();
    this.gates.forEach(gate => {
      gate.passed = false;
      gate.perfectPitch = false;
    });
  }

  /**
   * Pause the game
   */
  pause() {
    this.isPlaying = false;
  }

  /**
   * Reset the game
   */
  reset() {
    this.isPlaying = false;
    this.isGameOver = false;
    this.score = 0;
    this.currentGateIndex = 0;
    this.isSinging = false;
    this.currentPitch = null;
    this.startTime = null;
    this.elapsedTime = 0;
    this.totalAccuracy = 0;
    this.accuracyCount = 0;
    this.pitchTrace = [];
    this.perfectHits = [];
    this.ball.reset();
    this.initializeGates();
  }

  /**
   * Update game state
   * @param {number} deltaTime - Time since last update in ms
   */
  update(deltaTime) {
    if (!this.isPlaying || this.isGameOver) return;

    // Update elapsed time
    if (this.startTime) {
      this.elapsedTime = (Date.now() - this.startTime) / 1000; // Convert to seconds
    }

    // New physics model: ball gravitates toward the pitch height you're singing
    if (this.currentPitch) {
      // Find which scale degree this pitch belongs to (ignoring octave)
      const scaleDegreeMatch = this.scaleManager.findScaleDegreeForFrequency(this.currentPitch.frequency);

      if (scaleDegreeMatch) {
        // Use the GATE's reference frequency for positioning (not the sung frequency)
        // This ensures that singing any octave of the note positions the bird at the gate height
        const pitchY = this.calculateYFromPitch(scaleDegreeMatch.degreeFrequency);
        this.ball.floatToward(pitchY, this.isSinging);
      } else {
        // Pitch not in scale, use original frequency
        const pitchY = this.calculateYFromPitch(this.currentPitch.frequency);
        this.ball.floatToward(pitchY, false); // Don't move forward if not in scale
      }
    } else {
      // When not singing, ball falls with gravity
      this.ball.applyGravity();
    }

    this.ball.update();

    // Record pitch trace for visualization
    const ballPos = this.ball.getPosition();
    this.pitchTrace.push({ x: ballPos.x, y: ballPos.y });

    // Check collisions with gates
    this.checkGateCollisions();

    // Check win condition (only way to end the game)
    if (this.currentGateIndex >= this.gates.length) {
      this.win();
    }
  }

  /**
   * Calculate Y position from pitch frequency
   * Maps frequency to canvas height (higher pitch = higher position)
   * Supports frequencies beyond the base octave range
   */
  calculateYFromPitch(frequency) {
    // Get frequency range from scale
    const degrees = this.scaleManager.getAllDegrees();
    const minFreq = this.scaleManager.getFrequency(0); // First note
    const maxFreq = this.scaleManager.getFrequency(degrees.length - 1); // Last note

    // Use logarithmic scaling (like MIDI) for better octave handling
    // This ensures that singing D3 (one octave below D4) or D5 (one octave above D4)
    // will position the bird at the same height as the D4 gate
    const freqRange = maxFreq - minFreq;

    // Normalize using log2 to handle octaves correctly
    // Add small epsilon to avoid log(0)
    const epsilon = 0.001;
    const logMin = Math.log2(minFreq + epsilon);
    const logMax = Math.log2(maxFreq + epsilon);
    const logFreq = Math.log2(frequency + epsilon);

    // Calculate position in logarithmic space
    const normalizedPitch = (logFreq - logMin) / (logMax - logMin);

    // Allow some extension beyond the scale range (for visual feedback)
    // but clamp to prevent going completely off-screen
    const clampedNormalized = Math.max(-0.2, Math.min(1.2, normalizedPitch));

    // Map to canvas height (inverted - high pitch = low Y value)
    // Use SAME margins as gates (adjust for mobile vs desktop)
    const isMobile = GAME_CONFIG.CANVAS_WIDTH < 769;
    // Detect Chrome mobile (different viewport behavior than Safari)
    const isChromeMobile = isMobile && /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);

    // Use percentage-based margins that scale with canvas height to match gate positioning
    const topMarginPct = isMobile ? 0.05 : 0.15;
    const bottomMarginPct = isChromeMobile ? 0.20 : (isMobile ? 0.14 : 0.20);

    const topMargin = GAME_CONFIG.CANVAS_HEIGHT * topMarginPct;
    const bottomMargin = GAME_CONFIG.CANVAS_HEIGHT * bottomMarginPct;
    const availableHeight = GAME_CONFIG.CANVAS_HEIGHT - topMargin - bottomMargin;
    return GAME_CONFIG.CANVAS_HEIGHT - bottomMargin - (clampedNormalized * availableHeight);
  }

  /**
   * Check if we should apply lift force
   * @returns {boolean}
   */
  shouldApplyLift() {
    const timeSinceSinging = Date.now() - this.lastSingingTime;
    return timeSinceSinging < GAME_CONFIG.MINIMUM_SINGING_DURATION + 50;
  }

  /**
   * Check collisions with gates
   */
  checkGateCollisions() {
    if (this.currentGateIndex >= this.gates.length) return;

    const currentGate = this.gates[this.currentGateIndex];
    const ballPos = this.ball.getPosition();

    // Check if ball can pass through gate
    if (!currentGate.canPassThrough(ballPos.x, ballPos.y, this.ball.radius)) {
      // Instead of game over, bounce the ball back
      this.ball.bounceBack();
      return;
    }

    // Check if ball has passed through gate
    if (currentGate.hasPassedThrough(ballPos.x) && !currentGate.passed) {
      const isPerfect = currentGate.isPerfectlyAligned(ballPos.y);
      currentGate.markAsPassed(isPerfect);

      // Calculate accuracy (0-100%) based on vertical alignment
      const targetY = currentGate.y;
      const distanceFromTarget = Math.abs(ballPos.y - targetY);
      const maxDistance = GAME_CONFIG.HOLE_HEIGHT / 2 + GAME_CONFIG.HOLE_TOLERANCE;
      const accuracy = Math.max(0, Math.min(100, 100 * (1 - distanceFromTarget / maxDistance)));

      // Track total accuracy
      this.totalAccuracy += accuracy;
      this.accuracyCount++;

      this.score += GAME_CONFIG.POINTS_PER_GATE;
      if (isPerfect) {
        this.score += GAME_CONFIG.PERFECT_PITCH_BONUS;
        // Record perfect hit position
        this.perfectHits.push({ x: ballPos.x, y: ballPos.y });
      }

      this.currentGateIndex++;
    }
  }

  /**
   * Handle pitch update from detector
   * @param {object|null} pitchData - Pitch data from detector
   */
  onPitchDetected(pitchData) {
    this.currentPitch = pitchData;

    if (!this.isPlaying || this.isGameOver) return;

    if (pitchData && this.currentGateIndex < this.gates.length) {
      const currentGate = this.gates[this.currentGateIndex];

      // Find which scale degree the sung pitch belongs to (ignoring octave)
      const scaleDegreeMatch = this.scaleManager.findScaleDegreeForFrequency(pitchData.frequency);

      if (scaleDegreeMatch && scaleDegreeMatch.degree === currentGate.scaleDegree) {
        // Singing the correct scale degree (any octave)
        this.isSinging = true;
        this.lastSingingTime = Date.now();

        // Reset off-pitch tracking when on correct pitch
        this.offPitchStartTime = null;
        this.showPitchGuidance = false;
      } else {
        this.isSinging = false;

        // Track how long user has been off-pitch
        if (this.offPitchStartTime === null) {
          this.offPitchStartTime = Date.now();
        } else {
          // Check if user has been off-pitch for more than 1 second
          const offPitchDuration = Date.now() - this.offPitchStartTime;
          if (offPitchDuration > 1000) {
            this.showPitchGuidance = true;
          }
        }
      }
    } else {
      this.isSinging = false;
      // Reset off-pitch tracking when not singing
      this.offPitchStartTime = null;
      this.showPitchGuidance = false;
    }
  }

  /**
   * Set root note and regenerate gates
   * @param {string} rootNote - New root note
   */
  setRootNote(rootNote) {
    this.scaleManager.setRootNote(rootNote);
    this.initializeGates();
  }

  /**
   * Set scale type and regenerate gates
   * @param {string} scaleType - New scale type
   */
  setScaleType(scaleType) {
    this.scaleManager.setScaleType(scaleType);
    this.initializeGates();
  }

  /**
   * Set direction and regenerate gates
   * @param {string} direction - 'up', 'down', or 'random'
   */
  setDirection(direction) {
    this.direction = direction;
    this.initializeGates();
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get current target gate
   * @returns {Gate|null}
   */
  getCurrentTargetGate() {
    return this.gates[this.currentGateIndex] || null;
  }

  /**
   * Game over
   */
  gameOver() {
    this.isPlaying = false;
    this.isGameOver = true;
  }

  /**
   * Win condition
   */
  win() {
    this.isPlaying = false;
    this.isGameOver = true;
  }

  /**
   * Reposition gates when canvas is resized
   */
  repositionGates() {
    const degrees = this.gates.map(gate => ({
      degree: gate.scaleDegree,
      label: gate.degreeLabel,
      frequency: gate.targetFrequency
    }));

    const gateSpacing = GAME_CONFIG.getGateSpacing(degrees.length);
    const startX = GAME_CONFIG.getGateStartX();

    degrees.forEach((degreeInfo, index) => {
      const x = startX + (index * gateSpacing);

      const allDegrees = this.scaleManager.getAllDegrees();
      const minFreq = this.scaleManager.getFrequency(0);
      const maxFreq = this.scaleManager.getFrequency(allDegrees.length - 1);

      // Use logarithmic normalization (same as initializeGates and calculateYFromPitch)
      const epsilon = 0.001;
      const logMin = Math.log2(minFreq + epsilon);
      const logMax = Math.log2(maxFreq + epsilon);
      const logFreq = Math.log2(degreeInfo.frequency + epsilon);
      const normalizedPitch = (logFreq - logMin) / (logMax - logMin);

      const isMobile = GAME_CONFIG.CANVAS_WIDTH < 769;
      // Detect Chrome mobile (different viewport behavior than Safari)
      const isChromeMobile = isMobile && /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);

      // Use percentage-based margins that scale with canvas height
      // This ensures gates maintain relative position when canvas height changes
      const topMarginPct = isMobile ? 0.05 : 0.15;
      const bottomMarginPct = isChromeMobile ? 0.20 : (isMobile ? 0.14 : 0.20);

      const topMargin = GAME_CONFIG.CANVAS_HEIGHT * topMarginPct;
      const bottomMargin = GAME_CONFIG.CANVAS_HEIGHT * bottomMarginPct;
      const availableHeight = GAME_CONFIG.CANVAS_HEIGHT - topMargin - bottomMargin;
      const targetY = GAME_CONFIG.CANVAS_HEIGHT - bottomMargin - (normalizedPitch * availableHeight);

      this.gates[index].x = x;
      this.gates[index].y = targetY;
    });

    // Also reposition the ball
    this.ball.reset();
  }

  /**
   * Get game state for rendering
   * @returns {object}
   */
  getState() {
    const averageAccuracy = this.accuracyCount > 0 ? this.totalAccuracy / this.accuracyCount : 0;
    // Ensure accuracy is never NaN
    const accuracy = isNaN(averageAccuracy) ? 0 : Math.round(averageAccuracy);

    return {
      ball: this.ball,
      gates: this.gates,
      score: this.score,
      elapsedTime: this.elapsedTime,
      accuracy: accuracy,
      isPlaying: this.isPlaying,
      isGameOver: this.isGameOver,
      isSinging: this.isSinging,
      currentPitch: this.currentPitch,
      currentGateIndex: this.currentGateIndex,
      targetGate: this.getCurrentTargetGate(),
      scaleInfo: this.scaleManager.getScaleInfo(),
      pitchTrace: this.pitchTrace,
      perfectHits: this.perfectHits,
      showPitchGuidance: this.showPitchGuidance,
    };
  }
}
