/**
 * Main application entry point
 */

import { PitchDetector } from './pitch-engine/index.js';
import { GameState } from './game/GameState.js';
import { Renderer2D } from './rendering/Renderer2D.js';
import { DebugOverlay } from './ui/DebugOverlay.js';
import { TonePlayer } from './audio/TonePlayer.js';

class TralalaGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer2D(this.canvas);
    this.gameState = null;
    this.pitchDetector = null;
    this.debugOverlay = new DebugOverlay();
    this.tonePlayer = new TonePlayer();

    // UI elements
    this.startButton = document.getElementById('start-button');
    this.resetButton = document.getElementById('reset-button');
    this.rootNoteSelect = document.getElementById('root-note');
    this.scaleTypeSelect = document.getElementById('scale-type');
    this.directionSelect = document.getElementById('direction');
    this.pitchDisplay = document.getElementById('pitch-display');
    this.scoreDisplay = document.getElementById('score-display');
    this.statusDisplay = document.getElementById('status-display');
    this.debugToggle = document.getElementById('debug-toggle');

    this.lastFrameTime = 0;
    this.animationId = null;

    // Check for debug mode (enabled by default in development)
    this.debugEnabled = import.meta.env.DEV || localStorage.getItem('tralala-debug') === 'true';

    this.initialize();
  }

  /**
   * Initialize the game
   */
  initialize() {
    // Initialize renderer
    this.renderer.initialize();

    // Initialize game state
    // Convert simple note name (C, D, etc.) to note with octave (C3, D3, etc.)
    const rootNoteName = this.rootNoteSelect.value;
    const rootNote = rootNoteName.length === 1 ? `${rootNoteName}3` : rootNoteName;
    const scaleType = this.scaleTypeSelect.value;
    const direction = this.directionSelect.value;
    this.gameState = new GameState(rootNote, scaleType, direction);

    // Initialize pitch detector
    this.pitchDetector = new PitchDetector({
      updateInterval: 50,
      threshold: 0.005, // RMS threshold for sensitivity (lower = more sensitive)
      onPitchDetected: (pitchData) => this.handlePitchDetected(pitchData),
    });

    // Set up event listeners
    this.setupEventListeners();

    // Start render loop
    this.startRenderLoop();

    // Initial render
    this.render();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.startButton.addEventListener('click', () => this.handleStart());
    this.resetButton.addEventListener('click', () => this.handleReset());

    this.rootNoteSelect.addEventListener('change', (e) => {
      // Convert simple note name to note with octave
      const rootNoteName = e.target.value;
      const rootNote = rootNoteName.length === 1 ? `${rootNoteName}3` : rootNoteName;
      this.gameState.setRootNote(rootNote);
      this.updateStatus('Root note changed. Click Start to begin.');
    });

    this.scaleTypeSelect.addEventListener('change', (e) => {
      this.gameState.setScaleType(e.target.value);
      this.updateStatus('Mode changed. Click Start to begin.');
    });

    this.directionSelect.addEventListener('change', (e) => {
      this.gameState.setDirection(e.target.value);
      this.updateStatus('Direction changed. Click Start to begin.');
    });

    // Debug toggle
    this.debugToggle.addEventListener('click', () => {
      this.debugOverlay.toggle();
      localStorage.setItem('tralala-debug', this.debugOverlay.enabled ? 'true' : 'false');
    });

    // Show debug toggle only in dev mode or if previously enabled
    if (this.debugEnabled) {
      this.debugToggle.style.display = 'flex';
    } else {
      this.debugToggle.style.display = 'none';
    }

    // Keyboard shortcut for debug (Ctrl+D or Cmd+D)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        this.debugOverlay.toggle();
      }
    });
  }

  /**
   * Handle start button click
   */
  async handleStart() {
    try {
      this.startButton.disabled = true;
      this.updateStatus('Requesting microphone access...');

      // Start pitch detection
      await this.pitchDetector.start();

      // Play reference tones (1-5-1)
      this.updateStatus('Playing reference: 1-5-1...');
      await this.playReferenceTones();

      // Start game
      this.gameState.start();

      this.startButton.style.display = 'none';
      this.resetButton.disabled = false;
      this.rootNoteSelect.disabled = true;
      this.scaleTypeSelect.disabled = true;

      this.updateStatus('Game started! Sing to control the ball.');
    } catch (error) {
      console.error('Failed to start game:', error);
      this.updateStatus(`Error: ${error.message}`);
      this.startButton.disabled = false;
    }
  }

  /**
   * Play reference tones (1-5-8 pattern)
   */
  async playReferenceTones() {
    const scaleInfo = this.gameState.scaleManager.getScaleInfo();
    const degrees = scaleInfo.degrees;

    // Play Do - Sol - Do (octave higher) (1-5-8)
    const sequence = [
      { frequency: degrees[0].frequency, duration: 0.5 }, // Do
      { frequency: degrees[4].frequency, duration: 0.5 }, // Sol
      { frequency: degrees[0].frequency * 2, duration: 0.7 }, // Do (octave higher)
    ];

    await this.tonePlayer.playSequence(sequence);
  }

  /**
   * Handle reset button click
   */
  handleReset() {
    // Stop pitch detection
    if (this.pitchDetector) {
      this.pitchDetector.stop();
    }

    // Reset game state
    this.gameState.reset();

    // Reset UI
    this.startButton.style.display = 'inline-block';
    this.startButton.disabled = false;
    this.resetButton.disabled = true;
    this.rootNoteSelect.disabled = false;
    this.scaleTypeSelect.disabled = false;

    this.updatePitchDisplay(null);
    this.updateScoreDisplay(0);
    this.updateStatus('Click Start to begin');
  }

  /**
   * Handle pitch detected
   * @param {object|null} pitchData
   */
  handlePitchDetected(pitchData) {
    this.gameState.onPitchDetected(pitchData);
    this.updatePitchDisplay(pitchData);
  }

  /**
   * Start the render loop
   */
  startRenderLoop() {
    const loop = (timestamp) => {
      const deltaTime = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      this.update(deltaTime);
      this.render();

      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }

  /**
   * Update game state
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this.gameState.update(deltaTime);

    // Update UI
    const state = this.gameState.getState();
    this.updateScoreDisplay(state.score);

    if (state.isPlaying) {
      if (state.targetGate) {
        const targetNote = state.targetGate.degreeLabel;
        this.updateStatus(`Sing: ${targetNote}`);
      }
    }

    if (state.isGameOver) {
      const won = state.currentGateIndex >= state.gates.length;
      this.updateStatus(won ? 'You win! Great job!' : 'Game over. Try again!');
    }

    // Update debug overlay
    if (this.debugOverlay.enabled && this.pitchDetector) {
      const debugInfo = this.pitchDetector.getDebugInfo();
      this.debugOverlay.update(
        state.currentPitch,
        debugInfo,
        state.targetGate,
        state.isSinging
      );
    }
  }

  /**
   * Render the game
   */
  render() {
    const state = this.gameState.getState();
    this.renderer.render(state);
  }

  /**
   * Update pitch display
   * @param {object|null} pitchData
   */
  updatePitchDisplay(pitchData) {
    if (pitchData) {
      const centsStr = pitchData.centsOff >= 0 ? `+${pitchData.centsOff.toFixed(0)}` : pitchData.centsOff.toFixed(0);
      this.pitchDisplay.textContent = `Pitch: ${pitchData.noteName} (${centsStr}¢)`;
      this.pitchDisplay.classList.add('singing');
    } else {
      this.pitchDisplay.textContent = 'Pitch: --';
      this.pitchDisplay.classList.remove('singing');
    }
  }

  /**
   * Update score display
   * @param {number} score
   */
  updateScoreDisplay(score) {
    this.scoreDisplay.textContent = `Score: ${score}`;
  }

  /**
   * Update status display
   * @param {string} message
   */
  updateStatus(message) {
    this.statusDisplay.textContent = message;
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.pitchDetector) {
      this.pitchDetector.stop();
    }

    this.renderer.dispose();
  }
}

// Initialize game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.game = new TralalaGame();
  });
} else {
  window.game = new TralalaGame();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (window.game) {
    window.game.dispose();
  }
});
