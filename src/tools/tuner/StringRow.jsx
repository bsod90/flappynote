import { Check } from 'lucide-react';

import { centsColor, splitNoteName } from './tunerLogic.js';
import { cn } from '@/lib/utils';

/**
 * Bottom row of strings (low → high). Each pad shows the note letter; the
 * detected/active string is highlighted, recently-tuned strings get a check.
 * Tapping a pad selects it as the manual target (turns auto-detect off).
 */
export default function StringRow({
  strings,
  activeIndex,         // -1 if no active match
  selectedIndex,       // index of user-selected target (manual mode), or -1
  tunedSet,            // Set<number> of indices that have hit "in tune" since session start
  autoDetect,
  cents,               // cents-off for active match (for ring color)
  onSelect,            // (index) => void; flipping autoDetect off
}) {
  if (!strings?.length) return null;
  const ringColor = centsColor(cents);

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {strings.map((s, i) => {
        const { letter } = splitNoteName(s.noteName);
        const isActive = i === (autoDetect ? activeIndex : selectedIndex);
        const isTuned = tunedSet?.has(i);
        const ringClass = isActive ? activeRingClass(ringColor) : 'ring-0';
        return (
          <button
            key={`${s.midi}-${i}`}
            type="button"
            onClick={() => onSelect?.(i)}
            aria-label={`String ${i + 1} — ${s.noteName}`}
            className={cn(
              'relative flex h-12 w-12 items-center justify-center rounded-full border text-lg font-semibold transition-all sm:h-14 sm:w-14 sm:text-xl',
              isActive
                ? 'bg-background text-foreground shadow-md'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              isActive ? 'border-foreground/20' : 'border-border',
              ringClass,
            )}
          >
            {letter}
            {isTuned && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function activeRingClass(centsClass) {
  if (centsClass === 'in-tune') return 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-background';
  if (centsClass === 'close')   return 'ring-2 ring-amber-400 ring-offset-2 ring-offset-background';
  if (centsClass === 'off')     return 'ring-2 ring-rose-400 ring-offset-2 ring-offset-background';
  return 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background';
}
