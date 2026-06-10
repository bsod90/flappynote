/**
 * Public-domain melody catalog for sing-along exercises.
 *
 * Each note: semitone offset from the chosen root (0 = do, may be negative
 * for notes below the tonic), the lyric syllable sung on it, and an optional
 * `hold` multiplier for phrase-ending notes (scales the sustain requirement).
 *
 * Melodies are transcribed one note per syllable; short melismas are
 * simplified to a single pitch so each target carries exactly one syllable.
 * All melodies and lyrics below are public domain in the US.
 */

export const MELODIES = {
  twinkleTwinkle: {
    name: 'Twinkle Twinkle Little Star',
    scaleType: 'major',
    notes: [
      { s: 0, l: 'Twin' }, { s: 0, l: 'kle' }, { s: 7, l: 'twin' }, { s: 7, l: 'kle' },
      { s: 9, l: 'lit' }, { s: 9, l: 'tle' }, { s: 7, l: 'star', hold: 2 },
      { s: 5, l: 'how' }, { s: 5, l: 'I' }, { s: 4, l: 'won' }, { s: 4, l: 'der' },
      { s: 2, l: 'what' }, { s: 2, l: 'you' }, { s: 0, l: 'are', hold: 2 },
      { s: 7, l: 'Up' }, { s: 7, l: 'a' }, { s: 5, l: 'bove' }, { s: 5, l: 'the' },
      { s: 4, l: 'world' }, { s: 4, l: 'so' }, { s: 2, l: 'high', hold: 2 },
      { s: 7, l: 'like' }, { s: 7, l: 'a' }, { s: 5, l: 'dia' }, { s: 5, l: 'mond' },
      { s: 4, l: 'in' }, { s: 4, l: 'the' }, { s: 2, l: 'sky', hold: 2 },
    ],
  },

  maryHadALittleLamb: {
    name: 'Mary Had a Little Lamb',
    scaleType: 'major',
    notes: [
      { s: 4, l: 'Ma' }, { s: 2, l: 'ry' }, { s: 0, l: 'had' }, { s: 2, l: 'a' },
      { s: 4, l: 'lit' }, { s: 4, l: 'tle' }, { s: 4, l: 'lamb', hold: 2 },
      { s: 2, l: 'lit' }, { s: 2, l: 'tle' }, { s: 2, l: 'lamb', hold: 2 },
      { s: 4, l: 'lit' }, { s: 7, l: 'tle' }, { s: 7, l: 'lamb', hold: 2 },
      { s: 4, l: 'Ma' }, { s: 2, l: 'ry' }, { s: 0, l: 'had' }, { s: 2, l: 'a' },
      { s: 4, l: 'lit' }, { s: 4, l: 'tle' }, { s: 4, l: 'lamb' }, { s: 4, l: 'its' },
      { s: 2, l: 'fleece' }, { s: 2, l: 'was' }, { s: 4, l: 'white' }, { s: 2, l: 'as' },
      { s: 0, l: 'snow', hold: 2 },
    ],
  },

  rowYourBoat: {
    name: 'Row Row Row Your Boat',
    scaleType: 'major',
    notes: [
      { s: 0, l: 'Row' }, { s: 0, l: 'row' }, { s: 0, l: 'row' }, { s: 2, l: 'your' },
      { s: 4, l: 'boat', hold: 2 },
      { s: 4, l: 'gent' }, { s: 2, l: 'ly' }, { s: 4, l: 'down' }, { s: 5, l: 'the' },
      { s: 7, l: 'stream', hold: 2 },
      { s: 12, l: 'mer' }, { s: 12, l: 'ri' }, { s: 12, l: 'ly' },
      { s: 7, l: 'mer' }, { s: 7, l: 'ri' }, { s: 7, l: 'ly' },
      { s: 4, l: 'mer' }, { s: 4, l: 'ri' }, { s: 4, l: 'ly' },
      { s: 0, l: 'mer' }, { s: 0, l: 'ri' }, { s: 0, l: 'ly' },
      { s: 7, l: 'life' }, { s: 5, l: 'is' }, { s: 4, l: 'but' }, { s: 2, l: 'a' },
      { s: 0, l: 'dream', hold: 2 },
    ],
  },

  freresJacques: {
    name: 'Frère Jacques (Are You Sleeping)',
    scaleType: 'major',
    notes: [
      { s: 0, l: 'Are' }, { s: 2, l: 'you' }, { s: 4, l: 'sleep' }, { s: 0, l: 'ing' },
      { s: 0, l: 'are' }, { s: 2, l: 'you' }, { s: 4, l: 'sleep' }, { s: 0, l: 'ing' },
      { s: 4, l: 'Bro' }, { s: 5, l: 'ther' }, { s: 7, l: 'John', hold: 2 },
      { s: 4, l: 'Bro' }, { s: 5, l: 'ther' }, { s: 7, l: 'John', hold: 2 },
      { s: 7, l: 'Morn' }, { s: 9, l: 'ing' }, { s: 7, l: 'bells' }, { s: 5, l: 'are' },
      { s: 4, l: 'ring' }, { s: 0, l: 'ing' },
      { s: 7, l: 'morn' }, { s: 9, l: 'ing' }, { s: 7, l: 'bells' }, { s: 5, l: 'are' },
      { s: 4, l: 'ring' }, { s: 0, l: 'ing' },
      { s: 0, l: 'Ding' }, { s: -5, l: 'dang' }, { s: 0, l: 'dong', hold: 2 },
      { s: 0, l: 'ding' }, { s: -5, l: 'dang' }, { s: 0, l: 'dong', hold: 2 },
    ],
  },

  odeToJoy: {
    name: 'Ode to Joy (Beethoven)',
    scaleType: 'major',
    notes: [
      { s: 4, l: 'Joy' }, { s: 4, l: 'ful' }, { s: 5, l: 'joy' }, { s: 7, l: 'ful' },
      { s: 7, l: 'we' }, { s: 5, l: 'a' }, { s: 4, l: 'dore' }, { s: 2, l: 'thee' },
      { s: 0, l: 'God' }, { s: 0, l: 'of' }, { s: 2, l: 'glo' }, { s: 4, l: 'ry' },
      { s: 4, l: 'Lord' }, { s: 2, l: 'of' }, { s: 2, l: 'love', hold: 2 },
      { s: 4, l: 'Hearts' }, { s: 4, l: 'un' }, { s: 5, l: 'fold' }, { s: 7, l: 'like' },
      { s: 7, l: 'flowers' }, { s: 5, l: 'be' }, { s: 4, l: 'fore' }, { s: 2, l: 'thee' },
      { s: 0, l: 'open' }, { s: 0, l: 'ing' }, { s: 2, l: 'to' }, { s: 4, l: 'the' },
      { s: 2, l: 'sun' }, { s: 0, l: 'a' }, { s: 0, l: 'bove', hold: 2 },
    ],
  },

  happyBirthday: {
    name: 'Happy Birthday',
    scaleType: 'major',
    notes: [
      { s: -5, l: 'Hap' }, { s: -5, l: 'py' }, { s: -3, l: 'birth' }, { s: -5, l: 'day' },
      { s: 0, l: 'to' }, { s: -1, l: 'you', hold: 2 },
      { s: -5, l: 'hap' }, { s: -5, l: 'py' }, { s: -3, l: 'birth' }, { s: -5, l: 'day' },
      { s: 2, l: 'to' }, { s: 0, l: 'you', hold: 2 },
      { s: -5, l: 'hap' }, { s: -5, l: 'py' }, { s: 7, l: 'birth' }, { s: 4, l: 'day' },
      { s: 0, l: 'dear' }, { s: -1, l: 'sing' }, { s: -3, l: 'er', hold: 2 },
      { s: 5, l: 'hap' }, { s: 5, l: 'py' }, { s: 4, l: 'birth' }, { s: 0, l: 'day' },
      { s: 2, l: 'to' }, { s: 0, l: 'you', hold: 2 },
    ],
  },

  whenTheSaints: {
    name: 'When the Saints Go Marching In',
    scaleType: 'major',
    notes: [
      { s: 0, l: 'Oh' }, { s: 4, l: 'when' }, { s: 5, l: 'the' }, { s: 7, l: 'saints', hold: 2 },
      { s: 0, l: 'go' }, { s: 4, l: 'march' }, { s: 5, l: 'ing' }, { s: 7, l: 'in', hold: 2 },
      { s: 0, l: 'oh' }, { s: 4, l: 'when' }, { s: 5, l: 'the' }, { s: 7, l: 'saints' },
      { s: 4, l: 'go' }, { s: 0, l: 'march' }, { s: 4, l: 'ing' }, { s: 2, l: 'in', hold: 2 },
      { s: 4, l: 'Oh' }, { s: 4, l: 'Lord' }, { s: 2, l: 'I' }, { s: 0, l: 'want' },
      { s: 0, l: 'to' }, { s: 4, l: 'be' }, { s: 7, l: 'in' }, { s: 7, l: 'that' },
      { s: 5, l: 'num' }, { s: 5, l: 'ber', hold: 2 },
      { s: 4, l: 'when' }, { s: 5, l: 'the' }, { s: 7, l: 'saints' }, { s: 4, l: 'go' },
      { s: 0, l: 'march' }, { s: 2, l: 'ing' }, { s: 0, l: 'in', hold: 2 },
    ],
  },

  londonBridge: {
    name: 'London Bridge Is Falling Down',
    scaleType: 'major',
    notes: [
      { s: 7, l: 'Lon' }, { s: 9, l: 'don' }, { s: 7, l: 'bridge' }, { s: 5, l: 'is' },
      { s: 4, l: 'fall' }, { s: 5, l: 'ing' }, { s: 7, l: 'down', hold: 2 },
      { s: 2, l: 'fall' }, { s: 4, l: 'ing' }, { s: 5, l: 'down', hold: 2 },
      { s: 4, l: 'fall' }, { s: 5, l: 'ing' }, { s: 7, l: 'down', hold: 2 },
      { s: 7, l: 'Lon' }, { s: 9, l: 'don' }, { s: 7, l: 'bridge' }, { s: 5, l: 'is' },
      { s: 4, l: 'fall' }, { s: 5, l: 'ing' }, { s: 7, l: 'down', hold: 2 },
      { s: 2, l: 'my' }, { s: 7, l: 'fair' }, { s: 4, l: 'la' }, { s: 0, l: 'dy', hold: 2 },
    ],
  },
};
