#!/usr/bin/env node
// Capture a social screenshot of the Tuner in dark mode using Playwright.
// Assumes the dev server is running on http://localhost:3000.
//
// Usage:
//   node scripts/screenshot-tuner.mjs
//
// The script uses Tuner's demoFreq/demoTuned query params to render a
// "live" reading without needing a microphone.

import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT = path.join(REPO_ROOT, 'public', 'screenshot-tuner.png');

// D3 = 146.83 Hz, slightly sharp (+8 cents) — close-but-not-quite-in-tune.
// Mark the low E2 (idx 0) and A2 (idx 1) strings as tuned.
const FREQ = 146.83 * Math.pow(2, 8 / 1200);
const TUNED = '0,1';

const main = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    // Tight 16:10 viewport. Crops out empty whitespace around the
    // visualizer for a punchier social card.
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  // Force dark mode + collapse the sidebar so the visualizer fills the canvas.
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        'vocal-trainer-settings',
        JSON.stringify({ settingsCollapsed: true })
      );
    } catch {}
  });

  const url = `http://localhost:3000/tuner?demoFreq=${FREQ}&demoTuned=${TUNED}`;
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for the visualizer to settle into the demo state.
  await page.waitForSelector('text=Listening…, text=Low, text=High, text=In tune', { state: 'attached', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  // Crop tightly around the union of the big-note display and the strings
  // row. The column they share has flex-1 height so it would crop the whole
  // viewport; instead, take the actual bounding boxes of just those two
  // elements and union them.
  const span = await page.evaluate(() => {
    const big = document.querySelector('span[style*="clamp(96px"]');
    const stringPad = document.querySelector('button[aria-label^="String"]');
    if (!big || !stringPad) return null;
    const a = big.getBoundingClientRect();
    // Walk up from a string pad to the row container
    const row = stringPad.closest('.flex.items-center');
    const b = (row || stringPad).getBoundingClientRect();
    return { top: a.top, bottom: b.bottom };
  });
  const PAD_Y = 80;
  const clip = span
    ? {
        x: 0,
        y: Math.max(0, span.top - PAD_Y),
        width: 1600,
        height: Math.min(1000, span.bottom - span.top + PAD_Y * 2),
      }
    : { x: 0, y: 80, width: 1600, height: 760 };
  await page.screenshot({ path: OUT, type: 'png', clip });
  await browser.close();
  console.log(`Wrote ${OUT}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
