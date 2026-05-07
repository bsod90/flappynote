import { useMemo } from 'react';

import {
  centsColor,
  centsToStripPosition,
  splitNoteName,
  tuningStatus,
  IN_TUNE_CENTS,
} from './tunerLogic.js';

/**
 * Big note display + cents strip + status word. The "active" reading is
 * either the closest-string match (auto mode) or the user-selected target
 * (manual mode). When there's no signal we render placeholder dashes so the
 * layout doesn't jump.
 */
export default function TunerVisualizer({
  noteName,         // e.g. "D3" — the target note (the string we're tuning, or chromatic snap)
  cents,            // signed cents from target (null = no signal)
  frequency,        // current detected frequency (Hz) or null
  targetFrequency,  // target frequency (Hz) or null
  status,           // 'silent' | 'low' | 'in-tune' | 'high'
}) {
  const { letter, octave } = splitNoteName(noteName);
  const colorClass = useMemo(() => {
    const c = centsColor(cents);
    if (c === 'in-tune') return 'text-emerald-400';
    if (c === 'close')   return 'text-amber-400';
    if (c === 'off')     return 'text-rose-400';
    return 'text-muted-foreground';
  }, [cents]);

  const stripPos = centsToStripPosition(cents);
  const stripBgPercent = `${(stripPos * 100).toFixed(2)}%`;

  // Resolved status text. The tuner auto-starts on mount, so before the
  // first reading we show the same calm "Listening…" placeholder we use
  // for the silent-but-recording state.
  const statusText = (() => {
    if (status === 'in-tune') return 'In tune';
    if (status === 'low') return 'Low';
    if (status === 'high') return 'High';
    return 'Listening…';
  })();

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* Big note */}
      <div className="flex items-baseline gap-1">
        <span
          className={`font-semibold leading-none transition-colors duration-150 ${colorClass}`}
          style={{ fontSize: 'clamp(96px, 22vw, 220px)' }}
        >
          {letter || '—'}
        </span>
        {octave && (
          <span
            className="text-muted-foreground/80 font-mono"
            style={{ fontSize: 'clamp(28px, 6vw, 56px)' }}
          >
            {octave}
          </span>
        )}
      </div>

      {/* Status + cents readout */}
      <div className="flex flex-col items-center gap-1">
        <span className={`text-base font-semibold uppercase tracking-[0.25em] ${colorClass}`}>
          {statusText}
        </span>
        <span className="font-mono text-sm text-muted-foreground tabular-nums">
          {cents != null ? formatCents(cents) : '— cents'}
          {frequency != null && targetFrequency != null && (
            <>
              {'  ·  '}
              {frequency.toFixed(1)} Hz
              <span className="text-muted-foreground/60">
                {' / '}
                {targetFrequency.toFixed(1)} Hz
              </span>
            </>
          )}
        </span>
      </div>

      {/* Cents strip */}
      <div className="w-full max-w-md">
        <div className="relative h-7">
          {/* Tick marks at -50 / -25 / 0 / +25 / +50 */}
          <div className="absolute inset-0 flex items-center">
            {[-50, -25, 0, 25, 50].map((c) => {
              const left = `${((c + 50) / 100) * 100}%`;
              const isCenter = c === 0;
              return (
                <span
                  key={c}
                  className={`absolute top-0 h-full w-px ${isCenter ? 'bg-foreground/40' : 'bg-border'}`}
                  style={{ left }}
                />
              );
            })}
          </div>

          {/* In-tune band — thin green stripe ±IN_TUNE_CENTS */}
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-500/15"
            style={{
              left: `${(50 - IN_TUNE_CENTS)}%`,
              width: `${IN_TUNE_CENTS * 2}%`,
            }}
          />

          {/* Track */}
          <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-border" />

          {/* Marker */}
          {cents != null && (
            <div
              className={`absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full ${markerBgClass(cents)}`}
              style={{ left: stripBgPercent, transition: 'left 0.08s linear' }}
            />
          )}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground/70">
          <span>-50¢</span>
          <span>0</span>
          <span>+50¢</span>
        </div>
      </div>
    </div>
  );
}

function markerBgClass(cents) {
  const c = centsColor(cents);
  if (c === 'in-tune') return 'bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.55)]';
  if (c === 'close')   return 'bg-amber-400';
  if (c === 'off')     return 'bg-rose-400';
  return 'bg-muted';
}

function formatCents(cents) {
  const sign = cents > 0 ? '+' : cents < 0 ? '−' : '';
  return `${sign}${Math.round(Math.abs(cents))} cents`;
}
