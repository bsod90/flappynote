import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const MIN_BPM = 30;
const MAX_BPM = 300;
const PULSE_MS = 220;
const ROTATING_DOT_COUNT = 18;
const DEG_PER_BPM = 6; // dot rotation per BPM step

/**
 * The centerpiece. A clean ring (no ruler marks) with:
 *
 *  - Outer measure-visualization ring: one rounded arc per beat. The active
 *    segment fills smoothly as the beat progresses, and on hit its stroke
 *    width swells briefly. Accent beats use the super-accent color (magenta);
 *    regular beats use primary (cyan).
 *  - Subtle dots inside the ring that rotate as BPM changes — gives tactile
 *    feedback when scrolling/dragging the dial.
 *  - Inner zone is a tap target for play/stop. Drag anywhere on the outer
 *    ring rotates BPM. Click the BPM number to type a tempo directly.
 *  - Small TAP-tempo pill lives inside, just above the play affordance.
 */
export default function MetronomeDial({
  bpm,
  onBpmChange,
  isRunning,
  onToggle,
  onTap,
  beatsPerBar,
  accentPattern,
  currentBeat,
  lastBeatTime,
  getNow,
  isSkippedBar,
  timeSig,
  subdivision = 1,
}) {
  const wrapperRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState(360);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(bpm));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize(Math.max(220, Math.min(width, height)));
      }
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  // Animation heartbeat (only while running, to save CPU)
  useEffect(() => {
    if (!isRunning) return;
    let raf;
    const loop = () => {
      setTick((t) => (t + 1) % 1e9);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isRunning]);

  // Pointer drag — rotational, like a real knob. Outer ring only.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const onPointerDown = (e) => {
      if (editing) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const r = Math.hypot(dx, dy);
      const radius = Math.min(rect.width, rect.height) / 2;
      const innerRadius = radius * 0.6;
      if (r < innerRadius) return; // inner = play/stop click handler
      if (r > radius * 1.05) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      dragRef.current = {
        cx,
        cy,
        lastAngle: Math.atan2(dy, dx),
        accumDeg: 0,
        currentBpm: bpm,
      };
    };

    const onPointerMove = (e) => {
      const s = dragRef.current;
      if (!s) return;
      e.preventDefault();
      const dx = e.clientX - s.cx;
      const dy = e.clientY - s.cy;
      const angle = Math.atan2(dy, dx);
      let delta = angle - s.lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      else if (delta < -Math.PI) delta += Math.PI * 2;
      s.lastAngle = angle;
      s.accumDeg += (delta * 180) / Math.PI;
      const bpmDelta = Math.trunc(s.accumDeg / 5);
      if (bpmDelta !== 0) {
        s.accumDeg -= bpmDelta * 5;
        const next = clamp(s.currentBpm + bpmDelta, MIN_BPM, MAX_BPM);
        if (next !== s.currentBpm) {
          s.currentBpm = next;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(3); } catch { /* noop */ }
          }
          onBpmChange(next);
        }
      }
    };

    const onPointerUp = (e) => {
      if (!dragRef.current) return;
      el.releasePointerCapture?.(e.pointerId);
      dragRef.current = null;
    };

    const onWheel = (e) => {
      if (editing) return;
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      const next = clamp(bpm + direction, MIN_BPM, MAX_BPM);
      if (next !== bpm) onBpmChange(next);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [bpm, editing, onBpmChange]);

  // Smooth bar progress + per-segment pulse, derived from engine clock
  const beatDur = 60 / bpm;
  const now = isRunning && getNow ? getNow() : 0;
  const elapsed = lastBeatTime != null && now > 0 ? Math.max(0, now - lastBeatTime) : 0;
  const fractionInBeat = isRunning ? clamp(elapsed / beatDur, 0, 1) : 0;
  const pulseAge = isRunning ? elapsed * 1000 : Infinity;

  const cx = size / 2;
  const cy = size / 2;
  const ringR = size / 2 - 6;
  const innerR = size * 0.4;

  const beatGap = 6; // degrees between beats
  const subGap = 3.5; // degrees between subdivisions inside a beat
  const subdivisions = Math.max(1, subdivision | 0);
  const totalBeatGap = beatGap * beatsPerBar;
  const beatDeg = (360 - totalBeatGap) / beatsPerBar;
  const subTotal = beatDeg - (subdivisions - 1) * subGap;
  const subDeg = subTotal / subdivisions;

  const beats = Array.from({ length: beatsPerBar }, (_, i) => {
    const beatStart = -90 + i * (beatDeg + beatGap) + beatGap / 2;
    const beatEnd = beatStart + beatDeg;
    const isAccent = accentPattern[i] === 'accent';
    const isSilent = accentPattern[i] === 'silent';
    const isCurrent = i === currentBeat && isRunning;
    let fillProgress = 0;
    if (isRunning && currentBeat >= 0) {
      if (i < currentBeat) fillProgress = 1;
      else if (i === currentBeat) fillProgress = fractionInBeat;
    }
    const pulse = isCurrent ? Math.max(0, 1 - pulseAge / PULSE_MS) : 0;
    // Per-subdivision fill: each sub-segment fills as the playhead crosses it
    const subs = Array.from({ length: subdivisions }, (_, s) => {
      const subStart = beatStart + s * (subDeg + subGap);
      const subEnd = subStart + subDeg;
      const subFill = clamp(fillProgress * subdivisions - s, 0, 1);
      return { startDeg: subStart, endDeg: subEnd, fill: subFill };
    });
    return { beatStart, beatEnd, isAccent, isSilent, isCurrent, pulse, subs };
  });

  // Subtle dots, evenly spaced, rotated by BPM — gives visual feedback when
  // scrolling the dial.
  const dotsRotation = (bpm * DEG_PER_BPM) % 360;
  const dotsR = innerR + 12; // sits in the gap between inner circle and segments

  const handleEditCommit = () => {
    const n = parseInt(editValue, 10);
    if (Number.isFinite(n)) onBpmChange(clamp(n, MIN_BPM, MAX_BPM));
    setEditing(false);
  };

  const handleInnerClick = (e) => {
    if (editing) return;
    if (e.target.closest('[data-no-toggle]')) return;
    onToggle();
  };

  void tick; // touch the heartbeat so eslint stays quiet

  return (
    <div
      ref={wrapperRef}
      className="relative aspect-square w-full max-w-[22rem] touch-none select-none lg:max-w-[26rem] xl:max-w-[28rem]"
      style={{ touchAction: 'none' }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="block"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="dial-bg" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        {/* Backdrop disc */}
        <circle
          cx={cx}
          cy={cy}
          r={ringR - 14}
          fill="url(#dial-bg)"
          stroke="hsl(var(--border))"
          strokeWidth={1}
          opacity={isSkippedBar ? 0.5 : 1}
        />

        {/* Rotating dots — anchored to the dial's "face", spin as BPM changes */}
        <g
          transform={`rotate(${dotsRotation} ${cx} ${cy})`}
          opacity={isSkippedBar ? 0.25 : 0.45}
          style={{ transition: 'transform 100ms linear' }}
        >
          {Array.from({ length: ROTATING_DOT_COUNT }, (_, i) => {
            const angle = (i / ROTATING_DOT_COUNT) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * dotsR;
            const y = cy + Math.sin(angle) * dotsR;
            const isMarker = i === 0; // one slightly stronger dot acts as a "needle"
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={isMarker ? 2.5 : 1.5}
                fill={isMarker ? 'hsl(var(--super-accent))' : 'hsl(var(--muted-foreground))'}
                opacity={isMarker ? 0.85 : 0.6}
              />
            );
          })}
        </g>

        {/* Outer measure-visualization ring — per-beat group, subdivided.
            On pulse: only the empty track + glow halo swell. The filled
            stroke stays at its base width so the "solid" indicator reads
            as crisp while the surrounding light backdrop breathes. */}
        {beats.map((beat, i) => {
          const baseW = beat.isAccent ? 10 : 8;
          const swell = beat.pulse * 8;
          const trackW = baseW + swell;
          const filledColor = beat.isAccent
            ? 'hsl(var(--super-accent))'
            : 'hsl(var(--primary))';
          const showGlow = beat.pulse > 0.05 && !isSkippedBar;
          return (
            <g key={i} opacity={isSkippedBar ? 0.4 : 1}>
              {/* Glow halo behind the active beat — fades out with the pulse */}
              {showGlow && beat.subs.map((sub, si) => (
                <Arc
                  key={`glow-${si}`}
                  cx={cx}
                  cy={cy}
                  r={ringR}
                  fromDeg={sub.startDeg}
                  toDeg={sub.endDeg}
                  stroke={filledColor}
                  strokeWidth={trackW + 14 * beat.pulse}
                  opacity={beat.pulse * 0.45}
                  strokeLinecap="round"
                />
              ))}

              {beat.subs.map((sub, si) => (
                <g key={si}>
                  {/* Empty track — swells with the pulse */}
                  <Arc
                    cx={cx}
                    cy={cy}
                    r={ringR}
                    fromDeg={sub.startDeg}
                    toDeg={sub.endDeg}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={trackW}
                    opacity={beat.isSilent ? 0.1 : 0.18}
                    strokeLinecap="round"
                    strokeDasharray={beat.isSilent ? '2 4' : undefined}
                  />
                  {/* Filled portion — base width, no pulse */}
                  {sub.fill > 0 && (
                    <Arc
                      cx={cx}
                      cy={cy}
                      r={ringR}
                      fromDeg={sub.startDeg}
                      toDeg={sub.startDeg + (sub.endDeg - sub.startDeg) * sub.fill}
                      stroke={filledColor}
                      strokeWidth={baseW}
                      opacity={1}
                      strokeLinecap="round"
                    />
                  )}
                </g>
              ))}
            </g>
          );
        })}

        {/* Inner subtle ring outline */}
        <circle
          cx={cx}
          cy={cy}
          r={innerR}
          fill="hsl(var(--background))"
          stroke="hsl(var(--border))"
          strokeWidth={1}
          opacity={0.7}
        />
      </svg>

      {/* Centered overlay: every control lives here */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        onClick={handleInnerClick}
        role="button"
        tabIndex={0}
        aria-label={isRunning ? 'Stop metronome' : 'Start metronome'}
      >
        <div
          data-no-toggle
          className="font-mono text-sm uppercase tracking-widest text-muted-foreground"
        >
          {timeSig}
        </div>

        <div data-no-toggle className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onBpmChange(clamp(bpm - 1, MIN_BPM, MAX_BPM))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Decrease BPM"
          >
            −
          </button>

          {editing ? (
            <input
              autoFocus
              value={editValue}
              type="number"
              inputMode="numeric"
              min={MIN_BPM}
              max={MAX_BPM}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditCommit();
                else if (e.key === 'Escape') {
                  setEditValue(String(bpm));
                  setEditing(false);
                }
              }}
              className="w-32 bg-transparent text-center font-mono font-bold tabular-nums text-foreground outline-none"
              style={{ fontSize: size * 0.18 }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditValue(String(bpm));
                setEditing(true);
              }}
              className="font-mono font-bold leading-none tabular-nums text-foreground hover:text-primary focus:text-primary focus:outline-none"
              style={{ fontSize: size * 0.2 }}
              aria-label="Edit BPM"
            >
              {bpm}
            </button>
          )}

          <button
            type="button"
            onClick={() => onBpmChange(clamp(bpm + 1, MIN_BPM, MAX_BPM))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Increase BPM"
          >
            +
          </button>
        </div>

        <div className="text-xs uppercase tracking-wider text-muted-foreground">BPM</div>

        <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {isRunning ? (
            <>
              <Pause className="h-3.5 w-3.5" />
              <span>Tap to stop</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              <span>Tap to start</span>
            </>
          )}
        </div>

        {/* Inline TAP-tempo pill */}
        <button
          data-no-toggle
          type="button"
          onClick={onTap}
          className="mt-3 rounded-full border border-border bg-background/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:border-super-accent hover:text-super-accent"
          aria-label="Tap tempo"
        >
          Tap
        </button>
      </div>
    </div>
  );
}

function Arc({ cx, cy, r, fromDeg, toDeg, stroke, strokeWidth, opacity, strokeLinecap, strokeDasharray }) {
  if (toDeg <= fromDeg) return null;
  const fromRad = (fromDeg * Math.PI) / 180;
  const toRad = (toDeg * Math.PI) / 180;
  const x1 = cx + Math.cos(fromRad) * r;
  const y1 = cy + Math.sin(fromRad) * r;
  const x2 = cx + Math.cos(toRad) * r;
  const y2 = cy + Math.sin(toRad) * r;
  const sweep = toDeg - fromDeg;
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  return (
    <path
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      strokeLinecap={strokeLinecap}
      strokeDasharray={strokeDasharray}
    />
  );
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
