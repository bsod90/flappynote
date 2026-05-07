/**
 * Tuning presets for the tuner. Each instrument has one or more named tunings;
 * a tuning is a list of strings ordered low → high. Each entry carries a
 * MIDI note number; the human-readable name and target frequency are derived.
 */

import { FrequencyConverter } from '@/pitch-engine';

/**
 * Build a string descriptor from a MIDI note + reference A4.
 * @param {number} midi - MIDI note number (e.g. 40 = E2)
 * @param {number} referenceA4 - Reference frequency for A4 (default 440)
 * @returns {{midi: number, noteName: string, frequency: number}}
 */
export function makeString(midi, referenceA4 = 440) {
  const noteName = FrequencyConverter.midiToNoteName(midi);
  const frequency = midiToFreqAtReference(midi, referenceA4);
  return { midi, noteName, frequency };
}

/**
 * Convert a MIDI number to frequency using a custom A4 reference. Mirrors
 * FrequencyConverter.midiToFrequency but with a configurable reference, so
 * users tuning to A4=441 / 442 / 432 see correct targets.
 */
export function midiToFreqAtReference(midi, referenceA4) {
  return referenceA4 * Math.pow(2, (midi - 69) / 12);
}

const TUNINGS = {
  guitar: {
    label: 'Guitar',
    tunings: {
      standard:    { label: 'Standard',    midi: [40, 45, 50, 55, 59, 64] }, // E2 A2 D3 G3 B3 E4
      'drop-d':    { label: 'Drop D',      midi: [38, 45, 50, 55, 59, 64] }, // D2 A2 D3 G3 B3 E4
      'half-step': { label: 'Half-step',   midi: [39, 44, 49, 54, 58, 63] }, // E♭2 A♭2 D♭3 G♭3 B♭3 E♭4
      'open-d':    { label: 'Open D',      midi: [38, 45, 50, 54, 57, 62] }, // D2 A2 D3 F#3 A3 D4
      'open-g':    { label: 'Open G',      midi: [38, 43, 50, 55, 59, 62] }, // D2 G2 D3 G3 B3 D4
      dadgad:      { label: 'DADGAD',      midi: [38, 45, 50, 55, 57, 62] }, // D2 A2 D3 G3 A3 D4
    },
    defaultTuning: 'standard',
  },
  bass: {
    label: 'Bass (4-string)',
    tunings: {
      standard: { label: 'Standard',  midi: [28, 33, 38, 43] },               // E1 A1 D2 G2
      'drop-d': { label: 'Drop D',    midi: [26, 33, 38, 43] },               // D1 A1 D2 G2
    },
    defaultTuning: 'standard',
  },
  bass5: {
    label: 'Bass (5-string)',
    tunings: {
      standard: { label: 'Standard',  midi: [23, 28, 33, 38, 43] },           // B0 E1 A1 D2 G2
    },
    defaultTuning: 'standard',
  },
  ukulele: {
    label: 'Ukulele',
    tunings: {
      standard: { label: 'Standard (GCEA)', midi: [67, 60, 64, 69] },         // G4 C4 E4 A4
      'low-g':  { label: 'Low G (gCEA)',    midi: [55, 60, 64, 69] },         // G3 C4 E4 A4
    },
    defaultTuning: 'standard',
  },
  violin: {
    label: 'Violin',
    tunings: {
      standard: { label: 'Standard', midi: [55, 62, 69, 76] }, // G3 D4 A4 E5
    },
    defaultTuning: 'standard',
  },
  chromatic: {
    label: 'Chromatic',
    // No fixed strings — the tuner snaps to the nearest semitone in the full
    // detection range. UI hides the strings row in this mode.
    tunings: {
      chromatic: { label: 'Any pitch', midi: [] },
    },
    defaultTuning: 'chromatic',
  },
};

export function getInstruments() {
  return Object.entries(TUNINGS).map(([id, def]) => ({ id, label: def.label }));
}

export function getTuningsFor(instrumentId) {
  const def = TUNINGS[instrumentId];
  if (!def) return [];
  return Object.entries(def.tunings).map(([id, t]) => ({ id, label: t.label }));
}

export function getDefaultTuning(instrumentId) {
  return TUNINGS[instrumentId]?.defaultTuning ?? null;
}

/**
 * Resolve a (instrument, tuning, referenceA4) combo into an array of strings
 * ready for the UI. Returns [] for chromatic mode.
 */
export function getStrings(instrumentId, tuningId, referenceA4 = 440) {
  const def = TUNINGS[instrumentId];
  if (!def) return [];
  const tuning = def.tunings[tuningId] ?? def.tunings[def.defaultTuning];
  if (!tuning || !tuning.midi.length) return [];
  return tuning.midi.map((m) => makeString(m, referenceA4));
}

export function isChromatic(instrumentId) {
  return instrumentId === 'chromatic';
}
