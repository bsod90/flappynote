/**
 * EvaluationRunner - Orchestrates pitch detector evaluation
 * Runs synthetic tests, VocalSet samples, and user recordings
 */

import { TestSignalGenerator } from './TestSignalGenerator.js';
import { PitchEvaluator } from './PitchEvaluator.js';
import { OnsetDetector } from './OnsetDetector.js';

export class EvaluationRunner {
  /**
   * @param {object} options
   * @param {number} options.sampleRate - Sample rate (default: 44100)
   * @param {number} options.frameSize - Frame size for detection (default: 2048)
   * @param {number} options.hopSize - Hop size between frames (default: 512)
   */
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 44100;
    this.frameSize = options.frameSize || 2048;
    this.hopSize = options.hopSize || 512;

    this.generator = new TestSignalGenerator({ sampleRate: this.sampleRate });
    this.evaluator = new PitchEvaluator();
    this.onsetDetector = new OnsetDetector({
      sampleRate: this.sampleRate,
      frameSize: this.frameSize,
      hopSize: this.hopSize,
    });

    this.detectors = new Map();
  }

  /**
   * Register a pitch detector for evaluation
   * @param {string} name - Detector name
   * @param {object} detector - Detector instance with detect(buffer) method
   */
  registerDetector(name, detector) {
    this.detectors.set(name, detector);
  }

  /**
   * Run a single detector on a buffer and collect detections
   * @param {object} detector - Detector with detect(buffer) method
   * @param {Float32Array} buffer - Audio buffer
   * @returns {Array<{frequency, confidence, time}>} Detections for each frame
   */
  runDetector(detector, buffer) {
    const detections = [];
    const frames = this.generator.generateFrames(
      buffer,
      [], // Empty ground truth - we just need frames
      this.frameSize,
      this.hopSize
    );

    for (const { frame, time } of frames) {
      const result = detector.detect(frame);
      detections.push({
        frequency: result?.frequency ?? null,
        confidence: result?.confidence ?? null,
        time,
      });
    }

    return detections;
  }

  /**
   * Run synthetic test suite on a detector
   * @param {string} detectorName - Name of registered detector
   * @returns {object} Results for each test case
   */
  runSyntheticTests(detectorName) {
    const detector = this.detectors.get(detectorName);
    if (!detector) {
      throw new Error(`Detector not registered: ${detectorName}`);
    }

    const testSuite = this.generator.generateTestSuite();
    const results = [];

    for (const test of testSuite) {
      const detections = this.runDetector(detector, test.buffer);

      // Convert ground truth to detection format
      const groundTruthDetections = this._alignGroundTruth(
        test.groundTruth,
        detections.map(d => d.time)
      );

      const evaluation = this.evaluator.evaluate(detections, groundTruthDetections);

      results.push({
        name: test.name,
        type: test.type,
        metrics: evaluation.metrics,
        snr: test.snr ?? null,
      });
    }

    return {
      detectorName,
      tests: results,
      summary: this._summarizeResults(results),
    };
  }

  /**
   * Evaluate detector on user recording with auto-segmentation
   * @param {string} detectorName - Name of registered detector
   * @param {Float32Array} buffer - User recording
   * @param {number} expectedNotes - Expected number of notes
   * @returns {object} Evaluation results
   */
  evaluateUserRecording(detectorName, buffer, expectedNotes) {
    const detector = this.detectors.get(detectorName);
    if (!detector) {
      throw new Error(`Detector not registered: ${detectorName}`);
    }

    // Detect note boundaries
    const notes = this.onsetDetector.detectNotes(buffer);
    const validation = this.onsetDetector.validate(notes, expectedNotes);

    // Run detection on full buffer
    const detections = this.runDetector(detector, buffer);

    // Group detections by note
    const noteResults = [];
    for (const note of notes) {
      const noteDetections = detections.filter(
        d => d.time >= note.startTime && d.time <= note.endTime
      );

      // Calculate stability within note
      const frequencies = noteDetections
        .map(d => d.frequency)
        .filter(f => f !== null && f > 0);

      if (frequencies.length > 0) {
        const meanFreq = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
        const variance = frequencies.reduce((sum, f) => sum + Math.pow(f - meanFreq, 2), 0) / frequencies.length;
        const stdDev = Math.sqrt(variance);
        const centsStd = 1200 * Math.log2((meanFreq + stdDev) / meanFreq);

        noteResults.push({
          startTime: note.startTime,
          endTime: note.endTime,
          duration: note.endTime - note.startTime,
          meanFrequency: meanFreq,
          stdDevCents: centsStd,
          detectionRate: frequencies.length / noteDetections.length,
          numFrames: noteDetections.length,
        });
      }
    }

    return {
      detectorName,
      segmentation: validation,
      notes: noteResults,
      overallStability: this._calculateOverallStability(noteResults),
    };
  }

  /**
   * Compare two detectors on the same audio
   * @param {string} detector1Name - First detector name
   * @param {string} detector2Name - Second detector name
   * @param {Float32Array} buffer - Audio buffer
   * @param {Array} groundTruth - Ground truth (optional for synthetic)
   * @returns {object} Comparison results
   */
  compareDetectors(detector1Name, detector2Name, buffer, groundTruth = null) {
    const detector1 = this.detectors.get(detector1Name);
    const detector2 = this.detectors.get(detector2Name);

    if (!detector1) throw new Error(`Detector not registered: ${detector1Name}`);
    if (!detector2) throw new Error(`Detector not registered: ${detector2Name}`);

    const detections1 = this.runDetector(detector1, buffer);
    const detections2 = this.runDetector(detector2, buffer);

    if (!groundTruth) {
      // Without ground truth, compare agreement between detectors
      return this._compareWithoutGroundTruth(
        detector1Name, detector2Name,
        detections1, detections2
      );
    }

    const groundTruthDetections = this._alignGroundTruth(
      groundTruth,
      detections1.map(d => d.time)
    );

    const comparison = this.evaluator.compare(
      detections1,
      detections2,
      groundTruthDetections
    );

    return {
      detector1: detector1Name,
      detector2: detector2Name,
      ...comparison,
      reports: {
        detector1: this.evaluator.generateReport(comparison.detector1, detector1Name),
        detector2: this.evaluator.generateReport(comparison.detector2, detector2Name),
      },
    };
  }

  /**
   * Run A/B comparison on synthetic test suite
   * @param {string} detector1Name - First detector
   * @param {string} detector2Name - Second detector
   * @returns {object} Full comparison results
   */
  runABComparison(detector1Name, detector2Name) {
    const testSuite = this.generator.generateTestSuite();
    const comparisons = [];

    for (const test of testSuite) {
      const comparison = this.compareDetectors(
        detector1Name,
        detector2Name,
        test.buffer,
        test.groundTruth
      );

      comparisons.push({
        testName: test.name,
        testType: test.type,
        ...comparison,
      });
    }

    return {
      detector1: detector1Name,
      detector2: detector2Name,
      tests: comparisons,
      summary: this._summarizeComparison(comparisons, detector1Name, detector2Name),
    };
  }

  /**
   * Generate comparison report
   * @param {object} comparison - Comparison from runABComparison
   * @returns {string} Human-readable report
   */
  generateComparisonReport(comparison) {
    const lines = [
      `=== A/B Comparison Report ===`,
      `Detector 1: ${comparison.detector1}`,
      `Detector 2: ${comparison.detector2}`,
      ``,
      `Summary:`,
    ];

    const summary = comparison.summary;
    for (const [metric, data] of Object.entries(summary.byMetric)) {
      lines.push(`  ${metric}:`);
      lines.push(`    ${comparison.detector1} wins: ${data.detector1Wins}`);
      lines.push(`    ${comparison.detector2} wins: ${data.detector2Wins}`);
      lines.push(`    Ties: ${data.ties}`);
    }

    lines.push(``);
    lines.push(`Overall Winner: ${summary.overallWinner}`);
    lines.push(``);
    lines.push(`Test Results:`);

    for (const test of comparison.tests) {
      const d1RPA = (test.detector1?.rpa ?? 0) * 100;
      const d2RPA = (test.detector2?.rpa ?? 0) * 100;
      lines.push(`  ${test.testName}: ${d1RPA.toFixed(1)}% vs ${d2RPA.toFixed(1)}%`);
    }

    return lines.join('\n');
  }

  /**
   * Export results as JSON
   * @param {object} results - Any results object
   * @returns {string} JSON string
   */
  exportJSON(results) {
    return JSON.stringify(results, null, 2);
  }

  /**
   * Align ground truth to detection timestamps
   * @private
   */
  _alignGroundTruth(groundTruth, timestamps) {
    return timestamps.map(time => {
      // Find closest ground truth entry
      let closest = null;
      let minDiff = Infinity;

      for (const gt of groundTruth) {
        const diff = Math.abs(gt.time - time);
        if (diff < minDiff) {
          minDiff = diff;
          closest = gt;
        }
      }

      return { frequency: closest?.frequency ?? null };
    });
  }

  /**
   * Summarize test results
   * @private
   */
  _summarizeResults(results) {
    const byType = {};

    for (const result of results) {
      if (!byType[result.type]) {
        byType[result.type] = {
          count: 0,
          totalRPA: 0,
          totalGPE: 0,
        };
      }

      byType[result.type].count++;
      byType[result.type].totalRPA += result.metrics.rpa;
      byType[result.type].totalGPE += result.metrics.gpe;
    }

    const summary = {
      totalTests: results.length,
      byType: {},
      overallRPA: 0,
      overallGPE: 0,
    };

    let totalRPA = 0;
    let totalGPE = 0;

    for (const [type, data] of Object.entries(byType)) {
      summary.byType[type] = {
        count: data.count,
        meanRPA: data.totalRPA / data.count,
        meanGPE: data.totalGPE / data.count,
      };
      totalRPA += data.totalRPA;
      totalGPE += data.totalGPE;
    }

    summary.overallRPA = totalRPA / results.length;
    summary.overallGPE = totalGPE / results.length;

    return summary;
  }

  /**
   * Compare detections without ground truth
   * @private
   */
  _compareWithoutGroundTruth(name1, name2, detections1, detections2) {
    let agreements = 0;
    let totalVoiced = 0;

    for (let i = 0; i < detections1.length; i++) {
      const f1 = detections1[i].frequency;
      const f2 = detections2[i].frequency;

      if (f1 !== null && f2 !== null && f1 > 0 && f2 > 0) {
        totalVoiced++;
        const cents = Math.abs(1200 * Math.log2(f1 / f2));
        if (cents <= 50) agreements++;
      }
    }

    return {
      detector1: name1,
      detector2: name2,
      agreementRate: totalVoiced > 0 ? agreements / totalVoiced : 0,
      totalVoicedFrames: totalVoiced,
      agreements,
    };
  }

  /**
   * Calculate overall pitch stability
   * @private
   */
  _calculateOverallStability(noteResults) {
    if (noteResults.length === 0) return null;

    const totalCentsStd = noteResults.reduce((sum, n) => sum + n.stdDevCents, 0);
    const totalDetectionRate = noteResults.reduce((sum, n) => sum + n.detectionRate, 0);

    return {
      meanCentsStd: totalCentsStd / noteResults.length,
      meanDetectionRate: totalDetectionRate / noteResults.length,
      numNotes: noteResults.length,
    };
  }

  /**
   * Summarize comparison results
   * @private
   */
  _summarizeComparison(comparisons, name1, name2) {
    const byMetric = {
      rpa: { detector1Wins: 0, detector2Wins: 0, ties: 0 },
      gpe: { detector1Wins: 0, detector2Wins: 0, ties: 0 },
      octaveErrorRate: { detector1Wins: 0, detector2Wins: 0, ties: 0 },
    };

    for (const comp of comparisons) {
      if (!comp.winner) continue;

      for (const metric of Object.keys(byMetric)) {
        if (comp.winner[metric] === 'detector1') {
          byMetric[metric].detector1Wins++;
        } else if (comp.winner[metric] === 'detector2') {
          byMetric[metric].detector2Wins++;
        } else {
          byMetric[metric].ties++;
        }
      }
    }

    // Determine overall winner by RPA wins
    let overallWinner = 'tie';
    if (byMetric.rpa.detector1Wins > byMetric.rpa.detector2Wins) {
      overallWinner = name1;
    } else if (byMetric.rpa.detector2Wins > byMetric.rpa.detector1Wins) {
      overallWinner = name2;
    }

    return {
      byMetric,
      overallWinner,
      totalTests: comparisons.length,
    };
  }
}
