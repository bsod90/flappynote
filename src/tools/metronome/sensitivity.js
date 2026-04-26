/**
 * Slider value (1..100) ↔ OnsetDetector peak threshold (0..1).
 *
 * Higher slider = more sensitive (lower threshold). Mapping is logarithmic
 * so each step feels meaningful across the wide range of useful values.
 *
 *   slider  1  → threshold 0.05   (least sensitive — only hard hits)
 *   slider 50  → threshold ~0.007 (default — typical practice pad)
 *   slider 100 → threshold 0.0008 (most sensitive — fingertip taps)
 */
export const T_MAX = 0.05;
export const T_MIN = 0.0008;

export function sensitivityToThreshold(sliderValue) {
  const s = Math.max(1, Math.min(100, Number(sliderValue) || 50));
  const t = (s - 1) / 99; // 0..1
  return T_MAX * Math.pow(T_MIN / T_MAX, t);
}

export function thresholdToSensitivity(threshold) {
  const t = Math.max(T_MIN, Math.min(T_MAX, Number(threshold) || 0.007));
  const x = Math.log(t / T_MAX) / Math.log(T_MIN / T_MAX);
  return Math.round(1 + x * 99);
}
