import { Play, RotateCcw, Square, Timer } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Visual tracker for a multi-interval practice session.
 *
 *   PRACTICE                              interval 3 of 10
 *   [ ▓ ▓ ▒ ░ ░ ░ ░ ░ ░ ░ ]
 *                  0:42
 *   [ ⏹ Stop ]  [ ↻ Restart ]
 *
 * Drives the lifecycle externally — caller owns the state machine
 * (idle / countdown / running / complete) and just renders this view.
 */
export default function PracticeTracker({
  state, // 'idle' | 'countdown' | 'running' | 'complete'
  countdown, // 5..1 during countdown
  intervalIndex,
  totalIntervals,
  intervalRemainingSec,
  intervalDurationSec,
  onStart,
  onStop,
  onRestart,
}) {
  const intervalFraction = intervalDurationSec > 0
    ? Math.max(0, Math.min(1, 1 - intervalRemainingSec / intervalDurationSec))
    : 0;
  const intervalMins = Math.round(intervalDurationSec / 60);

  return (
    <div className="flex w-full max-w-[36rem] flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5" />
          Practice
        </span>
        <span>
          {state === 'running' && `interval ${intervalIndex + 1} of ${totalIntervals}`}
          {state === 'idle' && `${totalIntervals} × ${intervalMins} min`}
          {state === 'countdown' && 'starting…'}
          {state === 'complete' && (
            <span className="text-super-accent">session complete</span>
          )}
        </span>
      </div>

      <div className="flex w-full gap-1">
        {Array.from({ length: totalIntervals }, (_, i) => {
          const completed =
            state === 'complete' || (state === 'running' && i < intervalIndex);
          const current = state === 'running' && i === intervalIndex;
          return (
            <div
              key={i}
              className={`relative h-1.5 flex-1 overflow-hidden rounded-full ${
                completed ? 'bg-primary' : 'bg-muted'
              }`}
            >
              {current && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-100 ease-linear"
                  style={{ width: `${intervalFraction * 100}%` }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex h-12 items-center justify-center">
        {state === 'countdown' && (
          <div className="font-mono text-5xl font-bold leading-none tabular-nums text-super-accent">
            {countdown}
          </div>
        )}
        {state === 'running' && (
          <div className="font-mono text-3xl font-bold leading-none tabular-nums">
            {formatTime(intervalRemainingSec)}
          </div>
        )}
        {state === 'complete' && (
          <div className="font-mono text-2xl font-bold leading-none tabular-nums text-super-accent">
            ✓ done
          </div>
        )}
        {state === 'idle' && (
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Ready
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        {state === 'idle' && (
          <Button onClick={onStart} className="gap-2">
            <Play className="h-4 w-4" />
            Start session
          </Button>
        )}
        {state === 'countdown' && (
          <Button variant="outline" onClick={onStop} className="gap-2">
            <Square className="h-4 w-4" />
            Cancel
          </Button>
        )}
        {state === 'running' && (
          <>
            <Button variant="destructive" onClick={onStop} className="gap-2">
              <Square className="h-4 w-4" />
              Stop
            </Button>
            <Button variant="outline" onClick={onRestart} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
          </>
        )}
        {state === 'complete' && (
          <Button onClick={onRestart} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Start over
          </Button>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
