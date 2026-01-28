/**
 * VocalMonitorTool - Real-time pitch visualization tool
 * Extends ToolBase to integrate with the tool selection system
 */

import { ToolBase } from '../../core/ToolBase.js';
import { VocalMonitorState } from './VocalMonitorState.js';
import { VocalMonitorRenderer } from './VocalMonitorRenderer.js';
import { DebugOverlay } from '../../ui/DebugOverlay.js';

export class VocalMonitorTool extends ToolBase {
  constructor() {
    super('Vocal Monitor', 'Real-time pitch visualization on a piano roll. See your voice as a continuous line over time.');

    this.canvas = null;
    this.renderer = null;
    this.monitorState = null;

    // UI elements
    this.container = null;
    this.startButton = null;
    this.clearButton = null;
    this.backButton = null;
    this.rootNoteSelect = null;
    this.scaleTypeSelect = null;
    this.droneToggle = null;
    this.pitchDisplay = null;
    this.noteDisplay = null;
    this.settingsToggle = null;
    this.settingsPanel = null;

    // Animation
    this.animationId = null;
    this.lastFrameTime = 0;

    // State
    this.isRecording = false;
    this.recordingStartTime = null;

    // Debug
    this.debugOverlay = null;
    this.debugToggle = null;
    this.debugEnabled = localStorage.getItem('tralala-debug') === 'true';
  }

  /**
   * Get the tool's container
   */
  getContainer() {
    return this.container;
  }

  /**
   * Initialize the tool
   */
  async initialize() {
    // Get DOM elements
    this.container = document.getElementById('vocal-monitor-container');
    this.canvas = document.getElementById('vocal-monitor-canvas');
    this.startButton = document.getElementById('vocal-start-button');
    this.clearButton = document.getElementById('vocal-clear-button');
    this.backButton = document.getElementById('vocal-back-button');
    this.rootNoteSelect = document.getElementById('vocal-root-note');
    this.scaleTypeSelect = document.getElementById('vocal-scale-type');
    this.droneToggle = document.getElementById('vocal-drone-toggle');
    this.pitchDisplay = document.getElementById('vocal-pitch-display');
    this.noteDisplay = document.getElementById('vocal-note-display');
    this.settingsToggle = document.getElementById('vocal-settings-toggle');
    this.settingsPanel = document.getElementById('vocal-settings-panel');

    // IMPORTANT: Show container before initializing renderer
    // Otherwise canvas has zero dimensions and renderer initialization hangs
    if (this.container) {
      this.container.style.display = 'flex';
    }

    // Initialize renderer
    this.renderer = new VocalMonitorRenderer(this.canvas);
    await this.renderer.initialize();

    // Initialize state
    this.monitorState = new VocalMonitorState();

    // Initialize debug overlay
    this.debugOverlay = new DebugOverlay('vocal-monitor-debug-overlay');
    this.debugToggle = document.getElementById('debug-toggle');

    // Load settings to UI
    this.loadSettingsToUI();

    // Set up event listeners
    this.setupEventListeners();

    // Set up debug toggle
    this.setupDebugToggle();

    await super.initialize();
  }

  /**
   * Load settings into UI
   */
  loadSettingsToUI() {
    if (this.settings) {
      this.rootNoteSelect.value = this.settings.get('rootNote');
      this.scaleTypeSelect.value = this.settings.get('scaleType');
      this.droneToggle.checked = this.settings.get('droneEnabled');
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Start button
    this.startButton.addEventListener('click', () => this.handleStart());

    // Clear button
    this.clearButton.addEventListener('click', () => this.handleClear());

    // Back button
    if (this.backButton) {
      this.backButton.addEventListener('click', () => this.navigateBack());
    }

    // Root note change
    this.rootNoteSelect.addEventListener('change', (e) => {
      this.settings.set('rootNote', e.target.value);
      const rootNote = this.settings.getRootNoteWithOctave();
      this.scaleManager.setRootNote(rootNote);

      // Update drone if playing
      if (this.droneToggle.checked && this.droneManager.getIsDronePlaying()) {
        const frequency = this.scaleManager.getFrequency(0);
        this.droneManager.updateDroneFrequency(frequency);
        this.pitchContext.enableDroneCancellation(frequency);
      }

      this.trackEvent('setting_changed', {
        tool: 'vocal_monitor',
        setting: 'root_note',
        value: e.target.value,
      });
    });

    // Scale type change
    this.scaleTypeSelect.addEventListener('change', (e) => {
      this.settings.set('scaleType', e.target.value);
      this.scaleManager.setScaleType(e.target.value);

      this.trackEvent('setting_changed', {
        tool: 'vocal_monitor',
        setting: 'scale_type',
        value: e.target.value,
      });
    });

    // Drone toggle
    this.droneToggle.addEventListener('change', (e) => {
      this.settings.set('droneEnabled', e.target.checked);
      if (e.target.checked) {
        const frequency = this.scaleManager.getFrequency(0);
        this.droneManager.startDrone(frequency);
        if (this.isRecording) {
          this.pitchContext.enableDroneCancellation(frequency);
        }
      } else {
        this.droneManager.stopDrone();
        this.pitchContext.disableDroneCancellation();
      }

      this.trackEvent('setting_changed', {
        tool: 'vocal_monitor',
        setting: 'drone_enabled',
        value: e.target.checked,
      });
    });

    // Settings toggle (mobile)
    if (this.settingsToggle) {
      this.settingsToggle.addEventListener('click', () => {
        this.settingsPanel.classList.toggle('expanded');
        this.settingsToggle.textContent = this.settingsPanel.classList.contains('expanded')
          ? 'Hide Settings ▲'
          : 'Settings ⚙️';
      });
    }

    // Canvas scroll handling for history navigation
    this.setupScrollHandling();

    // Piano key click handling
    this.setupPianoKeyClicks();
  }

  /**
   * Set up debug toggle button
   * Only visible in development mode. Use Ctrl/Cmd + Shift + D to reveal in production.
   */
  setupDebugToggle() {
    if (this.debugToggle) {
      this.debugToggle.addEventListener('click', () => {
        this.debugOverlay.toggle();
      });

      // Only show in development
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      this.debugToggle.style.display = isDev ? 'flex' : 'none';

      // Keyboard shortcut for debug (Ctrl/Cmd + Shift + D) - reveals toggle in prod
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
          e.preventDefault();
          this.debugToggle.style.display = 'flex';
          this.debugOverlay.toggle();
        }
      });
    }
  }

  /**
   * Set up piano key interaction (press and hold to play, glidable)
   */
  setupPianoKeyClicks() {
    const keyboardWidth = this.renderer.getKeyboardWidth();
    this.pressedKey = null; // Track currently pressed key
    this.currentToneOscillator = null;
    this.isPianoPressed = false; // Track if we're in piano playing mode

    // Change cursor based on position
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x <= keyboardWidth) {
        this.canvas.style.cursor = 'pointer';

        // Handle gliding while pressed
        if (this.isPianoPressed) {
          const state = this.monitorState.getState();
          const midiNote = Math.floor(this.yToMidi(y, rect.height, state.pitchRangeMin, state.pitchRangeMax));

          if (midiNote >= state.pitchRangeMin && midiNote < state.pitchRangeMax && midiNote !== this.pressedKey) {
            this.glideToPianoKey(midiNote);
          }
        }
      } else {
        this.canvas.style.cursor = this.pressedKey ? 'default' : 'grab';
      }
    });

    // Mouse down - start playing
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x <= keyboardWidth) {
        const state = this.monitorState.getState();
        const midiNote = Math.floor(this.yToMidi(y, rect.height, state.pitchRangeMin, state.pitchRangeMax));

        if (midiNote >= state.pitchRangeMin && midiNote < state.pitchRangeMax) {
          this.isPianoPressed = true;
          this.startPianoKey(midiNote);
        }
      }
    });

    // Mouse up - stop playing
    window.addEventListener('mouseup', () => {
      this.isPianoPressed = false;
      this.stopPianoKey();
    });

    // Mouse leave canvas - stop playing
    this.canvas.addEventListener('mouseleave', () => {
      this.isPianoPressed = false;
      this.stopPianoKey();
    });

    // Touch support with gliding
    this.canvas.addEventListener('touchstart', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (x <= keyboardWidth) {
        e.preventDefault();
        const state = this.monitorState.getState();
        const midiNote = Math.floor(this.yToMidi(y, rect.height, state.pitchRangeMin, state.pitchRangeMax));

        if (midiNote >= state.pitchRangeMin && midiNote < state.pitchRangeMax) {
          this.isPianoPressed = true;
          this.startPianoKey(midiNote);
        }
      }
    }, { passive: false });

    // Touch move - handle gliding
    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isPianoPressed) return;

      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (x <= keyboardWidth) {
        e.preventDefault();
        const state = this.monitorState.getState();
        const midiNote = Math.floor(this.yToMidi(y, rect.height, state.pitchRangeMin, state.pitchRangeMax));

        if (midiNote >= state.pitchRangeMin && midiNote < state.pitchRangeMax && midiNote !== this.pressedKey) {
          this.glideToPianoKey(midiNote);
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => {
      this.isPianoPressed = false;
      this.stopPianoKey();
    });
  }

  /**
   * Convert Y position to MIDI note
   */
  yToMidi(y, height, pitchRangeMin, pitchRangeMax) {
    const range = pitchRangeMax - pitchRangeMin;
    // Y is inverted (0 at top, height at bottom)
    const normalized = 1 - (y / height);
    return pitchRangeMin + (normalized * range);
  }

  /**
   * Start playing a piano key
   */
  startPianoKey(midiNote) {
    // Stop any currently playing key
    this.stopPianoKey();

    this.pressedKey = midiNote;
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Start a sustained tone
    this.droneManager.tonePlayer.initialize();
    const ctx = this.droneManager.tonePlayer.audioContext;

    // Create oscillator for sustained tone
    this.currentToneOscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    this.currentToneOscillator.type = 'triangle';
    this.currentToneOscillator.frequency.value = frequency;

    // Smooth attack (20ms fade in to avoid click)
    const attackTime = 0.02;
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime); // Start near zero (not exactly zero for exponential ramp)
    gainNode.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + attackTime);

    this.currentToneOscillator.connect(gainNode);
    gainNode.connect(this.droneManager.tonePlayer.masterGain);

    this.currentToneOscillator.start();
    this.currentToneGain = gainNode;
  }

  /**
   * Stop playing the current piano key
   */
  stopPianoKey() {
    if (this.currentToneOscillator && this.currentToneGain) {
      const ctx = this.droneManager.tonePlayer.audioContext;
      const osc = this.currentToneOscillator;
      const gain = this.currentToneGain;

      // Smooth release (30ms fade out to avoid click)
      const releaseTime = 0.03;
      const now = ctx.currentTime;

      // Cancel any scheduled changes and get current value
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

      // Stop oscillator after release completes
      osc.stop(now + releaseTime + 0.01);

      // Clear references
      this.currentToneOscillator = null;
      this.currentToneGain = null;
    }
    this.pressedKey = null;
  }

  /**
   * Glide to a new piano key (smooth frequency transition)
   */
  glideToPianoKey(midiNote) {
    if (!this.currentToneOscillator) {
      // No note playing, just start the new one
      this.startPianoKey(midiNote);
      return;
    }

    const ctx = this.droneManager.tonePlayer.audioContext;
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Smooth glide to new frequency (portamento)
    const glideTime = 0.05; // 50ms glide
    this.currentToneOscillator.frequency.cancelScheduledValues(ctx.currentTime);
    this.currentToneOscillator.frequency.setValueAtTime(this.currentToneOscillator.frequency.value, ctx.currentTime);
    this.currentToneOscillator.frequency.linearRampToValueAtTime(frequency, ctx.currentTime + glideTime);

    this.pressedKey = midiNote;
  }

  /**
   * Get currently pressed piano key (for rendering)
   */
  getPressedKey() {
    return this.pressedKey;
  }

  /**
   * Set up scroll/drag handling on the canvas
   */
  setupScrollHandling() {
    let isDragging = false;
    let lastX = 0;
    const keyboardWidth = this.renderer.getKeyboardWidth();

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => {
      // Only start drag if clicking in the main area (not keyboard)
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x > keyboardWidth) {
        isDragging = true;
        lastX = e.clientX;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - lastX;
      lastX = e.clientX;
      // Convert pixel delta to time delta (negative because dragging right shows earlier time)
      const timeDelta = -deltaX * (this.monitorState.viewportWidth / (this.renderer.getDimensions().width - keyboardWidth));
      this.monitorState.scrollViewport(timeDelta);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.canvas.style.cursor = 'default';
      }
    });

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        if (x > keyboardWidth) {
          isDragging = true;
          lastX = e.touches[0].clientX;
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - lastX;
      lastX = e.touches[0].clientX;
      const timeDelta = -deltaX * (this.monitorState.viewportWidth / (this.renderer.getDimensions().width - keyboardWidth));
      this.monitorState.scrollViewport(timeDelta);
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      isDragging = false;
    }, { passive: true });

    // Mouse wheel for scrolling
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Scroll horizontally with wheel (or vertical scroll on trackpad)
      const timeDelta = e.deltaX !== 0 ? e.deltaX * 5 : e.deltaY * 5;
      this.monitorState.scrollViewport(timeDelta);
    }, { passive: false });
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

    // Reset UI
    this.startButton.textContent = 'Start';
    this.startButton.disabled = false;
    this.clearButton.disabled = true;
    this.rootNoteSelect.disabled = false;
    this.scaleTypeSelect.disabled = false;

    this.updatePitchDisplay(null);
    this.updateNoteDisplay(null);

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

    // Stop animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Stop recording
    if (this.isRecording) {
      this.stopRecording();
    }

    // Hide debug overlay
    if (this.debugOverlay) {
      this.debugOverlay.hide();
    }

    // Hide container
    this.hide();
  }

  /**
   * Handle start button click
   */
  async handleStart() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  /**
   * Start recording
   */
  async startRecording() {
    try {
      // Check microphone support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.showMicrophoneWarning();
        return;
      }

      this.startButton.disabled = true;
      this.startButton.textContent = 'Starting...';

      // Start pitch detection
      await this.pitchContext.start();

      // Start drone if enabled
      if (this.droneToggle.checked) {
        const frequency = this.scaleManager.getFrequency(0);
        this.droneManager.startDrone(frequency);
        this.pitchContext.enableDroneCancellation(frequency);
      }

      // Start state recording
      this.monitorState.start();

      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Update UI
      this.startButton.textContent = 'Stop';
      this.startButton.disabled = false;
      this.clearButton.disabled = false;
      this.rootNoteSelect.disabled = true;
      this.scaleTypeSelect.disabled = true;

      // Track event
      this.trackEvent('vocal_monitor_start', {
        root_note: this.rootNoteSelect.value,
        scale_type: this.scaleTypeSelect.value,
        drone_enabled: this.droneToggle.checked,
      });
    } catch (error) {
      console.error('Failed to start recording:', error);

      // Track the error
      this.trackEvent('mic_error', {
        tool: 'vocal_monitor',
        error_type: error.name || 'unknown',
        error_message: error.message,
      });

      // Check if this is a permission denied error
      if (error.message.includes('not allowed') || error.name === 'NotAllowedError') {
        this.showMicrophoneWarning('Microphone permission denied. Please check your browser settings and allow microphone access for this site.');
      }

      this.startButton.textContent = 'Start';
      this.startButton.disabled = false;
    }
  }

  /**
   * Stop recording
   */
  stopRecording() {
    // Stop pitch detection
    this.pitchContext.stop();
    this.pitchContext.disableDroneCancellation();

    // Stop drone
    this.droneManager.stopDrone();

    // Stop state recording
    this.monitorState.stop();

    // Calculate session duration
    const sessionDuration = this.recordingStartTime
      ? Math.round((Date.now() - this.recordingStartTime) / 1000)
      : 0;

    this.isRecording = false;
    this.recordingStartTime = null;

    // Update UI
    this.startButton.textContent = 'Start';
    this.rootNoteSelect.disabled = false;
    this.scaleTypeSelect.disabled = false;

    // Track event with duration
    this.trackEvent('vocal_monitor_stop', {
      session_duration_seconds: sessionDuration,
      root_note: this.rootNoteSelect.value,
      scale_type: this.scaleTypeSelect.value,
    });
  }

  /**
   * Handle clear button click
   */
  handleClear() {
    this.monitorState.clear();
    this.updatePitchDisplay(null);
    this.updateNoteDisplay(null);
  }

  /**
   * Handle pitch detected
   */
  onPitchDetected(pitchData) {
    if (this.monitorState) {
      this.monitorState.onPitchDetected(pitchData);
    }
    this.updatePitchDisplay(pitchData);
    this.updateNoteDisplay(pitchData);
  }

  /**
   * Handle settings changed
   */
  onSettingsChanged(key, newValue) {
    switch (key) {
      case 'rootNote':
        this.rootNoteSelect.value = newValue;
        break;
      case 'scaleType':
        this.scaleTypeSelect.value = newValue;
        break;
      case 'droneEnabled':
        this.droneToggle.checked = newValue;
        break;
    }
  }

  /**
   * Start render loop
   */
  startRenderLoop() {
    const loop = (timestamp) => {
      if (!this.isActive) return;

      this.lastFrameTime = timestamp;
      this.render();

      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }

  /**
   * Render the monitor
   */
  render() {
    if (!this.renderer || !this.monitorState) return;

    const state = this.monitorState.getState();
    this.renderer.render(state, this.scaleManager, this.pressedKey);

    // Update debug overlay if enabled
    if (this.debugOverlay && this.debugOverlay.enabled && this.pitchContext) {
      const debugInfo = this.pitchContext.getDebugInfo();
      this.debugOverlay.update(state.currentPitch, debugInfo, null, state.isSinging);
    }
  }

  /**
   * Update pitch display
   */
  updatePitchDisplay(pitchData) {
    if (!this.pitchDisplay) return;

    if (pitchData && pitchData.frequency) {
      const freq = pitchData.frequency.toFixed(1);
      this.pitchDisplay.textContent = `Pitch: ${freq} Hz`;
      this.pitchDisplay.classList.add('singing');
    } else {
      this.pitchDisplay.textContent = 'Pitch: --';
      this.pitchDisplay.classList.remove('singing');
    }
  }

  /**
   * Update note display
   */
  updateNoteDisplay(pitchData) {
    if (!this.noteDisplay) return;

    if (pitchData && pitchData.noteName) {
      const centsStr = pitchData.centsOff >= 0 ? `+${pitchData.centsOff.toFixed(0)}` : pitchData.centsOff.toFixed(0);
      this.noteDisplay.textContent = `Note: ${pitchData.noteName} (${centsStr}¢)`;
    } else {
      this.noteDisplay.textContent = 'Note: --';
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

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
