import { describe, it, expect, beforeEach } from 'vitest';
import { PitchEvaluator } from '../../evaluation/PitchEvaluator.js';

describe('PitchEvaluator', () => {
  let evaluator;

  beforeEach(() => {
    evaluator = new PitchEvaluator({ toleranceCents: 50 });
  });

  describe('constructor', () => {
    it('should use default tolerance of 50 cents', () => {
      const defaultEval = new PitchEvaluator();
      expect(defaultEval.toleranceCents).toBe(50);
    });

    it('should accept custom tolerance', () => {
      const customEval = new PitchEvaluator({ toleranceCents: 25 });
      expect(customEval.toleranceCents).toBe(25);
    });
  });

  describe('getCentsDifference', () => {
    it('should return 0 for identical frequencies', () => {
      const cents = evaluator.getCentsDifference(440, 440);
      expect(cents).toBeCloseTo(0, 5);
    });

    it('should return 1200 for octave up', () => {
      const cents = evaluator.getCentsDifference(880, 440);
      expect(cents).toBeCloseTo(1200, 1);
    });

    it('should return -1200 for octave down', () => {
      const cents = evaluator.getCentsDifference(220, 440);
      expect(cents).toBeCloseTo(-1200, 1);
    });

    it('should return ~100 cents for a semitone', () => {
      const cents = evaluator.getCentsDifference(466.16, 440); // A4 to A#4
      expect(cents).toBeCloseTo(100, 0);
    });

    it('should return Infinity for zero/negative frequencies', () => {
      expect(evaluator.getCentsDifference(0, 440)).toBe(Infinity);
      expect(evaluator.getCentsDifference(440, 0)).toBe(Infinity);
      expect(evaluator.getCentsDifference(-1, 440)).toBe(Infinity);
    });
  });

  describe('evaluateFrame', () => {
    it('should mark exact match as correct', () => {
      const result = evaluator.evaluateFrame(440, 440);
      expect(result.isCorrect).toBe(true);
      expect(result.isGrossError).toBe(false);
      expect(result.cents).toBeCloseTo(0, 5);
    });

    it('should mark within-tolerance as correct', () => {
      // ~20 cents sharp
      const result = evaluator.evaluateFrame(445, 440);
      expect(result.isCorrect).toBe(true);
      expect(result.isGrossError).toBe(false);
    });

    it('should mark outside-tolerance as incorrect', () => {
      // ~100 cents sharp (semitone)
      const result = evaluator.evaluateFrame(466.16, 440);
      expect(result.isCorrect).toBe(false);
      expect(result.isGrossError).toBe(true);
    });

    it('should detect octave error up', () => {
      const result = evaluator.evaluateFrame(880, 440);
      expect(result.isOctaveError).toBe(true);
      expect(result.isCorrect).toBe(false);
    });

    it('should detect octave error down', () => {
      const result = evaluator.evaluateFrame(220, 440);
      expect(result.isOctaveError).toBe(true);
      expect(result.isCorrect).toBe(false);
    });

    it('should handle null detected frequency (miss)', () => {
      const result = evaluator.evaluateFrame(null, 440);
      expect(result.voicingCorrect).toBe(false);
      expect(result.isGrossError).toBe(true);
    });

    it('should handle null expected frequency (expected unvoiced)', () => {
      const result = evaluator.evaluateFrame(440, null);
      expect(result.voicingCorrect).toBe(false);
      expect(result.isCorrect).toBe(false);
    });

    it('should handle both null (correct unvoiced)', () => {
      const result = evaluator.evaluateFrame(null, null);
      expect(result.voicingCorrect).toBe(true);
      expect(result.isCorrect).toBe(true);
    });

    it('should store confidence value', () => {
      const result = evaluator.evaluateFrame(440, 440, 0.95);
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('evaluate', () => {
    it('should calculate perfect RPA for perfect detections', () => {
      const detections = [
        { frequency: 440 },
        { frequency: 440 },
        { frequency: 440 },
      ];
      const groundTruth = [
        { frequency: 440 },
        { frequency: 440 },
        { frequency: 440 },
      ];

      const { metrics } = evaluator.evaluate(detections, groundTruth);
      expect(metrics.rpa).toBe(1.0);
      expect(metrics.gpe).toBe(0);
    });

    it('should calculate 0 RPA for all wrong detections', () => {
      const detections = [
        { frequency: 880 }, // octave error
        { frequency: 220 }, // octave error
        { frequency: 550 }, // wrong
      ];
      const groundTruth = [
        { frequency: 440 },
        { frequency: 440 },
        { frequency: 440 },
      ];

      const { metrics } = evaluator.evaluate(detections, groundTruth);
      expect(metrics.rpa).toBe(0);
      expect(metrics.gpe).toBe(1.0);
    });

    it('should calculate mixed accuracy correctly', () => {
      const detections = [
        { frequency: 440 },  // correct
        { frequency: 445 },  // correct (within tolerance)
        { frequency: 880 },  // wrong (octave)
        { frequency: 550 },  // wrong
      ];
      const groundTruth = [
        { frequency: 440 },
        { frequency: 440 },
        { frequency: 440 },
        { frequency: 440 },
      ];

      const { metrics } = evaluator.evaluate(detections, groundTruth);
      expect(metrics.rpa).toBe(0.5);  // 2/4 correct
      expect(metrics.gpe).toBe(0.5);  // 2/4 gross errors
    });

    it('should calculate voicing accuracy', () => {
      const detections = [
        { frequency: 440 },
        { frequency: null }, // false negative
        { frequency: 440 },  // false positive
        { frequency: null },
      ];
      const groundTruth = [
        { frequency: 440 },
        { frequency: 440 },  // expected voiced, got null
        { frequency: null }, // expected null, got voiced
        { frequency: null },
      ];

      const { metrics } = evaluator.evaluate(detections, groundTruth);
      expect(metrics.voicingAccuracy).toBe(0.5); // 2/4 correct voicing
    });

    it('should calculate cents error statistics', () => {
      const detections = [
        { frequency: 445 }, // ~20 cents sharp
        { frequency: 435 }, // ~20 cents flat
        { frequency: 440 }, // 0 cents
      ];
      const groundTruth = [
        { frequency: 440 },
        { frequency: 440 },
        { frequency: 440 },
      ];

      const { metrics } = evaluator.evaluate(detections, groundTruth);
      expect(metrics.meanCentsError).toBeCloseTo(0, 0); // Sharp and flat cancel
      expect(metrics.meanAbsCentsError).toBeGreaterThan(0);
    });

    it('should throw on length mismatch', () => {
      const detections = [{ frequency: 440 }];
      const groundTruth = [{ frequency: 440 }, { frequency: 440 }];

      expect(() => evaluator.evaluate(detections, groundTruth)).toThrow('Length mismatch');
    });

    it('should calculate confidence correlation', () => {
      const detections = [
        { frequency: 440, confidence: 0.9 },  // correct, high confidence
        { frequency: 440, confidence: 0.85 }, // correct, high confidence
        { frequency: 880, confidence: 0.3 },  // wrong, low confidence
        { frequency: 550, confidence: 0.2 },  // wrong, low confidence
      ];
      const groundTruth = [
        { frequency: 440 },
        { frequency: 440 },
        { frequency: 440 },
        { frequency: 440 },
      ];

      const { metrics } = evaluator.evaluate(detections, groundTruth);
      expect(metrics.meanConfidenceCorrect).toBeGreaterThan(metrics.meanConfidenceIncorrect);
      expect(metrics.confidenceDiscriminates).toBe(true);
    });
  });

  describe('evaluateLatency', () => {
    it('should calculate latency from onset to detection', () => {
      const detections = [
        { time: 0.0, frequency: null },
        { time: 0.01, frequency: null },
        { time: 0.02, frequency: 440 }, // First correct detection
        { time: 0.03, frequency: 440 },
      ];
      const notes = [
        { startTime: 0, frequency: 440 },
      ];

      const result = evaluator.evaluateLatency(detections, notes);
      expect(result.meanLatency).toBeCloseTo(0.02, 5);
      expect(result.detectedNotes).toBe(1);
    });

    it('should handle multiple notes', () => {
      const detections = [
        { time: 0.0, frequency: null },
        { time: 0.02, frequency: 440 },
        { time: 0.5, frequency: null },
        { time: 0.53, frequency: 550 },
      ];
      const notes = [
        { startTime: 0, frequency: 440 },
        { startTime: 0.5, frequency: 550 },
      ];

      const result = evaluator.evaluateLatency(detections, notes);
      expect(result.detectedNotes).toBe(2);
      expect(result.detectionRate).toBe(1.0);
    });

    it('should handle undetected notes', () => {
      const detections = [
        { time: 0.0, frequency: null },
        { time: 0.02, frequency: 550 }, // Wrong frequency
      ];
      const notes = [
        { startTime: 0, frequency: 440 },
      ];

      const result = evaluator.evaluateLatency(detections, notes);
      expect(result.detectedNotes).toBe(0);
      expect(result.detectionRate).toBe(0);
    });
  });

  describe('compare', () => {
    it('should compare two detectors', () => {
      const detections1 = [
        { frequency: 440 },
        { frequency: 445 },
        { frequency: 880 }, // octave error
      ];
      const detections2 = [
        { frequency: 440 },
        { frequency: 440 },
        { frequency: 440 }, // correct
      ];
      const groundTruth = [
        { frequency: 440 },
        { frequency: 440 },
        { frequency: 440 },
      ];

      const comparison = evaluator.compare(detections1, detections2, groundTruth);

      expect(comparison.detector1.rpa).toBeLessThan(comparison.detector2.rpa);
      expect(comparison.differences.rpa).toBeGreaterThan(0);
      expect(comparison.winner.rpa).toBe('detector2');
    });

    it('should handle ties', () => {
      const detections1 = [{ frequency: 440 }];
      const detections2 = [{ frequency: 440 }];
      const groundTruth = [{ frequency: 440 }];

      const comparison = evaluator.compare(detections1, detections2, groundTruth);
      expect(comparison.winner.rpa).toBe('tie');
    });
  });

  describe('generateReport', () => {
    it('should generate human-readable report', () => {
      const metrics = {
        rpa: 0.85,
        gpe: 0.10,
        octaveErrorRate: 0.05,
        voicingAccuracy: 0.95,
        meanCentsError: 5.2,
        medianCentsError: 3.1,
        meanAbsCentsError: 12.5,
        stdCentsError: 8.3,
        totalFrames: 1000,
        totalVoicedFrames: 800,
        correctFrames: 680,
        grossErrors: 80,
        meanConfidenceCorrect: 0.92,
        meanConfidenceIncorrect: 0.45,
        confidenceDiscriminates: true,
      };

      const report = evaluator.generateReport(metrics, 'TestDetector');

      expect(report).toContain('TestDetector');
      expect(report).toContain('85.0%'); // RPA
      expect(report).toContain('10.0%'); // GPE
      expect(report).toContain('5.0%');  // Octave error rate
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays', () => {
      const { metrics } = evaluator.evaluate([], []);
      expect(metrics.rpa).toBe(0);
      expect(metrics.totalFrames).toBe(0);
    });

    it('should handle all unvoiced frames', () => {
      const detections = [{ frequency: null }, { frequency: null }];
      const groundTruth = [{ frequency: null }, { frequency: null }];

      const { metrics } = evaluator.evaluate(detections, groundTruth);
      expect(metrics.voicingAccuracy).toBe(1.0);
      expect(metrics.rpa).toBe(0); // No voiced frames to be correct
    });

    it('should handle zero frequencies as unvoiced', () => {
      const result = evaluator.evaluateFrame(0, 440);
      expect(result.voicingCorrect).toBe(false);
    });
  });
});
