/**
 * Generates WAV fixtures used as fake microphone input in browser tests
 * (Chromium --use-file-for-fake-audio-capture). 16-bit PCM mono 44.1kHz.
 */
import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_RATE = 44100;

function writeWav(filePath, samples) {
  const dataLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

/**
 * Sustained tone with a few harmonics (voice-like enough for the pitch
 * detectors, far more stable than a real voice).
 */
export function generateTone(filePath, { frequency = 220, seconds = 60, amplitude = 0.5 } = {}) {
  const n = SAMPLE_RATE * seconds;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] =
      amplitude *
      (0.7 * Math.sin(2 * Math.PI * frequency * t) +
        0.2 * Math.sin(2 * Math.PI * 2 * frequency * t) +
        0.1 * Math.sin(2 * Math.PI * 3 * frequency * t));
  }
  writeWav(filePath, samples);
}

/**
 * Percussive click track: short decaying noise bursts at a fixed BPM,
 * silence in between. Mimics drumstick hits on a practice pad.
 */
export function generateClicks(filePath, { bpm = 120, seconds = 60, amplitude = 0.8 } = {}) {
  const n = SAMPLE_RATE * seconds;
  const samples = new Float32Array(n);
  const beatInterval = (60 / bpm) * SAMPLE_RATE;
  const burstLength = Math.floor(0.01 * SAMPLE_RATE); // 10ms burst

  for (let beatStart = 0; beatStart < n; beatStart += beatInterval) {
    const start = Math.floor(beatStart);
    for (let i = 0; i < burstLength && start + i < n; i++) {
      const decay = Math.exp(-i / (burstLength / 4));
      // Mix of noise + 1kHz ping so both energy and spectral detectors see it
      samples[start + i] =
        amplitude * decay * (0.6 * (Math.random() * 2 - 1) + 0.4 * Math.sin((2 * Math.PI * 1000 * i) / SAMPLE_RATE));
    }
  }
  writeWav(filePath, samples);
}

export function ensureFixtures(dir) {
  const tonePath = path.join(dir, 'tone-a3-220hz.wav');
  const clicksPath = path.join(dir, 'clicks-120bpm.wav');
  if (!fs.existsSync(tonePath)) generateTone(tonePath);
  if (!fs.existsSync(clicksPath)) generateClicks(clicksPath);
  return { tonePath, clicksPath };
}
