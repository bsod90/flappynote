/**
 * Synthesizes short click `AudioBuffer`s for the metronome's click bank.
 * Each timbre has a "regular" and "accent" variant (accent is brighter +
 * slightly louder). Buffers are cached per AudioContext.
 */

const SAMPLE_RATE = 44100;

const TIMBRES = {
  woodblock: {
    label: 'Woodblock',
    build: buildWoodblock,
  },
  click: {
    label: 'Click',
    build: buildClick,
  },
  beep: {
    label: 'Beep',
    build: buildBeep,
  },
  cowbell: {
    label: 'Cowbell',
    build: buildCowbell,
  },
};

export const TIMBRE_LIST = Object.entries(TIMBRES).map(([key, t]) => ({
  key,
  label: t.label,
}));

const cache = new WeakMap(); // AudioContext → { [timbre]: { regular, accent } }

export function getClickBuffers(audioContext, timbreKey) {
  const timbre = TIMBRES[timbreKey] ?? TIMBRES.woodblock;
  let perCtx = cache.get(audioContext);
  if (!perCtx) {
    perCtx = {};
    cache.set(audioContext, perCtx);
  }
  if (!perCtx[timbreKey]) {
    perCtx[timbreKey] = {
      regular: timbre.build(audioContext, false),
      accent: timbre.build(audioContext, true),
    };
  }
  return perCtx[timbreKey];
}

// ── Synthesis primitives ─────────────────────────────────────────────────

/**
 * Bandpass-filtered noise burst, decays fast — the classic woodblock click.
 */
function buildWoodblock(ctx, accent) {
  const duration = 0.05;
  const buffer = ctx.createBuffer(1, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const data = buffer.getChannelData(0);
  const freq = accent ? 1800 : 1200;
  const decay = accent ? 70 : 90; // higher = faster decay

  let phase = 0;
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    // Resonant pulse: sine + filtered noise
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const sine = Math.sin(phase);
    const noise = Math.random() * 2 - 1;
    const mix = sine * 0.7 + noise * 0.3;
    // 1-pole lowpass on noise to soften it
    prev = prev * 0.6 + mix * 0.4;
    const env = Math.exp(-decay * t);
    data[i] = prev * env * (accent ? 0.95 : 0.75);
  }
  return buffer;
}

/**
 * Crisp high-frequency tick — sharp transient, very short.
 */
function buildClick(ctx, accent) {
  const duration = 0.03;
  const buffer = ctx.createBuffer(1, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const data = buffer.getChannelData(0);
  const freq = accent ? 3200 : 2200;
  const decay = 200;
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-decay * t);
    data[i] = Math.sin(2 * Math.PI * freq * t) * env * (accent ? 0.9 : 0.7);
  }
  return buffer;
}

/**
 * Pure-tone beep — square-ish, easy to spot in mic listen-back.
 */
function buildBeep(ctx, accent) {
  const duration = 0.06;
  const buffer = ctx.createBuffer(1, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const data = buffer.getChannelData(0);
  const freq = accent ? 1000 : 600;
  const decay = 35;
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-decay * t);
    // Soft square via tanh of a sine
    const wave = Math.tanh(Math.sin(2 * Math.PI * freq * t) * 3);
    data[i] = wave * env * (accent ? 0.85 : 0.65);
  }
  return buffer;
}

/**
 * Cowbell-ish — two slightly inharmonic frequencies summed, longer ring.
 */
function buildCowbell(ctx, accent) {
  const duration = 0.18;
  const buffer = ctx.createBuffer(1, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const data = buffer.getChannelData(0);
  const f1 = accent ? 845 : 587;
  const f2 = f1 * 1.504; // inharmonic ratio for "metallic" feel
  const decay = accent ? 18 : 22;
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-decay * t);
    const wave = Math.sin(2 * Math.PI * f1 * t) * 0.6 + Math.sin(2 * Math.PI * f2 * t) * 0.4;
    data[i] = wave * env * (accent ? 0.85 : 0.65);
  }
  return buffer;
}
