/**
 * Genre-tagged chord progression library, in roman numerals.
 *
 * Each progression has:
 *   name      — short display label
 *   bars      — 4 | 8 | 12
 *   mode      — 'major' | 'minor' (the mode it lives in; the resolver auto-
 *               relativizes if the user is in the opposite mode)
 *   numerals  — array of strings (roman numeral, optionally with quality
 *               suffix: "7", "maj7"). Length should equal `bars` for
 *               one-chord-per-bar; some progressions split a bar with
 *               commas inside a single string (kept simple here)
 *   genre     — used for filtering
 *   note      — optional one-liner subtitle (e.g. "Andalusian cadence")
 */

export const PROGRESSIONS = [
  // ── Pop / Rock ─────────────────────────────────────────────────────────
  { genre: 'pop',   bars: 4, mode: 'major', name: 'Axis of awesome',
    numerals: ['I','V','vi','IV'], note: 'Cliché but irresistible' },
  { genre: 'pop',   bars: 4, mode: 'major', name: '50s doo-wop',
    numerals: ['I','vi','IV','V'] },
  { genre: 'pop',   bars: 4, mode: 'minor', name: 'Sad pop',
    numerals: ['vi','IV','I','V'].map(swapMajorToMinorRel), note: '(plays in relative minor)' },
  { genre: 'pop',   bars: 8, mode: 'major', name: 'Pop ballad',
    numerals: ['I','V','vi','iii','IV','I','IV','V'] },
  { genre: 'pop',   bars: 4, mode: 'major', name: 'Rising fourths',
    numerals: ['I','IV','V','V'] },

  // ── Blues ──────────────────────────────────────────────────────────────
  { genre: 'blues', bars: 12, mode: 'major', name: '12-bar blues',
    numerals: ['I7','I7','I7','I7','IV7','IV7','I7','I7','V7','IV7','I7','V7'] },
  { genre: 'blues', bars: 12, mode: 'major', name: '12-bar quick-change',
    numerals: ['I7','IV7','I7','I7','IV7','IV7','I7','I7','V7','IV7','I7','V7'] },
  { genre: 'blues', bars: 8,  mode: 'major', name: '8-bar blues',
    numerals: ['I7','V7','IV7','IV7','I7','V7','I7','V7'] },
  { genre: 'blues', bars: 12, mode: 'minor', name: 'Minor blues',
    numerals: ['i','i','i','i','iv','iv','i','i','V','iv','i','V'] },

  // ── Slavic rock / dark folk ────────────────────────────────────────────
  { genre: 'slavic', bars: 4, mode: 'minor', name: 'Andalusian cadence',
    numerals: ['i','VII','VI','V'], note: 'Phrygian descent — Russian rock staple' },
  { genre: 'slavic', bars: 4, mode: 'minor', name: 'i-VI-VII-i',
    numerals: ['i','VI','VII','i'] },
  { genre: 'slavic', bars: 4, mode: 'minor', name: 'Doom march',
    numerals: ['i','iv','V','i'] },
  { genre: 'slavic', bars: 8, mode: 'minor', name: 'Epic minor',
    numerals: ['i','VI','iv','VII','III','VI','iv','V'] },
  { genre: 'slavic', bars: 4, mode: 'minor', name: 'Phrygian vamp',
    numerals: ['i','VII','VI','VII'] },

  // ── Techno / EDM / dark dance ─────────────────────────────────────────
  { genre: 'techno', bars: 4, mode: 'minor', name: 'Driving minor',
    numerals: ['i','i','VII','VI'] },
  { genre: 'techno', bars: 4, mode: 'minor', name: 'Hypnotic',
    numerals: ['i','VI','III','VII'] },
  { genre: 'techno', bars: 4, mode: 'minor', name: 'Two-chord pulse',
    numerals: ['i','iv','i','iv'] },
  { genre: 'techno', bars: 8, mode: 'minor', name: 'Berlin night',
    numerals: ['i','VII','VI','V','i','VI','III','VII'] },

  // ── House (deep + nu-disco) ───────────────────────────────────────────
  { genre: 'house', bars: 4, mode: 'major', name: 'Sunrise',
    numerals: ['Imaj7','vi7','iiim7','IV'] },
  { genre: 'house', bars: 4, mode: 'major', name: 'Funky 7ths',
    numerals: ['ii7','V7','Imaj7','vi7'] },
  { genre: 'house', bars: 4, mode: 'major', name: 'Uplifting house',
    numerals: ['I','V','vi','IV'] },
  { genre: 'house', bars: 4, mode: 'minor', name: 'Deep house',
    numerals: ['i7','VI','III','VII'] },
  { genre: 'house', bars: 8, mode: 'major', name: 'Disco',
    numerals: ['Imaj7','vi7','ii7','V7','Imaj7','vi7','ii7','V7'] },

  // ── Hip-hop ───────────────────────────────────────────────────────────
  { genre: 'hiphop', bars: 4, mode: 'minor', name: 'Boom bap',
    numerals: ['i','iv','i','iv'] },
  { genre: 'hiphop', bars: 4, mode: 'minor', name: 'Soul sample',
    numerals: ['i','VI','VII','i'] },
  { genre: 'hiphop', bars: 4, mode: 'major', name: 'Lo-fi loop',
    numerals: ['IV','V','iii','vi'] },
  { genre: 'hiphop', bars: 4, mode: 'minor', name: 'Trap',
    numerals: ['i','VI','VII','V'] },
  { genre: 'hiphop', bars: 8, mode: 'minor', name: 'Jazzy hip-hop',
    numerals: ['ii','V','i','iv','VII','III','VI','V'] },

  // ── Jazz ──────────────────────────────────────────────────────────────
  { genre: 'jazz', bars: 4, mode: 'major', name: 'ii-V-I',
    numerals: ['ii7','V7','Imaj7','Imaj7'] },
  { genre: 'jazz', bars: 4, mode: 'major', name: 'Rhythm changes (A)',
    numerals: ['I','vi','ii','V'] },
  { genre: 'jazz', bars: 8, mode: 'major', name: 'Standard',
    numerals: ['Imaj7','vi7','ii7','V7','Imaj7','vi7','ii7','V7'] },
  { genre: 'jazz', bars: 12, mode: 'major', name: 'Jazz blues',
    numerals: ['I7','IV7','I7','I7','IV7','IV7','I7','I7','ii7','V7','I7','V7'] },

  // ── Funk ──────────────────────────────────────────────────────────────
  { genre: 'funk', bars: 4, mode: 'minor', name: 'Funk vamp',
    numerals: ['i7','i7','iv7','i7'] },
  { genre: 'funk', bars: 4, mode: 'minor', name: 'JB groove',
    numerals: ['i7','IV7','i7','V7'] },
  { genre: 'funk', bars: 4, mode: 'major', name: 'Disco-funk',
    numerals: ['Imaj7','IV7','V7','IV7'] },

  // ── Reggae / dub ──────────────────────────────────────────────────────
  { genre: 'reggae', bars: 4, mode: 'major', name: 'Skank',
    numerals: ['I','V','I','V'] },
  { genre: 'reggae', bars: 4, mode: 'major', name: 'One drop',
    numerals: ['I','IV','V','IV'] },
  { genre: 'reggae', bars: 4, mode: 'minor', name: 'Dub minor',
    numerals: ['i','VII','VI','VII'] },

  // ── Metal / doom ──────────────────────────────────────────────────────
  { genre: 'metal', bars: 4, mode: 'minor', name: 'Power chords',
    numerals: ['i','VII','VI','V'] },
  { genre: 'metal', bars: 4, mode: 'minor', name: 'Phrygian metal',
    numerals: ['i','II','i','II'] },
  { genre: 'metal', bars: 4, mode: 'minor', name: 'Doom',
    numerals: ['i','iv','i','iv'] },
];

export const GENRES = [
  { id: 'pop',    label: 'Pop / Rock' },
  { id: 'blues',  label: 'Blues' },
  { id: 'slavic', label: 'Slavic / Folk' },
  { id: 'techno', label: 'Techno / EDM' },
  { id: 'house',  label: 'House' },
  { id: 'hiphop', label: 'Hip-hop' },
  { id: 'jazz',   label: 'Jazz' },
  { id: 'funk',   label: 'Funk' },
  { id: 'reggae', label: 'Reggae' },
  { id: 'metal',  label: 'Metal' },
];

// Helper used in some progression definitions to clarify intent.
function swapMajorToMinorRel(roman) { return roman; }

export function getProgressions({ genre, bars }) {
  return PROGRESSIONS.filter((p) =>
    (genre == null || p.genre === genre) &&
    (bars == null || p.bars === bars)
  );
}
