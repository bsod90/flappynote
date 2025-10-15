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
    this.settingsToggle = document.getElementById('settings-toggle');
    this.settingsPanel = document.getElementById('settings-panel');
    this.droneToggle = document.getElementById('drone-toggle');

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
    // Check if we're in an embedded browser and show warning
    this.checkEmbeddedBrowser();

    // Load settings from localStorage
    this.loadSettings();

    // Initialize renderer
    this.renderer.initialize();

    // Initialize game state
    // Convert simple note name (C, D, etc.) to note with octave (C3, D3, etc.)
    const rootNoteName = this.rootNoteSelect.value;
    const rootNote = rootNoteName.length === 1 ? `${rootNoteName}3` : rootNoteName;
    const scaleType = this.scaleTypeSelect.value;
    const direction = this.directionSelect.value;
    this.gameState = new GameState(rootNote, scaleType, direction);

    // Force a resize after game state is initialized to ensure gates are positioned correctly
    // This handles the race condition where canvas dimensions aren't stable on first load
    // Do it twice: once immediately and once after a tiny delay for stubborn browsers
    setTimeout(() => {
      this.renderer.handleResize();
      this.gameState.repositionGates();
    }, 0);

    setTimeout(() => {
      this.renderer.handleResize();
      this.gameState.repositionGates();
    }, 100);

    // Initialize pitch detector
    this.pitchDetector = new PitchDetector({
      updateInterval: 30, // Faster updates for better mobile response
      threshold: 0.0001, // Ultra-low threshold for maximum sensitivity (especially for low notes on iPhone)
      bufferSize: 8192, // Extra large buffer for better low-frequency detection on mobile
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

      // Update drone frequency if it's playing
      if (this.droneToggle.checked) {
        const frequency = this.gameState.scaleManager.getFrequency(0);
        this.tonePlayer.updateDroneFrequency(frequency);
      }

      this.saveSettings();
    });

    this.scaleTypeSelect.addEventListener('change', (e) => {
      this.gameState.setScaleType(e.target.value);
      this.updateStatus('Mode changed. Click Start to begin.');
      this.saveSettings();
    });

    this.directionSelect.addEventListener('change', (e) => {
      this.gameState.setDirection(e.target.value);
      this.updateStatus('Direction changed. Click Start to begin.');
      this.saveSettings();
    });

    // Drone toggle
    this.droneToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        // Start drone on current root note
        const rootNoteName = this.rootNoteSelect.value;
        const rootNote = rootNoteName.length === 1 ? `${rootNoteName}3` : rootNoteName;
        const frequency = this.gameState.scaleManager.getFrequency(0);
        this.tonePlayer.startDrone(frequency);
      } else {
        // Stop drone
        this.tonePlayer.stopDrone();
      }
      this.saveSettings();
    });

    // Settings toggle (mobile)
    this.settingsToggle.addEventListener('click', () => {
      this.settingsPanel.classList.toggle('expanded');
      // Update button text
      if (this.settingsPanel.classList.contains('expanded')) {
        this.settingsToggle.textContent = 'Hide Settings ▲';
      } else {
        this.settingsToggle.textContent = 'Settings ⚙️';
      }
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

    // Handle window resize
    window.addEventListener('resize', () => {
      this.renderer.handleResize();
      if (this.gameState) {
        this.gameState.repositionGates();
      }
    });
  }

  /**
   * Handle start button click
   */
  async handleStart() {
    try {
      // Check microphone support before attempting to start
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.showMicrophoneWarning();
        this.updateStatus('Microphone not supported in this browser');
        return;
      }

      this.startButton.disabled = true;
      this.updateStatus('Requesting microphone access...');

      // Start pitch detection
      await this.pitchDetector.start();

      // Play reference tones (dynamically show correct pattern)
      const scaleInfo = this.gameState.scaleManager.getScaleInfo();
      const isChord = scaleInfo.degrees.length <= 5;
      this.updateStatus(isChord ? 'Playing reference: 1-3-5...' : 'Playing reference: 1-5-8...');
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
   * Play reference tones (1-3-5 for chords, 1-5-8 for scales)
   */
  async playReferenceTones() {
    const scaleInfo = this.gameState.scaleManager.getScaleInfo();
    const degrees = scaleInfo.degrees;

    // For chords (5 notes or fewer), play 1-3-5 (Do-Mi-Sol)
    // For scales (more than 5 notes), play 1-5-8 (Do-Sol-Do)
    let sequence;
    if (degrees.length <= 5) {
      // Chord: Play 1st, 2nd, 3rd notes (Do-Mi-Sol)
      sequence = [
        { frequency: degrees[0].frequency, duration: 0.5 }, // 1st note (Do)
        { frequency: degrees[1].frequency, duration: 0.5 }, // 2nd note (Mi)
        { frequency: degrees[2].frequency, duration: 0.7 }, // 3rd note (Sol)
      ];
    } else {
      // Scale: Play 1st, 5th, 8th notes (Do-Sol-Do octave)
      sequence = [
        { frequency: degrees[0].frequency, duration: 0.5 }, // Do
        { frequency: degrees[4].frequency, duration: 0.5 }, // Sol
        { frequency: degrees[0].frequency * 2, duration: 0.7 }, // Do (octave higher)
      ];
    }

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

    // Stop drone if it's playing
    if (this.droneToggle.checked) {
      this.tonePlayer.stopDrone();
      this.droneToggle.checked = false;
      this.saveSettings();
    }

    // Reset game state
    this.gameState.reset();

    // Reset UI
    this.startButton.style.display = 'inline-block';
    this.startButton.disabled = false;
    this.resetButton.disabled = true;
    this.resetButton.textContent = 'Reset'; // Reset button text
    this.resetButton.style.background = ''; // Reset button style
    this.resetButton.style.borderColor = '';
    this.resetButton.style.boxShadow = '';
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
      // Change reset button text and style to "Play Again" when won
      if (won) {
        this.resetButton.textContent = 'Play Again';
        this.resetButton.style.background = 'linear-gradient(180deg, #5ac54f 0%, #4a9d3f 100%)';
        this.resetButton.style.borderColor = '#7ee67e';
        this.resetButton.style.boxShadow = '0 6px 0 #3e7e32, 0 8px 15px rgba(0, 0, 0, 0.3)';
      } else {
        this.resetButton.textContent = 'Reset';
        this.resetButton.style.background = '';
        this.resetButton.style.borderColor = '';
        this.resetButton.style.boxShadow = '';
      }
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
   * @param {number} score - Calculated score
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
   * Check if we're in an embedded browser (LinkedIn, Instagram, Facebook, etc.)
   */
  checkEmbeddedBrowser() {
    const ua = navigator.userAgent || '';

    // Detect common embedded browsers
    const isEmbedded =
      ua.includes('FBAN') ||       // Facebook App
      ua.includes('FBAV') ||       // Facebook App
      ua.includes('Instagram') ||  // Instagram
      ua.includes('LinkedIn') ||   // LinkedIn
      ua.includes('Twitter') ||    // Twitter
      ua.includes('Line/') ||      // Line
      ua.includes('MicroMessenger'); // WeChat

    if (isEmbedded) {
      this.showEmbeddedBrowserWarning();
    }
  }

  /**
   * Show embedded browser warning banner
   */
  showEmbeddedBrowserWarning() {
    // Check if warning already exists or was dismissed
    if (document.getElementById('embedded-warning') ||
        localStorage.getItem('flappynote-embedded-warning-dismissed') === 'true') {
      return;
    }

    // Show warning banner
    const warning = document.createElement('div');
    warning.id = 'embedded-warning';
    warning.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #ff6b35;
      color: white;
      padding: 12px 40px 12px 20px;
      text-align: center;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    `;
    warning.innerHTML = `
      ⚠️ This game needs microphone access. Please open this link in Safari or Chrome.
    `;

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: white;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      line-height: 30px;
      text-align: center;
    `;
    closeBtn.onclick = () => {
      warning.remove();
      localStorage.setItem('flappynote-embedded-warning-dismissed', 'true');
    };

    warning.appendChild(closeBtn);
    document.body.prepend(warning);
  }

  /**
   * Show microphone warning banner (when user clicks start)
   */
  showMicrophoneWarning() {
    // Check if warning already exists
    if (document.getElementById('mic-warning')) return;

    // Show warning banner
    const warning = document.createElement('div');
    warning.id = 'mic-warning';
    warning.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #ff6b35;
      color: white;
      padding: 12px 40px 12px 20px;
      text-align: center;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    `;
    warning.innerHTML = `
      ⚠️ Microphone not supported. Please open in Safari or Chrome.
    `;

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: white;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      line-height: 30px;
      text-align: center;
    `;
    closeBtn.onclick = () => warning.remove();

    warning.appendChild(closeBtn);
    document.body.prepend(warning);
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('flappynote-settings') || '{}');

      if (settings.rootNote) {
        this.rootNoteSelect.value = settings.rootNote;
      }

      if (settings.scaleType) {
        this.scaleTypeSelect.value = settings.scaleType;
      }

      if (settings.direction) {
        this.directionSelect.value = settings.direction;
      }

      if (settings.droneEnabled) {
        this.droneToggle.checked = settings.droneEnabled;
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      const settings = {
        rootNote: this.rootNoteSelect.value,
        scaleType: this.scaleTypeSelect.value,
        direction: this.directionSelect.value,
        droneEnabled: this.droneToggle.checked,
      };

      localStorage.setItem('flappynote-settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
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

    if (this.tonePlayer) {
      this.tonePlayer.stop();
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
