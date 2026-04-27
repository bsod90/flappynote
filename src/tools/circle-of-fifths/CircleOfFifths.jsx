import { useEffect, useMemo, useRef, useState } from 'react';

import { MAJOR_KEYS, MINOR_KEYS, POSITION_COUNT } from './musicTheory.js';
import KeyHub from './KeyHub.jsx';

/**
 * The wheel itself — concentric SVG rings.
 *
 * Sectors run clockwise from 12 o'clock. Each sector spans 30°.
 *   • Outer rim badge: number of sharps/flats.
 *   • Major ring (outer): big chord letter (C, G, D…)
 *   • Minor ring (middle): relative minor (Am, Em, Bm…)
 *   • Diminished ring (inner): vii° chord of the major above it.
 *   • Hub: KeyHub component (key signature staff + diatonic readout)
 *
 * Highlighting:
 *   • Selected sector glows brightly (full saturation).
 *   • The two adjacent sectors (subdominant + dominant) glow at medium.
 *   • Other sectors stay at low saturation so the rainbow still reads.
 *
 * Selecting either ring picks a tonic in that mode (major ring → I,
 * minor ring → i). Roman numerals are then drawn as floating labels on
 * each diatonic cell.
 */

const SECTOR_DEG = 360 / POSITION_COUNT;
const TAU = Math.PI * 2;

// HSL hue per wheel position — rainbow that matches the inspiration art.
// Starts in red at C, sweeps clockwise through orange/yellow/green/blue/
// purple back to magenta-ish at F.
function hueForPos(pos) {
  return (pos * 30 + 350) % 360;
}

function colorForPos(pos, isDark, intensity = 'normal') {
  const h = hueForPos(pos);
  if (isDark) {
    if (intensity === 'tonic')   return `hsl(${h} 70% 45%)`;
    if (intensity === 'diatonic') return `hsl(${h} 50% 32%)`;
    if (intensity === 'muted')    return `hsl(${h} 18% 18%)`;
    return `hsl(${h} 35% 24%)`; // normal
  }
  if (intensity === 'tonic')    return `hsl(${h} 75% 60%)`;
  if (intensity === 'diatonic') return `hsl(${h} 65% 78%)`;
  if (intensity === 'muted')    return `hsl(${h} 30% 92%)`;
  return `hsl(${h} 60% 86%)`;
}

/**
 * Generate the SVG path for a ring-segment (annular sector).
 *   cx, cy: center
 *   rOuter, rInner: ring radii
 *   startDeg, endDeg: 0° = top, clockwise
 */
function annularPath(cx, cy, rOuter, rInner, startDeg, endDeg) {
  const a0 = ((startDeg - 90) * Math.PI) / 180;
  const a1 = ((endDeg - 90) * Math.PI) / 180;
  const x0o = cx + rOuter * Math.cos(a0);
  const y0o = cy + rOuter * Math.sin(a0);
  const x1o = cx + rOuter * Math.cos(a1);
  const y1o = cy + rOuter * Math.sin(a1);
  const x0i = cx + rInner * Math.cos(a0);
  const y0i = cy + rInner * Math.sin(a0);
  const x1i = cx + rInner * Math.cos(a1);
  const y1i = cy + rInner * Math.sin(a1);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${x0o} ${y0o}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x0i} ${y0i}`,
    'Z',
  ].join(' ');
}

function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export default function CircleOfFifths({
  selectedPos,
  selectedMode,
  onSelect,
  diatonicChords,
  onPlayChord,
  isDark,
}) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState(640);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize(Math.max(280, Math.min(width, height)));
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Layout — radii as fractions of size
  const cx = size / 2;
  const cy = size / 2;
  const rOuterEdge = size / 2 - 4;
  const rOuterIn   = rOuterEdge - size * 0.10;   // major ring inner
  const rMidIn     = rOuterIn   - size * 0.085;  // minor ring inner
  const rDimIn     = rMidIn     - size * 0.055;  // dim ring inner
  const rHubR      = rDimIn - 4;                 // hub radius

  // Function map for the selected key — three adjacent sectors carry the
  // diatonic functions. Keys are wheel positions, values describe what
  // function each ring of that sector plays.
  const functions = useMemo(() => {
    const fn = {};
    const offsetMap = selectedMode === 'major'
      ? { '-1': { major: 'IV',  minor: 'ii'  },
          '0':  { major: 'I',   minor: 'vi'  },
          '1':  { major: 'V',   minor: 'iii' } }
      : { '-1': { major: 'VI',  minor: 'iv'  },
          '0':  { major: 'III', minor: 'i'   },
          '1':  { major: 'VII', minor: 'v'   } };
    for (const off of [-1, 0, 1]) {
      const wp = (selectedPos + off + 12) % 12;
      const m = offsetMap[String(off)];
      fn[wp] = { major: m.major, minor: m.minor, isTonic: off === 0, offset: off };
    }
    return fn;
  }, [selectedPos, selectedMode]);

  // vii°/ii° wheel position (relative to selected key)
  const dimPos = useMemo(() => {
    if (selectedMode === 'major') return (selectedPos + 5) % 12; // vii° lives at +5 fifths
    return (selectedPos + 2) % 12; // ii° at +2 fifths in minor
  }, [selectedPos, selectedMode]);

  return (
    <div ref={wrapRef} className="relative aspect-square w-full max-w-[42rem] select-none">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="block" style={{ overflow: 'visible' }}>
        {/* Render sectors back-to-front so the outer ring strokes don't get
            covered by the inner rings. */}
        {MAJOR_KEYS.map((mk) => {
          const pos = mk.pos;
          const startDeg = pos * SECTOR_DEG - SECTOR_DEG / 2;
          const endDeg = startDeg + SECTOR_DEG;
          const fn = functions[pos];
          const isSelectedSector = pos === selectedPos;
          const isDiatonicSector = !!fn;
          const intensity = isSelectedSector ? 'tonic' : (isDiatonicSector ? 'diatonic' : 'muted');

          const majorFill = colorForPos(pos, isDark, intensity);
          const minorFill = colorForPos(pos, isDark, intensity === 'muted' ? 'muted' : intensity);
          const dimFill   = colorForPos(pos, isDark, 'muted');
          const isDimSector = pos === dimPos;

          const majorRingClick = () => onSelect(pos, 'major');
          const minorRingClick = () => onSelect(pos, 'minor');

          // Label positions
          const midDeg = pos * SECTOR_DEG;
          const [mx, my] = polar(cx, cy, (rOuterEdge + rOuterIn) / 2, midDeg);
          const [nx, ny] = polar(cx, cy, (rOuterIn + rMidIn) / 2, midDeg);
          const [dx, dy] = polar(cx, cy, (rMidIn + rDimIn) / 2, midDeg);

          // Roman numeral labels float above each diatonic ring
          const fnMaj = fn?.major;
          const fnMin = fn?.minor;

          // Whether this position represents the SELECTED tonic in either ring
          const isTonicMajor = isSelectedSector && selectedMode === 'major';
          const isTonicMinor = isSelectedSector && selectedMode === 'minor';

          return (
            <g key={pos}>
              {/* MAJOR RING */}
              <path
                d={annularPath(cx, cy, rOuterEdge, rOuterIn, startDeg, endDeg)}
                fill={majorFill}
                stroke={isDark ? 'hsl(var(--background))' : 'hsl(var(--background))'}
                strokeWidth={1.5}
                onClick={majorRingClick}
                style={{ cursor: 'pointer', transition: 'fill 200ms' }}
              />
              <text
                x={mx} y={my}
                textAnchor="middle" dominantBaseline="central"
                style={{
                  pointerEvents: 'none',
                  fontSize: size * 0.045,
                  fontWeight: isTonicMajor ? 800 : 700,
                  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  fill: isDark ? '#fff' : (intensity === 'muted' ? '#444' : '#0b1220'),
                }}
              >
                {mk.tonic}
              </text>
              {/* Sharp/flat count badge (just outside) */}
              <SignatureBadge cx={cx} cy={cy} r={rOuterEdge + size * 0.018} deg={midDeg}
                count={mk.accCount} type={mk.accType} size={size} isDark={isDark} />

              {/* MINOR RING */}
              <path
                d={annularPath(cx, cy, rOuterIn - 1, rMidIn, startDeg, endDeg)}
                fill={minorFill}
                opacity={isDark ? 0.85 : 0.95}
                stroke={isDark ? 'hsl(var(--background))' : 'hsl(var(--background))'}
                strokeWidth={1}
                onClick={minorRingClick}
                style={{ cursor: 'pointer', transition: 'fill 200ms' }}
              />
              <text
                x={nx} y={ny}
                textAnchor="middle" dominantBaseline="central"
                style={{
                  pointerEvents: 'none',
                  fontSize: size * 0.028,
                  fontWeight: isTonicMinor ? 800 : 600,
                  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  fill: isDark ? '#e5edf5' : (intensity === 'muted' ? '#555' : '#0b1220'),
                }}
              >
                {MINOR_KEYS[pos].tonic}
              </text>

              {/* DIMINISHED RING */}
              <path
                d={annularPath(cx, cy, rMidIn - 1, rDimIn, startDeg, endDeg)}
                fill={dimFill}
                opacity={isDark ? 0.85 : 0.85}
                stroke={isDark ? 'hsl(var(--background))' : 'hsl(var(--background))'}
                strokeWidth={0.75}
              />
              <text
                x={dx} y={dy}
                textAnchor="middle" dominantBaseline="central"
                style={{
                  pointerEvents: 'none',
                  fontSize: size * 0.018,
                  fontWeight: isDimSector ? 700 : 400,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fill: isDimSector
                    ? (isDark ? 'hsl(var(--super-accent))' : 'hsl(var(--super-accent))')
                    : (isDark ? '#7d8590' : '#888'),
                }}
              >
                {/* Diminished chord on the leading tone of this position's
                    major key — e.g. C major → B°. */}
                {(() => {
                  const ldSemi = (mk.semitone + 11) % 12;
                  const flat = mk.accType === 'flat';
                  const N = flat
                    ? ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
                    : ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
                  return N[ldSemi] + '°';
                })()}
              </text>

              {/* Function label overlay on diatonic sectors */}
              {fnMaj && (
                <text
                  x={polar(cx, cy, rOuterEdge - size * 0.018, midDeg)[0]}
                  y={polar(cx, cy, rOuterEdge - size * 0.018, midDeg)[1]}
                  textAnchor="middle" dominantBaseline="hanging"
                  style={{
                    pointerEvents: 'none',
                    fontSize: size * 0.016,
                    fontWeight: 700,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fill: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)',
                    letterSpacing: 0.5,
                  }}
                >
                  {fnMaj}
                </text>
              )}
              {fnMin && (
                <text
                  x={polar(cx, cy, rOuterIn - size * 0.012, midDeg)[0]}
                  y={polar(cx, cy, rOuterIn - size * 0.012, midDeg)[1]}
                  textAnchor="middle" dominantBaseline="hanging"
                  style={{
                    pointerEvents: 'none',
                    fontSize: size * 0.014,
                    fontWeight: 700,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fill: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)',
                    letterSpacing: 0.5,
                  }}
                >
                  {fnMin}
                </text>
              )}
            </g>
          );
        })}

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={rHubR} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1} />
      </svg>

      {/* HTML overlay for the hub — easier to lay out rich content than SVG text */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: cx - rHubR,
          top: cy - rHubR,
          width: rHubR * 2,
          height: rHubR * 2,
          pointerEvents: 'none',
        }}
      >
        <div className="pointer-events-auto" style={{ width: '92%' }}>
          <KeyHub
            selectedPos={selectedPos}
            selectedMode={selectedMode}
            chords={diatonicChords}
            onChordClick={(chord) => onPlayChord?.(chord)}
          />
        </div>
      </div>
    </div>
  );
}

function SignatureBadge({ cx, cy, r, deg, count, type, size, isDark }) {
  if (count === 0) {
    const [x, y] = polar(cx, cy, r, deg);
    return (
      <text
        x={x} y={y}
        textAnchor="middle" dominantBaseline="central"
        style={{
          fontSize: size * 0.018,
          fontWeight: 600,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fill: isDark ? '#94a3b8' : '#64748b',
        }}
      >
        ♮
      </text>
    );
  }
  const symbol = type === 'sharp' ? '♯' : '♭';
  const [x, y] = polar(cx, cy, r, deg);
  return (
    <text
      x={x} y={y}
      textAnchor="middle" dominantBaseline="central"
      style={{
        fontSize: size * 0.018,
        fontWeight: 600,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fill: isDark ? '#94a3b8' : '#475569',
      }}
    >
      {`${count}${symbol}`}
    </text>
  );
}
