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

  ohSusanna: {
    name: 'Oh Susanna',
    scaleType: 'major',
    notes: [
      { s: 0, l: 'I' }, { s: 2, l: 'come' }, { s: 4, l: 'from' }, { s: 7, l: 'Al' },
      { s: 7, l: 'a' }, { s: 9, l: 'bam' }, { s: 7, l: 'a' }, { s: 4, l: 'with' },
      { s: 0, l: 'my' }, { s: 2, l: 'ban' }, { s: 4, l: 'jo' }, { s: 4, l: 'on' },
      { s: 2, l: 'my' }, { s: 2, l: 'knee', hold: 2 },
      { s: 0, l: "I'm" }, { s: 2, l: 'goin' }, { s: 4, l: 'to' }, { s: 7, l: 'Lou' },
      { s: 7, l: 'si' }, { s: 9, l: 'an' }, { s: 7, l: 'a' }, { s: 4, l: 'my' },
      { s: 0, l: 'true' }, { s: 2, l: 'love' }, { s: 4, l: 'for' }, { s: 4, l: 'to' },
      { s: 2, l: 'see' }, { s: 0, l: '—', hold: 2 },
      { s: 5, l: 'Oh' }, { s: 5, l: 'Su' }, { s: 9, l: 'san' }, { s: 9, l: 'na', hold: 2 },
      { s: 9, l: 'oh' }, { s: 7, l: "don't" }, { s: 7, l: 'you' }, { s: 4, l: 'cry' },
      { s: 0, l: 'for' }, { s: 2, l: 'me', hold: 2 },
    ],
  },

  myBonnie: {
    name: 'My Bonnie Lies Over the Ocean',
    scaleType: 'major',
    notes: [
      { s: -5, l: 'My' }, { s: 4, l: 'Bon' }, { s: 2, l: 'nie' }, { s: 0, l: 'lies' },
      { s: 2, l: 'o' }, { s: 0, l: 'ver' }, { s: -3, l: 'the' }, { s: -5, l: 'o' },
      { s: -8, l: 'cean', hold: 2 },
      { s: -5, l: 'my' }, { s: 4, l: 'Bon' }, { s: 2, l: 'nie' }, { s: 0, l: 'lies' },
      { s: 0, l: 'o' }, { s: -1, l: 'ver' }, { s: 0, l: 'the' }, { s: 2, l: 'sea', hold: 2 },
      { s: -5, l: 'Bring' }, { s: 0, l: 'back', hold: 2 },
      { s: -3, l: 'bring' }, { s: 2, l: 'back', hold: 2 },
      { s: 0, l: 'oh' }, { s: -1, l: 'bring' }, { s: -1, l: 'back' }, { s: -1, l: 'my' },
      { s: -1, l: 'Bon' }, { s: -3, l: 'nie' }, { s: -1, l: 'to' }, { s: 0, l: 'me', hold: 2 },
    ],
  },

  clementine: {
    name: 'Clementine (Oh My Darling)',
    scaleType: 'major',
    notes: [
      { s: 0, l: 'Oh' }, { s: 0, l: 'my' }, { s: 0, l: 'dar' }, { s: -5, l: 'ling' },
      { s: 4, l: 'oh' }, { s: 4, l: 'my' }, { s: 4, l: 'dar' }, { s: 0, l: 'ling' },
      { s: 0, l: 'oh' }, { s: 4, l: 'my' }, { s: 7, l: 'dar' }, { s: 7, l: 'ling' },
      { s: 5, l: 'Clem' }, { s: 4, l: 'en' }, { s: 2, l: 'tine', hold: 2 },
      { s: 2, l: 'thou' }, { s: 4, l: 'art' }, { s: 5, l: 'lost' }, { s: 5, l: 'and' },
      { s: 4, l: 'gone' }, { s: 2, l: 'for' }, { s: 4, l: 'ev' }, { s: 0, l: 'er' },
      { s: 0, l: 'dread' }, { s: 4, l: 'ful' }, { s: 2, l: 'sor' }, { s: -5, l: 'ry' },
      { s: -1, l: 'Clem' }, { s: 2, l: 'en' }, { s: 0, l: 'tine', hold: 2 },
    ],
  },

  yankeeDoodle: {
    name: 'Yankee Doodle',
    scaleType: 'major',
    notes: [
      { s: 0, l: 'Yan' }, { s: 0, l: 'kee' }, { s: 2, l: 'Doo' }, { s: 4, l: 'dle' },
      { s: 0, l: 'went' }, { s: 4, l: 'to' }, { s: 2, l: 'town' }, { s: -5, l: 'a' },
      { s: 0, l: 'rid' }, { s: 0, l: 'ing' }, { s: 2, l: 'on' }, { s: 4, l: 'a' },
      { s: 0, l: 'po' }, { s: -1, l: 'ny', hold: 2 },
      { s: 0, l: 'stuck' }, { s: 0, l: 'a' }, { s: 2, l: 'feath' }, { s: 4, l: 'er' },
      { s: 5, l: 'in' }, { s: 4, l: 'his' }, { s: 2, l: 'cap' }, { s: 0, l: 'and' },
      { s: -1, l: 'called' }, { s: -5, l: 'it' }, { s: -3, l: 'mac' }, { s: -1, l: 'a' },
      { s: 0, l: 'ro' }, { s: 0, l: 'ni', hold: 2 },
    ],
  },

  oldMacDonald: {
    name: 'Old MacDonald Had a Farm',
    scaleType: 'major',
    notes: [
      { s: 0, l: 'Old' }, { s: 0, l: 'Mac' }, { s: 0, l: 'Don' }, { s: -5, l: 'ald' },
      { s: -3, l: 'had' }, { s: -3, l: 'a' }, { s: -5, l: 'farm', hold: 2 },
      { s: 4, l: 'E' }, { s: 4, l: 'I' }, { s: 2, l: 'E' }, { s: 2, l: 'I' },
      { s: 0, l: 'O', hold: 2 },
      { s: -5, l: 'And' }, { s: 0, l: 'on' }, { s: 0, l: 'that' }, { s: 0, l: 'farm' },
      { s: -5, l: 'he' }, { s: -3, l: 'had' }, { s: -3, l: 'a' }, { s: -5, l: 'cow', hold: 2 },
      { s: 4, l: 'E' }, { s: 4, l: 'I' }, { s: 2, l: 'E' }, { s: 2, l: 'I' },
      { s: 0, l: 'O', hold: 2 },
    ],
  },
};
