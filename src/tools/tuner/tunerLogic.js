/**
 * Pure tuning math. No DOM, no audio — easy to unit-test.
 */

import { FrequencyConverter } from '@/pitch-engine';
import { midiToFreqAtReference } from './tunings.js';

/** Cents within this band are considered "in tune". */
export const IN_TUNE_CENTS = 5;

/** Above this absolute cent value the user is clearly off — bias to "Low/High". */
export const OFF_CENTS = 15;

/**
 * Cents difference from `freq` to `target`. Positive = freq is sharper than
 * target (i.e. user's pitch is too high).
 */
export function cents(freq, target) {
  if (!freq || !target) return null;
  return 1200 * Math.log2(freq / target);
}

/**
 * Pick the closest string (by absolute cent distance) to a detected
 * frequency. Returns the string + its cents-off, or null if there are no
 * strings (chromatic mode).
 */
export function findClosestString(frequency, strings) {
  if (!frequency || !strings || strings.length === 0) return null;
  let best = null;
  for (let i = 0; i < strings.length; i++) {
    const c = cents(frequency, strings[i].frequency);
    if (best === null || Math.abs(c) < Math.abs(best.cents)) {
      best = { index: i, string: strings[i], cents: c };
    }
  }
  return best;
}

/**
 * For chromatic mode: snap detected frequency to the nearest semitone and
 * compute cents-off using the supplied reference pitch.
 */
export function nearestSemitone(frequency, referenceA4 = 440) {
  if (!frequency) return null;
  const midiFloat = 69 + 12 * Math.log2(frequency / referenceA4);
  const midi = Math.round(midiFloat);
  const target = midiToFreqAtReference(midi, referenceA4);
  return {
    midi,
    noteName: FrequencyConverter.midiToNoteName(midi),
    target,
    cents: cents(frequency, target),
  };
}

/**
 * Classify a cents value into one of three semantic statuses for the UI.
 */
export function tuningStatus(centsValue) {
  if (centsValue == null) return 'silent';
  if (Math.abs(centsValue) <= IN_TUNE_CENTS) return 'in-tune';
  return centsValue < 0 ? 'low' : 'high';
}

/**
 * Color classification for cents readout: green / yellow / red. Used by both
 * the cents strip and the per-string rings.
 */
export function centsColor(centsValue) {
  if (centsValue == null) return 'muted';
  const a = Math.abs(centsValue);
  if (a <= IN_TUNE_CENTS) return 'in-tune';
  if (a <= OFF_CENTS) return 'close';
  return 'off';
}

/**
 * Clamp + map a cents value (-50..+50) to a 0..1 horizontal position for the
 * cents strip. Anything beyond ±50 cents pins to the edge.
 */
export function centsToStripPosition(centsValue) {
  if (centsValue == null) return 0.5;
  const clamped = Math.max(-50, Math.min(50, centsValue));
  return (clamped + 50) / 100;
}

/**
 * Strip the octave digit from a note name like "F#4" → "F#". Returns the
 * octave separately.
 */
export function splitNoteName(noteName) {
  if (!noteName) return { letter: '', octave: '' };
  const m = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!m) return { letter: noteName, octave: '' };
  return { letter: m[1], octave: m[2] };
}
