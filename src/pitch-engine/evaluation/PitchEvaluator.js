/**
 * PitchEvaluator - Calculates standard pitch detection metrics
 * Used to compare accuracy of different pitch detection algorithms
 */

export class PitchEvaluator {
  /**
   * @param {object} options
   * @param {number} options.toleranceCents - Tolerance for RPA calculation (default: 50 cents)
   * @param {number} options.grossErrorThreshold - Threshold for GPE (default: 50 cents)
   */
  constructor(options = {}) {
    this.toleranceCents = options.toleranceCents || 50;
    this.grossErrorThreshold = options.grossErrorThreshold || 50;
  }

  /**
   * Calculate cents difference between two frequencies
   * @param {number} detected - Detected frequency in Hz
   * @param {number} expected - Expected frequency in Hz
   * @returns {number} Difference in cents
   */
  getCentsDifference(detected, expected) {
    if (detected <= 0 || expected <= 0) return Infinity;
    return 1200 * Math.log2(detected / expected);
  }

  /**
   * Evaluate a single frame
   * @param {number|null} detectedFrequency - Detected frequency (null if unvoiced)
   * @param {number|null} expectedFrequency - Expected frequency (null if unvoiced)
   * @param {number} confidence - Confidence score 0-1 (optional)
   * @returns {object} Frame evaluation result
   */
  evaluateFrame(detectedFrequency, expectedFrequency, confidence = null) {
    const result = {
      detectedFrequency,
      expectedFrequency,
      confidence,
      cents: null,
      isCorrect: false,
      isGrossError: false,
      voicingCorrect: false,
      isOctaveError: false,
    };

    const detectedVoiced = detectedFrequency !== null && detectedFrequency > 0;
    const expectedVoiced = expectedFrequency !== null && expectedFrequency > 0;

    // Voicing detection
    result.voicingCorrect = detectedVoiced === expectedVoiced;

    if (!expectedVoiced) {
      // Expected unvoiced
      result.isCorrect = !detectedVoiced;
      return result;
    }

    if (!detectedVoiced) {
      // Expected voiced but detected unvoiced - miss
      result.isGrossError = true;
      return result;
    }

    // Both voiced - calculate cents difference
    result.cents = this.getCentsDifference(detectedFrequency, expectedFrequency);
    const absCents = Math.abs(result.cents);

    result.isCorrect = absCents <= this.toleranceCents;
    result.isGrossError = absCents > this.grossErrorThreshold;

    // Check for octave error (within 50 cents of an octave)
    const octaveUp = this.getCentsDifference(detectedFrequency, expectedFrequency * 2);
    const octaveDown = this.getCentsDifference(detectedFrequency, expectedFrequency / 2);
    result.isOctaveError =
      Math.abs(octaveUp) <= this.toleranceCents ||
      Math.abs(octaveDown) <= this.toleranceCents;

    return result;
  }

  /**
   * Evaluate a sequence of detections against ground truth
   * @param {Array<{frequency: number|null, confidence: number}>} detections - Detector outputs
   * @param {Array<{frequency: number|null}>} groundTruth - Expected values
   * @returns {object} Comprehensive metrics
   */
  evaluate(detections, groundTruth) {
    if (detections.length !== groundTruth.length) {
      throw new Error(`Length mismatch: ${detections.length} detections vs ${groundTruth.length} ground truth`);
    }

    const frameResults = [];
    let correctFrames = 0;
    let grossErrors = 0;
    let octaveErrors = 0;
    let voicingCorrect = 0;
    let totalVoicedFrames = 0;
    let detectedVoicedFrames = 0;

    const centsErrors = [];
    const confidenceCorrect = [];
    const confidenceIncorrect = [];

    for (let i = 0; i < detections.length; i++) {
      const detection = detections[i];
      const expected = groundTruth[i];

      const detectedFreq = detection?.frequency ?? null;
      const expectedFreq = expected?.frequency ?? null;
      const confidence = detection?.confidence ?? null;

      const result = this.evaluateFrame(detectedFreq, expectedFreq, confidence);
      frameResults.push(result);

      if (result.voicingCorrect) voicingCorrect++;
      if (expectedFreq !== null && expectedFreq > 0) {
        totalVoicedFrames++;
        if (detectedFreq !== null && detectedFreq > 0) {
          detectedVoicedFrames++;
        }
      }

      if (result.isCorrect) {
        correctFrames++;
        if (confidence !== null) confidenceCorrect.push(confidence);
      } else if (result.isGrossError) {
        grossErrors++;
        if (confidence !== null) confidenceIncorrect.push(confidence);
      }

      if (result.isOctaveError) octaveErrors++;
      if (result.cents !== null && isFinite(result.cents)) {
        centsErrors.push(result.cents);
      }
    }

    const totalFrames = detections.length;

    // Calculate metrics
    const metrics = {
      // Raw Pitch Accuracy: % of voiced frames within tolerance
      rpa: totalVoicedFrames > 0 ? correctFrames / totalVoicedFrames : 0,

      // Gross Pitch Error: % of voiced frames with error > threshold
      gpe: totalVoicedFrames > 0 ? grossErrors / totalVoicedFrames : 0,

      // Octave Error Rate: % of frames with octave confusion
      octaveErrorRate: totalVoicedFrames > 0 ? octaveErrors / totalVoicedFrames : 0,

      // Voicing Accuracy: % of frames with correct voiced/unvoiced classification
      voicingAccuracy: totalFrames > 0 ? voicingCorrect / totalFrames : 0,

      // Voicing Recall: % of voiced frames detected as voiced
      voicingRecall: totalVoicedFrames > 0 ? detectedVoicedFrames / totalVoicedFrames : 0,

      // Cents error statistics
      meanCentsError: centsErrors.length > 0
        ? centsErrors.reduce((a, b) => a + b, 0) / centsErrors.length
        : 0,
      stdCentsError: this._calculateStd(centsErrors),
      medianCentsError: this._calculateMedian(centsErrors),
      meanAbsCentsError: centsErrors.length > 0
        ? centsErrors.reduce((a, b) => a + Math.abs(b), 0) / centsErrors.length
        : 0,

      // Confidence correlation
      meanConfidenceCorrect: confidenceCorrect.length > 0
        ? confidenceCorrect.reduce((a, b) => a + b, 0) / confidenceCorrect.length
        : null,
      meanConfidenceIncorrect: confidenceIncorrect.length > 0
        ? confidenceIncorrect.reduce((a, b) => a + b, 0) / confidenceIncorrect.length
        : null,

      // Counts
      totalFrames,
      totalVoicedFrames,
      correctFrames,
      grossErrors,
      octaveErrors,
    };

    // Calculate confidence correlation if we have data
    if (confidenceCorrect.length > 0 && confidenceIncorrect.length > 0) {
      metrics.confidenceDiscriminates =
        metrics.meanConfidenceCorrect > metrics.meanConfidenceIncorrect;
    } else {
      metrics.confidenceDiscriminates = null;
    }

    return {
      metrics,
      frameResults,
    };
  }

  /**
   * Evaluate latency: time from note onset to correct detection
   * @param {Array<{time: number, frequency: number|null}>} detections - Timestamped detections
   * @param {Array<{startTime: number, frequency: number}>} notes - Note onsets with expected frequency
   * @returns {object} Latency metrics
   */
  evaluateLatency(detections, notes) {
    const latencies = [];

    for (const note of notes) {
      // Find first correct detection after note onset
      let latency = null;

      for (const detection of detections) {
        if (detection.time < note.startTime) continue;

        if (detection.frequency !== null) {
          const cents = Math.abs(this.getCentsDifference(detection.frequency, note.frequency));
          if (cents <= this.toleranceCents) {
            latency = detection.time - note.startTime;
            break;
          }
        }
      }

      if (latency !== null) {
        latencies.push(latency);
      }
    }

    return {
      meanLatency: latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : null,
      medianLatency: this._calculateMedian(latencies),
      minLatency: latencies.length > 0 ? Math.min(...latencies) : null,
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : null,
      detectedNotes: latencies.length,
      totalNotes: notes.length,
      detectionRate: notes.length > 0 ? latencies.length / notes.length : 0,
    };
  }

  /**
   * Compare two detectors on the same audio
   * @param {Array} detections1 - First detector results
   * @param {Array} detections2 - Second detector results
   * @param {Array} groundTruth - Ground truth
   * @returns {object} Comparison results
   */
  compare(detections1, detections2, groundTruth) {
    const result1 = this.evaluate(detections1, groundTruth);
    const result2 = this.evaluate(detections2, groundTruth);

    const comparison = {
      detector1: result1.metrics,
      detector2: result2.metrics,
      differences: {},
    };

    // Calculate differences for each metric
    const metricKeys = ['rpa', 'gpe', 'octaveErrorRate', 'voicingAccuracy', 'meanAbsCentsError'];
    for (const key of metricKeys) {
      const v1 = result1.metrics[key];
      const v2 = result2.metrics[key];
      comparison.differences[key] = v2 - v1;
    }

    // Determine winner for each metric
    comparison.winner = {
      rpa: comparison.differences.rpa > 0 ? 'detector2' : (comparison.differences.rpa < 0 ? 'detector1' : 'tie'),
      gpe: comparison.differences.gpe < 0 ? 'detector2' : (comparison.differences.gpe > 0 ? 'detector1' : 'tie'),
      octaveErrorRate: comparison.differences.octaveErrorRate < 0 ? 'detector2' :
        (comparison.differences.octaveErrorRate > 0 ? 'detector1' : 'tie'),
      voicingAccuracy: comparison.differences.voicingAccuracy > 0 ? 'detector2' :
        (comparison.differences.voicingAccuracy < 0 ? 'detector1' : 'tie'),
      meanAbsCentsError: comparison.differences.meanAbsCentsError < 0 ? 'detector2' :
        (comparison.differences.meanAbsCentsError > 0 ? 'detector1' : 'tie'),
    };

    return comparison;
  }

  /**
   * Generate a summary report
   * @param {object} metrics - Metrics from evaluate()
   * @param {string} detectorName - Name of the detector
   * @returns {string} Human-readable report
   */
  generateReport(metrics, detectorName = 'Detector') {
    const lines = [
      `=== ${detectorName} Evaluation Report ===`,
      '',
      'Accuracy Metrics:',
      `  Raw Pitch Accuracy (RPA): ${(metrics.rpa * 100).toFixed(1)}%`,
      `  Gross Pitch Error (GPE):  ${(metrics.gpe * 100).toFixed(1)}%`,
      `  Octave Error Rate:        ${(metrics.octaveErrorRate * 100).toFixed(1)}%`,
      `  Voicing Accuracy:         ${(metrics.voicingAccuracy * 100).toFixed(1)}%`,
      '',
      'Pitch Error Statistics:',
      `  Mean Cents Error:    ${metrics.meanCentsError.toFixed(1)} cents`,
      `  Median Cents Error:  ${metrics.medianCentsError?.toFixed(1) ?? 'N/A'} cents`,
      `  Mean Abs Error:      ${metrics.meanAbsCentsError.toFixed(1)} cents`,
      `  Std Dev:             ${metrics.stdCentsError?.toFixed(1) ?? 'N/A'} cents`,
      '',
      'Frame Counts:',
      `  Total Frames:        ${metrics.totalFrames}`,
      `  Voiced Frames:       ${metrics.totalVoicedFrames}`,
      `  Correct Frames:      ${metrics.correctFrames}`,
      `  Gross Errors:        ${metrics.grossErrors}`,
    ];

    if (metrics.confidenceDiscriminates !== null) {
      lines.push('');
      lines.push('Confidence Analysis:');
      lines.push(`  Mean (correct):   ${metrics.meanConfidenceCorrect?.toFixed(3) ?? 'N/A'}`);
      lines.push(`  Mean (incorrect): ${metrics.meanConfidenceIncorrect?.toFixed(3) ?? 'N/A'}`);
      lines.push(`  Discriminates:    ${metrics.confidenceDiscriminates ? 'Yes' : 'No'}`);
    }

    return lines.join('\n');
  }

  /**
   * Calculate standard deviation
   * @private
   */
  _calculateStd(values) {
    if (values.length === 0) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Calculate median
   * @private
   */
  _calculateMedian(values) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }
}
