/**
 * Pitch Engine - Standalone pitch detection module
 * Export all public APIs
 */

// Main pitch detection
export { PitchDetector, DetectorType } from './PitchDetector.js';
export { FrequencyConverter } from './FrequencyConverter.js';
export { AudioAnalyzer } from './AudioAnalyzer.js';

// Detector implementations
export { BasePitchDetector } from './detectors/BasePitchDetector.js';
export { HybridPitchDetector } from './detectors/HybridPitchDetector.js';
export { CREPEPitchDetector, CREPEState } from './detectors/CREPEPitchDetector.js';

// Evaluation framework
export { TestSignalGenerator } from './evaluation/TestSignalGenerator.js';
export { PitchEvaluator } from './evaluation/PitchEvaluator.js';
export { OnsetDetector } from './evaluation/OnsetDetector.js';
export { EvaluationRunner } from './evaluation/EvaluationRunner.js';
