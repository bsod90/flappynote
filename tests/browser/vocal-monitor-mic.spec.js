import { test, expect } from '@playwright/test';

// Runs in the `fake-mic-tone` project: the fake mic produces a sustained
// 220Hz (A3) tone. Verifies the vocal monitor's full start → detect → render
// flow using the dev-only window.__vmController hook.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
});

test.use({ viewport: { width: 1280, height: 800 } });

test('start begins recording and the pitch pipeline reports ~220Hz', async ({ page }) => {
  await page.goto('/vocal-monitor');

  await page.getByRole('button', { name: 'Start' }).click();

  // Recording state flips the toolbar button to Stop
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible({ timeout: 15000 });

  // Poll the pitch context through the controller until it reports a pitch
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const c = window.__vmController;
          const pitch = c?.pitchContext?.getCurrentPitch?.();
          return pitch?.frequency ?? null;
        }),
      { timeout: 20000, message: 'pitch detected from fake mic' }
    )
    .not.toBeNull();

  const frequency = await page.evaluate(
    () => window.__vmController.pitchContext.getCurrentPitch().frequency
  );
  // A3 = 220Hz; allow generous tolerance (±1 semitone ≈ 207–233Hz)
  expect(frequency).toBeGreaterThan(205);
  expect(frequency).toBeLessThan(235);

  // Stop returns the toolbar to Start
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('rhythm mode starts a metronome click alongside recording', async ({ page }) => {
  await page.goto('/vocal-monitor');

  const errors = [];
  page.on('pageerror', (e) => errors.push(e));

  // Enable rhythm mode and set the tempo in the sidebar
  await page.getByRole('switch', { name: 'Metronome Click' }).click();

  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible({ timeout: 15000 });

  // The click engine should be running at the configured tempo
  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          running: window.__vmController?._rhythmEngine?.isRunning ?? false,
          bpm: window.__vmController?._rhythmEngine?.bpm ?? 0,
        })),
      { timeout: 10000 }
    )
    .toEqual({ running: true, bpm: 90 });

  // Toggling rhythm off mid-recording stops the click
  await page.getByRole('switch', { name: 'Metronome Click' }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => window.__vmController?._rhythmEngine?.isRunning ?? false)
    )
    .toBe(false);

  await page.getByRole('button', { name: 'Stop' }).click();
  expect(errors).toEqual([]);
});
