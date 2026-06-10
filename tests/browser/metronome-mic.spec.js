import { test, expect } from '@playwright/test';

// Runs in the `fake-mic-clicks` project: the fake mic produces a percussive
// click track at 120 BPM. Verifies the metronome's listen-back flow — mic
// onsets are detected and tracked as hits against the running click.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
});

test.use({ viewport: { width: 1280, height: 800 } });

test('listen-back detects hits from the (fake) mic while the metronome runs', async ({ page }) => {
  await page.goto('/metronome');

  const errors = [];
  page.on('pageerror', (e) => errors.push(e));

  // Start the metronome (creates the shared AudioContext). The dial center
  // is covered by data-no-toggle controls, so dispatch the click directly.
  await page.getByRole('button', { name: /start metronome/i }).dispatchEvent('click');
  await expect(page.getByRole('button', { name: /stop metronome/i })).toBeVisible();

  // Enable listen-back (opens the mic and the listen-back panel)
  await page.getByRole('button', { name: /listen back/i }).click();
  await expect(page.getByText(/listen back · on/i)).toBeVisible();

  // The panel shows live stats; with a 120 BPM click track on the fake mic,
  // hits should register within a few seconds: the "hits" stat moves off "—".
  await expect
    .poll(
      async () => {
        const statValues = await page
          .locator('span:has-text("hits")')
          .locator('..')
          .allInnerTexts();
        return statValues.join(' ');
      },
      { timeout: 25000, message: 'listen-back hits registered' }
    )
    .toMatch(/\d+%/);

  expect(errors).toEqual([]);
});
