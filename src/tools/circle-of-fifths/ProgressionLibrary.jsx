import { Play, Square } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { GENRES, getProgressions } from './progressions.js';
import { progressionToChords, MAJOR_KEYS, MINOR_KEYS } from './musicTheory.js';

/**
 * Bottom panel: genre chips, length toggle, and a list of progressions
 * resolved to the user's currently-selected key.
 */
export default function ProgressionLibrary({
  selectedPos,
  selectedMode,
  genre,
  onGenreChange,
  bars,
  onBarsChange,
  onPlayProgression,
  onStopProgression,
  isPlaying,
  playingId,
}) {
  const major = MAJOR_KEYS[selectedPos];
  const minor = MINOR_KEYS[selectedPos];

  const list = useMemo(() => getProgressions({ genre, bars }), [genre, bars]);

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border bg-card/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Progressions in {selectedMode === 'major' ? major.tonic + ' major' : minor.tonic.replace('m','') + ' minor'}
        </span>
        <BarsToggle value={bars} onChange={onBarsChange} />
      </div>

      <GenreChips value={genre} onChange={onGenreChange} />

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {list.length === 0 && (
          <div className="text-xs text-muted-foreground">No progressions for this filter.</div>
        )}
        {list.map((prog, i) => {
          const id = `${prog.genre}-${prog.bars}-${i}-${prog.name}`;
          // Resolve roman numerals to chord names in the user's key (or its
          // relative if the progression is in the opposite mode).
          let tonicSemi, accType, modeForResolve;
          if (prog.mode === selectedMode) {
            tonicSemi = major.semitone + (selectedMode === 'minor' ? -3 : 0);
            tonicSemi = ((tonicSemi % 12) + 12) % 12;
            accType = major.accType;
            modeForResolve = prog.mode;
          } else {
            // Relative key: same key signature, different tonic.
            // Major user → progression in minor → relative minor (same sig).
            // Minor user → progression in major → relative major.
            if (prog.mode === 'minor') {
              tonicSemi = (major.semitone - 3 + 12) % 12;
            } else {
              tonicSemi = major.semitone;
            }
            accType = major.accType;
            modeForResolve = prog.mode;
          }
          const chords = progressionToChords(prog.numerals, tonicSemi, accType, modeForResolve);
          const isThis = isPlaying && playingId === id;
          return (
            <div
              key={id}
              className={cn(
                'flex flex-col gap-1 rounded-md border bg-background/60 px-2 py-1.5 transition-colors',
                isThis && 'border-primary/60 bg-primary/5'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold leading-tight">{prog.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {prog.bars}-bar · {prog.mode === 'major' ? 'major' : 'minor'}
                    {prog.note && <span className="ml-1 normal-case tracking-normal">· {prog.note}</span>}
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant={isThis ? 'default' : 'outline'}
                  className="h-7 w-7 shrink-0"
                  onClick={() => isThis ? onStopProgression() : onPlayProgression(id, chords)}
                  aria-label={isThis ? 'Stop' : 'Play'}
                >
                  {isThis
                    ? <Square className="h-3.5 w-3.5" />
                    : <Play className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 font-mono text-[11px]">
                {prog.numerals.map((n, idx) => (
                  <span key={idx} className="inline-flex items-baseline gap-1">
                    <span className="text-muted-foreground">{n}</span>
                    <span className="font-semibold">{chords[idx].name}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarsToggle({ value, onChange }) {
  const opts = [4, 8, 12];
  return (
    <div className="flex rounded-md border bg-background/60 p-0.5">
      {opts.map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => onChange(b)}
          className={cn(
            'rounded px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider transition-colors',
            value === b
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {b} bar
        </button>
      ))}
    </div>
  );
}

function GenreChips({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {GENRES.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onChange(g.id)}
          className={cn(
            'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
            value === g.id
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}
