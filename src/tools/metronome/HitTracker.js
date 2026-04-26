/**
 * HitTracker — turns a stream of expected beats and detected hits into
 * unified history for visualization + stats.
 *
 *   gridOffsetMs  — signed offset to the closest grid point
 *                   (quarter / 8th / 16th, plus optional 8th-triplet).
 *                   Drives the dot color: how on-grid you are.
 *   clickOffsetMs — signed offset to the closest *audible* expected beat
 *                   (silent / skipped beats excluded). Drives the
 *                   "click sync" stat.
 *
 * Times are AudioContext seconds. Output latency is added to expected
 * beat times so we compare hits against what the user actually heard.
 *
 * Status (from gridOffsetMs):
 *   onTime — |offset| ≤ tolerances.onTime  (green)
 *   close  — |offset| ≤ tolerances.close   (yellow)
 *   off    — matched but further out       (red)
 *   ghost  — couldn't pair to any beat in MATCH_WINDOW_MS  (red)
 */

const MATCH_WINDOW_MS = 250;
const MAX_AGE_S = 12;

// Flam: any pair of close hits (typically a stick-out-of-sync mistake when
// the player meant to hit simultaneously). We treat them symmetrically —
// either hit can be the louder one — and only require both to be above a
// small fraction of each other so we don't pair true noise with a hit.
const FLAM_MIN_GAP_MS = 5;
const FLAM_MAX_GAP_MS_STATIC = 80;
const FLAM_MIN_RATIO = 0.1; // quieter ≥ 0.1 × louder

/**
 * Effective max gap is capped against a fraction of the beat duration so
 * legitimate fast 16ths don't read as flams (e.g. at 200 BPM a 16th is
 * 75ms — within our static 80ms window).
 */
function flamMaxGapMs(bpm) {
  const beatDurMs = 60000 / Math.max(20, bpm);
  return Math.min(FLAM_MAX_GAP_MS_STATIC, beatDurMs / 8);
}

export class HitTracker {
  constructor({ outputLatency = 0, tolerances = { onTime: 35, close: 80 } } = {}) {
    this.outputLatency = outputLatency;
    this.tolerances = tolerances;

    this.bpm = 120;
    this.gridConfig = { includeTriplets: false };

    this.expectedBeats = []; // { time, beatIndex, barNumber, isAccent, isSilent, isSkippedBar }
    this.hits = [];

    this._ambientEnergy = 0;
  }

  setOutputLatency(seconds) { this.outputLatency = seconds; }
  setBpm(bpm) { this.bpm = Math.max(20, Math.min(300, bpm | 0)); }
  setGridConfig(config) { this.gridConfig = { ...this.gridConfig, ...config }; }

  /**
   * Engine onBeat → tracker. Silent + skipped beats are tracked too:
   * keeping time when the click is silent is the most important thing
   * to measure, so they're flagged but counted.
   */
  addExpectedBeat({ time, beatIndex, barNumber, kind, skipped }) {
    this.expectedBeats.push({
      time: time + this.outputLatency,
      beatIndex,
      barNumber,
      isAccent: kind === 'accent',
      isSilent: kind === 'silent' || !!skipped,
      isSkippedBar: !!skipped,
    });
    this._prune();
  }

  /** MicListener onOnset → tracker. Returns the matched record. */
  addHit({ time, energy }) {
    // Anchor: nearest expected beat (any kind) — used to compute the
    // grid offset by snapping the hit's intra-beat fraction to the
    // closest virtual grid point.
    let anchor = null;
    let anchorOffsetMs = Infinity;
    for (const b of this.expectedBeats) {
      const off = (time - b.time) * 1000;
      if (Math.abs(off) < Math.abs(anchorOffsetMs)) {
        anchorOffsetMs = off;
        anchor = b;
      }
    }

    let matchedBeatTime = null;
    let matchedIsAccent = false;
    let matchedIsSilent = false;
    if (anchor) {
      matchedBeatTime = anchor.time;
      matchedIsAccent = anchor.isAccent;
      matchedIsSilent = anchor.isSilent;
    }

    // Grid offset uses a *virtual* beat reference projected from the latest
    // known beat by BPM. This is critical for hits that arrive just before
    // the next click — the engine hasn't emitted that beat yet, so the
    // nearest real beat is the previous one (~beatDur back). With nearest-
    // virtual-beat the fracTime is always in ±beatDur/2 and the candidates
    // around 0 cover the case correctly.
    let gridOffsetMs = null;
    let gridSubdivision = null;
    if (this.expectedBeats.length > 0) {
      const beatDur = 60 / this.bpm;
      const latest = this.expectedBeats[this.expectedBeats.length - 1];
      const beatsFromLatest = Math.round((time - latest.time) / beatDur);
      const beatRef = latest.time + beatsFromLatest * beatDur;
      const fracTime = time - beatRef; // |fracTime| ≤ beatDur/2

      const candidates = [
        { frac: 0, sub: 'quarter' },
        { frac: 0.5, sub: 'eighth' },
        { frac: -0.5, sub: 'eighth' },
        { frac: 0.25, sub: 'sixteenth' },
        { frac: -0.25, sub: 'sixteenth' },
      ];
      if (this.gridConfig.includeTriplets) {
        candidates.push(
          { frac: 1 / 3, sub: 'triplet' },
          { frac: -1 / 3, sub: 'triplet' },
        );
      }
      let bestOff = Infinity;
      let bestSub = 'quarter';
      for (const c of candidates) {
        const off = (fracTime - c.frac * beatDur) * 1000;
        if (Math.abs(off) < Math.abs(bestOff)) {
          bestOff = off;
          bestSub = c.sub;
        }
      }
      gridOffsetMs = bestOff;
      gridSubdivision = bestSub;
    }

    // Click-sync offset: nearest *audible* beat
    let clickOffsetMs = null;
    let matchedClickTime = null;
    for (const b of this.expectedBeats) {
      if (b.isSilent) continue;
      const off = (time - b.time) * 1000;
      if (clickOffsetMs == null || Math.abs(off) < Math.abs(clickOffsetMs)) {
        clickOffsetMs = off;
        matchedClickTime = b.time;
      }
    }
    if (clickOffsetMs != null && Math.abs(clickOffsetMs) > MATCH_WINDOW_MS) {
      clickOffsetMs = null;
      matchedClickTime = null;
    }

    let status = 'ghost';
    if (gridOffsetMs != null) {
      const abs = Math.abs(gridOffsetMs);
      if (abs <= this.tolerances.onTime) status = 'onTime';
      else if (abs <= this.tolerances.close) status = 'close';
      else status = 'off';
    }

    const isAccentHit = this._ambientEnergy > 1e-4 && energy > 1.5 * this._ambientEnergy;
    this._ambientEnergy = 0.85 * this._ambientEnergy + 0.15 * energy;

    // Flam detection — symmetric. Two close hits with comparable energy
    // either way around → flam. The earlier one is collapsed into the
    // later "main" hit so the grid scoring + timeline show a single event.
    let hasFlam = false;
    const prev = this.hits[this.hits.length - 1];
    if (prev) {
      const gapMs = (time - prev.time) * 1000;
      const louder = Math.max(prev.energy, energy);
      const quieter = Math.min(prev.energy, energy);
      const ratio = louder > 0 ? quieter / louder : 0;
      const maxGap = flamMaxGapMs(this.bpm);
      if (gapMs >= FLAM_MIN_GAP_MS && gapMs <= maxGap && ratio >= FLAM_MIN_RATIO) {
        hasFlam = true;
        this.hits.pop(); // earlier hit collapses into this one
      }
    }

    const record = {
      time,
      energy,
      isAccentHit,
      hasFlam,
      matchedBeatTime,
      matchedIsAccent,
      matchedIsSilent,
      matchedClickTime,
      gridOffsetMs,
      gridSubdivision,
      clickOffsetMs,
      status,
    };
    this.hits.push(record);
    this._prune();
    return record;
  }

  _prune(nowSeconds) {
    const now = nowSeconds ?? this._latest();
    const cutoff = now - MAX_AGE_S;
    this.expectedBeats = this.expectedBeats.filter((b) => b.time > cutoff);
    this.hits = this.hits.filter((h) => h.time > cutoff);
  }

  _latest() {
    let t = 0;
    if (this.expectedBeats.length) t = Math.max(t, this.expectedBeats.at(-1).time);
    if (this.hits.length) t = Math.max(t, this.hits.at(-1).time);
    return t;
  }

  reset() {
    this.expectedBeats = [];
    this.hits = [];
    this._ambientEnergy = 0;
  }

  /** Aggregate stats over the last `windowSeconds`. */
  getStats({ now, windowSeconds = 8 } = {}) {
    const ref = now ?? this._latest();
    const cutoff = ref - windowSeconds;
    const recentHits = this.hits.filter((h) => h.time > cutoff);
    // Only count beats that have *already happened* — the engine schedules
    // ~120ms ahead and outputLatency pushes beat times further into the
    // future, so including those would show a hit rate that drops every
    // time the next beat is queued (before you've even heard it).
    const recentExpected = this.expectedBeats.filter(
      (b) => b.time > cutoff && b.time <= ref
    );

    // Grid-relative
    const gridMatched = recentHits.filter((h) => h.gridOffsetMs != null);
    const onGrid = gridMatched.filter((h) => h.status === 'onTime').length;
    const avgGridOffsetMs = gridMatched.length > 0
      ? Math.round(gridMatched.reduce((s, h) => s + h.gridOffsetMs, 0) / gridMatched.length)
      : 0;
    const onGridPct = gridMatched.length > 0
      ? Math.round((onGrid / gridMatched.length) * 100)
      : null;

    // Click-sync (audible beats only)
    const clickMatched = recentHits.filter((h) => h.clickOffsetMs != null);
    const onClick = clickMatched.filter(
      (h) => Math.abs(h.clickOffsetMs) <= this.tolerances.onTime
    ).length;
    const avgClickOffsetMs = clickMatched.length > 0
      ? Math.round(clickMatched.reduce((s, h) => s + h.clickOffsetMs, 0) / clickMatched.length)
      : 0;
    const onClickPct = clickMatched.length > 0
      ? Math.round((onClick / clickMatched.length) * 100)
      : null;

    // Hit rate vs all expected beats. Only count matched beat times that
    // fall inside the same window — otherwise a recent hit anchored to a
    // beat just before the cutoff inflates matchedSet.size past
    // recentExpected.length and the rate creeps over 100%.
    const matchedSet = new Set(
      gridMatched
        .map((h) => h.matchedBeatTime)
        .filter((t) => t != null && t > cutoff)
    );
    const hitRate = recentExpected.length > 0
      ? Math.min(1, matchedSet.size / recentExpected.length)
      : 0;

    // Accent precision (only audible accent beats)
    const accentExpected = gridMatched.filter((h) => h.matchedIsAccent && !h.matchedIsSilent);
    const accentCorrect = accentExpected.filter((h) => h.isAccentHit).length;

    return {
      gridHits: gridMatched.length,
      onGridCount: onGrid,
      onGridPct,
      avgGridOffsetMs,
      clickHits: clickMatched.length,
      onClickCount: onClick,
      onClickPct,
      avgClickOffsetMs,
      expected: recentExpected.length,
      hitRate,
      accentExpected: accentExpected.length,
      accentCorrect,
      ghosts: recentHits.filter((h) => h.status === 'ghost').length,
    };
  }
}
