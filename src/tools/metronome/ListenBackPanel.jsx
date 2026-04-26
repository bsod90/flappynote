import { useEffect, useRef, useState } from 'react';
import { Headphones } from 'lucide-react';

import { T_MAX } from './sensitivity.js';

/**
 * Single unified timeline:
 *
 *   • subtle quarter > 8th > 16th grid (always on)
 *   • optional 8th-triplet grid (toggle button on the panel)
 *   • beat ticks on top of the grid (audible solid; silent dashed)
 *   • muted "below threshold" band as the sensitivity indicator
 *   • cyan waveform mirrored ± from center
 *   • hit dots colored by `gridOffsetMs` status (on grid / close / off)
 *   • stats: On grid / Click sync / Hit rate / Accents
 *
 * Y-scale is calibrated so amplitude = T_MAX maps to the box edge — at the
 * lowest sensitivity the threshold band fills the whole strip.
 */
export default function ListenBackPanel({
  tracker,
  getNow,
  isActive,
  bpm,
  showTriplets,
  onToggleTriplets,
  windowSec = 6,
  height = 200,
  warning,
  threshold = 0.008,
  levelBufferRef,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: height });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width } = e.contentRect;
        setSize({ w: Math.max(200, Math.floor(width)), h: height });
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [height]);

  useEffect(() => {
    if (!isActive || !tracker || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf;
    let lastStatsTime = 0;
    const css = (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    const render = () => {
      const now = getNow();
      const winStart = now - windowSec;
      const w = size.w;
      const h = size.h;
      const colors = {
        bg: `hsl(${css('--card')})`,
        border: `hsl(${css('--border')})`,
        muted: `hsl(${css('--muted-foreground')})`,
        primary: `hsl(${css('--primary')})`,
        super: `hsl(${css('--super-accent')})`,
        green: 'rgb(34, 197, 94)',
        yellow: 'rgb(234, 179, 8)',
        red: 'rgb(239, 68, 68)',
      };

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);

      const padX = 12;
      const padY = 6;
      const lanesX = padX;
      const lanesW = w - padX * 2;
      const top = padY;
      const bottom = h - padY;
      const midY = (top + bottom) / 2;
      const halfH = (bottom - top) / 2;
      const ampToY = (amp) => Math.min(halfH, (amp / T_MAX) * halfH);
      const tToX = (t) => lanesX + ((t - winStart) / windowSec) * lanesW;
      const beatDur = 60 / Math.max(20, bpm);

      // ── Threshold band (sensitivity indicator) — fill only, no border
      const bandY = ampToY(threshold);
      ctx.fillStyle = colors.muted;
      ctx.globalAlpha = 0.1;
      ctx.fillRect(lanesX, midY - bandY, lanesW, bandY * 2);
      ctx.globalAlpha = 1;

      // ── Subdivision grid (16th < 8th < quarter, painted lightest first).
      // We anchor to the latest known beat and project forward + backward
      // using BPM so the grid covers the whole window, even if the engine
      // hasn't fired the upcoming beats yet.
      const beats = tracker.expectedBeats;
      const drawSubLine = (t, color, opacity, lineWidth, dash) => {
        if (t < winStart || t > now) return;
        const x = tToX(t);
        ctx.strokeStyle = color;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = lineWidth;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(x, top + 4);
        ctx.lineTo(x, bottom - 4);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (dash) ctx.setLineDash([]);
      };
      if (beats.length > 0 && bpm > 0) {
        const anchor = beats[beats.length - 1];
        const beatsBack = Math.ceil((anchor.time - winStart) / beatDur) + 1;
        const beatsForward = Math.ceil((now - anchor.time) / beatDur) + 1;
        for (let i = -beatsBack; i <= beatsForward; i++) {
          const bt = anchor.time + i * beatDur;
          // 16ths (lightest)
          drawSubLine(bt + 0.25 * beatDur, colors.muted, 0.22, 1);
          drawSubLine(bt + 0.75 * beatDur, colors.muted, 0.22, 1);
          // 8th (medium)
          drawSubLine(bt + 0.5 * beatDur, colors.muted, 0.42, 1.25);
          // Triplets (optional, dashed super-accent so they read as alt grid)
          if (showTriplets) {
            drawSubLine(bt + (1 / 3) * beatDur, colors.super, 0.32, 1, [2, 3]);
            drawSubLine(bt + (2 / 3) * beatDur, colors.super, 0.32, 1, [2, 3]);
          }
        }
      }

      // ── Waveform — mirrored peak fill
      const buf = levelBufferRef?.current ?? [];
      ctx.fillStyle = colors.primary;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < buf.length; i++) {
        const e = buf[i];
        if (e.time < winStart || e.time > now) continue;
        const x = tToX(e.time);
        const y = midY - ampToY(e.peak);
        if (!started) { ctx.moveTo(x, midY); started = true; }
        ctx.lineTo(x, y);
      }
      for (let i = buf.length - 1; i >= 0; i--) {
        const e = buf[i];
        if (e.time < winStart || e.time > now) continue;
        const x = tToX(e.time);
        const y = midY + ampToY(e.peak);
        ctx.lineTo(x, y);
      }
      if (started) {
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Beat ticks — quarter grid (on top of subdivisions)
      for (const beat of tracker.expectedBeats) {
        if (beat.time < winStart || beat.time > now) continue;
        const x = tToX(beat.time);
        if (beat.isSilent) {
          ctx.strokeStyle = colors.muted;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
        } else if (beat.isAccent) {
          ctx.strokeStyle = colors.super;
          ctx.globalAlpha = 0.95;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = colors.muted;
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(x, top + 2);
        ctx.lineTo(x, bottom - 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }

      // ── Center axis
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lanesX, midY);
      ctx.lineTo(lanesX + lanesW, midY);
      ctx.stroke();

      // ── "Now" marker
      ctx.strokeStyle = colors.muted;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(lanesX + lanesW, top);
      ctx.lineTo(lanesX + lanesW, bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Hit dots — colored by grid status. On-grid hits get a green
      // shade keyed to which subdivision they landed on:
      //   quarter   → vivid kelly green
      //   eighth    → lime
      //   sixteenth → teal
      //   triplet   → emerald
      // Flam hits (drum-grace + main pair) get a subtle small dot below.
      for (const hit of tracker.hits) {
        if (hit.time < winStart || hit.time > now) continue;
        const x = tToX(hit.time);
        const r = hit.isAccentHit ? 6 : 4;
        const color = colorForHit(hit);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(x, midY, r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, midY, r, 0, Math.PI * 2);
        ctx.fill();

      }

      // ── Flam indicators — yellow dot + tiny "FLAM" label at the bottom
      ctx.font = '8px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (const hit of tracker.hits) {
        if (!hit.hasFlam) continue;
        if (hit.time < winStart || hit.time > now) continue;
        const x = tToX(hit.time);
        const flamYellow = 'rgb(234, 179, 8)';
        ctx.fillStyle = flamYellow;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(x, bottom - 14, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.fillText('FLAM', x, bottom - 2);
        ctx.globalAlpha = 1;
      }

      // ── Frame
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

      if (performance.now() - lastStatsTime > 250) {
        lastStatsTime = performance.now();
        setStats(tracker.getStats({ now }));
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [tracker, getNow, isActive, size.w, size.h, windowSec, threshold, levelBufferRef, bpm, showTriplets]);

  return (
    <div ref={wrapRef} className="w-full">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Headphones className="h-3.5 w-3.5" />
          Listen back
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleTriplets}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
              showTriplets
                ? 'bg-super-accent/20 text-super-accent'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={showTriplets}
          >
            Triplets
          </button>
          {warning && (
            <span className="text-[11px] text-destructive">{warning}</span>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="block w-full rounded-md" />

      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
        <Stat
          label="On grid"
          value={stats?.onGridPct != null ? `${stats.onGridPct}%` : '—'}
          sub={stats?.gridHits ? `${signed(stats.avgGridOffsetMs)}ms` : null}
        />
        <Stat
          label="Click sync"
          value={stats?.onClickPct != null ? `${stats.onClickPct}%` : '—'}
          sub={stats?.clickHits ? `${signed(stats.avgClickOffsetMs)}ms` : null}
        />
        <Stat
          label="Hit rate"
          value={stats && stats.expected > 0 ? `${Math.round(stats.hitRate * 100)}%` : '—'}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2">
      <div className="font-mono text-sm tabular-nums text-foreground">{value}</div>
      {sub && <div className="font-mono text-[10px] tabular-nums text-muted-foreground">{sub}</div>}
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
    </div>
  );
}

function signed(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

const HIT_GREENS = {
  quarter: 'rgb(34, 197, 94)',    // kelly green — on the click
  eighth: 'rgb(132, 204, 22)',    // lime — on the "and"
  sixteenth: 'rgb(20, 184, 166)', // teal — sixteenth subdivision
  triplet: 'rgb(16, 185, 129)',   // emerald — triplet grid
};

function colorForHit(hit) {
  if (hit.status === 'onTime') {
    return HIT_GREENS[hit.gridSubdivision] ?? HIT_GREENS.quarter;
  }
  if (hit.status === 'close') return 'rgb(234, 179, 8)';
  return 'rgb(239, 68, 68)';
}
