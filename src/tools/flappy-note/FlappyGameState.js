/**
 * FlappyGameState - Game state and logic for Flappy Note
 * Renamed from GameState.js for tool-specific naming
 */

import { Ball } from './Ball.js';
import { Gate } from './Gate.js';
import { GAME_CONFIG } from '../../config/gameConfig.js';

export class FlappyGameState {
  constructor(rootNote = 'C4', scaleType = 'major', direction = 'up', scaleManager = null) {
    // Use provided scaleManager or create a placeholder
    this.scaleManager = scaleManager;
    this.ball = new Ball();
    this.gates = [];
    this.score = 0;
    this.currentGateIndex = 0;
    this.isPlaying = false;
    this.isGameOver = false;
    this.isSinging = false;
    this.currentPitch = null;
    this.lastSingingTime = 0;
    this.direction = direction;

    // Timer and accuracy tracking
    this.startTime = null;
    this.elapsedTime = 0;
    this.totalAccuracy = 0;
    this.accuracyCount = 0;

    // Pitch trace for visualizing accuracy
    this.pitchTrace = [];
    this.perfectHits = [];

    // Pitch guidance
    this.offPitchStartTime = null;
    this.showPitchGuidance = false;

    this.initializeGates();
  }

  /**
   * Initialize gates for all scale degrees
   */
  initializeGates() {
    if (!this.scaleManager) return;

    this.gates = [];
    let degrees = this.scaleManager.getAllDegrees();

    // Handle direction
    if (this.direction === 'down') {
      degrees = [...degrees].reverse();
    } else if (this.direction === 'random') {
      degrees = this.shuffleArray([...degrees]);
    }

    const gateSpacing = GAME_CONFIG.getGateSpacing(degrees.length);
    const startX = GAME_CONFIG.getGateStartX();

    degrees.forEach((degreeInfo, index) => {
      const x = startX + (index * gateSpacing);

      const allDegrees = this.scaleManager.getAllDegrees();
      const minFreq = this.scaleManager.getFrequency(0);
      const maxFreq = this.scaleManager.getFrequency(allDegrees.length - 1);

      // Logarithmic normalization
      const epsilon = 0.001;
      const logMin = Math.log2(minFreq + epsilon);
      const logMax = Math.log2(maxFreq + epsilon);
      const logFreq = Math.log2(degreeInfo.frequency + epsilon);
      const normalizedPitch = (logFreq - logMin) / (logMax - logMin);

      // Map to canvas with margins
      const isMobile = GAME_CONFIG.CANVAS_WIDTH < 769;
      const isChromeMobile = isMobile && /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);

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
   */
  update(deltaTime) {
    if (!this.isPlaying || this.isGameOver) return;

    if (this.startTime) {
      this.elapsedTime = (Date.now() - this.startTime) / 1000;
    }

    if (this.currentPitch && this.scaleManager) {
      const scaleDegreeMatch = this.scaleManager.findScaleDegreeForFrequency(this.currentPitch.frequency);

      if (scaleDegreeMatch) {
        const pitchY = this.calculateYFromPitch(scaleDegreeMatch.degreeFrequency);
        this.ball.floatToward(pitchY, this.isSinging);
      } else {
        const pitchY = this.calculateYFromPitch(this.currentPitch.frequency);
        this.ball.floatToward(pitchY, false);
      }
    } else {
      this.ball.applyGravity();
    }

    this.ball.update();

    const ballPos = this.ball.getPosition();
    this.pitchTrace.push({ x: ballPos.x, y: ballPos.y });

    this.checkGateCollisions();

    if (this.currentGateIndex >= this.gates.length) {
      this.win();
    }
  }

  /**
   * Calculate Y position from pitch frequency
   */
  calculateYFromPitch(frequency) {
    if (!this.scaleManager) return GAME_CONFIG.CANVAS_HEIGHT / 2;

    const degrees = this.scaleManager.getAllDegrees();
    const minFreq = this.scaleManager.getFrequency(0);
    const maxFreq = this.scaleManager.getFrequency(degrees.length - 1);

    const epsilon = 0.001;
    const logMin = Math.log2(minFreq + epsilon);
    const logMax = Math.log2(maxFreq + epsilon);
    const logFreq = Math.log2(frequency + epsilon);

    const normalizedPitch = (logFreq - logMin) / (logMax - logMin);
    const clampedNormalized = Math.max(-0.2, Math.min(1.2, normalizedPitch));

    const isMobile = GAME_CONFIG.CANVAS_WIDTH < 769;
    const isChromeMobile = isMobile && /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);

    const topMarginPct = isMobile ? 0.05 : 0.15;
    const bottomMarginPct = isChromeMobile ? 0.20 : (isMobile ? 0.14 : 0.20);

    const topMargin = GAME_CONFIG.CANVAS_HEIGHT * topMarginPct;
    const bottomMargin = GAME_CONFIG.CANVAS_HEIGHT * bottomMarginPct;
    const availableHeight = GAME_CONFIG.CANVAS_HEIGHT - topMargin - bottomMargin;
    return GAME_CONFIG.CANVAS_HEIGHT - bottomMargin - (clampedNormalized * availableHeight);
  }

  /**
   * Check gate collisions
   */
  checkGateCollisions() {
    if (this.currentGateIndex >= this.gates.length) return;

    const currentGate = this.gates[this.currentGateIndex];
    const ballPos = this.ball.getPosition();

    if (!currentGate.canPassThrough(ballPos.x, ballPos.y, this.ball.radius)) {
      this.ball.bounceBack();
      return;
    }

    if (currentGate.hasPassedThrough(ballPos.x) && !currentGate.passed) {
      const isPerfect = currentGate.isPerfectlyAligned(ballPos.y);
      currentGate.markAsPassed(isPerfect);

      const targetY = currentGate.y;
      const distanceFromTarget = Math.abs(ballPos.y - targetY);
      const maxDistance = GAME_CONFIG.HOLE_HEIGHT / 2 + GAME_CONFIG.HOLE_TOLERANCE;
      const accuracy = Math.max(0, Math.min(100, 100 * (1 - distanceFromTarget / maxDistance)));

      this.totalAccuracy += accuracy;
      this.accuracyCount++;

      this.score += GAME_CONFIG.POINTS_PER_GATE;
      if (isPerfect) {
        this.score += GAME_CONFIG.PERFECT_PITCH_BONUS;
        this.perfectHits.push({ x: ballPos.x, y: ballPos.y });
      }

      this.currentGateIndex++;
    }
  }

  /**
   * Handle pitch detection
   */
  onPitchDetected(pitchData) {
    this.currentPitch = pitchData;

    if (!this.isPlaying || this.isGameOver) return;

    if (pitchData && this.currentGateIndex < this.gates.length && this.scaleManager) {
      const currentGate = this.gates[this.currentGateIndex];
      const scaleDegreeMatch = this.scaleManager.findScaleDegreeForFrequency(pitchData.frequency);

      if (scaleDegreeMatch && scaleDegreeMatch.degree === currentGate.scaleDegree) {
        this.isSinging = true;
        this.lastSingingTime = Date.now();
        this.offPitchStartTime = null;
        this.showPitchGuidance = false;
      } else {
        this.isSinging = false;

        if (this.offPitchStartTime === null) {
          this.offPitchStartTime = Date.now();
        } else {
          const offPitchDuration = Date.now() - this.offPitchStartTime;
          if (offPitchDuration > 1000) {
            this.showPitchGuidance = true;
          }
        }
      }
    } else {
      this.isSinging = false;
      this.offPitchStartTime = null;
      this.showPitchGuidance = false;
    }
  }

  /**
   * Set root note
   */
  setRootNote(rootNote) {
    if (this.scaleManager) {
      this.scaleManager.setRootNote(rootNote);
    }
    this.initializeGates();
  }

  /**
   * Set scale type
   */
  setScaleType(scaleType) {
    if (this.scaleManager) {
      this.scaleManager.setScaleType(scaleType);
    }
    this.initializeGates();
  }

  /**
   * Set direction
   */
  setDirection(direction) {
    this.direction = direction;
    this.initializeGates();
  }

  /**
   * Shuffle array
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
   * Win
   */
  win() {
    this.isPlaying = false;
    this.isGameOver = true;
  }

  /**
   * Reposition gates
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

      if (!this.scaleManager) return;

      const allDegrees = this.scaleManager.getAllDegrees();
      const minFreq = this.scaleManager.getFrequency(0);
      const maxFreq = this.scaleManager.getFrequency(allDegrees.length - 1);

      const epsilon = 0.001;
      const logMin = Math.log2(minFreq + epsilon);
      const logMax = Math.log2(maxFreq + epsilon);
      const logFreq = Math.log2(degreeInfo.frequency + epsilon);
      const normalizedPitch = (logFreq - logMin) / (logMax - logMin);

      const isMobile = GAME_CONFIG.CANVAS_WIDTH < 769;
      const isChromeMobile = isMobile && /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);

      const topMarginPct = isMobile ? 0.05 : 0.15;
      const bottomMarginPct = isChromeMobile ? 0.20 : (isMobile ? 0.14 : 0.20);

      const topMargin = GAME_CONFIG.CANVAS_HEIGHT * topMarginPct;
      const bottomMargin = GAME_CONFIG.CANVAS_HEIGHT * bottomMarginPct;
      const availableHeight = GAME_CONFIG.CANVAS_HEIGHT - topMargin - bottomMargin;
      const targetY = GAME_CONFIG.CANVAS_HEIGHT - bottomMargin - (normalizedPitch * availableHeight);

      this.gates[index].x = x;
      this.gates[index].y = targetY;
    });

    this.ball.reset();
  }

  /**
   * Get state for rendering
   */
  getState() {
    const averageAccuracy = this.accuracyCount > 0 ? this.totalAccuracy / this.accuracyCount : 0;
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
      scaleInfo: this.scaleManager ? this.scaleManager.getScaleInfo() : null,
      pitchTrace: this.pitchTrace,
      perfectHits: this.perfectHits,
      showPitchGuidance: this.showPitchGuidance,
    };
  }
}
