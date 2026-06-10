import { test, expect } from '@playwright/test';

// Runs in the `fake-mic-tone` project: Chromium's fake mic plays a sustained
// 220Hz (A3) tone. This drives the REAL pitch detection pipeline end-to-end.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
});

test.use({ viewport: { width: 1280, height: 800 } });

test('chromatic tuner detects the A3 tone from the (fake) microphone', async ({ page }) => {
  await page.goto('/tuner');

  // Switch to chromatic mode so the detected note is shown directly
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Chromatic' }).click();

  // The big note readout should settle on A within a few seconds
  await expect(page.getByText(/In tune|Low|High/).first()).toBeVisible({ timeout: 15000 });
  // The visualizer shows the note letter A (octave 3)
  await expect(page.getByText('A', { exact: true }).first()).toBeVisible({ timeout: 15000 });
});
