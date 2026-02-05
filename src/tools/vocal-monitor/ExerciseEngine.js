/**
 * ExerciseEngine - Core state machine and hit detection for exercise mode.
 * Pure logic, no rendering, no DOM — fully testable.
 *
 * State machine: IDLE → ACTIVE (per-target: WAITING → SUSTAINING → HIT) → COMPLETE → loops
 */

import { FrequencyConverter } from '../../pitch-engine/index.js';

// Engine states
export const EngineState = {
  IDLE: 'idle',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETE: 'complete',
};

// Target states
export const TargetState = {
  WAITING: 'waiting',
  SUSTAINING: 'sustaining',
  HIT: 'hit',
};

export class ExerciseEngine {
  constructor() {
    this.state = EngineState.IDLE;
    this.definition = null;
    this.scaleManager = null;
    this.sustainDuration = 800; // ms required to sustain

    // Phase tracking
    this.phases = [];
    this.currentPhaseIndex = 0;
    this.currentTargetIndex = 0;

    // Sustain tracking
    this.sustainAccumulated = 0;
    this.lastMatchTime = null;
    this.gracePeriod = 150; // ms grace for detection dropouts

    // Timing
    this.targetHitTime = null;
    this.targetGap = 300; // ms between targets
    this.phaseGap = 1000; // ms between phases

    // Hit effects tracking
    this.hitEffects = []; // { midiNote, time, x, y }

    // Archived hit targets from previous phases/restarts (persists across key changes)
    this.hitHistory = [];

    // Cents tolerance for matching
    this.centsTolerance = 80;

    // Rest tracking (for rest targets between ladders)
    this._restStartTime = null;

    // Callbacks
    this.onCycleComplete = null; // Called when full exercise cycle completes
  }

  /**
   * Start an exercise
   * @param {object} definition - Exercise definition with generatePhases method
   * @param {ScaleManager} scaleManager - Current scale manager
   * @param {number} sustainDuration - Duration to sustain in ms
   * @param {number|null} startTime - Exercise start time for timeline sync (optional)
   */
  startExercise(definition, scaleManager, sustainDuration = 800, startTime = null) {
    // Archive any hit targets from current phases before replacing them
    this._archiveHitTargets();

    this.definition = definition;
    this.scaleManager = scaleManager;
    this.sustainDuration = sustainDuration;

    // Store exercise start time for relative calculations
    this.exerciseStartTime = startTime ?? 0;

    this.phases = definition.generatePhases(scaleManager);
    this.currentPhaseIndex = 0;
    this.currentTargetIndex = 0;
    this.sustainAccumulated = 0;
    this.lastMatchTime = null;
    this.targetHitTime = null;
    this._restStartTime = null;

    this.hitEffects = [];
    this.state = EngineState.ACTIVE;
  }

  /**
   * Stop/pause the exercise (preserves hit targets for review, restarts from beginning)
   */
  stopExercise() {
    if (this.state === EngineState.ACTIVE) {
      this.state = EngineState.PAUSED;
    }

    // Reset to beginning but keep hit targets for review
    this.currentPhaseIndex = 0;
    this.currentTargetIndex = 0;
    this.sustainAccumulated = 0;
    this.lastMatchTime = null;
    this.targetHitTime = null;

    // Reset non-hit targets back to WAITING (clears pending targets)
    // but preserve HIT targets with their data
    this._resetPendingTargets();
  }

  /**
   * Reset only non-hit targets to WAITING (keeps hit targets for review)
   */
  _resetPendingTargets() {
    for (const phase of this.phases) {
      for (const target of phase.targets) {
        if (target.state !== TargetState.HIT) {
          target.state = TargetState.WAITING;
        }
      }
    }
  }

  /**
   * Resume a paused exercise
   */
  resumeExercise() {
    if (this.state === EngineState.PAUSED && this.phases.length > 0) {
      this.state = EngineState.ACTIVE;
    }
  }

  /**
   * Clear/reset the exercise completely
   */
  clearExercise() {
    this.state = EngineState.IDLE;
    this.phases = [];
    this.currentPhaseIndex = 0;
    this.currentTargetIndex = 0;
    this.sustainAccumulated = 0;
    this.lastMatchTime = null;
    this.targetHitTime = null;
    this._restStartTime = null;

    this.hitEffects = [];
    this.hitHistory = [];
    this.definition = null;
  }

  /**
   * Process a single pitch frame (~30Hz)
   * @param {object} pitchData - { frequency, midiNote, confidence }
   * @param {number} currentTime - Elapsed time in ms
   */
  processFrame(pitchData, currentTime) {
    if (this.state !== EngineState.ACTIVE) return;

    const phase = this.phases[this.currentPhaseIndex];
    if (!phase) return;

    const target = phase.targets[this.currentTargetIndex];
    if (!target) return;

    // Handle rest targets — auto-advance after rest duration
    if (target.rest) {
      if (this._restStartTime == null) {
        this._restStartTime = currentTime;
      }
      if (currentTime - this._restStartTime >= (target.restDuration || 500)) {
        this._restStartTime = null;
        this.advanceTarget(currentTime);
      }
      return;
    }

    // If we just hit a target, wait for the gap before next target
    if (this.targetHitTime !== null) {
      const isLastTarget = this.currentTargetIndex >= phase.targets.length - 1;
      const gap = isLastTarget ? this.phaseGap : this.targetGap;

      if (currentTime - this.targetHitTime >= gap) {
        this.targetHitTime = null;
        this.advanceTarget(currentTime);
      }
      return;
    }

    // Check if pitch matches target
    if (!pitchData || !pitchData.frequency) {
      // No pitch detected - check grace period
      this._handleNoPitch(currentTime);
      return;
    }

    const isMatch = this._isPitchMatch(pitchData, target);

    if (isMatch) {
      // Mark target as sustaining
      target.state = TargetState.SUSTAINING;
      this.lastMatchTime = currentTime;

      // Accumulate sustain time (~33ms per frame at 30Hz)
      const frameDuration = 33;
      this.sustainAccumulated += frameDuration;

      // Check if sustained long enough
      if (this.sustainAccumulated >= this.sustainDuration) {
        this._hitTarget(target, currentTime, pitchData);
      }
    } else {
      // Wrong pitch - check grace period
      this._handleNoPitch(currentTime);
    }

    if (window.__exerciseDebug) {
      const debugTarget = phase.targets[this.currentTargetIndex];
      console.log('[ExerciseEngine]', {
        time: currentTime,
        match: isMatch,
        sustain: this.sustainAccumulated,
        pct: Math.round((this.sustainAccumulated / this.sustainDuration) * 100) + '%',
        targetMidi: debugTarget?.midiNote,
        detectedMidi: pitchData?.frequency ? FrequencyConverter.frequencyToMidi(pitchData.frequency).toFixed(2) : null,
      });
    }
  }

  /**
   * Handle no pitch or wrong pitch - apply grace period
   */
  _handleNoPitch(currentTime) {
    if (this.lastMatchTime !== null) {
      const elapsed = currentTime - this.lastMatchTime;
      if (elapsed > this.gracePeriod) {
        // Decay sustain instead of hard reset
        this.sustainAccumulated = Math.max(0, this.sustainAccumulated - this.gracePeriod);
        this.lastMatchTime = null;

        // Only reset target to WAITING if sustain fully decayed
        if (this.sustainAccumulated === 0) {
          const phase = this.phases[this.currentPhaseIndex];
          if (phase) {
            const target = phase.targets[this.currentTargetIndex];
            if (target && target.state === TargetState.SUSTAINING) {
              target.state = TargetState.WAITING;
            }
          }
        }
      }
    }
  }

  /**
   * Check if detected pitch matches the target (octave-aware)
   * Compares actual MIDI notes including octave - the pitch line must
   * visually hit the target note on the piano roll
   * @param {object} pitchData - { frequency, midiNote }
   * @param {object} target - { midiNote }
   * @returns {boolean}
   */
  _isPitchMatch(pitchData, target) {
    // Get fractional MIDI from frequency for accurate comparison
    const detectedMidi = FrequencyConverter.frequencyToMidi(pitchData.frequency);

    // Compare full MIDI notes (octave-aware)
    // The pitch line must be at the same position as the target on piano roll
    const diff = Math.abs(detectedMidi - target.midiNote);

    // Match if within tolerance (0.5 semitones = 50 cents)
    const tolerance = this.centsTolerance / 100; // Convert cents to semitones
    return diff <= tolerance;
  }

  /**
   * Mark current target as hit
   */
  _hitTarget(target, currentTime, pitchData) {
    target.state = TargetState.HIT;
    target.hitTime = currentTime;
    target.hitFrequency = pitchData?.frequency;
    target.hitAnimationStart = currentTime;
    this.targetHitTime = currentTime;
    this.sustainAccumulated = 0;
    this.lastMatchTime = null;

    // Add hit effect for particles
    this.hitEffects.push({
      midiNote: target.midiNote,
      time: currentTime,
      label: target.label,
    });

    // Keep only recent effects (last 3 seconds)
    this.hitEffects = this.hitEffects.filter(e => currentTime - e.time < 3000);
  }

  /**
   * Advance to next target
   */
  advanceTarget() {
    const phase = this.phases[this.currentPhaseIndex];
    if (!phase) return;

    this.currentTargetIndex++;
    this.sustainAccumulated = 0;
    this.lastMatchTime = null;

    if (this.currentTargetIndex >= phase.targets.length) {
      // Phase complete — advance immediately (gap was already applied via targetHitTime)
      this.advancePhase();
    }
  }

  /**
   * Advance to next phase
   */
  advancePhase() {
    this.currentPhaseIndex++;
    this.currentTargetIndex = 0;
    this.sustainAccumulated = 0;
    this.lastMatchTime = null;

    if (this.currentPhaseIndex >= this.phases.length) {
      // All phases complete — notify callback before looping
      this.state = EngineState.COMPLETE;

      // Fire cycle complete callback (for rolling key advancement)
      if (this.onCycleComplete) {
        this.onCycleComplete();
      }

      // If the callback already restarted the exercise (e.g., rolling key
      // called startExercise with new phases), skip the loop-back reset.
      if (this.state !== EngineState.COMPLETE) return;

      // Archive hit targets before looping
      this._archiveHitTargets();

      // Loop back and reset all target states
      this.currentPhaseIndex = 0;
      this.currentTargetIndex = 0;
      this._resetAllTargetStates();
      this.state = EngineState.ACTIVE;
    }
  }

  /**
   * Set the cycle completion callback
   * @param {Function} callback - Called when full exercise cycle completes
   */
  setOnCycleComplete(callback) {
    this.onCycleComplete = callback;
  }

  /**
   * Archive HIT targets from current phases into hitHistory
   */
  _archiveHitTargets() {
    for (const phase of this.phases) {
      for (const target of phase.targets) {
        if (target.state === TargetState.HIT && target.hitTime != null) {
          this.hitHistory.push({ ...target });
        }
      }
    }
  }

  /**
   * Reset all target states to WAITING (used when looping)
   */
  _resetAllTargetStates() {
    for (const phase of this.phases) {
      for (const target of phase.targets) {
        target.state = TargetState.WAITING;
        target.hitTime = null;
        target.hitFrequency = null;
        target.hitAnimationStart = null;
      }
    }
  }

  /**
   * Get the current target
   * @returns {object|null}
   */
  getCurrentTarget() {
    // Return target when ACTIVE or PAUSED (for review)
    if (this.state === EngineState.IDLE) return null;
    const phase = this.phases[this.currentPhaseIndex];
    if (!phase) return null;
    return phase.targets[this.currentTargetIndex] || null;
  }

  /**
   * Get the current phase
   * @returns {object|null}
   */
  getCurrentPhase() {
    // Return phase when ACTIVE or PAUSED (for review)
    if (this.state === EngineState.IDLE) return null;
    return this.phases[this.currentPhaseIndex] || null;
  }

  /**
   * Get overall progress
   * @returns {object} { phaseIndex, phaseCount, targetIndex, targetCount, overallFraction }
   */
  getProgress() {
    const phaseCount = this.phases.length;
    const phase = this.phases[this.currentPhaseIndex];
    const targetCount = phase ? phase.targets.length : 0;

    // Calculate overall fraction
    let completedTargets = 0;
    let totalTargets = 0;
    for (let i = 0; i < this.phases.length; i++) {
      const p = this.phases[i];
      totalTargets += p.targets.length;
      if (i < this.currentPhaseIndex) {
        completedTargets += p.targets.length;
      } else if (i === this.currentPhaseIndex) {
        completedTargets += this.currentTargetIndex;
      }
    }

    return {
      phaseIndex: this.currentPhaseIndex,
      phaseCount,
      targetIndex: this.currentTargetIndex,
      targetCount,
      overallFraction: totalTargets > 0 ? completedTargets / totalTargets : 0,
    };
  }

  /**
   * Get full state snapshot for rendering
   * @returns {object}
   */
  getState() {
    return {
      engineState: this.state,
      phases: this.phases,
      currentPhaseIndex: this.currentPhaseIndex,
      currentTargetIndex: this.currentTargetIndex,
      sustainAccumulated: this.sustainAccumulated,
      sustainDuration: this.sustainDuration,
      sustainFraction: this.sustainDuration > 0
        ? Math.min(1, this.sustainAccumulated / this.sustainDuration)
        : 0,
      progress: this.getProgress(),
      currentTarget: this.getCurrentTarget(),
      currentPhase: this.getCurrentPhase(),
      hitEffects: this.hitEffects,
      hitHistory: this.hitHistory,
      isWaitingGap: this.targetHitTime !== null,
    };
  }
}
