/**
 * Pure music-theory helpers for the Circle of Fifths tool.
 *
 * The wheel is indexed clockwise from 12 o'clock:
 *   0 = C / Am          (0 ♯/♭)
 *   1 = G / Em          (1♯)
 *   2 = D / Bm          (2♯)
 *   3 = A / F♯m         (3♯)
 *   4 = E / C♯m         (4♯)
 *   5 = B / G♯m         (5♯) — also Cb/Abm (7♭)
 *   6 = F♯ / D♯m        (6♯) — also Gb/Ebm (6♭)
 *   7 = D♭ / B♭m        (5♭)
 *   8 = A♭ / Fm         (4♭)
 *   9 = E♭ / Cm         (3♭)
 *   10 = B♭ / Gm        (2♭)
 *   11 = F / Dm         (1♭)
 */

export const POSITION_COUNT = 12;

// Per-position canonical major key spelling (sharps preferred until 6♯; flats
// from position 7 onward; position 6 picks Gb so we get a flat-side spelling
// at the bottom of the wheel matching the inspiration art).
export const MAJOR_KEYS = [
  { pos: 0,  tonic: 'C',  semitone: 0,  accidentals: [],                                    accCount: 0,  accType: null },
  { pos: 1,  tonic: 'G',  semitone: 7,  accidentals: ['F#'],                                accCount: 1,  accType: 'sharp' },
  { pos: 2,  tonic: 'D',  semitone: 2,  accidentals: ['F#','C#'],                           accCount: 2,  accType: 'sharp' },
  { pos: 3,  tonic: 'A',  semitone: 9,  accidentals: ['F#','C#','G#'],                      accCount: 3,  accType: 'sharp' },
  { pos: 4,  tonic: 'E',  semitone: 4,  accidentals: ['F#','C#','G#','D#'],                 accCount: 4,  accType: 'sharp' },
  { pos: 5,  tonic: 'B',  semitone: 11, accidentals: ['F#','C#','G#','D#','A#'],            accCount: 5,  accType: 'sharp' },
  { pos: 6,  tonic: 'Gb', semitone: 6,  accidentals: ['Bb','Eb','Ab','Db','Gb','Cb'],       accCount: 6,  accType: 'flat',  enharmonic: 'F#' },
  { pos: 7,  tonic: 'Db', semitone: 1,  accidentals: ['Bb','Eb','Ab','Db','Gb'],            accCount: 5,  accType: 'flat' },
  { pos: 8,  tonic: 'Ab', semitone: 8,  accidentals: ['Bb','Eb','Ab','Db'],                 accCount: 4,  accType: 'flat' },
  { pos: 9,  tonic: 'Eb', semitone: 3,  accidentals: ['Bb','Eb','Ab'],                      accCount: 3,  accType: 'flat' },
  { pos: 10, tonic: 'Bb', semitone: 10, accidentals: ['Bb','Eb'],                           accCount: 2,  accType: 'flat' },
  { pos: 11, tonic: 'F',  semitone: 5,  accidentals: ['Bb'],                                accCount: 1,  accType: 'flat' },
];

// Relative minor of each position. The minor tonic is 3 semitones below the
// major tonic and uses the same key signature.
export const MINOR_KEYS = [
  { pos: 0,  tonic: 'Am'   },
  { pos: 1,  tonic: 'Em'   },
  { pos: 2,  tonic: 'Bm'   },
  { pos: 3,  tonic: 'F#m'  },
  { pos: 4,  tonic: 'C#m'  },
  { pos: 5,  tonic: 'G#m'  },
  { pos: 6,  tonic: 'Ebm', enharmonic: 'D#m' },
  { pos: 7,  tonic: 'Bbm'  },
  { pos: 8,  tonic: 'Fm'   },
  { pos: 9,  tonic: 'Cm'   },
  { pos: 10, tonic: 'Gm'   },
  { pos: 11, tonic: 'Dm'   },
];

// Chromatic spellings — first entry is the sharp form, second is the flat form.
const SHARP_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_NAMES  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

/** Note name for a semitone, choosing sharp/flat spelling per the key context. */
export function spellNote(semitone, accType) {
  const s = ((semitone % 12) + 12) % 12;
  return accType === 'flat' ? FLAT_NAMES[s] : SHARP_NAMES[s];
}

// Chord interval recipes (in semitones above the root).
export const CHORD_RECIPES = {
  major:    { triad: [0, 4, 7],  seventh: [0, 4, 7, 11] }, // M7
  minor:    { triad: [0, 3, 7],  seventh: [0, 3, 7, 10] }, // m7
  dim:      { triad: [0, 3, 6],  seventh: [0, 3, 6, 9]  }, // dim7 (or m7♭5 — using true dim7 for color)
  dom:      { triad: [0, 4, 7],  seventh: [0, 4, 7, 10] }, // dominant 7
  aug:      { triad: [0, 4, 8],  seventh: [0, 4, 8, 10] },
};

/**
 * Diatonic chord types per scale degree. We use:
 *   - Pure major-key triads
 *   - Minor key with raised 7th for V (the most useful "modal mix" choice
 *     for the audible practice this tool is for)
 */
export const MAJOR_DEGREES = [
  { numeral: 'I',   roman: 'I',    semitone: 0,  type: 'major' },
  { numeral: 'ii',  roman: 'ii',   semitone: 2,  type: 'minor' },
  { numeral: 'iii', roman: 'iii',  semitone: 4,  type: 'minor' },
  { numeral: 'IV',  roman: 'IV',   semitone: 5,  type: 'major' },
  { numeral: 'V',   roman: 'V',    semitone: 7,  type: 'major' },
  { numeral: 'vi',  roman: 'vi',   semitone: 9,  type: 'minor' },
  { numeral: 'vii°',roman: 'vii°', semitone: 11, type: 'dim'   },
];

export const MINOR_DEGREES = [
  { numeral: 'i',   roman: 'i',    semitone: 0,  type: 'minor' },
  { numeral: 'ii°', roman: 'ii°',  semitone: 2,  type: 'dim'   },
  { numeral: 'III', roman: 'III',  semitone: 3,  type: 'major' },
  { numeral: 'iv',  roman: 'iv',   semitone: 5,  type: 'minor' },
  { numeral: 'V',   roman: 'V',    semitone: 7,  type: 'major' }, // raised 7th — dominant function
  { numeral: 'VI',  roman: 'VI',   semitone: 8,  type: 'major' },
  { numeral: 'VII', roman: 'VII',  semitone: 10, type: 'major' },
];

/**
 * Build the seven diatonic chord descriptors for a key.
 *   key: { pos, tonic, semitone, accType } — major or minor key
 *   mode: 'major' | 'minor'
 * Returns: [{ numeral, root, type, name, semitones }] where:
 *   - root: spelled note name ("C", "F#", "Bb")
 *   - type: 'major' | 'minor' | 'dim'
 *   - name: full chord label ("C", "Dm", "B°")
 *   - semitones: absolute MIDI semitones (for ChordSynth) — root in octave 4
 */
export function diatonicChords(tonicSemitone, accType, mode) {
  const degrees = mode === 'minor' ? MINOR_DEGREES : MAJOR_DEGREES;
  return degrees.map((d) => {
    const rootSemi = (tonicSemitone + d.semitone) % 12;
    const root = spellNote(rootSemi, accType);
    return {
      numeral: d.numeral,
      root,
      type: d.type,
      name: chordName(root, d.type),
      semitones: rootSemi, // 0..11 — actual octave assigned at synth time
    };
  });
}

export function chordName(root, type) {
  if (type === 'minor') return root + 'm';
  if (type === 'dim') return root + '°';
  if (type === 'aug') return root + '+';
  if (type === 'dom') return root + '7';
  return root;
}

/**
 * Resolve a Roman-numeral progression to chord descriptors in a given key.
 * Accepts numerals like: I, ii, iii, IV, V, vi, vii°, i, ii°, III, iv, V, VI, VII
 * Optionally followed by a chord-quality suffix: 7, maj7, m7, 7b9, etc.
 *
 *   romans: array of strings
 *   tonicSemitone, accType: from the user's selected key
 *   mode: 'major' | 'minor' — what mode the progression is in
 */
export function progressionToChords(romans, tonicSemitone, accType, mode) {
  const table = mode === 'minor' ? MINOR_DEGREES : MAJOR_DEGREES;
  const lookup = new Map();
  for (const d of table) lookup.set(d.numeral.toLowerCase().replace('°','dim'), d);

  return romans.map((raw) => {
    // Pull off any quality suffix after the numeral
    const m = raw.match(/^([ivIV]+°?b?)(.*)$/);
    if (!m) return { name: raw, root: 'C', type: 'major', semitones: 0 };
    const numeralRaw = m[1];
    const suffix = m[2]; // "", "7", "maj7", etc.
    const key = numeralRaw.toLowerCase().replace('°','dim');
    const d = lookup.get(key);
    if (!d) return { name: raw, root: 'C', type: 'major', semitones: 0 };
    const rootSemi = (tonicSemitone + d.semitone) % 12;
    const root = spellNote(rootSemi, accType);
    let type = d.type;
    if (suffix === '7') {
      // "V7" → dominant 7; "I7" → dominant 7 (blues style); "i7" → minor 7
      if (type === 'major') type = 'dom';
    } else if (suffix === 'maj7') {
      type = 'major'; // marked separately by quality
    }
    return {
      numeral: numeralRaw + suffix,
      root,
      type,
      quality: suffix || null,
      name: chordName(root, type) + (suffix === 'maj7' ? 'M7' : suffix === '7' && type === 'minor' ? '7' : suffix === '7' ? '' : ''),
      semitones: rootSemi,
    };
  });
}

/**
 * For a given selected key (pos, mode), return for every wheel position the
 * roman-numeral function it represents (or null if it's not in the key).
 *   selectedPos: 0..11
 *   mode: 'major' | 'minor'
 *   ring: 'major' | 'minor' (which ring's chord on that position)
 * Returns: { 0: { numeral: 'IV', isTonic: false }, ... }
 */
export function functionMap(selectedPos, mode) {
  // The 6 diatonic chords (excluding the dim) live in 3 adjacent wheel
  // sectors: pos-1 (subdominant), pos (tonic), pos+1 (dominant).
  // For majors: outer ring has I/IV/V; inner ring has the relative minors
  // (vi/ii/iii respectively). For minor key, the inner ring is the tonic.
  const functions = {};
  const map = mode === 'major'
    ? {
        '-1': { major: 'IV', minor: 'ii' },
        '0':  { major: 'I',  minor: 'vi' },
        '+1': { major: 'V',  minor: 'iii' },
      }
    : {
        '-1': { major: 'VI', minor: 'iv' },
        '0':  { major: 'III',minor: 'i' },
        '+1': { major: 'VII',minor: 'v' },
      };
  for (const offset of [-1, 0, 1]) {
    const wheelPos = (selectedPos + offset + 12) % 12;
    const ents = map[String(offset >= 0 ? '+' + offset : offset).replace('+0','0')]
      ?? map[String(offset)]
      ?? null;
    const m = offset === 0 ? map['0'] : (offset === -1 ? map['-1'] : map['+1']);
    functions[wheelPos] = {
      major: m.major,
      minor: m.minor,
      isTonic: offset === 0,
    };
  }
  // vii° / ii° lives 5 fifths away from tonic (pos +5 in major, pos +1 in minor — actually pos +2)
  // For now omit; we mark dim chords inside the hub.
  return functions;
}
