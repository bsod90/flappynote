/**
 * VocalMonitorController
 *
 * DOM-agnostic controller for the Vocal Monitor tool. Owns the canvas renderer,
 * pitch monitor state, exercise engine, scale timeline, and rolling-key manager.
 *
 * Architecture: "effective state"
 *   SharedSettings holds user preferences only — the controller never writes
 *   to it. Ephemeral overrides (rolling-key current root, scale-lock from an
 *   exercise) live on the controller. Downstream consumers (ScaleManager,
 *   monitorState, drone, scaleTimeline, exercise) always read effective values
 *   so the system has a single source of truth and the settings subscriber is
 *   pure-react (no re-entrancy).
 *
 * All async drone ops are serialized through a single Promise queue so rapid
 * toggles can't race into ghost / missing oscillators.
 */

import { VocalMonitorState } from './VocalMonitorState.js';
import { VocalMonitorRenderer } from './VocalMonitorRenderer.js';
import { ExerciseEngine } from './ExerciseEngine.js';
import { createExercise } from './exercises/index.js';
import { ScaleTimeline } from './ScaleTimeline.js';
import { RollingKeyManager } from './RollingKeyManager.js';
import { FrequencyConverter } from '../../pitch-engine/index.js';
import { ROLLING_KEY_LOWS, ROLLING_KEY_HIGHS } from './rollingKeyOptions.js';

const LOWS_MIDI = ROLLING_KEY_LOWS.map((n) => FrequencyConverter.noteNameToMidi(n));
const HIGHS_MIDI = ROLLING_KEY_HIGHS.map((n) => FrequencyConverter.noteNameToMidi(n));
const ROLLING_FLOOR_MIDI = LOWS_MIDI[0];
const ROLLING_CEILING_MIDI = HIGHS_MIDI[HIGHS_MIDI.length - 1];

export class VocalMonitorController {
  constructor({ canvas, settings, scaleManager, pitchContext, droneManager, onStateChange }) {
    this.canvas = canvas;
    this.settings = settings;
    this.scaleManager = scaleManager;
    this.pitchContext = pitchContext;
    this.droneManager = droneManager;
    this.onStateChange = onStateChange ?? (() => {});

    this.renderer = null;
    this.monitorState = new VocalMonitorState();
    this.exerciseEngine = new ExerciseEngine();
    this.scaleTimeline = new ScaleTimeline();
    this.rollingKeyManager = new RollingKeyManager();
    this.exerciseDefinition = null;

    // Ephemeral overrides (null = use settings value)
    this._lockedScaleType = null;
    this._rollingRootNote = null;

    // Recording lifecycle
    this.isRecording = false;
    this.recordingStartTime = null;

    // Render-loop derived flags (cached so we only emit on change)
    this.animationId = null;
    this._lastJumpToFrontVisible = false;

    // Piano-key playback state
    this.pressedKey = null;
    this.currentToneOscillator = null;
    this.currentToneGain = null;
    this.isPianoPressed = false;

    // Drone serialization
    this._dronePending = Promise.resolve();

    // Subscriptions
    this._unsubscribePitch = null;
    this._unsubscribeSettings = null;
    this._cleanupCanvas = null;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Effective-state getters — single source of truth for downstream code
  // ──────────────────────────────────────────────────────────────────────

  get effectiveRootNote() {
    return this._rollingRootNote ?? this.settings.getRootNoteWithOctave();
  }

  get effectiveScaleType() {
    return this._lockedScaleType ?? this.settings.get('scaleType');
  }

  get scaleLocked() {
    return this._lockedScaleType !== null;
  }

  /**
   * The user's saved highest-root, clamped so that root + exercise.maxOffset
   * doesn't exceed the dropdown's overall ceiling. When exercise is off, just
   * returns the user's saved value (no clamp needed). The clamp is virtual —
   * settings are never overwritten, so flipping exercise off restores the
   * user's original choice.
   */
  get effectiveRollingKeyHighest() {
    const user = this.settings.get('rollingKeyHighestRoot') || 'G4';
    if (!this.settings.get('exerciseEnabled') || !this.exerciseDefinition) return user;
    const range = this._getExerciseRange();
    const userMidi = FrequencyConverter.noteNameToMidi(user);
    const target = ROLLING_CEILING_MIDI - range.max;
    if (userMidi <= target) return user;
    // Clamp to highest valid HIGHS option ≤ target (fall back to lowest if none fit)
    for (let i = HIGHS_MIDI.length - 1; i >= 0; i--) {
      if (HIGHS_MIDI[i] <= target) return ROLLING_KEY_HIGHS[i];
    }
    return ROLLING_KEY_HIGHS[0];
  }

  get effectiveRollingKeyLowest() {
    const user = this.settings.get('rollingKeyLowestRoot') || 'C3';
    if (!this.settings.get('exerciseEnabled') || !this.exerciseDefinition) return user;
    const range = this._getExerciseRange();
    const userMidi = FrequencyConverter.noteNameToMidi(user);
    const target = ROLLING_FLOOR_MIDI - range.min; // range.min is ≤0
    if (userMidi >= target) return user;
    for (let i = 0; i < LOWS_MIDI.length; i++) {
      if (LOWS_MIDI[i] >= target) return ROLLING_KEY_LOWS[i];
    }
    return ROLLING_KEY_LOWS[LOWS_MIDI.length - 1];
  }

  /**
   * Range of the active exercise's targets relative to the root, in semitones.
   * `max` is the highest note above the root any target reaches; `min` is the
   * lowest below (≤0). Probes by calling generatePhases with the live
   * scaleManager, so scale-bound exercises (major vs minor) get the right answer.
   */
  _getExerciseRange() {
    if (!this.exerciseDefinition) return { min: 0, max: 0 };
    let phases;
    try {
      phases = this.exerciseDefinition.generatePhases(this.scaleManager);
    } catch {
      return { min: 0, max: 0 };
    }
    const rootMidi = FrequencyConverter.noteNameToMidi(this.scaleManager.getRootNote());
    let min = 0;
    let max = 0;
    for (const phase of phases) {
      for (const target of phase.targets) {
        if (target.rest || target.midiNote == null) continue;
        const offset = target.midiNote - rootMidi;
        if (offset < min) min = offset;
        if (offset > max) max = offset;
      }
    }
    return { min, max };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────────────────

  async mount() {
    this.renderer = new VocalMonitorRenderer(this.canvas);
    await this.renderer.initialize();

    this.exerciseDefinition = createExercise(
      this.settings.get('exerciseType') || 'ascendingMajorLadder'
    );

    // Configure rolling key from settings (does NOT activate progression)
    this._configureRollingKey();

    // If an exercise is enabled and locks scale, apply lock now
    if (this.settings.get('exerciseEnabled')) {
      this._applyScaleLock();
    }

    // Push effective values into ScaleManager / monitorState
    const root = this.effectiveRootNote;
    const scale = this.effectiveScaleType;
    this.scaleManager.setRootNote(root);
    this.scaleManager.setScaleType(scale);
    this.scaleTimeline.setInitialKey(root, scale);
    this.monitorState.setScaleContext(root, scale);

    this.exerciseEngine.setOnCycleComplete(() => this._handleExerciseCycleComplete());

    this._unsubscribePitch = this.pitchContext.subscribe((pitch) => this._onPitch(pitch));
    this._unsubscribeSettings = this.settings.subscribe((key, value) =>
      this._onSettingChanged(key, value)
    );

    this._wireCanvasEvents();
    this._startRenderLoop();

    this._emitState();
  }

  async dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = null;

    if (this.isRecording) {
      // Tear down recording state synchronously, then await drone in queue
      this.exerciseEngine.clearExercise();
      this.pitchContext.stop();
      this.pitchContext.disableDroneCancellation?.();
      this.monitorState.stop();
      this.isRecording = false;
      this.recordingStartTime = null;
    }

    // Wait for any pending drone ops, then enqueue a final stop
    await this._enqueueDrone(() => this._droneOff());

    this._unsubscribePitch?.();
    this._unsubscribePitch = null;
    this._unsubscribeSettings?.();
    this._unsubscribeSettings = null;

    this._cleanupCanvas?.();
    this._cleanupCanvas = null;

    this.stopPianoKey();

    this.renderer?.dispose?.();
    this.renderer = null;
  }

  async start() {
    if (this.isRecording) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone API is unavailable in this browser.');
    }

    // Pre-flight: if exercise mode is enabled, reset rolling key + apply lock + sync
    const exerciseEnabled = this.settings.get('exerciseEnabled');
    if (exerciseEnabled && this.rollingKeyManager.isRolling()) {
      this.rollingKeyManager.reset();
      this._rollingRootNote = this.rollingKeyManager.getCurrentRootNote();
      this.scaleTimeline.clear();
      this.scaleTimeline.setInitialKey(this._rollingRootNote, this.effectiveScaleType);
    }
    if (exerciseEnabled) {
      this._applyScaleLock();
    }
    this._syncScale();

    await this.pitchContext.start();

    this.monitorState.start();
    this.isRecording = true;
    this.recordingStartTime = Date.now();

    // Drone — if already playing (toggled while stopped) just enable cancellation;
    // otherwise enqueue a fresh start.
    if (this.settings.get('droneEnabled')) {
      if (this.droneManager.getIsDronePlaying()) {
        this.pitchContext.enableDroneCancellation?.(this.scaleManager.getFrequency(0));
      } else {
        await this._enqueueDrone(() => this._droneOn());
      }
    }

    // Always start a fresh exercise (no resume from paused)
    if (exerciseEnabled) {
      this._startEngine();
    }

    this._emitState();
  }

  async stop() {
    if (!this.isRecording) return;

    this.exerciseEngine.clearExercise();
    this.pitchContext.stop();
    this.pitchContext.disableDroneCancellation?.();

    await this._enqueueDrone(() => this._droneOff());

    this.monitorState.stop();
    this.isRecording = false;
    this.recordingStartTime = null;
    this._emitState();
  }

  clear() {
    this.monitorState.clear();

    if (this.rollingKeyManager.isRolling()) {
      this.rollingKeyManager.reset();
      this._rollingRootNote = this.rollingKeyManager.getCurrentRootNote();
    }

    this.scaleTimeline.clear();
    this.scaleTimeline.setInitialKey(this.effectiveRootNote, this.effectiveScaleType);

    this.exerciseEngine.clearExercise();
    this._syncScale();
    this._emitState();
  }

  jumpToFront() {
    this.monitorState.jumpToFront();
  }

  /**
   * Restart the current practice: reset rolling-key to its starting root and
   * regenerate exercise targets from the beginning. Pitch history is preserved
   * (use clear() for that). No-op if neither exercise nor rolling-key is active.
   */
  restart() {
    const rolling = this.rollingKeyManager.isRolling();
    const exerciseOn = this.settings.get('exerciseEnabled');
    if (!rolling && !exerciseOn) return;

    if (rolling) {
      this.rollingKeyManager.reset();
      this._rollingRootNote = this.rollingKeyManager.getCurrentRootNote();
    }
    this._markKeyChange();
    this._syncScale();
    if (this.exerciseEngine.state !== 'idle') {
      this._startEngine();
    }
    this._emitState();
  }

  // ──────────────────────────────────────────────────────────────────────
  // Settings subscription — pure side-effects, NEVER writes back
  // ──────────────────────────────────────────────────────────────────────

  _onSettingChanged(key, value) {
    switch (key) {
      case 'rootNote':
        // User explicitly chose a new root — exit any rolling-key override
        this._rollingRootNote = null;
        this._markKeyChange();
        this._syncScale();
        this._restartExerciseIfActive();
        this._emitState();
        break;

      case 'scaleType':
        // Locked? Sidebar disables the select but defend anyway.
        if (this._lockedScaleType !== null) break;
        this._markKeyChange();
        this._syncScale();
        this._restartExerciseIfActive();
        this._emitState();
        break;

      case 'droneEnabled':
        this._enqueueDrone(() => (value ? this._droneOn() : this._droneOff()));
        break;

      case 'droneMode':
        this._enqueueDrone(() => this._droneSwitchMode());
        break;

      case 'exerciseEnabled':
        if (value) this._enableExercise();
        else this._disableExercise();
        break;

      case 'exerciseType':
        this.exerciseDefinition = createExercise(value);
        this._applyScaleLock();
        // New exercise may have a different reach → re-clamp rolling-key bounds
        this._configureRollingKey();
        this._restartExerciseIfActive();
        this._emitState();
        break;

      case 'rollingKeyEnabled':
        this.rollingKeyManager.configure({ mode: value ? 'rolling' : 'static' });
        if (value) {
          this.rollingKeyManager.reset();
          this._rollingRootNote = this.rollingKeyManager.getCurrentRootNote();
        } else {
          this._rollingRootNote = null;
        }
        this._markKeyChange();
        this._syncScale();
        this._restartExerciseIfActive();
        this._emitState();
        break;

      case 'rollingKeyLowestRoot':
        this.rollingKeyManager.configure({
          lowestRoot: FrequencyConverter.noteNameToMidi(value),
        });
        this._refreshRollingRoot();
        break;

      case 'rollingKeyHighestRoot':
        this.rollingKeyManager.configure({
          highestRoot: FrequencyConverter.noteNameToMidi(value),
        });
        this._refreshRollingRoot();
        break;

      case 'rollingKeyDirection':
        this.rollingKeyManager.configure({ direction: value });
        this._refreshRollingRoot();
        break;

      case 'rollingKeyStepType':
        this.rollingKeyManager.configure({ stepType: value });
        this._refreshRollingRoot();
        break;

      default:
        break;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Effective-state apply / sync
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Push effective root + scale into ScaleManager, monitor state context,
   * and the live drone frequency. Idempotent.
   */
  _syncScale() {
    const root = this.effectiveRootNote;
    const scale = this.effectiveScaleType;
    this.scaleManager.setRootNote(root);
    this.scaleManager.setScaleType(scale);
    this.monitorState.setScaleContext(root, scale);
    this._droneUpdateFrequency();
  }

  _applyScaleLock() {
    const required = this.exerciseDefinition?.locksScale?.()
      ? this.exerciseDefinition.getRequiredScaleType()
      : null;
    if (this._lockedScaleType === required) return;
    this._lockedScaleType = required;
    this._syncScale();
  }

  _releaseScaleLock() {
    if (this._lockedScaleType === null) return;
    this._lockedScaleType = null;
    this._syncScale();
  }

  _configureRollingKey() {
    this.rollingKeyManager.configure({
      mode: this.settings.get('rollingKeyEnabled') ? 'rolling' : 'static',
      lowestRoot: FrequencyConverter.noteNameToMidi(this.effectiveRollingKeyLowest),
      highestRoot: FrequencyConverter.noteNameToMidi(this.effectiveRollingKeyHighest),
      direction: this.settings.get('rollingKeyDirection') || 'ascending',
      stepType: this.settings.get('rollingKeyStepType') || 'semitone',
    });
    if (this.settings.get('rollingKeyEnabled')) {
      this.rollingKeyManager.reset();
      this._rollingRootNote = this.rollingKeyManager.getCurrentRootNote();
    }
  }

  /** Reset rolling-key progression after a range/direction/step change. */
  _refreshRollingRoot() {
    this.rollingKeyManager.reset();
    if (this.rollingKeyManager.isRolling()) {
      this._rollingRootNote = this.rollingKeyManager.getCurrentRootNote();
      this._markKeyChange();
      this._syncScale();
      this._restartExerciseIfActive();
      this._emitState();
    }
  }

  /**
   * Record a scale-timeline transition at the current playhead, so historical
   * trace stays rendered in its original key colors and only future trace uses
   * the new effective key. No-op if there's no current playhead (paused / cleared).
   */
  _markKeyChange() {
    if (this.monitorState.currentTime != null) {
      this.scaleTimeline.addKeyChange(
        this.monitorState.currentTime,
        this.effectiveRootNote,
        this.effectiveScaleType
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Exercise lifecycle
  // ──────────────────────────────────────────────────────────────────────

  _enableExercise() {
    this._applyScaleLock();
    // Effective rolling-key bounds depend on exerciseEnabled — reconfigure
    this._configureRollingKey();
    if (this.rollingKeyManager.isRolling()) {
      this.rollingKeyManager.reset();
      this._rollingRootNote = this.rollingKeyManager.getCurrentRootNote();
      this.scaleTimeline.clear();
      this.scaleTimeline.setInitialKey(this._rollingRootNote, this.effectiveScaleType);
    }
    this._syncScale();
    if (this.isRecording && this.exerciseEngine.state === 'idle') {
      this._startEngine();
    }
    this._emitState();
  }

  _disableExercise() {
    this.exerciseEngine.clearExercise();
    this._releaseScaleLock();
    // Bounds revert to user's saved values — reconfigure
    this._configureRollingKey();
    this._emitState();
  }

  _restartExerciseIfActive() {
    if (this.exerciseEngine.state === 'idle') return;
    this._startEngine();
  }

  _startEngine() {
    if (!this.exerciseDefinition) return;
    const sustain = this.exerciseDefinition.sustainDuration || 200;
    this.exerciseEngine.startExercise(
      this.exerciseDefinition,
      this.scaleManager,
      sustain,
      this.monitorState.currentTime
    );
  }

  _handleExerciseCycleComplete() {
    if (!this.rollingKeyManager.isRolling()) return;

    const advanced = this.rollingKeyManager.advanceToNextKey();
    if (!advanced) return;

    this._rollingRootNote = this.rollingKeyManager.getCurrentRootNote();
    this._markKeyChange();
    this._syncScale();
    this._restartExerciseIfActive();
    this._emitState();
  }

  // ──────────────────────────────────────────────────────────────────────
  // Drone — all async ops serialized through _dronePending
  // ──────────────────────────────────────────────────────────────────────

  _enqueueDrone(op) {
    const next = this._dronePending.then(op, op).catch((err) => {
      console.error('Drone op failed:', err);
    });
    this._dronePending = next;
    return next;
  }

  async _droneOn() {
    if (this.droneManager.getIsDronePlaying()) {
      // Already playing — enable cancellation if recording
      if (this.isRecording) {
        this.pitchContext.enableDroneCancellation?.(this.scaleManager.getFrequency(0));
      }
      return;
    }
    const frequency = this.scaleManager.getFrequency(0);
    if (this.settings.get('droneMode') === 'chord') {
      const chordType = this.effectiveScaleType.includes('minor') ? 'minor' : 'major';
      await this.droneManager.startChordDrone(frequency, chordType);
    } else {
      await this.droneManager.startDrone(frequency);
    }
    if (this.isRecording) {
      this.pitchContext.enableDroneCancellation?.(frequency);
    }
  }

  async _droneOff() {
    if (!this.droneManager.getIsDronePlaying()) return;
    if (this.droneManager.isInChordMode()) {
      await this.droneManager.stopChordDrone();
    } else {
      await this.droneManager.stopDrone();
    }
    this.pitchContext.disableDroneCancellation?.();
  }

  async _droneSwitchMode() {
    if (!this.droneManager.getIsDronePlaying()) return;
    const frequency = this.scaleManager.getFrequency(0);
    if (this.settings.get('droneMode') === 'chord') {
      const chordType = this.effectiveScaleType.includes('minor') ? 'minor' : 'major';
      await this.droneManager.switchToChordDrone(frequency, chordType);
    } else {
      await this.droneManager.switchToRootDrone(frequency);
    }
  }

  /** Synchronous drone-frequency update; only acts if drone is playing. */
  _droneUpdateFrequency() {
    if (!this.droneManager.getIsDronePlaying()) return;
    const frequency = this.scaleManager.getFrequency(0);
    if (this.droneManager.isInChordMode()) {
      const chordType = this.effectiveScaleType.includes('minor') ? 'minor' : 'major';
      this.droneManager.updateChordDroneFrequency(frequency, chordType);
    } else {
      this.droneManager.updateDroneFrequency(frequency);
    }
    if (this.isRecording) {
      this.pitchContext.enableDroneCancellation?.(frequency);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Pitch ingestion + render loop
  // ──────────────────────────────────────────────────────────────────────

  _onPitch(pitchData) {
    this.monitorState.onPitchDetected(pitchData);
    if (this.exerciseEngine.state === 'active' && this.monitorState.currentTime != null) {
      this.exerciseEngine.processFrame(this.monitorState.currentPitch, this.monitorState.currentTime);
    }
  }

  _startRenderLoop() {
    const loop = () => {
      this._renderFrame();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  _renderFrame() {
    if (!this.renderer) return;
    const state = this.monitorState.getState();
    const exerciseState =
      this.exerciseEngine.state !== 'idle' ? this.exerciseEngine.getState() : null;
    const showLyrics = this.settings.get('exerciseShowLyrics');
    this.renderer.render(
      state,
      this.scaleManager,
      this.pressedKey,
      exerciseState,
      showLyrics,
      this.scaleTimeline
    );

    const jumpVisible = state.isRecording && !state.isAutoScrolling;
    if (jumpVisible !== this._lastJumpToFrontVisible) {
      this._lastJumpToFrontVisible = jumpVisible;
      this._emitState();
    }
  }

  _emitState() {
    const exerciseEnabled = this.settings.get('exerciseEnabled');
    this.onStateChange({
      isRecording: this.isRecording,
      jumpToFrontVisible: this._lastJumpToFrontVisible,
      scaleLocked: this.scaleLocked,
      lockedScaleType: this._lockedScaleType,
      effectiveRootName: stripOctave(this.effectiveRootNote),
      isRollingKeyActive: this.rollingKeyManager.isRolling(),
      exerciseRange: exerciseEnabled ? this._getExerciseRange() : null,
      effectiveRollingKeyLowest: this.effectiveRollingKeyLowest,
      effectiveRollingKeyHighest: this.effectiveRollingKeyHighest,
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Canvas pointer interactions
  // ──────────────────────────────────────────────────────────────────────

  _wireCanvasEvents() {
    const canvas = this.canvas;
    const keyboardWidth = this.renderer.getKeyboardWidth();

    let isDragging = false;
    let lastX = 0;

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x <= keyboardWidth) {
        canvas.style.cursor = 'pointer';
        if (this.isPianoPressed) {
          const state = this.monitorState.getState();
          const midi = Math.floor(
            this._yToMidi(y, rect.height, state.pitchRangeMin, state.pitchRangeMax)
          );
          if (
            midi >= state.pitchRangeMin &&
            midi < state.pitchRangeMax &&
            midi !== this.pressedKey
          ) {
            this.glideToPianoKey(midi);
          }
        }
      } else {
        canvas.style.cursor = isDragging ? 'grabbing' : this.pressedKey ? 'default' : 'grab';
      }
    };

    const onMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x <= keyboardWidth) {
        const state = this.monitorState.getState();
        const midi = Math.floor(
          this._yToMidi(y, rect.height, state.pitchRangeMin, state.pitchRangeMax)
        );
        if (midi >= state.pitchRangeMin && midi < state.pitchRangeMax) {
          this.isPianoPressed = true;
          this.startPianoKey(midi);
        }
      } else {
        isDragging = true;
        lastX = e.clientX;
        canvas.style.cursor = 'grabbing';
      }
    };

    const onWindowMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - lastX;
      lastX = e.clientX;
      const dims = this.renderer.getDimensions();
      const timeDelta =
        -deltaX * (this.monitorState.viewportWidth / (dims.width - keyboardWidth));
      this.monitorState.scrollViewport(timeDelta);
    };

    const onWindowMouseUp = () => {
      this.isPianoPressed = false;
      this.stopPianoKey();
      if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'default';
      }
    };

    const onMouseLeave = () => {
      this.isPianoPressed = false;
      this.stopPianoKey();
    };

    const onWheel = (e) => {
      e.preventDefault();
      const timeDelta = (e.deltaX !== 0 ? e.deltaX : e.deltaY) * 5;
      this.monitorState.scrollViewport(timeDelta);
    };

    const onTouchStart = (e) => {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      if (x <= keyboardWidth) {
        e.preventDefault();
        const state = this.monitorState.getState();
        const midi = Math.floor(
          this._yToMidi(y, rect.height, state.pitchRangeMin, state.pitchRangeMax)
        );
        if (midi >= state.pitchRangeMin && midi < state.pitchRangeMax) {
          this.isPianoPressed = true;
          this.startPianoKey(midi);
        }
      } else if (e.touches.length === 1) {
        isDragging = true;
        lastX = t.clientX;
      }
    };

    const onTouchMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      if (this.isPianoPressed && x <= keyboardWidth) {
        e.preventDefault();
        const state = this.monitorState.getState();
        const midi = Math.floor(
          this._yToMidi(y, rect.height, state.pitchRangeMin, state.pitchRangeMax)
        );
        if (
          midi >= state.pitchRangeMin &&
          midi < state.pitchRangeMax &&
          midi !== this.pressedKey
        ) {
          this.glideToPianoKey(midi);
        }
      } else if (isDragging && e.touches.length === 1) {
        const deltaX = t.clientX - lastX;
        lastX = t.clientX;
        const dims = this.renderer.getDimensions();
        const timeDelta =
          -deltaX * (this.monitorState.viewportWidth / (dims.width - keyboardWidth));
        this.monitorState.scrollViewport(timeDelta);
      }
    };

    const onTouchEnd = () => {
      this.isPianoPressed = false;
      this.stopPianoKey();
      isDragging = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    this._cleanupCanvas = () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }

  _yToMidi(y, height, pitchMin, pitchMax) {
    const range = pitchMax - pitchMin;
    return pitchMin + (1 - y / height) * range;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Piano keyboard tone playback (shares TonePlayer's audio context)
  // ──────────────────────────────────────────────────────────────────────

  startPianoKey(midiNote) {
    this.stopPianoKey();
    this.pressedKey = midiNote;
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    this.droneManager.tonePlayer.initialize();
    const ctx = this.droneManager.tonePlayer.audioContext;

    this.currentToneOscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    this.currentToneOscillator.type = 'triangle';
    this.currentToneOscillator.frequency.value = frequency;

    const attackTime = 0.02;
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + attackTime);

    this.currentToneOscillator.connect(gainNode);
    gainNode.connect(this.droneManager.tonePlayer.masterGain);
    this.currentToneOscillator.start();
    this.currentToneGain = gainNode;
  }

  stopPianoKey() {
    if (this.currentToneOscillator && this.currentToneGain) {
      const ctx = this.droneManager.tonePlayer.audioContext;
      const osc = this.currentToneOscillator;
      const gain = this.currentToneGain;

      const releaseTime = 0.03;
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
      osc.stop(now + releaseTime + 0.01);

      this.currentToneOscillator = null;
      this.currentToneGain = null;
    }
    this.pressedKey = null;
  }

  glideToPianoKey(midiNote) {
    if (!this.currentToneOscillator) {
      this.startPianoKey(midiNote);
      return;
    }
    const ctx = this.droneManager.tonePlayer.audioContext;
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const glideTime = 0.05;
    this.currentToneOscillator.frequency.cancelScheduledValues(ctx.currentTime);
    this.currentToneOscillator.frequency.setValueAtTime(
      this.currentToneOscillator.frequency.value,
      ctx.currentTime
    );
    this.currentToneOscillator.frequency.linearRampToValueAtTime(
      frequency,
      ctx.currentTime + glideTime
    );
    this.pressedKey = midiNote;
  }
}

function stripOctave(noteWithOctave) {
  return noteWithOctave?.replace(/\d+$/, '') ?? '';
}
