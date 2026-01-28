/**
 * FlappyNoteTool - Wraps the Flappy Note game as a Tool
 * Extends ToolBase to integrate with the tool selection system
 */

import { ToolBase } from '../../core/ToolBase.js';
import { FlappyGameState } from './FlappyGameState.js';
import { FlappyRenderer } from './FlappyRenderer.js';
import { DebugOverlay } from '../../ui/DebugOverlay.js';

export class FlappyNoteTool extends ToolBase {
  constructor() {
    super('Flappy Note', 'Sing to guide the bird through pipes. Match each target note to progress through the scale.');

    this.canvas = null;
    this.renderer = null;
    this.gameState = null;
    this.debugOverlay = null;

    // UI elements
    this.container = null;
    this.startButton = null;
    this.resetButton = null;
    this.rootNoteSelect = null;
    this.scaleTypeSelect = null;
    this.directionSelect = null;
    this.droneToggle = null;
    this.pitchDisplay = null;
    this.scoreDisplay = null;
    this.statusDisplay = null;
    this.settingsToggle = null;
    this.settingsPanel = null;
    this.debugToggle = null;
    this.backButton = null;

    // Animation
    this.lastFrameTime = 0;
    this.animationId = null;

    // Tracking
    this.lastGateIndex = -1;
    this.gameCompletionTracked = false;

    // Debug mode
    this.debugEnabled = false;
  }

  /**
   * Get the tool's container element
   */
  getContainer() {
    return this.container;
  }

  /**
   * Initialize the tool
   */
  async initialize() {
    // Get DOM elements
    this.container = document.getElementById('flappy-note-container');
    this.canvas = document.getElementById('game-canvas');
    this.startButton = document.getElementById('start-button');
    this.resetButton = document.getElementById('reset-button');
    this.rootNoteSelect = document.getElementById('root-note');
    this.scaleTypeSelect = document.getElementById('scale-type');
    this.directionSelect = document.getElementById('direction');
    this.droneToggle = document.getElementById('drone-toggle');
    this.pitchDisplay = document.getElementById('pitch-display');
    this.scoreDisplay = document.getElementById('score-display');
    this.statusDisplay = document.getElementById('status-display');
    this.settingsToggle = document.getElementById('settings-toggle');
    this.settingsPanel = document.getElementById('settings-panel');
    this.debugToggle = document.getElementById('debug-toggle');
    this.backButton = document.getElementById('flappy-back-button');

    // Check debug mode
    this.debugEnabled = localStorage.getItem('tralala-debug') === 'true';

    // IMPORTANT: Show container before initializing renderer
    // Otherwise canvas has zero dimensions and renderer initialization hangs
    if (this.container) {
      this.container.style.display = 'flex';
    }

    // Initialize renderer
    this.renderer = new FlappyRenderer(this.canvas);
    await this.renderer.initialize();

    // Set up resize callback
    this.renderer.onResize = () => {
      if (this.gameState) {
        this.gameState.repositionGates();
      }
    };

    // Initialize debug overlay
    this.debugOverlay = new DebugOverlay();

    // Load settings into UI
    this.loadSettingsToUI();

    // Initialize game state
    this.initializeGameState();

    // Set up event listeners
    this.setupEventListeners();

    await super.initialize();
  }

  /**
   * Initialize game state from current settings
   */
  initializeGameState() {
    const rootNote = this.settings.getRootNoteWithOctave();
    const scaleType = this.settings.get('scaleType');
    const direction = this.settings.get('direction');

    this.gameState = new FlappyGameState(rootNote, scaleType, direction, this.scaleManager);
  }

  /**
   * Load settings values into UI controls
   */
  loadSettingsToUI() {
    if (this.settings) {
      this.rootNoteSelect.value = this.settings.get('rootNote');
      this.scaleTypeSelect.value = this.settings.get('scaleType');
      this.directionSelect.value = this.settings.get('direction');
      this.droneToggle.checked = this.settings.get('droneEnabled');
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Start button
    this.startButton.addEventListener('click', () => this.handleStart());

    // Reset button
    this.resetButton.addEventListener('click', () => this.handleReset());

    // Back button
    if (this.backButton) {
      this.backButton.addEventListener('click', () => this.navigateBack());
    }

    // Root note change
    this.rootNoteSelect.addEventListener('change', (e) => {
      this.settings.set('rootNote', e.target.value);
      const rootNote = this.settings.getRootNoteWithOctave();
      this.gameState.setRootNote(rootNote);
      this.scaleManager.setRootNote(rootNote);
      this.gameState.repositionGates();
      this.updateStatus('Root note changed. Click Start to begin.');

      // Update drone if playing
      if (this.droneToggle.checked && this.droneManager.getIsDronePlaying()) {
        const frequency = this.scaleManager.getFrequency(0);
        this.droneManager.updateDroneFrequency(frequency);
        if (this.gameState.isPlaying) {
          this.pitchContext.enableDroneCancellation(frequency);
        }
      }

      this.trackEvent('setting_changed', {
        tool: 'flappy_note',
        setting: 'root_note',
        value: e.target.value,
      });
    });

    // Scale type change
    this.scaleTypeSelect.addEventListener('change', (e) => {
      this.settings.set('scaleType', e.target.value);
      this.gameState.setScaleType(e.target.value);
      this.scaleManager.setScaleType(e.target.value);
      this.gameState.repositionGates();
      this.updateStatus('Mode changed. Click Start to begin.');

      this.trackEvent('setting_changed', {
        tool: 'flappy_note',
        setting: 'scale_type',
        value: e.target.value,
      });
    });

    // Direction change
    this.directionSelect.addEventListener('change', (e) => {
      this.settings.set('direction', e.target.value);
      this.gameState.setDirection(e.target.value);
      this.gameState.repositionGates();
      this.updateStatus('Direction changed. Click Start to begin.');

      this.trackEvent('setting_changed', {
        tool: 'flappy_note',
        setting: 'direction',
        value: e.target.value,
      });
    });

    // Drone toggle
    this.droneToggle.addEventListener('change', (e) => {
      this.settings.set('droneEnabled', e.target.checked);
      if (e.target.checked) {
        const frequency = this.scaleManager.getFrequency(0);
        this.droneManager.startDrone(frequency);
        if (this.gameState.isPlaying) {
          this.pitchContext.enableDroneCancellation(frequency);
        }
      } else {
        this.droneManager.stopDrone();
        this.pitchContext.disableDroneCancellation();
      }

      this.trackEvent('setting_changed', {
        tool: 'flappy_note',
        setting: 'drone_enabled',
        value: e.target.checked,
      });
    });

    // Settings toggle (mobile)
    this.settingsToggle.addEventListener('click', () => {
      this.settingsPanel.classList.toggle('expanded');
      this.settingsToggle.textContent = this.settingsPanel.classList.contains('expanded')
        ? 'Hide Settings ▲'
        : 'Settings ⚙️';

      // Reinitialize gates after settings panel toggle
      setTimeout(() => {
        if (this.gameState) {
          this.gameState.initializeGates();
        }
      }, 100);
    });

    // Debug toggle - only show in development mode, never in production
    // Use keyboard shortcut Ctrl/Cmd + Shift + D to reveal in production
    if (this.debugToggle) {
      this.debugToggle.addEventListener('click', () => {
        this.debugOverlay.toggle();
      });

      // Only show in development
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      this.debugToggle.style.display = isDev ? 'flex' : 'none';
    }

    // Keyboard shortcut for debug (Ctrl/Cmd + Shift + D) - works in prod too
    this._keydownHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        if (this.debugToggle) {
          this.debugToggle.style.display = 'flex';
        }
        this.debugOverlay.toggle();
        localStorage.setItem('tralala-debug', this.debugOverlay.enabled ? 'true' : 'false');
      }
    };
    document.addEventListener('keydown', this._keydownHandler);
  }

  /**
   * Start the tool
   */
  async start() {
    await super.start();

    // Show container
    this.show();

    // Show debug toggle only in development
    if (this.debugToggle) {
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      this.debugToggle.style.display = isDev ? 'flex' : 'none';
    }

    // Reset UI state
    this.startButton.style.display = 'inline-block';
    this.startButton.disabled = false;
    this.resetButton.disabled = true;
    this.rootNoteSelect.disabled = false;
    this.scaleTypeSelect.disabled = false;

    this.updatePitchDisplay(null);
    this.updateScoreDisplay(0);
    this.updateStatus('Click Start to begin');

    // Start render loop
    this.startRenderLoop();

    // Initial render
    this.render();
  }

  /**
   * Stop the tool
   */
  stop() {
    super.stop();

    // Stop render loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Stop game
    if (this.gameState && this.gameState.isPlaying) {
      this.handleReset();
    }

    // Hide container
    this.hide();
  }

  /**
   * Handle pitch detected
   */
  onPitchDetected(pitchData) {
    if (this.gameState) {
      this.gameState.onPitchDetected(pitchData);
    }
    this.updatePitchDisplay(pitchData);
  }

  /**
   * Handle settings changed
   */
  onSettingsChanged(key, newValue, oldValue) {
    // Sync UI with external settings changes
    switch (key) {
      case 'rootNote':
        this.rootNoteSelect.value = newValue;
        break;
      case 'scaleType':
        this.scaleTypeSelect.value = newValue;
        break;
      case 'direction':
        this.directionSelect.value = newValue;
        break;
      case 'droneEnabled':
        this.droneToggle.checked = newValue;
        break;
    }
  }

  /**
   * Handle start button click
   */
  async handleStart() {
    try {
      // Check microphone support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.showMicrophoneWarning();
        this.updateStatus('Microphone not supported in this browser');
        return;
      }

      this.startButton.disabled = true;
      this.updateStatus('Requesting microphone access...');

      // Start pitch detection
      await this.pitchContext.start();

      // Play reference tones
      const scaleInfo = this.scaleManager.getScaleInfo();
      const isChord = scaleInfo.degrees.length <= 5;
      this.updateStatus(isChord ? 'Playing reference: 1-3-5...' : 'Playing reference: 1-5-8...');
      await this.playReferenceTones();

      // Start drone if enabled
      if (this.droneToggle.checked) {
        const frequency = this.scaleManager.getFrequency(0);
        this.droneManager.startDrone(frequency);
        this.pitchContext.enableDroneCancellation(frequency);
      }

      // Start game
      this.gameState.start();

      // Track event
      this.trackEvent('game_start', {
        root_note: this.rootNoteSelect.value,
        scale_type: this.scaleTypeSelect.value,
        direction: this.directionSelect.value,
        num_gates: scaleInfo.degrees.length,
        drone_enabled: this.droneToggle.checked,
      });

      // Reset tracking
      this.lastGateIndex = -1;
      this.gameCompletionTracked = false;

      // Update UI
      this.startButton.style.display = 'none';
      this.resetButton.disabled = false;
      this.rootNoteSelect.disabled = true;
      this.scaleTypeSelect.disabled = true;

      this.updateStatus('Game started! Sing to control the ball.');
    } catch (error) {
      console.error('Failed to start game:', error);

      // Track the error
      this.trackEvent('mic_error', {
        tool: 'flappy_note',
        error_type: error.name || 'unknown',
        error_message: error.message,
      });

      // Check if this is a permission denied error
      if (error.message.includes('not allowed') || error.name === 'NotAllowedError') {
        this.showMicrophoneWarning('Microphone permission denied. Please check your browser settings and allow microphone access for this site.');
        this.updateStatus('Microphone permission denied');
      } else {
        this.updateStatus(`Error: ${error.message}`);
      }
      this.startButton.disabled = false;
    }
  }

  /**
   * Handle reset button click
   */
  handleReset() {
    // Stop pitch detection
    this.pitchContext.stop();
    this.pitchContext.disableDroneCancellation();

    // Stop drone (but keep checkbox state)
    this.droneManager.stopDrone();

    // Reset game state
    this.gameState.reset();

    // Reset tracking
    this.gameCompletionTracked = false;
    this.lastGateIndex = -1;

    // Reset UI
    this.startButton.style.display = 'inline-block';
    this.startButton.disabled = false;
    this.resetButton.disabled = true;
    this.resetButton.textContent = 'Reset';
    this.resetButton.style.background = '';
    this.resetButton.style.borderColor = '';
    this.resetButton.style.boxShadow = '';
    this.rootNoteSelect.disabled = false;
    this.scaleTypeSelect.disabled = false;

    this.updatePitchDisplay(null);
    this.updateScoreDisplay(0);
    this.updateStatus('Click Start to begin');
  }

  /**
   * Play reference tones
   */
  async playReferenceTones() {
    const scaleInfo = this.scaleManager.getScaleInfo();
    const degrees = scaleInfo.degrees;

    let sequence;
    if (degrees.length <= 5) {
      // Chord: Play 1-3-5
      sequence = [
        { frequency: degrees[0].frequency, duration: 0.5 },
        { frequency: degrees[1].frequency, duration: 0.5 },
        { frequency: degrees[2].frequency, duration: 0.7 },
      ];
    } else {
      // Scale: Play 1-5-8
      sequence = [
        { frequency: degrees[0].frequency, duration: 0.5 },
        { frequency: degrees[4].frequency, duration: 0.5 },
        { frequency: degrees[0].frequency * 2, duration: 0.7 },
      ];
    }

    await this.droneManager.playSequence(sequence);
  }

  /**
   * Start render loop
   */
  startRenderLoop() {
    const loop = (timestamp) => {
      if (!this.isActive) return;

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
   */
  update(deltaTime) {
    if (!this.gameState) return;

    this.gameState.update(deltaTime);

    const state = this.gameState.getState();
    this.updateScoreDisplay(state.score);

    if (state.isPlaying) {
      if (state.targetGate) {
        this.updateStatus(`Sing: ${state.targetGate.degreeLabel}`);
      }

      // Track gate completions
      if (state.currentGateIndex > this.lastGateIndex) {
        this.lastGateIndex = state.currentGateIndex;
        this.trackEvent('gate_completed', {
          gate_number: state.currentGateIndex,
          total_gates: state.gates.length,
          progress_percent: Math.round((state.currentGateIndex / state.gates.length) * 100),
        });
      }
    }

    if (state.isGameOver) {
      const won = state.currentGateIndex >= state.gates.length;
      this.updateStatus(won ? 'You win! Great job!' : 'Game over. Try again!');

      if (!this.gameCompletionTracked) {
        this.gameCompletionTracked = true;
        this.trackEvent(won ? 'game_completed' : 'game_failed', {
          score: state.score,
          gates_completed: state.currentGateIndex,
          total_gates: state.gates.length,
        });
      }

      if (won) {
        this.resetButton.textContent = 'Play Again';
        this.resetButton.style.background = 'linear-gradient(180deg, #5ac54f 0%, #4a9d3f 100%)';
        this.resetButton.style.borderColor = '#7ee67e';
        this.resetButton.style.boxShadow = '0 6px 0 #3e7e32, 0 8px 15px rgba(0, 0, 0, 0.3)';
      }
    }

    // Update debug overlay
    if (this.debugOverlay.enabled && this.pitchContext) {
      const debugInfo = this.pitchContext.getDebugInfo();
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
    if (!this.gameState || !this.renderer) return;
    const state = this.gameState.getState();
    this.renderer.render(state);
  }

  /**
   * Update pitch display
   */
  updatePitchDisplay(pitchData) {
    if (!this.pitchDisplay) return;

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
   */
  updateScoreDisplay(score) {
    if (this.scoreDisplay) {
      this.scoreDisplay.textContent = `Score: ${score}`;
    }
  }

  /**
   * Update status display
   */
  updateStatus(message) {
    if (this.statusDisplay) {
      this.statusDisplay.textContent = message;
    }
  }

  /**
   * Show microphone warning
   * @param {string} customMessage - Optional custom message to display
   */
  showMicrophoneWarning(customMessage) {
    if (document.getElementById('mic-warning')) return;

    const defaultMessage = 'Microphone access is required. Please use Safari, Chrome, or Firefox for full functionality.';
    const message = customMessage || defaultMessage;

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
    warning.innerHTML = `⚠️ ${message}`;

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
   * Track analytics event
   */
  trackEvent(eventName, params = {}) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  }

  /**
   * Dispose of the tool
   */
  dispose() {
    super.dispose();

    // Remove keyboard handler
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
    }

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
