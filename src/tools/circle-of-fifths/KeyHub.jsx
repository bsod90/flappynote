import { MAJOR_KEYS, MINOR_KEYS } from './musicTheory.js';

/**
 * Center hub of the circle. Shows:
 *   • Selected key name, big and bold
 *   • Mini key-signature staff (treble clef + accidentals)
 *   • The seven diatonic chords with roman numerals; clicking plays them
 *
 * The chord row is hidden on mobile (rendered separately under the wheel
 * by the page) so it doesn't overflow the small hub area.
 */
export default function KeyHub({ selectedPos, selectedMode, chords, onChordClick }) {
  const major = MAJOR_KEYS[selectedPos];
  const minor = MINOR_KEYS[selectedPos];
  const sigText = signatureLabel(major.accCount, major.accType);

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {selectedMode === 'major' ? 'Major key' : 'Minor key'}
      </div>
      <div className="text-2xl font-bold leading-none tabular-nums sm:text-3xl">
        {selectedMode === 'major' ? major.tonic : minor.tonic.replace('m', '')}
        <span className="ml-1.5 text-base font-medium text-muted-foreground">
          {selectedMode === 'major' ? 'major' : 'minor'}
        </span>
      </div>

      <KeySignatureStaff accCount={major.accCount} accType={major.accType} />

      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {sigText}
      </div>

      {/* Diatonic chords — hidden on mobile (rendered under the wheel instead) */}
      <div className="mt-1 hidden sm:block">
        <DiatonicChordRow chords={chords} onChordClick={onChordClick} />
      </div>
    </div>
  );
}

/**
 * Standalone diatonic-chord row. Used inside the hub on desktop and
 * rendered under the wheel on mobile.
 */
export function DiatonicChordRow({ chords, onChordClick, className = '' }) {
  return (
    <div className={`grid grid-cols-7 gap-1 ${className}`}>
      {chords?.map((c, i) => (
        <button
          key={i}
          type="button"
          onPointerDown={(e) => { e.preventDefault(); onChordClick?.(c, i); }}
          className="flex flex-col items-center rounded px-0.5 py-0.5 hover:bg-accent active:bg-accent/80"
          aria-label={`Play ${c.name}`}
        >
          <span className="text-[10px] font-mono tracking-wider text-muted-foreground">
            {c.numeral}
          </span>
          <span className="text-[11px] font-semibold leading-tight">
            {c.name}
          </span>
        </button>
      ))}
    </div>
  );
}

function signatureLabel(count, type) {
  if (count === 0) return 'No sharps or flats';
  return `${count} ${type === 'sharp' ? 'sharp' : 'flat'}${count > 1 ? 's' : ''}`;
}

/**
 * Mini SVG of a treble clef with N accidentals on the staff.
 * Order of sharps: F C G D A E B
 * Order of flats:  B E A D G C F
 * Standard staff positions (top line = F5):
 *   F#: top line (F5)
 *   C#: 3rd space (C5)
 *   G#: above-top space (G5)
 *   D#: 4th line (D5)
 *   A#: 2nd space (A4)
 *   E#: 4th space (E5)
 *   B#: 3rd line (B4)
 *   Bb: 3rd line (B4)
 *   Eb: 4th space (E5)
 *   Ab: 2nd space (A4)
 *   Db: 4th line (D5)
 *   Gb: 2nd line (G4)
 *   Cb: 3rd space (C5)
 *   Fb: top line (F5)
 */
function KeySignatureStaff({ accCount, accType }) {
  const W = 92;
  const H = 32;
  const lineGap = 4;     // distance between staff lines in px
  const top = 8;         // y of top staff line
  const lines = [0, 1, 2, 3, 4].map((i) => top + i * lineGap);
  const clefX = 8;
  const accStart = 30;
  const accStep = 5;

  const sharpsOrder = ['F#','C#','G#','D#','A#','E#','B#'];
  const flatsOrder  = ['Bb','Eb','Ab','Db','Gb','Cb','Fb'];

  // y-positions for each accidental note. For sharps, classical engraving
  // has F# on top line, C# on third-space, G# above the staff (small),
  // D# on fourth line, A# on second space, E# on fourth space (top), B#
  // on third line.
  const SHARP_Y = {
    'F#': top + 0,
    'C#': top + 1.5 * lineGap,
    'G#': top - 0.5 * lineGap,
    'D#': top + 1 * lineGap,
    'A#': top + 2.5 * lineGap,
    'E#': top + 0.5 * lineGap,
    'B#': top + 2 * lineGap,
  };
  const FLAT_Y = {
    'Bb': top + 2 * lineGap,
    'Eb': top + 0.5 * lineGap,
    'Ab': top + 2.5 * lineGap,
    'Db': top + 1 * lineGap,
    'Gb': top + 3 * lineGap,
    'Cb': top + 1.5 * lineGap,
    'Fb': top + 0 * lineGap, // unusual edge case
  };

  const accidentals = accType === 'sharp'
    ? sharpsOrder.slice(0, accCount).map((n, i) => ({ name: n, y: SHARP_Y[n], x: accStart + i * accStep, glyph: '♯' }))
    : accType === 'flat'
      ? flatsOrder.slice(0, accCount).map((n, i) => ({ name: n, y: FLAT_Y[n], x: accStart + i * accStep, glyph: '♭' }))
      : [];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block">
      {/* Staff lines */}
      {lines.map((y, i) => (
        <line key={i} x1={4} x2={W - 4} y1={y} y2={y}
          stroke="currentColor" strokeWidth={0.6} opacity={0.7} />
      ))}
      {/* Treble clef — drawn as a stylized G clef using a unicode glyph */}
      <text x={clefX} y={top + 4 * lineGap + 1} fontSize="22" fontFamily="serif" fill="currentColor">
        𝄞
      </text>
      {/* Accidentals */}
      {accidentals.map((a) => (
        <text
          key={a.name}
          x={a.x}
          y={a.y + 2}
          fontSize="10"
          fontFamily="serif"
          fill="currentColor"
          textAnchor="middle"
        >
          {a.glyph}
        </text>
      ))}
    </svg>
  );
}
