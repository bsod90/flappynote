import { useEffect, useMemo, useRef, useState } from 'react';

import { MAJOR_KEYS, MINOR_KEYS, POSITION_COUNT, MAJOR_DEGREES, MINOR_DEGREES } from './musicTheory.js';
import KeyHub from './KeyHub.jsx';

/**
 * Concentric SVG wheel.
 *   • Outer rim: sharp/flat-count badge.
 *   • Major ring: big chord letter. Roman numeral function in the corner.
 *   • Minor ring: relative-minor chord. Function corner-label.
 *   • Diminished ring (innermost): leading-tone diminished of each major
 *     (passive reference layer — not highlighted).
 *   • Hub: KeyHub (key signature + diatonic readout).
 *
 * Selected sector is outlined in super-accent. Adjacent sectors carry the
 * three I–IV–V (or III–VI–VII) subdominant/tonic/dominant relationships.
 *
 * Optional overlays make extra harmony obvious:
 *   • secondaryDominants — V/x labels on the non-diatonic chords that
 *     resolve into the diatonic ones.
 *   • tritoneSubs — ♭II/x labels on the tritone substitutes of the V's.
 *   • parallel — dashed link to the parallel-mode tonic.
 *
 * Audio is fired on pointer-DOWN (not click) for instant feedback.
 */

const SECTOR_DEG = 360 / POSITION_COUNT;

function hueForPos(pos) {
  return (pos * 30 + 350) % 360;
}

function colorForPos(pos, isDark, intensity = 'normal') {
  const h = hueForPos(pos);
  if (isDark) {
    if (intensity === 'tonic')   return `hsl(${h} 70% 45%)`;
    if (intensity === 'diatonic') return `hsl(${h} 50% 32%)`;
    if (intensity === 'muted')    return `hsl(${h} 18% 18%)`;
    return `hsl(${h} 35% 24%)`;
  }
  if (intensity === 'tonic')    return `hsl(${h} 75% 60%)`;
  if (intensity === 'diatonic') return `hsl(${h} 65% 78%)`;
  if (intensity === 'muted')    return `hsl(${h} 30% 92%)`;
  return `hsl(${h} 60% 86%)`;
}

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

// Find wheel position whose major key has this semitone pitch class.
function posForSemi(semi) {
  const s = ((semi % 12) + 12) % 12;
  return MAJOR_KEYS.findIndex((k) => k.semitone === s);
}

export default function CircleOfFifths({
  selectedPos,
  selectedMode,
  onSelect,
  diatonicChords,
  onPlayChord,
  isDark,
  overlays = { secondary: false, tritone: false, parallel: false },
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

  // Layout
  const cx = size / 2;
  const cy = size / 2;
  const rOuterEdge = size / 2 - 4;
  const rOuterIn   = rOuterEdge - size * 0.10;
  const rMidIn     = rOuterIn   - size * 0.085;
  const rDimIn     = rMidIn     - size * 0.055;
  const rHubR      = rDimIn - 4;

  // Diatonic-position function map
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

  const diatonicPositions = useMemo(
    () => new Set(Object.keys(functions).map(Number)),
    [functions]
  );

  // Tonic semitone
  const tonicSemi = useMemo(() => {
    const m = MAJOR_KEYS[selectedPos].semitone;
    return selectedMode === 'major' ? m : ((m - 3) + 12) % 12;
  }, [selectedPos, selectedMode]);

  // Secondary dominants — V of each diatonic chord (excluding tonic + dim).
  // We only show ones that fall on a non-diatonic wedge (otherwise the
  // label would clobber the existing function label).
  const secondaryDoms = useMemo(() => {
    if (!overlays.secondary) return [];
    const degs = (selectedMode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES)
      .filter((d) => d.semitone !== 0 && d.type !== 'dim');
    const out = [];
    for (const d of degs) {
      const targetSemi = (tonicSemi + d.semitone) % 12;
      const domSemi = (targetSemi + 7) % 12;
      const domPos = posForSemi(domSemi);
      if (diatonicPositions.has(domPos)) continue;
      out.push({ pos: domPos, label: `V/${d.numeral}` });
    }
    return out;
  }, [overlays.secondary, selectedMode, tonicSemi, diatonicPositions]);

  // Tritone substitutions — ♭II of every secondary dominant + the
  // primary V (or v in minor).
  const tritoneSubs = useMemo(() => {
    if (!overlays.tritone) return [];
    const out = [];
    // Primary V's tritone sub
    const vSemi = (tonicSemi + 7) % 12;
    const subSemi = (vSemi + 6) % 12;
    const subPos = posForSemi(subSemi);
    if (!diatonicPositions.has(subPos)) {
      out.push({ pos: subPos, label: '♭II' });
    }
    // Tritone subs of secondary doms
    for (const sd of secondaryDoms) {
      const sSemi = (MAJOR_KEYS[sd.pos].semitone + 6) % 12;
      const sPos = posForSemi(sSemi);
      if (diatonicPositions.has(sPos)) continue;
      out.push({ pos: sPos, label: '♭II/' + sd.label.slice(2) });
    }
    return out;
  }, [overlays.tritone, secondaryDoms, tonicSemi, diatonicPositions]);

  // Parallel-mode tonic position
  const parallel = useMemo(() => {
    if (!overlays.parallel) return null;
    // Parallel = same letter, opposite mode. Tonic semitone is identical;
    // the OTHER ring at the wheel position whose major-key semitone == tonicSemi
    // (when the user is in minor) or whose relative-minor lives at our
    // current position (when the user is in major).
    if (selectedMode === 'major') {
      // Parallel minor of selectedPos's major: the minor with that tonic.
      // Cm = relative minor of Eb major (pos 9). Tonic Cm has same letter as C.
      // Find pos whose major.semitone + 9 (rel minor offset) == tonicSemi
      // i.e. major.semitone = (tonicSemi - 9 + 12) % 12 = (tonicSemi + 3) % 12
      const targetMajorSemi = (tonicSemi + 3) % 12;
      const pos = posForSemi(targetMajorSemi);
      return { fromPos: selectedPos, fromRing: 'major', toPos: pos, toRing: 'minor' };
    }
    // Minor → parallel major. Selected pos is the minor; parallel major has
    // tonic = same note. Find pos where major.semitone == tonicSemi.
    const pos = posForSemi(tonicSemi);
    return { fromPos: selectedPos, fromRing: 'minor', toPos: pos, toRing: 'major' };
  }, [overlays.parallel, selectedPos, selectedMode, tonicSemi]);

  return (
    <div ref={wrapRef} className="relative aspect-square w-full max-w-[42rem] select-none">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="block" style={{ overflow: 'visible' }}>
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

          const handleMajorDown = (e) => { e.preventDefault(); onSelect(pos, 'major'); };
          const handleMinorDown = (e) => { e.preventDefault(); onSelect(pos, 'minor'); };

          // Centered label positions
          const midDeg = pos * SECTOR_DEG;
          const [mx, my] = polar(cx, cy, (rOuterEdge + rOuterIn) / 2, midDeg);
          const [nx, ny] = polar(cx, cy, (rOuterIn + rMidIn) / 2, midDeg);
          const [dx, dy] = polar(cx, cy, (rMidIn + rDimIn) / 2, midDeg);

          // Corner positions for Roman numerals — leading angular edge,
          // outer radial edge of each ring.
          const cornerDeg = startDeg + SECTOR_DEG * 0.18;
          const [mNumX, mNumY] = polar(cx, cy, rOuterEdge - size * 0.018, cornerDeg);
          const [nNumX, nNumY] = polar(cx, cy, rOuterIn   - size * 0.014, cornerDeg);

          const fnMaj = fn?.major;
          const fnMin = fn?.minor;
          const isTonicMajor = isSelectedSector && selectedMode === 'major';
          const isTonicMinor = isSelectedSector && selectedMode === 'minor';

          return (
            <g key={pos}>
              {/* MAJOR RING */}
              <path
                d={annularPath(cx, cy, rOuterEdge, rOuterIn, startDeg, endDeg)}
                fill={majorFill}
                stroke="hsl(var(--background))"
                strokeWidth={1.5}
                onPointerDown={handleMajorDown}
                style={{ cursor: 'pointer', transition: 'fill 200ms', touchAction: 'none' }}
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

              {/* Sharp/flat count badge */}
              <SignatureBadge cx={cx} cy={cy} r={rOuterEdge + size * 0.018} deg={midDeg}
                count={mk.accCount} type={mk.accType} size={size} isDark={isDark} />

              {/* MINOR RING */}
              <path
                d={annularPath(cx, cy, rOuterIn - 1, rMidIn, startDeg, endDeg)}
                fill={minorFill}
                opacity={isDark ? 0.85 : 0.95}
                stroke="hsl(var(--background))"
                strokeWidth={1}
                onPointerDown={handleMinorDown}
                style={{ cursor: 'pointer', transition: 'fill 200ms', touchAction: 'none' }}
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
                opacity={0.85}
                stroke="hsl(var(--background))"
                strokeWidth={0.75}
              />
              <text
                x={dx} y={dy}
                textAnchor="middle" dominantBaseline="central"
                style={{
                  pointerEvents: 'none',
                  fontSize: size * 0.018,
                  fontWeight: 400,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fill: isDark ? '#7d8590' : '#888',
                }}
              >
                {(() => {
                  const ldSemi = (mk.semitone + 11) % 12;
                  const flat = mk.accType === 'flat';
                  const N = flat
                    ? ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
                    : ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
                  return N[ldSemi] + '°';
                })()}
              </text>

              {/* Roman numeral function labels — corner placement, monospace */}
              {fnMaj && (
                <text
                  x={mNumX} y={mNumY}
                  textAnchor="middle" dominantBaseline="central"
                  style={{
                    pointerEvents: 'none',
                    fontSize: size * 0.018,
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
                  x={nNumX} y={nNumY}
                  textAnchor="middle" dominantBaseline="central"
                  style={{
                    pointerEvents: 'none',
                    fontSize: size * 0.016,
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

        {/* OVERLAYS — sit on top of wedges. Secondary dominants ride near
            the outer rim of the major ring; tritone subs ride near the
            inner edge so the chord letter in between stays readable. */}
        {secondaryDoms.map((sd, i) => {
          const midDeg = sd.pos * SECTOR_DEG;
          // Push to the outer rim, well away from the chord letter
          const [x, y] = polar(cx, cy, rOuterEdge - size * 0.012, midDeg);
          return (
            <text
              key={`sd-${i}`}
              x={x} y={y}
              textAnchor="middle" dominantBaseline="central"
              pointerEvents="none"
              style={{
                fontSize: size * 0.015,
                fontWeight: 800,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fill: 'hsl(var(--super-accent))',
                paintOrder: 'stroke',
                stroke: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)',
                strokeWidth: 3,
                strokeLinejoin: 'round',
              }}
            >
              {sd.label}
            </text>
          );
        })}

        {tritoneSubs.map((tt, i) => {
          const midDeg = tt.pos * SECTOR_DEG;
          // Push to the inner edge of the major ring, well below the letter
          const [x, y] = polar(cx, cy, rOuterIn + size * 0.018, midDeg);
          return (
            <text
              key={`tt-${i}`}
              x={x} y={y}
              textAnchor="middle" dominantBaseline="central"
              pointerEvents="none"
              style={{
                fontSize: size * 0.014,
                fontWeight: 800,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fill: 'hsl(var(--primary))',
                paintOrder: 'stroke',
                stroke: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)',
                strokeWidth: 3,
                strokeLinejoin: 'round',
              }}
            >
              {tt.label}
            </text>
          );
        })}

        {parallel && (() => {
          const fromR = parallel.fromRing === 'major'
            ? (rOuterEdge + rOuterIn) / 2
            : (rOuterIn + rMidIn) / 2;
          const toR = parallel.toRing === 'major'
            ? (rOuterEdge + rOuterIn) / 2
            : (rOuterIn + rMidIn) / 2;
          const [fx, fy] = polar(cx, cy, fromR, parallel.fromPos * SECTOR_DEG);
          const [tx, ty] = polar(cx, cy, toR, parallel.toPos * SECTOR_DEG);
          const [mx2, my2] = [(fx + tx) / 2, (fy + ty) / 2];
          return (
            <g pointerEvents="none">
              <line x1={fx} y1={fy} x2={tx} y2={ty}
                stroke="hsl(var(--super-accent))" strokeWidth={1.5}
                strokeDasharray="4 3" opacity={0.85} />
              <text
                x={mx2} y={my2 - 4}
                textAnchor="middle" dominantBaseline="central"
                style={{
                  fontSize: size * 0.014,
                  fontWeight: 700,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fill: 'hsl(var(--super-accent))',
                  paintOrder: 'stroke',
                  stroke: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
                  strokeWidth: 3,
                  strokeLinejoin: 'round',
                }}
              >
                parallel
              </text>
            </g>
          );
        })()}

        {/* KEY-REGION BORDER — outlines the whole 3-sector diatonic span
            across every ring (major + minor + dim). Drawn before the
            tonic outline so the tonic sits on top. */}
        {(() => {
          const startDeg = (selectedPos - 1) * SECTOR_DEG - SECTOR_DEG / 2;
          const endDeg   = (selectedPos + 1) * SECTOR_DEG + SECTOR_DEG / 2;
          return (
            <path
              d={annularPath(cx, cy, rOuterEdge, rDimIn, startDeg, endDeg)}
              fill="none"
              stroke="hsl(var(--super-accent))"
              strokeWidth={2.5}
              strokeLinejoin="round"
              opacity={0.85}
              pointerEvents="none"
            />
          );
        })()}

        {/* TONIC WEDGE BORDER — inner highlight around the selected ring
            of the selected position so the tonic specifically reads. */}
        {(() => {
          const startDeg = selectedPos * SECTOR_DEG - SECTOR_DEG / 2;
          const endDeg = startDeg + SECTOR_DEG;
          const isMajor = selectedMode === 'major';
          const rOut = isMajor ? rOuterEdge : rOuterIn - 1;
          const rIn  = isMajor ? rOuterIn   : rMidIn;
          return (
            <path
              d={annularPath(cx, cy, rOut, rIn, startDeg, endDeg)}
              fill="none"
              stroke="hsl(var(--super-accent))"
              strokeWidth={3}
              strokeLinejoin="round"
              pointerEvents="none"
              style={{ filter: isDark ? 'drop-shadow(0 0 4px hsl(var(--super-accent)))' : 'none' }}
            />
          );
        })()}

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={rHubR} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1} />
      </svg>

      {/* HTML overlay for the hub */}
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
  const [x, y] = polar(cx, cy, r, deg);
  if (count === 0) {
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
