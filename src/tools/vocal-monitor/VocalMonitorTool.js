/**
 * VocalMonitorTool - Real-time pitch visualization tool
 * Extends ToolBase to integrate with the tool selection system
 */

import { ToolBase } from '../../core/ToolBase.js';
import { VocalMonitorState } from './VocalMonitorState.js';
import { VocalMonitorRenderer } from './VocalMonitorRenderer.js';
import { ExerciseEngine } from './ExerciseEngine.js';
import { createExercise } from './exercises/index.js';
import { ScaleTimeline } from './ScaleTimeline.js';
import { RollingKeyManager } from './RollingKeyManager.js';
import { DebugOverlay } from '../../ui/DebugOverlay.js';
import { FrequencyConverter } from '../../pitch-engine/index.js';

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
    this.settingsToggle = null;
    this.settingsPanel = null;

    // Animation
    this.animationId = null;
    this.lastFrameTime = 0;

    // State
    this.isRecording = false;
    this.recordingStartTime = null;

    // Exercise mode
    this.exerciseEngine = new ExerciseEngine();
    this.exerciseDefinition = null; // Created dynamically based on type
    this.exerciseToggle = null;
    this.exerciseSettingsPanel = null;
    this.showLyricsToggle = null;

    // Rolling key and timeline
    this.scaleTimeline = new ScaleTimeline();
    this.rollingKeyManager = new RollingKeyManager();

    // Jump to front button
    this.jumpToFrontButton = null;

    // Sidebar elements
    this.sidebar = null;
    this.sidebarToggle = null;
    this.sidebarRootNote = null;
    this.sidebarScaleType = null;
    this.sidebarDroneToggle = null;
    this.sidebarExerciseToggle = null;
    this.sidebarExerciseType = null;
    this.sidebarExerciseOptions = null;
    this.sidebarShowLyrics = null;
    this.sidebarRollingKeyToggle = null;
    this.sidebarRollingKeyOptions = null;
    this.sidebarStaticKeyOptions = null;
    this.scaleLocked = false;

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
    this.settingsToggle = document.getElementById('vocal-settings-toggle');
    this.settingsPanel = document.getElementById('vocal-settings-panel');
    this.exerciseToggle = document.getElementById('vocal-exercise-toggle');
    this.exerciseSettingsPanel = document.getElementById('vocal-exercise-settings');
    this.showLyricsToggle = document.getElementById('vocal-show-lyrics');

    // Sidebar elements
    this.sidebar = document.getElementById('vocal-sidebar');
    this.sidebarToggle = document.getElementById('vocal-sidebar-toggle');
    this.sidebarRootNote = document.getElementById('sidebar-root-note');
    this.sidebarScaleType = document.getElementById('sidebar-scale-type');
    this.sidebarDroneToggle = document.getElementById('sidebar-drone-toggle');
    this.sidebarDroneChordToggle = document.getElementById('sidebar-drone-chord');
    this.sidebarExerciseToggle = document.getElementById('sidebar-exercise-toggle');
    this.sidebarExerciseType = document.getElementById('sidebar-exercise-type');
    this.sidebarExerciseOptions = document.getElementById('sidebar-exercise-options');
    this.sidebarShowLyrics = document.getElementById('sidebar-show-lyrics');
    this.sidebarRollingKeyToggle = document.getElementById('sidebar-rolling-key-toggle');
    this.sidebarRollingKeyOptions = document.getElementById('sidebar-rolling-key-options');
    this.sidebarStaticKeyOptions = document.getElementById('sidebar-static-key-options');
    this.scaleLockNotice = document.getElementById('scale-locked-notice');

    // Jump to front button
    this.jumpToFrontButton = document.getElementById('vocal-jump-to-front');

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

    // Initialize exercise definition
    const exerciseType = this.settings?.get('exerciseType') || 'ascendingMajorLadder';
    this.exerciseDefinition = createExercise(exerciseType);

    // Initialize scale timeline with current scale
    this._initializeScaleTimeline();

    // Set up exercise cycle completion callback for rolling key
    this.exerciseEngine.setOnCycleComplete(() => this._handleExerciseCycleComplete());

    // Load settings to UI
    this.loadSettingsToUI();

    // Set up event listeners
    this.setupEventListeners();

    // Set up sidebar event listeners
    this.setupSidebarEventListeners();

    // Set up debug toggle
    this.setupDebugToggle();

    await super.initialize();
  }

  /**
   * Load settings into UI
   */
  loadSettingsToUI() {
    if (this.settings) {
      // Legacy controls
      this.rootNoteSelect.value = this.settings.get('rootNote');
      this.scaleTypeSelect.value = this.settings.get('scaleType');
      this.droneToggle.checked = this.settings.get('droneEnabled');

      if (this.showLyricsToggle) {
        this.showLyricsToggle.checked = this.settings.get('exerciseShowLyrics');
      }

      // Sidebar controls
      if (this.sidebarRootNote) {
        this.sidebarRootNote.value = this.settings.get('rootNote');
      }
      if (this.sidebarScaleType) {
        this.sidebarScaleType.value = this.settings.get('scaleType');
      }
      if (this.sidebarDroneToggle) {
        this.sidebarDroneToggle.checked = this.settings.get('droneEnabled');
      }
      if (this.sidebarDroneChordToggle) {
        this.sidebarDroneChordToggle.checked = this.settings.get('droneMode') === 'chord';
      }
      if (this.sidebarExerciseType) {
        this.sidebarExerciseType.value = this.settings.get('exerciseType');
      }
      if (this.sidebarShowLyrics) {
        this.sidebarShowLyrics.checked = this.settings.get('exerciseShowLyrics');
      }
      if (this.sidebarExerciseToggle) {
        this.sidebarExerciseToggle.checked = this.settings.get('exerciseEnabled');
      }
      if (this.exerciseToggle) {
        this.exerciseToggle.checked = this.settings.get('exerciseEnabled');
      }
      if (this.sidebarRollingKeyToggle) {
        this.sidebarRollingKeyToggle.checked = this.settings.get('rollingKeyEnabled');
      }

      // Load rolling key settings
      const lowestRoot = this.settings.get('rollingKeyLowestRoot') || 'C3';
      const highestRoot = this.settings.get('rollingKeyHighestRoot') || 'G4';
      const direction = this.settings.get('rollingKeyDirection') || 'ascending';
      const stepType = this.settings.get('rollingKeyStepType') || 'semitone';

      const lowestSelect = document.getElementById('sidebar-rolling-key-lowest');
      const highestSelect = document.getElementById('sidebar-rolling-key-highest');
      const directionSelect = document.getElementById('sidebar-rolling-key-direction');
      const stepSelect = document.getElementById('sidebar-rolling-key-step');

      if (lowestSelect) lowestSelect.value = lowestRoot;
      if (highestSelect) highestSelect.value = highestRoot;
      if (directionSelect) directionSelect.value = direction;
      if (stepSelect) stepSelect.value = stepType;

      // Configure rolling key manager
      this.rollingKeyManager.configure({
        mode: this.settings.get('rollingKeyEnabled') ? 'rolling' : 'static',
        lowestRoot: FrequencyConverter.noteNameToMidi(lowestRoot),
        highestRoot: FrequencyConverter.noteNameToMidi(highestRoot),
        direction,
        stepType,
      });

      // Sync derived UI state after setting checkbox values
      this._syncDerivedUIState();
    }
  }

  /**
   * Sync derived UI state (panel visibility) based on checkbox values.
   * Called after loadSettingsToUI() to ensure panels reflect persisted state.
   */
  _syncDerivedUIState() {
    // Exercise mode controls exercise options visibility
    const exerciseEnabled = this.sidebarExerciseToggle?.checked ?? false;
    if (this.sidebarExerciseOptions) {
      this.sidebarExerciseOptions.style.display = exerciseEnabled ? '' : 'none';
    }

    // Key mode controls static vs rolling key options visibility
    const rollingKeyEnabled = this.sidebarRollingKeyToggle?.checked ?? false;

    if (this.sidebarStaticKeyOptions) {
      this.sidebarStaticKeyOptions.style.display = rollingKeyEnabled ? 'none' : '';
    }
    if (this.sidebarRollingKeyOptions) {
      this.sidebarRollingKeyOptions.style.display = rollingKeyEnabled ? '' : 'none';
    }
  }

  /**
   * Initialize scale timeline with current scale
   */
  _initializeScaleTimeline() {
    if (this.settings && this.scaleManager) {
      const rootNote = this.settings.getRootNoteWithOctave();
      const scaleType = this.settings.get('scaleType');
      this.scaleTimeline.setInitialKey(rootNote, scaleType);

      // Set scale context in monitor state
      this.monitorState.setScaleContext(rootNote, scaleType);
    }
  }

  /**
   * Handle exercise cycle completion (for rolling key)
   */
  _handleExerciseCycleComplete() {
    if (!this.rollingKeyManager.isRolling()) {
      return; // Not in rolling mode, just loop
    }

    const advanced = this.rollingKeyManager.advanceToNextKey();
    if (advanced) {
      const newRootNote = this.rollingKeyManager.getCurrentRootNote();

      // Record key change to timeline
      if (this.monitorState.currentTime != null) {
        const scaleType = this.settings.get('scaleType');
        this.scaleTimeline.addKeyChange(this.monitorState.currentTime, newRootNote, scaleType);

        // Update scale context in monitor state
        this.monitorState.setScaleContext(newRootNote, scaleType);
      }

      // Update scale manager with new root
      this.scaleManager.setRootNote(newRootNote);

      // Update settings
      this.settings.set('rootNote', newRootNote.replace(/\d+$/, '')); // Strip octave for settings

      // Sync UI
      this._syncRootNoteUI(newRootNote.replace(/\d+$/, ''));

      // Update drone if playing
      if (this.droneToggle.checked && this.droneManager.getIsDronePlaying()) {
        const frequency = this.scaleManager.getFrequency(0);
        if (this.droneManager.isInChordMode()) {
          const scaleType = this.settings.get('scaleType');
          const chordType = scaleType.includes('minor') ? 'minor' : 'major';
          this.droneManager.updateChordDroneFrequency(frequency, chordType);
        } else {
          this.droneManager.updateDroneFrequency(frequency);
        }
        this.pitchContext.enableDroneCancellation(frequency);
      }

      // Regenerate exercise with new scale
      this._restartExerciseIfActive();

      this.trackEvent('rolling_key_advance', {
        new_root: newRootNote,
        progress: this.rollingKeyManager.getProgress(),
      });
    } else {
      // Completed all keys
      this.trackEvent('rolling_key_complete', {
        total_keys: this.rollingKeyManager.getTotalKeys(),
      });
    }

  }

  /**
   * Sync root note across all UI elements
   */
  _syncRootNoteUI(rootNote) {
    if (this.rootNoteSelect) this.rootNoteSelect.value = rootNote;
    if (this.sidebarRootNote) this.sidebarRootNote.value = rootNote;
  }

  /**
   * Sync scale type across all UI elements
   */
  _syncScaleTypeUI(scaleType) {
    if (this.scaleTypeSelect) this.scaleTypeSelect.value = scaleType;
    if (this.sidebarScaleType) this.sidebarScaleType.value = scaleType;
  }

  /**
   * Apply scale lock if the current exercise requires it.
   * Centralizes scale lock logic to avoid duplication.
   */
  _applyScaleLockIfNeeded() {
    if (!this.exerciseDefinition?.locksScale()) {
      this._releaseScaleLock();
      return;
    }

    const requiredScale = this.exerciseDefinition.getRequiredScaleType();
    this.scaleLocked = true;

    // Update scale manager and settings
    this.scaleManager.setScaleType(requiredScale);
    this.settings.set('scaleType', requiredScale);
    this._syncScaleTypeUI(requiredScale);

    // Show lock notice
    if (this.scaleLockNotice) {
      this.scaleLockNotice.style.display = '';
      this.scaleLockNotice.textContent = `Scale locked to ${requiredScale}`;
    }

    // Disable scale selectors
    if (this.sidebarScaleType) this.sidebarScaleType.disabled = true;
    if (this.scaleTypeSelect) this.scaleTypeSelect.disabled = true;
  }

  /**
   * Release scale lock and re-enable scale selectors.
   */
  _releaseScaleLock() {
    this.scaleLocked = false;
    if (this.scaleLockNotice) this.scaleLockNotice.style.display = 'none';
    if (this.sidebarScaleType) this.sidebarScaleType.disabled = false;
    if (this.scaleTypeSelect) this.scaleTypeSelect.disabled = false;
  }

  /**
   * Set up sidebar event listeners
   */
  setupSidebarEventListeners() {
    // Sidebar toggle button
    if (this.sidebarToggle) {
      this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    }

    // Escape key to close sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.sidebar?.classList.contains('open')) {
        this.closeSidebar();
      }
    });

    // Root note in sidebar
    if (this.sidebarRootNote) {
      this.sidebarRootNote.addEventListener('change', (e) => {
        this._handleRootNoteChange(e.target.value);
        // Sync legacy control
        if (this.rootNoteSelect) this.rootNoteSelect.value = e.target.value;
      });
    }

    // Scale type in sidebar
    if (this.sidebarScaleType) {
      this.sidebarScaleType.addEventListener('change', (e) => {
        this._handleScaleTypeChange(e.target.value);
        // Sync legacy control
        if (this.scaleTypeSelect) this.scaleTypeSelect.value = e.target.value;
      });
    }

    // Drone toggle in sidebar
    if (this.sidebarDroneToggle) {
      this.sidebarDroneToggle.addEventListener('change', (e) => {
        this._handleDroneToggle(e.target.checked);
        // Sync legacy control
        if (this.droneToggle) this.droneToggle.checked = e.target.checked;
      });
    }

    // Drone chord toggle in sidebar
    if (this.sidebarDroneChordToggle) {
      this.sidebarDroneChordToggle.addEventListener('change', (e) => {
        this._handleDroneChordToggle(e.target.checked);
      });
    }

    // Exercise toggle in sidebar
    if (this.sidebarExerciseToggle) {
      this.sidebarExerciseToggle.addEventListener('change', (e) => {
        this.toggleExerciseMode(e.target.checked);
        // Sync legacy control
        if (this.exerciseToggle) this.exerciseToggle.checked = e.target.checked;

        // Show/hide exercise options
        if (this.sidebarExerciseOptions) {
          this.sidebarExerciseOptions.style.display = e.target.checked ? '' : 'none';
        }
      });
    }

    // Exercise type in sidebar
    if (this.sidebarExerciseType) {
      this.sidebarExerciseType.addEventListener('change', (e) => {
        this._handleExerciseTypeChange(e.target.value);
      });
    }

    // Show lyrics in sidebar
    if (this.sidebarShowLyrics) {
      this.sidebarShowLyrics.addEventListener('change', (e) => {
        this.settings.set('exerciseShowLyrics', e.target.checked);
        // Sync legacy control
        if (this.showLyricsToggle) this.showLyricsToggle.checked = e.target.checked;
      });
    }

    // Rolling key toggle
    if (this.sidebarRollingKeyToggle) {
      this.sidebarRollingKeyToggle.addEventListener('change', (e) => {
        this.settings.set('rollingKeyEnabled', e.target.checked);
        this.rollingKeyManager.configure({ mode: e.target.checked ? 'rolling' : 'static' });

        // Show/hide static vs rolling key options
        if (this.sidebarStaticKeyOptions) {
          this.sidebarStaticKeyOptions.style.display = e.target.checked ? 'none' : '';
        }
        if (this.sidebarRollingKeyOptions) {
          this.sidebarRollingKeyOptions.style.display = e.target.checked ? '' : 'none';
        }

        // Reset rolling key when toggled on
        if (e.target.checked) {
          this.rollingKeyManager.reset();
        }
      });
    }

    // Rolling key settings
    this._setupRollingKeySettings();
  }

  /**
   * Set up rolling key range and direction settings
   */
  _setupRollingKeySettings() {
    const lowestSelect = document.getElementById('sidebar-rolling-key-lowest');
    const highestSelect = document.getElementById('sidebar-rolling-key-highest');
    const directionSelect = document.getElementById('sidebar-rolling-key-direction');
    const stepSelect = document.getElementById('sidebar-rolling-key-step');

    if (lowestSelect) {
      lowestSelect.addEventListener('change', (e) => {
        this.settings.set('rollingKeyLowestRoot', e.target.value);
        this.rollingKeyManager.configure({
          lowestRoot: FrequencyConverter.noteNameToMidi(e.target.value),
        });
        this.rollingKeyManager.reset();
      });
    }

    if (highestSelect) {
      highestSelect.addEventListener('change', (e) => {
        this.settings.set('rollingKeyHighestRoot', e.target.value);
        this.rollingKeyManager.configure({
          highestRoot: FrequencyConverter.noteNameToMidi(e.target.value),
        });
        this.rollingKeyManager.reset();
      });
    }

    if (directionSelect) {
      directionSelect.addEventListener('change', (e) => {
        this.settings.set('rollingKeyDirection', e.target.value);
        this.rollingKeyManager.configure({ direction: e.target.value });
        this.rollingKeyManager.reset();
      });
    }

    if (stepSelect) {
      stepSelect.addEventListener('change', (e) => {
        this.settings.set('rollingKeyStepType', e.target.value);
        this.rollingKeyManager.configure({ stepType: e.target.value });
        this.rollingKeyManager.reset();
      });
    }
  }

  /**
   * Toggle sidebar open/closed
   */
  toggleSidebar() {
    const isOpen = this.sidebar?.classList.contains('open');
    if (isOpen) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  /**
   * Open the sidebar
   */
  openSidebar() {
    if (this.sidebar) {
      this.sidebar.classList.add('open');
      this.container?.classList.add('sidebar-open');
      this.settings?.set('sidebarOpen', true);
      if (this.sidebarToggle) {
        this.sidebarToggle.textContent = '× Close';
        this.sidebarToggle.setAttribute('aria-expanded', 'true');
      }
      this._showBackdrop();
    }
  }

  /**
   * Close the sidebar
   */
  closeSidebar() {
    if (this.sidebar) {
      this.sidebar.classList.remove('open');
      this.container?.classList.remove('sidebar-open');
      this.settings?.set('sidebarOpen', false);
      if (this.sidebarToggle) {
        this.sidebarToggle.textContent = 'Settings';
        this.sidebarToggle.setAttribute('aria-expanded', 'false');
      }
      this._hideBackdrop();
    }
  }

  /**
   * Show backdrop overlay (mobile only)
   */
  _showBackdrop() {
    if (window.innerWidth > 768) return;
    let backdrop = document.getElementById('sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebar-backdrop';
      backdrop.addEventListener('click', () => this.closeSidebar());
      this.container.appendChild(backdrop);
    }
    backdrop.style.display = 'block';
  }

  /**
   * Hide backdrop overlay
   */
  _hideBackdrop() {
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  /**
   * Handle root note change (shared logic)
   */
  _handleRootNoteChange(rootNote) {
    this.settings.set('rootNote', rootNote);
    const rootNoteWithOctave = this.settings.getRootNoteWithOctave();
    this.scaleManager.setRootNote(rootNoteWithOctave);

    // Update scale context
    this.monitorState.setScaleContext(rootNoteWithOctave, this.settings.get('scaleType'));

    // Update drone if playing
    if (this.droneToggle?.checked && this.droneManager.getIsDronePlaying()) {
      const frequency = this.scaleManager.getFrequency(0);
      if (this.droneManager.isInChordMode()) {
        const scaleType = this.settings.get('scaleType');
        const chordType = scaleType.includes('minor') ? 'minor' : 'major';
        this.droneManager.updateChordDroneFrequency(frequency, chordType);
      } else {
        this.droneManager.updateDroneFrequency(frequency);
      }
      this.pitchContext.enableDroneCancellation(frequency);
    }

    // Restart exercise with new scale if active
    this._restartExerciseIfActive();

    this.trackEvent('setting_changed', {
      tool: 'vocal_monitor',
      setting: 'root_note',
      value: rootNote,
    });
  }

  /**
   * Handle scale type change (shared logic)
   */
  _handleScaleTypeChange(scaleType) {
    this.settings.set('scaleType', scaleType);
    this.scaleManager.setScaleType(scaleType);

    // Update scale context
    const rootNote = this.settings.getRootNoteWithOctave();
    this.monitorState.setScaleContext(rootNote, scaleType);

    // Restart exercise with new scale if active
    this._restartExerciseIfActive();

    this.trackEvent('setting_changed', {
      tool: 'vocal_monitor',
      setting: 'scale_type',
      value: scaleType,
    });
  }

  /**
   * Handle drone toggle (shared logic)
   */
  async _handleDroneToggle(enabled) {
    this.settings.set('droneEnabled', enabled);
    if (enabled) {
      const frequency = this.scaleManager.getFrequency(0);
      const droneMode = this.settings.get('droneMode');
      if (droneMode === 'chord') {
        const scaleType = this.settings.get('scaleType');
        const chordType = scaleType.includes('minor') ? 'minor' : 'major';
        this.droneManager.startChordDrone(frequency, chordType);
      } else {
        this.droneManager.startDrone(frequency);
      }
      if (this.isRecording) {
        this.pitchContext.enableDroneCancellation(frequency);
      }
    } else {
      // Stop whichever drone is playing (only one can be active)
      if (this.droneManager.isInChordMode()) {
        await this.droneManager.stopChordDrone();
      } else {
        await this.droneManager.stopDrone();
      }
      this.pitchContext.disableDroneCancellation();
    }

    this.trackEvent('setting_changed', {
      tool: 'vocal_monitor',
      setting: 'drone_enabled',
      value: enabled,
    });
  }

  /**
   * Handle drone chord toggle (play as chord)
   */
  async _handleDroneChordToggle(enabled) {
    const newMode = enabled ? 'chord' : 'root';
    this.settings.set('droneMode', newMode);

    // If drone is currently playing, switch modes (async to avoid overlap)
    if (this.droneManager.getIsDronePlaying()) {
      const frequency = this.scaleManager.getFrequency(0);

      if (enabled) {
        // Switch from root to chord (waits for stop before starting)
        const scaleType = this.settings.get('scaleType');
        const chordType = scaleType.includes('minor') ? 'minor' : 'major';
        await this.droneManager.switchToChordDrone(frequency, chordType);
      } else {
        // Switch from chord to root (waits for stop before starting)
        await this.droneManager.switchToRootDrone(frequency);
      }
    }

    this.trackEvent('setting_changed', {
      tool: 'vocal_monitor',
      setting: 'drone_mode',
      value: newMode,
    });
  }

  /**
   * Handle exercise type change
   */
  _handleExerciseTypeChange(exerciseType) {
    this.settings.set('exerciseType', exerciseType);

    // Create new exercise definition
    this.exerciseDefinition = createExercise(exerciseType);

    // Apply scale lock using shared method
    this._applyScaleLockIfNeeded();

    // Restart exercise with new type if active
    this._restartExerciseIfActive();

    this.trackEvent('setting_changed', {
      tool: 'vocal_monitor',
      setting: 'exercise_type',
      value: exerciseType,
    });
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

    // Root note change (legacy control - sync with sidebar)
    this.rootNoteSelect.addEventListener('change', (e) => {
      this._handleRootNoteChange(e.target.value);
      // Sync sidebar control
      if (this.sidebarRootNote) this.sidebarRootNote.value = e.target.value;
    });

    // Scale type change (legacy control - sync with sidebar)
    this.scaleTypeSelect.addEventListener('change', (e) => {
      this._handleScaleTypeChange(e.target.value);
      // Sync sidebar control
      if (this.sidebarScaleType) this.sidebarScaleType.value = e.target.value;
    });

    // Drone toggle (legacy control - sync with sidebar)
    this.droneToggle.addEventListener('change', (e) => {
      this._handleDroneToggle(e.target.checked);
      // Sync sidebar control
      if (this.sidebarDroneToggle) this.sidebarDroneToggle.checked = e.target.checked;
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

    // Exercise mode toggle (legacy control - sync with sidebar)
    if (this.exerciseToggle) {
      this.exerciseToggle.addEventListener('change', (e) => {
        this.toggleExerciseMode(e.target.checked);
        // Sync sidebar control
        if (this.sidebarExerciseToggle) {
          this.sidebarExerciseToggle.checked = e.target.checked;
        }
        // Show/hide sidebar exercise options
        if (this.sidebarExerciseOptions) {
          this.sidebarExerciseOptions.style.display = e.target.checked ? '' : 'none';
        }
      });
    }

    // Show lyrics toggle (legacy control - sync with sidebar)
    if (this.showLyricsToggle) {
      this.showLyricsToggle.addEventListener('change', (e) => {
        this.settings.set('exerciseShowLyrics', e.target.checked);
        // Sync sidebar control
        if (this.sidebarShowLyrics) this.sidebarShowLyrics.checked = e.target.checked;
      });
    }

    // Canvas scroll handling for history navigation
    this.setupScrollHandling();

    // Piano key click handling
    this.setupPianoKeyClicks();

    // Jump to front button
    if (this.jumpToFrontButton) {
      this.jumpToFrontButton.addEventListener('click', () => {
        this.monitorState.jumpToFront();
      });
    }
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
   * Toggle exercise mode on/off
   * @param {boolean} enabled
   */
  async toggleExerciseMode(enabled) {
    // Persist exercise enabled state
    this.settings.set('exerciseEnabled', enabled);

    if (enabled) {
      // Show exercise settings
      if (this.exerciseSettingsPanel) {
        this.exerciseSettingsPanel.style.display = '';
      }

      // Apply scale lock BEFORE starting exercise (critical fix)
      this._applyScaleLockIfNeeded();

      // If rolling key is enabled, reset it and sync to scale manager
      if (this.rollingKeyManager.isRolling()) {
        this.rollingKeyManager.reset();
        const startingRoot = this.rollingKeyManager.getCurrentRootNote();
        this.scaleManager.setRootNote(startingRoot);
        this.settings.set('rootNote', startingRoot.replace(/\d+$/, '')); // Strip octave for settings
        this._syncRootNoteUI(startingRoot.replace(/\d+$/, ''));

        // Reset scale timeline and set initial key
        this.scaleTimeline.clear();
        this.scaleTimeline.setInitialKey(startingRoot, this.settings.get('scaleType'));
        this.monitorState.setScaleContext(startingRoot, this.settings.get('scaleType'));

        // Update drone to new root if playing
        if (this.droneToggle.checked && this.droneManager.getIsDronePlaying()) {
          const frequency = this.scaleManager.getFrequency(0);
          if (this.droneManager.isInChordMode()) {
            const scaleType = this.settings.get('scaleType');
            const chordType = scaleType.includes('minor') ? 'minor' : 'major';
            this.droneManager.updateChordDroneFrequency(frequency, chordType);
          } else {
            this.droneManager.updateDroneFrequency(frequency);
          }
          this.pitchContext.enableDroneCancellation(frequency);
        }
      }

      // Auto-start recording if not already recording
      if (!this.isRecording) {
        await this.startRecording();
      }

      // Start exercise if not already started by startRecording()
      if (this.exerciseEngine.state !== 'active') {
        const sustainDuration = this.exerciseDefinition.sustainDuration || 200;
        this.exerciseEngine.startExercise(
          this.exerciseDefinition, this.scaleManager, sustainDuration,
          this.monitorState.currentTime
        );
      }

      this.trackEvent('exercise_mode_start', {
        sustain_duration: sustainDuration,
        root_note: this.rootNoteSelect.value,
        scale_type: this.scaleTypeSelect.value,
        rolling_key: this.rollingKeyManager.isRolling(),
      });
    } else {
      // Hide exercise settings
      if (this.exerciseSettingsPanel) {
        this.exerciseSettingsPanel.style.display = 'none';
      }

      // Clear exercise completely when user turns off exercise mode
      this.exerciseEngine.clearExercise();

      // Release scale lock
      this._releaseScaleLock();

      this.trackEvent('exercise_mode_stop');
    }
  }

  /**
   * Restart exercise if currently active (e.g., after root note or scale change)
   */
  _restartExerciseIfActive() {
    if (this.exerciseEngine.state !== 'idle') {
      const sustainDuration = this.exerciseDefinition.sustainDuration || 200;
      this.exerciseEngine.startExercise(
        this.exerciseDefinition,
        this.scaleManager,
        sustainDuration,
        this.monitorState.currentTime // Sync to current timeline position
      );
    }
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

      // Handle exercise mode on start (must happen BEFORE drone start so scaleManager has correct root)
      const exerciseActive = this.exerciseToggle && this.exerciseToggle.checked;
      if (exerciseActive) {
        if (this.exerciseEngine.state === 'paused') {
          // Resume paused exercise
          this.exerciseEngine.resumeExercise();
        } else if (this.exerciseEngine.state === 'idle') {
          // Start exercise if enabled but not yet started (e.g., page reload with settings preserved)
          // Sync rolling key if enabled
          if (this.rollingKeyManager.isRolling()) {
            this.rollingKeyManager.reset();
            const startingRoot = this.rollingKeyManager.getCurrentRootNote();
            this.scaleManager.setRootNote(startingRoot);
            this.settings.set('rootNote', startingRoot.replace(/\d+$/, ''));
            this._syncRootNoteUI(startingRoot.replace(/\d+$/, ''));

            this.scaleTimeline.clear();
            this.scaleTimeline.setInitialKey(startingRoot, this.settings.get('scaleType'));
            this.monitorState.setScaleContext(startingRoot, this.settings.get('scaleType'));
          }

          // Apply scale lock if needed
          this._applyScaleLockIfNeeded();
        }
      }

      // Start drone if enabled (after exercise/rolling key sync so frequency is correct)
      if (this.droneToggle.checked) {
        const frequency = this.scaleManager.getFrequency(0);
        const droneMode = this.settings.get('droneMode');
        if (droneMode === 'chord') {
          const scaleType = this.settings.get('scaleType');
          const chordType = scaleType.includes('minor') ? 'minor' : 'major';
          this.droneManager.startChordDrone(frequency, chordType);
        } else {
          this.droneManager.startDrone(frequency);
        }
        this.pitchContext.enableDroneCancellation(frequency);
      }

      // Start state recording
      this.monitorState.start();

      // Start exercise (after monitorState.start() so currentTime is available)
      if (exerciseActive && this.exerciseEngine.state === 'idle') {
        const sustainDuration = this.exerciseDefinition?.sustainDuration || 200;
        this.exerciseEngine.startExercise(
          this.exerciseDefinition, this.scaleManager, sustainDuration,
          this.monitorState.currentTime
        );
      }

      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Update UI
      this.startButton.textContent = 'Stop';
      this.startButton.disabled = false;
      this.clearButton.disabled = false;
      // Keep scale selects enabled during exercise mode so user can change scales
      this.rootNoteSelect.disabled = !exerciseActive;
      this.scaleTypeSelect.disabled = !exerciseActive;

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
    // Pause exercise (but keep targets visible for review)
    // Don't uncheck the toggle - user can scroll back and see their results
    if (this.exerciseEngine.state === 'active') {
      this.exerciseEngine.stopExercise();
    }

    // Stop pitch detection
    this.pitchContext.stop();
    this.pitchContext.disableDroneCancellation();

    // Stop whichever drone is playing
    if (this.droneManager.isInChordMode()) {
      this.droneManager.stopChordDrone();
    } else {
      this.droneManager.stopDrone();
    }

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

    // Reset rolling key FIRST so scaleManager/settings sync to the reset root
    if (this.rollingKeyManager.isRolling()) {
      this.rollingKeyManager.reset();
      const resetRoot = this.rollingKeyManager.getCurrentRootNote();
      this.scaleManager.setRootNote(resetRoot);
      this.settings.set('rootNote', resetRoot.replace(/\d+$/, ''));
      this._syncRootNoteUI(resetRoot.replace(/\d+$/, ''));
    }

    // Clear scale timeline and reinitialize (reads from now-correct settings)
    this.scaleTimeline.clear();
    this._initializeScaleTimeline();

    // Clear exercise engine so next Start does a full sync from 'idle' state
    this.exerciseEngine.clearExercise();
  }

  /**
   * Handle pitch detected
   */
  onPitchDetected(pitchData) {
    if (this.monitorState) {
      this.monitorState.onPitchDetected(pitchData);

      // Feed exercise engine if actively running (not paused)
      if (this.exerciseEngine.state === 'active' && this.monitorState.currentTime != null) {
        this.exerciseEngine.processFrame(this.monitorState.currentPitch, this.monitorState.currentTime);
      }
    }
  }

  /**
   * Handle settings changed
   */
  onSettingsChanged(key, newValue) {
    switch (key) {
      case 'rootNote':
        this.rootNoteSelect.value = newValue;
        if (this.sidebarRootNote) this.sidebarRootNote.value = newValue;
        break;
      case 'scaleType':
        this.scaleTypeSelect.value = newValue;
        if (this.sidebarScaleType) this.sidebarScaleType.value = newValue;
        break;
      case 'droneEnabled':
        this.droneToggle.checked = newValue;
        if (this.sidebarDroneToggle) this.sidebarDroneToggle.checked = newValue;
        break;
      case 'exerciseShowLyrics':
        if (this.showLyricsToggle) this.showLyricsToggle.checked = newValue;
        if (this.sidebarShowLyrics) this.sidebarShowLyrics.checked = newValue;
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
    const exerciseState = this.exerciseEngine.state !== 'idle'
      ? this.exerciseEngine.getState()
      : null;
    const showLyrics = this.settings ? this.settings.get('exerciseShowLyrics') : true;
    this.renderer.render(state, this.scaleManager, this.pressedKey, exerciseState, showLyrics, this.scaleTimeline);

    // Update jump to front button visibility
    // Show when recording but user has scrolled back in history
    if (this.jumpToFrontButton) {
      const shouldShow = state.isRecording && !state.isAutoScrolling;
      this.jumpToFrontButton.style.display = shouldShow ? 'flex' : 'none';
    }

    // Update debug overlay if enabled
    if (this.debugOverlay && this.debugOverlay.enabled && this.pitchContext) {
      const debugInfo = this.pitchContext.getDebugInfo();
      const volumeInfo = { rmsMin: state.rmsMin, rmsMax: state.rmsMax };
      this.debugOverlay.update(state.currentPitch, debugInfo, null, state.isSinging, volumeInfo);
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
