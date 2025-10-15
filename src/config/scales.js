/**
 * Scale definitions - intervals in semitones from root
 */

export const SCALES = {
  major: {
    name: 'Major Scale',
    intervals: [0, 2, 4, 5, 7, 9, 11, 12],
    degrees: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti', 'Do'],
  },
  minor: {
    name: 'Natural Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10, 12],
    degrees: ['Do', 'Re', 'Me', 'Fa', 'Sol', 'Le', 'Te', 'Do'],
  },
  harmonicMinor: {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11, 12],
    degrees: ['Do', 'Re', 'Me', 'Fa', 'Sol', 'Le', 'Ti', 'Do'],
  },
  melodicMinor: {
    name: 'Melodic Minor',
    intervals: [0, 2, 3, 5, 7, 9, 11, 12],
    degrees: ['Do', 'Re', 'Me', 'Fa', 'Sol', 'La', 'Ti', 'Do'],
  },
  dorian: {
    name: 'Dorian Mode',
    intervals: [0, 2, 3, 5, 7, 9, 10, 12],
    degrees: ['Do', 'Re', 'Me', 'Fa', 'Sol', 'La', 'Te', 'Do'],
  },
  mixolydian: {
    name: 'Mixolydian Mode',
    intervals: [0, 2, 4, 5, 7, 9, 10, 12],
    degrees: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Te', 'Do'],
  },
  major7: {
    name: 'Major 7th',
    intervals: [0, 4, 7, 11, 12],
    degrees: ['Do', 'Mi', 'Sol', 'Ti', 'Do'],
  },
  dominant7: {
    name: 'Dominant 7th',
    intervals: [0, 4, 7, 10, 12],
    degrees: ['Do', 'Mi', 'Sol', 'Te', 'Do'],
  },
  minor7: {
    name: 'Minor 7th',
    intervals: [0, 3, 7, 10, 12],
    degrees: ['Do', 'Me', 'Sol', 'Te', 'Do'],
  },
  minorMajor7: {
    name: 'Minor Major 7th',
    intervals: [0, 3, 7, 11, 12],
    degrees: ['Do', 'Me', 'Sol', 'Ti', 'Do'],
  },
  halfDiminished7: {
    name: 'Half Diminished 7th',
    intervals: [0, 3, 6, 10, 12],
    degrees: ['Do', 'Me', 'Fi', 'Te', 'Do'],
  },
  diminished7: {
    name: 'Diminished 7th',
    intervals: [0, 3, 6, 9, 12],
    degrees: ['Do', 'Me', 'Fi', 'La', 'Do'],
  },
  chromatic: {
    name: 'Chromatic Scale',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    degrees: ['Do', 'Di', 'Re', 'Ri', 'Mi', 'Fa', 'Fi', 'Sol', 'Si', 'La', 'Li', 'Ti', 'Do'],
  },
  pentatonic: {
    name: 'Pentatonic Major',
    intervals: [0, 2, 4, 7, 9, 12],
    degrees: ['Do', 'Re', 'Mi', 'Sol', 'La', 'Do'],
  },
  blues: {
    name: 'Blues Scale',
    intervals: [0, 3, 5, 6, 7, 10],
    degrees: ['Do', 'Me', 'Fa', 'Fi', 'Sol', 'Te'],
  },
  wholeTone: {
    name: 'Whole Tone',
    intervals: [0, 2, 4, 6, 8, 10],
    degrees: ['Do', 'Re', 'Mi', 'Fi', 'Si', 'Li'],
  },
  diminished: {
    name: 'Diminished (Half-Whole)',
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    degrees: ['Do', 'Ra', 'Me', 'Fa', 'Se', 'Sol', 'Le', 'Te'],
  },
};

export const DEFAULT_SCALE = 'major';
