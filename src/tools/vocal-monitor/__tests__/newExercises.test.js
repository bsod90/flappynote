import { describe, it, expect } from 'vitest';
import { ScaleManager } from '../../../core/ScaleManager.js';
import { FrequencyConverter } from '../../../pitch-engine/index.js';
import { ExerciseEngine, EngineState, TargetState } from '../ExerciseEngine.js';
import {
  ExerciseRegistry,
  createExercise,
  MELODIES,
  SirenExercise,
  FifthSlideExercise,
  OctaveLeapExercise,
  NinthSlideExercise,
  ArpeggioTenthExercise,
  OctaveBounceExercise,
  DescendingSirenExercise,
} from '../exercises/index.js';

describe('Passaggio exercises', () => {
  const scaleManager = new ScaleManager('C4', 'major');
  const rootMidi = FrequencyConverter.noteNameToMidi('C4');

  it('siren runs the full scale up and back down', () => {
    const phases = new SirenExercise().generatePhases(scaleManager);
    expect(phases).toHaveLength(1);
    const offsets = phases[0].targets.map((t) => t.midiNote - rootMidi);
    expect(offsets).toEqual([0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0]);
  });

  it('fifth slide goes 1→5→1 stepwise', () => {
    const phases = new FifthSlideExercise().generatePhases(scaleManager);
    const offsets = phases[0].targets.map((t) => t.midiNote - rootMidi);
    expect(offsets).toEqual([0, 2, 4, 5, 7, 5, 4, 2, 0]);
  });

  it('octave leap is 1-8-1 with a long sustain', () => {
    const exercise = new OctaveLeapExercise();
    const phases = exercise.generatePhases(scaleManager);
    const offsets = phases[0].targets.map((t) => t.midiNote - rootMidi);
    expect(offsets).toEqual([0, 12, 0]);
    expect(exercise.sustainDuration).toBeGreaterThanOrEqual(300);
  });

  it('ninth slide climbs past the octave to the ninth and back', () => {
    const phases = new NinthSlideExercise().generatePhases(scaleManager);
    const offsets = phases[0].targets.map((t) => t.midiNote - rootMidi);
    expect(offsets).toEqual([0, 2, 4, 5, 7, 9, 11, 12, 14, 12, 11, 9, 7, 5, 4, 2, 0]);
  });

  it('arpeggio to the tenth spans 16 semitones (do-mi-sol-do-mi)', () => {
    const phases = new ArpeggioTenthExercise().generatePhases(scaleManager);
    const offsets = phases[0].targets.map((t) => t.midiNote - rootMidi);
    expect(offsets).toEqual([0, 4, 7, 12, 16, 12, 7, 4, 0]);
  });

  it('octave bounce repeats the leap both directions', () => {
    const phases = new OctaveBounceExercise().generatePhases(scaleManager);
    const offsets = phases[0].targets.map((t) => t.midiNote - rootMidi);
    expect(offsets).toEqual([0, 12, 0, 12, 0]);
  });

  it('descending siren starts at the octave and dips to the root', () => {
    const phases = new DescendingSirenExercise().generatePhases(scaleManager);
    const offsets = phases[0].targets.map((t) => t.midiNote - rootMidi);
    expect(offsets).toEqual([12, 11, 9, 7, 5, 4, 2, 0, 2, 4, 5, 7, 9, 11, 12]);
  });

  it('extended degrees label correctly above the octave', () => {
    const phases = new ArpeggioTenthExercise().generatePhases(scaleManager);
    const tenth = phases[0].targets[4]; // mi'
    expect(tenth.label).toBe('Mi');
    expect(tenth.midiNote - rootMidi).toBe(16);
  });

  it('all passaggio exercises lock the scale to major', () => {
    for (const Ex of [
      SirenExercise, FifthSlideExercise, OctaveLeapExercise,
      NinthSlideExercise, ArpeggioTenthExercise, OctaveBounceExercise, DescendingSirenExercise,
    ]) {
      expect(new Ex().locksScale()).toBe(true);
    }
  });
});

describe('Melody exercises', () => {
  const scaleManager = new ScaleManager('C4', 'major');
  const rootMidi = FrequencyConverter.noteNameToMidi('C4');

  it('every melody is registered and instantiable', () => {
    for (const key of Object.keys(MELODIES)) {
      const exercise = createExercise(`melody:${key}`);
      expect(exercise, key).not.toBeNull();
      expect(exercise.name).toBe(MELODIES[key].name);
    }
  });

  it('every melody generates one valid target per syllable', () => {
    for (const [key, melody] of Object.entries(MELODIES)) {
      const exercise = createExercise(`melody:${key}`);
      const phases = exercise.generatePhases(scaleManager);
      expect(phases).toHaveLength(1);

      const targets = phases[0].targets;
      expect(targets).toHaveLength(melody.notes.length);
      for (const target of targets) {
        expect(Number.isInteger(target.midiNote), `${key} midiNote`).toBe(true);
        expect(typeof target.lyric, `${key} lyric`).toBe('string');
        expect(target.lyric.length).toBeGreaterThan(0);
        expect(target.state).toBe(TargetState.WAITING);
      }
    }
  });

  it('melodies stay within a singable range (max a 10th, octave around root)', () => {
    for (const [key, melody] of Object.entries(MELODIES)) {
      const offsets = melody.notes.map((n) => n.s);
      const span = Math.max(...offsets) - Math.min(...offsets);
      expect(span, `${key} range span`).toBeLessThanOrEqual(16);
    }
  });

  it('twinkle twinkle starts with the famous do-do-sol-sol-la-la-sol', () => {
    const exercise = createExercise('melody:twinkleTwinkle');
    const targets = exercise.generatePhases(scaleManager)[0].targets;
    const offsets = targets.slice(0, 7).map((t) => t.midiNote - rootMidi);
    expect(offsets).toEqual([0, 0, 7, 7, 9, 9, 7]);
    expect(targets[0].lyric).toBe('Twin');
  });

  it('phrase-ending notes carry a longer per-target sustain', () => {
    const exercise = createExercise('melody:twinkleTwinkle');
    const targets = exercise.generatePhases(scaleManager)[0].targets;
    const star = targets[6]; // "star" — end of first phrase
    expect(star.sustainDuration).toBeGreaterThan(exercise.sustainDuration);
  });
});

describe('ExerciseEngine per-target sustain', () => {
  it('honors a target sustainDuration override', () => {
    const scaleManager = new ScaleManager('C4', 'major');
    const engine = new ExerciseEngine();
    const definition = {
      generatePhases: () => [{
        targets: [
          {
            midiNote: 60,
            label: 'Do',
            lyric: 'Do',
            state: TargetState.WAITING,
            sustainDuration: 200, // override: longer than the engine default
          },
        ],
      }],
    };

    engine.startExercise(definition, scaleManager, 100); // engine default 100ms
    const pitch = { frequency: FrequencyConverter.midiToFrequency(60), midiNote: 60 };

    // 100ms of matching (4 frames × ~33ms) — enough for the engine default
    // but NOT for the 200ms override
    for (let t = 0; t <= 3; t++) engine.processFrame(pitch, t * 33);
    expect(engine.getCurrentTarget().state).toBe(TargetState.SUSTAINING);

    // Keep going past 200ms — now it should hit
    for (let t = 4; t <= 8; t++) engine.processFrame(pitch, t * 33);
    expect(engine.phases[0].targets[0].state).toBe(TargetState.HIT);
  });
});
