import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, 'tests/fixtures/audio');

/**
 * Chromium flags that replace getUserMedia with a fake mic fed from a WAV
 * file — lets tests drive the real pitch/onset pipeline end-to-end.
 */
const fakeMicArgs = (wavFile) => [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${path.join(fixturesDir, wavFile)}`,
  '--autoplay-policy=no-user-gesture-required',
];

export default defineConfig({
  testDir: './tests/browser',
  globalSetup: './tests/browser/global-setup.mjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /.*-mic\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Specs that need a fake mic producing a sustained 220Hz (A3) tone —
      // tuner + vocal monitor pitch flows.
      name: 'fake-mic-tone',
      testMatch: /(tuner|vocal-monitor)-mic\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: fakeMicArgs('tone-a3-220hz.wav') },
      },
    },
    {
      // Specs that need a fake mic producing a 120 BPM percussive click
      // track — metronome listen-back onset detection.
      name: 'fake-mic-clicks',
      testMatch: /metronome-mic\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: fakeMicArgs('clicks-120bpm.wav') },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
