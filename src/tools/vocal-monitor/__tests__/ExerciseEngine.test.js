import { describe, it, expect, beforeEach } from 'vitest';
import { ExerciseEngine, EngineState, TargetState } from '../ExerciseEngine.js';
import { ScaleDegreePatternExercise } from '../exercises/ScaleDegreePatternExercise.js';
import { ScaleManager } from '../../../core/ScaleManager.js';
import { FrequencyConverter } from '../../../pitch-engine/FrequencyConverter.js';

describe('ExerciseEngine', () => {
  let engine;
  let scaleManager;
  let exercise;

  beforeEach(() => {
    engine = new ExerciseEngine();
    scaleManager = new ScaleManager('C4', 'major');
    exercise = new ScaleDegreePatternExercise();
  });

  describe('ScaleDegreePatternExercise - Generation', () => {
    it('should generate correct ladder patterns', () => {
      expect(ScaleDegreePatternExercise.generateLadderPattern(1)).toEqual([0]);
      expect(ScaleDegreePatternExercise.generateLadderPattern(2)).toEqual([0, 1, 0]);
      expect(ScaleDegreePatternExercise.generateLadderPattern(3)).toEqual([0, 1, 2, 1, 0]);
      expect(ScaleDegreePatternExercise.generateLadderPattern(4)).toEqual([0, 1, 2, 3, 2, 1, 0]);
      expect(ScaleDegreePatternExercise.generateLadderPattern(8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0]);
    });

    it('should generate single phase with all targets', () => {
      const phases = exercise.generatePhases(scaleManager);
      expect(phases.length).toBe(1);
    });

    it('should generate correct total targets (sum of all ladders)', () => {
      const phases = exercise.generatePhases(scaleManager);
      // Ladder 1: 1, Ladder 2: 3, Ladder 3: 5, Ladder 4: 7, Ladder 5: 9, Ladder 6: 11, Ladder 7: 13, Ladder 8: 15
      // Total = 1 + 3 + 5 + 7 + 9 + 11 + 13 + 15 = 64
      expect(phases[0].targets.length).toBe(64);
    });

    it('should set correct MIDI notes for C major', () => {
      const phases = exercise.generatePhases(scaleManager);
      const targets = phases[0].targets;
      // First ladder: just C4
      expect(targets[0].midiNote).toBe(60); // C4
      // Second ladder starts at index 1: C4, D4, C4
      expect(targets[1].midiNote).toBe(60); // C4
      expect(targets[2].midiNote).toBe(62); // D4
      expect(targets[3].midiNote).toBe(60); // C4
    });

    it('should set correct solfege labels', () => {
      const phases = exercise.generatePhases(scaleManager);
      const targets = phases[0].targets;
      expect(targets[0].label).toBe('Do');
      expect(targets[1].label).toBe('Do');
      expect(targets[2].label).toBe('Re');
      expect(targets[3].label).toBe('Do');
    });

    it('should track ladder number for each target', () => {
      const phases = exercise.generatePhases(scaleManager);
      const targets = phases[0].targets;
      expect(targets[0].ladder).toBe(1); // First ladder
      expect(targets[1].ladder).toBe(2); // Second ladder starts
      expect(targets[4].ladder).toBe(3); // Third ladder starts at index 4
    });

    it('should initialize all targets in WAITING state', () => {
      const phases = exercise.generatePhases(scaleManager);
      for (const target of phases[0].targets) {
        expect(target.state).toBe(TargetState.WAITING);
      }
    });

    it('should respect scale with fewer degrees', () => {
      // Pentatonic has 6 degrees (5 + octave)
      const pentatonicManager = new ScaleManager('C4', 'pentatonic');
      const phases = exercise.generatePhases(pentatonicManager);
      expect(phases.length).toBe(1);
      // 6 ladders: 1 + 3 + 5 + 7 + 9 + 11 = 36 targets
      expect(phases[0].targets.length).toBe(36);
    });
  });

  describe('Exercise lifecycle', () => {
    it('should start in IDLE state', () => {
      expect(engine.getState().engineState).toBe(EngineState.IDLE);
    });

    it('should transition to ACTIVE on startExercise', () => {
      engine.startExercise(exercise, scaleManager, 800);
      expect(engine.getState().engineState).toBe(EngineState.ACTIVE);
    });

    it('should transition to PAUSED on stopExercise (preserves targets)', () => {
      engine.startExercise(exercise, scaleManager, 800);
      engine.stopExercise();
      expect(engine.getState().engineState).toBe(EngineState.PAUSED);
      // Phases are preserved for review
      expect(engine.getState().phases.length).toBe(1);
    });

    it('should resume from PAUSED state', () => {
      engine.startExercise(exercise, scaleManager, 800);
      engine.stopExercise();
      expect(engine.getState().engineState).toBe(EngineState.PAUSED);
      engine.resumeExercise();
      expect(engine.getState().engineState).toBe(EngineState.ACTIVE);
    });

    it('should return currentPhase when PAUSED (for review)', () => {
      engine.startExercise(exercise, scaleManager, 800);
      const phaseWhenActive = engine.getCurrentPhase();
      expect(phaseWhenActive).not.toBeNull();

      engine.stopExercise();
      expect(engine.getState().engineState).toBe(EngineState.PAUSED);

      const phaseWhenPaused = engine.getCurrentPhase();
      expect(phaseWhenPaused).not.toBeNull();
      expect(phaseWhenPaused.targets.length).toBe(64);
    });

    it('should return currentTarget when PAUSED (for review)', () => {
      engine.startExercise(exercise, scaleManager, 800);
      const targetWhenActive = engine.getCurrentTarget();
      expect(targetWhenActive).not.toBeNull();

      engine.stopExercise();
      expect(engine.getState().engineState).toBe(EngineState.PAUSED);

      const targetWhenPaused = engine.getCurrentTarget();
      expect(targetWhenPaused).not.toBeNull();
      expect(targetWhenPaused.midiNote).toBe(60); // C4
    });

    it('should preserve hit targets when PAUSED but restart exercise', () => {
      engine.startExercise(exercise, scaleManager, 100);

      // Hit the first target
      const pitchData = { frequency: 261.63, midiNote: 60 };
      for (let t = 0; t < 5; t++) {
        engine.processFrame(pitchData, t * 33);
      }

      const phase = engine.getCurrentPhase();
      expect(phase.targets[0].state).toBe(TargetState.HIT);
      expect(phase.targets[0].hitFrequency).toBe(261.63);

      // Pause
      engine.stopExercise();
      expect(engine.getState().engineState).toBe(EngineState.PAUSED);

      // Hit target data should still be accessible
      const pausedPhase = engine.getCurrentPhase();
      expect(pausedPhase.targets[0].state).toBe(TargetState.HIT);
      expect(pausedPhase.targets[0].hitFrequency).toBe(261.63);
      expect(pausedPhase.targets[0].hitTime).not.toBeNull();

      // Exercise should restart from beginning
      expect(engine.getState().currentTargetIndex).toBe(0);
      expect(engine.getState().currentPhaseIndex).toBe(0);
    });

    it('should reset pending targets to WAITING on stop', () => {
      engine.startExercise(exercise, scaleManager, 100);

      // Advance to target index 2 (hitting first two targets)
      const pitchData = { frequency: 261.63, midiNote: 60 };
      for (let t = 0; t < 5; t++) {
        engine.processFrame(pitchData, t * 33);
      }
      // First target is now HIT

      // Stop exercise
      engine.stopExercise();

      const phase = engine.getCurrentPhase();
      // First target should remain HIT
      expect(phase.targets[0].state).toBe(TargetState.HIT);
      // Second target (which was pending) should be WAITING
      expect(phase.targets[1].state).toBe(TargetState.WAITING);
    });

    it('should reset all state on clearExercise', () => {
      engine.startExercise(exercise, scaleManager, 800);
      engine.clearExercise();
      const state = engine.getState();
      expect(state.engineState).toBe(EngineState.IDLE);
      expect(state.phases).toEqual([]);
      expect(state.currentPhaseIndex).toBe(0);
      expect(state.currentTargetIndex).toBe(0);
      expect(state.sustainAccumulated).toBe(0);
    });
  });

  describe('Hit detection', () => {
    beforeEach(() => {
      engine.startExercise(exercise, scaleManager, 100); // Short sustain for testing
    });

    it('should detect matching pitch (same octave)', () => {
      const target = engine.getCurrentTarget();
      expect(target.midiNote).toBe(60); // C4

      const pitchData = { frequency: 261.63, midiNote: 60 };
      engine.processFrame(pitchData, 0);

      expect(target.state).toBe(TargetState.SUSTAINING);
      expect(engine.getState().sustainAccumulated).toBeGreaterThan(0);
    });

    it('should reject pitch in wrong octave (octave-aware)', () => {
      const target = engine.getCurrentTarget();
      expect(target.midiNote).toBe(60); // C4

      // Sing C5 (MIDI 72) — same pitch class but wrong octave
      const pitchData = { frequency: 523.25, midiNote: 72 };
      engine.processFrame(pitchData, 0);

      // Should NOT match because we need the exact octave
      expect(target.state).toBe(TargetState.WAITING);
    });

    it('should reject pitch one octave below (octave-aware)', () => {
      const target = engine.getCurrentTarget();
      expect(target.midiNote).toBe(60); // C4

      // Sing C3 (MIDI 48) — same pitch class but wrong octave
      const pitchData = { frequency: 130.81, midiNote: 48 };
      engine.processFrame(pitchData, 0);

      // Should NOT match because we need the exact octave
      expect(target.state).toBe(TargetState.WAITING);
    });

    it('should reject non-matching pitch', () => {
      const target = engine.getCurrentTarget();

      // Sing D4 (MIDI 62) when target is C4 (MIDI 60)
      const pitchData = { frequency: 293.66, midiNote: 62 };
      engine.processFrame(pitchData, 0);

      expect(target.state).toBe(TargetState.WAITING);
      expect(engine.getState().sustainAccumulated).toBe(0);
    });

    it('should reject pitch outside cents tolerance', () => {
      const target = engine.getCurrentTarget();

      // Frequency far from C4 — ~113 cents sharp, outside 80-cent tolerance
      // C4 = 261.63 Hz, 280 Hz ≈ 113 cents sharp
      const pitchData = { frequency: 280.0, midiNote: 61.13 };
      engine.processFrame(pitchData, 0);

      expect(target.state).toBe(TargetState.WAITING);
    });

    it('should accumulate sustain and mark hit', () => {
      const target = engine.getCurrentTarget();
      const pitchData = { frequency: 261.63, midiNote: 60 };

      // Process enough frames to exceed sustain duration (100ms, ~33ms per frame → 4 frames)
      for (let t = 0; t < 4; t++) {
        engine.processFrame(pitchData, t * 33);
      }

      expect(target.state).toBe(TargetState.HIT);
    });
  });

  describe('Grace period', () => {
    beforeEach(() => {
      engine.startExercise(exercise, scaleManager, 200);
    });

    it('should not reset sustain during grace period', () => {
      const pitchData = { frequency: 261.63, midiNote: 60 };

      // Build up some sustain
      engine.processFrame(pitchData, 0);
      engine.processFrame(pitchData, 33);
      const sustainAfterMatch = engine.getState().sustainAccumulated;

      // Brief gap within grace period (150ms)
      engine.processFrame(null, 100); // no pitch, 67ms after last match

      // Sustain should NOT be reset
      expect(engine.getState().sustainAccumulated).toBe(sustainAfterMatch);
    });

    it('should fully decay small sustain after grace period expires', () => {
      const pitchData = { frequency: 261.63, midiNote: 60 };

      // Build up 66ms of sustain (2 frames × 33ms)
      engine.processFrame(pitchData, 0);
      engine.processFrame(pitchData, 33);
      expect(engine.getState().sustainAccumulated).toBe(66);

      // Gap exceeding grace period: decay by 150ms → 66 - 150 = 0 (clamped)
      engine.processFrame(null, 200); // 167ms after last match > 150ms grace

      expect(engine.getState().sustainAccumulated).toBe(0);
    });

    it('should partially decay large sustain after grace period expires', () => {
      const pitchData = { frequency: 261.63, midiNote: 60 };

      // Build up 198ms of sustain (6 frames × 33ms)
      for (let t = 0; t < 6; t++) {
        engine.processFrame(pitchData, t * 33);
      }
      expect(engine.getState().sustainAccumulated).toBe(198);

      // Gap exceeding grace period: decay by 150ms → 198 - 150 = 48
      engine.processFrame(null, 330); // 165 + 165ms after last match > 150ms grace

      expect(engine.getState().sustainAccumulated).toBe(48);
    });

    it('should keep target SUSTAINING when sustain partially decays', () => {
      const pitchData = { frequency: 261.63, midiNote: 60 };

      // Build up enough sustain
      for (let t = 0; t < 6; t++) {
        engine.processFrame(pitchData, t * 33);
      }

      const target = engine.getCurrentTarget();
      expect(target.state).toBe(TargetState.SUSTAINING);

      // Grace period expires but sustain only partially decays
      engine.processFrame(null, 330);

      // Target should stay SUSTAINING since sustain > 0
      expect(target.state).toBe(TargetState.SUSTAINING);
      expect(engine.getState().sustainAccumulated).toBeGreaterThan(0);
    });

    it('should reset target to WAITING when sustain fully decays to 0', () => {
      const pitchData = { frequency: 261.63, midiNote: 60 };

      // Build up small sustain (66ms, 2 frames)
      engine.processFrame(pitchData, 0);
      engine.processFrame(pitchData, 33);

      const target = engine.getCurrentTarget();
      expect(target.state).toBe(TargetState.SUSTAINING);

      // Grace period expires — sustain fully decays (66 - 150 = 0)
      engine.processFrame(null, 200);

      expect(target.state).toBe(TargetState.WAITING);
      expect(engine.getState().sustainAccumulated).toBe(0);
    });
  });

  describe('Exercise progression', () => {
    beforeEach(() => {
      engine.startExercise(exercise, scaleManager, 100);
    });

    function hitCurrentTarget(startTime) {
      const target = engine.getCurrentTarget();
      if (!target) return startTime;
      const pitchData = { frequency: FrequencyConverter.midiToFrequency(target.midiNote), midiNote: target.midiNote };

      let t = startTime;
      while (target.state !== TargetState.HIT) {
        engine.processFrame(pitchData, t);
        t += 33;
      }
      return t;
    }

    it('should advance to next target after hit + gap', () => {
      let t = hitCurrentTarget(0);

      // Wait for target gap (300ms)
      t += 300;
      engine.processFrame(null, t);

      // Should have advanced to the second target (index 1)
      expect(engine.getState().currentTargetIndex).toBe(1);
    });

    it('should track progress through multiple targets', () => {
      let t = 0;

      // Hit first 4 targets (covering first 2 ladders: [0], [0,1,0])
      for (let i = 0; i < 4; i++) {
        t = hitCurrentTarget(t);
        t += 300;
        engine.processFrame(null, t);
        t += 33;
      }

      expect(engine.getState().currentTargetIndex).toBe(4);
    });

    it('should loop after completing all 64 targets', () => {
      let t = 0;

      // Complete all 64 targets in the single phase
      const phase = engine.getCurrentPhase();
      for (let ti = 0; ti < phase.targets.length; ti++) {
        t = hitCurrentTarget(t);
        // Wait for gap (last target uses phaseGap = 1000ms)
        const isLastTarget = ti === phase.targets.length - 1;
        t += isLastTarget ? 1000 : 300;
        engine.processFrame(null, t);
        t += 33;
        engine.processFrame(null, t);
      }

      // Should have looped back to beginning
      const state = engine.getState();
      expect(state.engineState).toBe(EngineState.ACTIVE);
      expect(state.currentPhaseIndex).toBe(0);
      expect(state.currentTargetIndex).toBe(0);
    });
  });

  describe('State and progress', () => {
    it('should report correct progress', () => {
      engine.startExercise(exercise, scaleManager, 100);

      const progress = engine.getProgress();
      expect(progress.phaseIndex).toBe(0);
      expect(progress.phaseCount).toBe(1); // Now just 1 phase with all targets
      expect(progress.targetIndex).toBe(0);
      expect(progress.targetCount).toBe(64); // All ladders combined
      expect(progress.overallFraction).toBe(0);
    });

    it('should report sustain fraction', () => {
      engine.startExercise(exercise, scaleManager, 200);

      const pitchData = { frequency: 261.63, midiNote: 60 };
      engine.processFrame(pitchData, 0);

      const state = engine.getState();
      expect(state.sustainFraction).toBeGreaterThan(0);
      expect(state.sustainFraction).toBeLessThanOrEqual(1);
    });

    it('should track hit effects', () => {
      engine.startExercise(exercise, scaleManager, 100);

      const pitchData = { frequency: 261.63, midiNote: 60 };
      for (let t = 0; t < 5; t++) {
        engine.processFrame(pitchData, t * 33);
      }

      expect(engine.getState().hitEffects.length).toBe(1);
      expect(engine.getState().hitEffects[0].midiNote).toBe(60);
    });

    it('should return null for getCurrentTarget when idle', () => {
      expect(engine.getCurrentTarget()).toBeNull();
    });

    it('should return null for getCurrentPhase when idle', () => {
      expect(engine.getCurrentPhase()).toBeNull();
    });
  });
});
