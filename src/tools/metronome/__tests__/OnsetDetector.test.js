import { describe, it, expect } from 'vitest';
import { OnsetDetector } from '../OnsetDetector.js';

/**
 * Synthetic-percussion tests for the real-time onset detector.
 * Signals are processed in 1024-sample blocks like MicListener does.
 */

const SR = 44100;
const BLOCK = 1024;

/** Decaying noise burst (drum-pad-like hit) written into `buf` at `start`. */
function writeHit(buf, start, { amplitude = 0.5, durMs = 10, seed = 1 } = {}) {
  const n = Math.floor((durMs / 1000) * SR);
  let s = seed;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    // Cheap deterministic pseudo-noise
    s = (s * 16807) % 2147483647;
    const noise = (s / 2147483647) * 2 - 1;
    const decay = Math.exp(-i / (n / 4));
    buf[start + i] += amplitude * decay * noise;
  }
}

/** Exponentially decaying sine tail (plucked-string-like sustain). */
function writeTail(buf, start, { amplitude = 0.4, freq = 196, durMs = 600 } = {}) {
  const n = Math.floor((durMs / 1000) * SR);
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const decay = Math.exp(-i / (n / 2.5));
    buf[start + i] += amplitude * decay * Math.sin((2 * Math.PI * freq * i) / SR);
  }
}

/** Run the detector over the buffer in blocks; returns detected onsets. */
function detectAll(detector, buf) {
  const onsets = [];
  for (let start = 0; start + BLOCK <= buf.length; start += BLOCK) {
    const block = buf.subarray(start, start + BLOCK);
    const blockEndTime = (start + BLOCK) / SR;
    const onset = detector.process(block, blockEndTime, SR);
    if (onset) onsets.push(onset);
  }
  return onsets;
}

function seconds(s) {
  return Math.floor(s * SR);
}

describe('OnsetDetector', () => {
  it('detects isolated hits at the right times', () => {
    const buf = new Float32Array(seconds(2));
    const hitTimes = [0.25, 0.75, 1.25, 1.75];
    hitTimes.forEach((t, i) => writeHit(buf, seconds(t), { seed: i + 1 }));

    const detector = new OnsetDetector();
    const onsets = detectAll(detector, buf);

    expect(onsets.length).toBe(hitTimes.length);
    onsets.forEach((onset, i) => {
      // Onset time within 25ms of the true attack (one block of slack)
      expect(Math.abs(onset.time - hitTimes[i]) * 1000).toBeLessThan(25);
    });
  });

  it('estimates onset near the attack start, not the burst tail', () => {
    const buf = new Float32Array(seconds(1));
    // Slow 30ms attack: ramp up to the peak so the loudest sample sits late
    const start = seconds(0.5);
    const attack = Math.floor(0.03 * SR);
    for (let i = 0; i < attack; i++) {
      buf[start + i] = (i / attack) * 0.5 * Math.sin((2 * Math.PI * 800 * i) / SR);
    }
    for (let i = attack; i < attack + Math.floor(0.02 * SR); i++) {
      const decay = Math.exp(-(i - attack) / (0.005 * SR));
      buf[start + i] = 0.5 * decay * Math.sin((2 * Math.PI * 800 * i) / SR);
    }

    const detector = new OnsetDetector();
    const onsets = detectAll(detector, buf);

    expect(onsets.length).toBe(1);
    // The detector should report the onset near the attack start (0.5s),
    // not at the peak 30ms later.
    expect((onsets[0].time - 0.5) * 1000).toBeLessThan(20);
  });

  it('detects a second hit during the sustained tail of the first', () => {
    const buf = new Float32Array(seconds(2));
    // Pluck with a long tail, then another pluck 150ms later, mid-tail
    writeHit(buf, seconds(0.5), { amplitude: 0.6 });
    writeTail(buf, seconds(0.5), { amplitude: 0.35 });
    writeHit(buf, seconds(0.65), { amplitude: 0.6, seed: 7 });
    writeTail(buf, seconds(0.65), { amplitude: 0.35, freq: 247 });

    const detector = new OnsetDetector();
    const onsets = detectAll(detector, buf);

    expect(onsets.length).toBe(2);
    expect(Math.abs(onsets[1].time - 0.65) * 1000).toBeLessThan(25);
  });

  it('detects quick double hits ~80ms apart', () => {
    const buf = new Float32Array(seconds(1));
    writeHit(buf, seconds(0.4), { amplitude: 0.6 });
    writeHit(buf, seconds(0.48), { amplitude: 0.55, seed: 3 });

    const detector = new OnsetDetector();
    const onsets = detectAll(detector, buf);

    expect(onsets.length).toBe(2);
  });

  it('does not fire on smooth amplitude modulation (tremolo)', () => {
    const buf = new Float32Array(seconds(2));
    // 6Hz tremolo on a 220Hz tone — no sharp attacks after the initial one
    for (let i = 0; i < buf.length; i++) {
      const t = i / SR;
      const am = 0.55 + 0.45 * Math.sin(2 * Math.PI * 6 * t - Math.PI / 2);
      buf[i] = 0.3 * am * Math.sin(2 * Math.PI * 220 * t);
    }

    const detector = new OnsetDetector();
    const onsets = detectAll(detector, buf);

    // At most the initial swell registers; the modulation itself must not
    expect(onsets.length).toBeLessThanOrEqual(1);
  });

  it('ignores low-level noise', () => {
    const buf = new Float32Array(seconds(1));
    let s = 42;
    for (let i = 0; i < buf.length; i++) {
      s = (s * 16807) % 2147483647;
      buf[i] = ((s / 2147483647) * 2 - 1) * 0.003; // below default threshold
    }

    const detector = new OnsetDetector();
    expect(detectAll(detector, buf).length).toBe(0);
  });

  it('respects the refractory period for back-to-back blocks', () => {
    const buf = new Float32Array(seconds(1));
    writeHit(buf, seconds(0.5), { amplitude: 0.6 });

    // Process overlapping reads like RAF cadence does (~16ms hop, 23ms window)
    const detector = new OnsetDetector();
    const onsets = [];
    const hop = Math.floor(0.016 * SR);
    for (let start = 0; start + BLOCK <= buf.length; start += hop) {
      const block = buf.subarray(start, start + BLOCK);
      const onset = detector.process(block, (start + BLOCK) / SR, SR);
      if (onset) onsets.push(onset);
    }

    expect(onsets.length).toBe(1);
  });
});
