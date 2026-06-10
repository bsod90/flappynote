import { describe, it, expect } from 'vitest';
import { HybridPitchDetector } from '../../detectors/HybridPitchDetector.js';
import { TestSignalGenerator } from '../../evaluation/TestSignalGenerator.js';
import { PitchEvaluator } from '../../evaluation/PitchEvaluator.js';

/**
 * Accuracy benchmark for the production pitch detector (hybrid MPM+YIN).
 * Runs synthesized vocal-like signals through the real detector and asserts
 * minimum accuracy so pitch-quality regressions fail loudly in CI.
 */

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096; // what the vocal monitor uses
const HOP_SIZE = Math.floor(SAMPLE_RATE * 0.03); // ~30ms, the production update interval

async function makeDetector(overrides = {}) {
  const detector = new HybridPitchDetector({
    sampleRate: SAMPLE_RATE,
    bufferSize: BUFFER_SIZE,
    minFrequency: 60,
    maxFrequency: 1200,
    threshold: 0.005,
    ...overrides,
  });
  await detector.initialize();
  return detector;
}

/** Feed a signal frame-by-frame; returns per-frame {detected, expected}. */
function runDetector(detector, buffer, groundTruth) {
  const generator = new TestSignalGenerator({ sampleRate: SAMPLE_RATE });
  const frames = generator.generateFrames(buffer, groundTruth, BUFFER_SIZE, HOP_SIZE);
  return frames.map(({ frame, expectedFrequency }) => {
    const result = detector.detect(frame);
    return { detected: result.frequency, expected: expectedFrequency };
  });
}

function accuracy(results, { toleranceCents = 50, skipFrames = 3 } = {}) {
  const evaluator = new PitchEvaluator({ toleranceCents });
  const settled = results.slice(skipFrames);
  let correct = 0;
  let grossErrors = 0;
  let detections = 0;
  for (const { detected, expected } of settled) {
    if (detected == null) continue;
    detections++;
    const frame = evaluator.evaluateFrame(detected, expected);
    if (frame.isCorrect) correct++;
    if (frame.isGrossError) grossErrors++;
  }
  return {
    correctRate: detections > 0 ? correct / detections : 0,
    grossErrorRate: detections > 0 ? grossErrors / detections : 0,
    detectionRate: settled.length > 0 ? detections / settled.length : 0,
  };
}

describe('HybridPitchDetector accuracy benchmark', () => {
  const generator = new TestSignalGenerator({ sampleRate: SAMPLE_RATE });

  it('detects pure sine waves across the vocal range within 50 cents', async () => {
    for (const freq of [110, 165, 220, 330, 440, 660, 880]) {
      const detector = await makeDetector();
      const { buffer, groundTruth } = generator.generateSineWave(freq, 1.0);
      const stats = accuracy(runDetector(detector, buffer, groundTruth));

      expect(stats.detectionRate, `${freq}Hz detection rate`).toBeGreaterThan(0.9);
      expect(stats.correctRate, `${freq}Hz accuracy`).toBeGreaterThan(0.95);
      expect(stats.grossErrorRate, `${freq}Hz gross errors`).toBeLessThan(0.02);
    }
  });

  it('detects harmonic-rich (voice-like) tones without octave errors', async () => {
    for (const freq of [110, 220, 440]) {
      const detector = await makeDetector();
      const { buffer, groundTruth } = generator.generateWithHarmonics(
        freq, 1.0, [1, 0.6, 0.3, 0.15, 0.08]
      );
      const stats = accuracy(runDetector(detector, buffer, groundTruth));

      expect(stats.correctRate, `${freq}Hz accuracy`).toBeGreaterThan(0.95);
      expect(stats.grossErrorRate, `${freq}Hz gross errors`).toBeLessThan(0.02);
    }
  });

  it('stays accurate with added noise (20dB SNR)', async () => {
    const detector = await makeDetector();
    const { buffer, groundTruth } = generator.generateWithHarmonics(
      220, 1.0, [1, 0.6, 0.3, 0.15, 0.08]
    );
    const noisy = generator.addNoise(buffer, 20);
    const stats = accuracy(runDetector(detector, noisy, groundTruth));

    expect(stats.correctRate).toBeGreaterThan(0.85);
    expect(stats.grossErrorRate).toBeLessThan(0.05);
  });

  it('tracks note changes in a scale without sticking to the old pitch', async () => {
    const detector = await makeDetector();
    // C4 major scale, 400ms per note — long enough for several frames per note
    const { buffer, groundTruth } = generator.generateScale('major', 261.63, 0.4);
    const results = runDetector(detector, buffer, groundTruth);

    // Allow transition frames at note boundaries (the analysis window spans
    // the boundary): overall accuracy must still be high.
    const stats = accuracy(results, { toleranceCents: 60, skipFrames: 3 });
    expect(stats.correctRate).toBeGreaterThan(0.8);
    expect(stats.grossErrorRate).toBeLessThan(0.1);
  });

  it('recovers quickly after silence', async () => {
    const detector = await makeDetector();
    const tone = generator.generateWithHarmonics(330, 0.5, [1, 0.5, 0.25]);
    const silence = new Float32Array(SAMPLE_RATE / 2); // 500ms silence

    // tone → silence → tone
    const full = new Float32Array(tone.buffer.length * 2 + silence.length);
    full.set(tone.buffer, 0);
    full.set(silence, tone.buffer.length);
    full.set(tone.buffer, tone.buffer.length + silence.length);

    const secondToneStart = (tone.buffer.length + silence.length) / SAMPLE_RATE;
    const groundTruth = [];
    for (let t = 0; t < full.length / SAMPLE_RATE; t += 0.01) {
      groundTruth.push({ time: t, frequency: 330 });
    }

    const generatorFrames = generator.generateFrames(full, groundTruth, BUFFER_SIZE, HOP_SIZE);
    let framesAfterToneResume = 0;
    let firstDetectionDelay = null;
    for (const { frame, time } of generatorFrames) {
      const result = detector.detect(frame);
      // Only consider frames fully inside the second tone
      if (time >= secondToneStart) {
        framesAfterToneResume++;
        if (firstDetectionDelay == null && result.frequency != null) {
          firstDetectionDelay = framesAfterToneResume;
        }
      }
    }

    // Should re-detect within 3 frames (~90ms) of the tone resuming
    expect(firstDetectionDelay).not.toBeNull();
    expect(firstDetectionDelay).toBeLessThanOrEqual(3);
  });
});
