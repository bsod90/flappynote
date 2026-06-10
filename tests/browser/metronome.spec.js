import { test, expect } from '@playwright/test';

// Metronome flows without a microphone: BPM controls, start/stop,
// listen-back toggle, settings drawer.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
});

test.describe('Metronome — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('BPM steppers change the tempo and persist it', async ({ page }) => {
    await page.goto('/metronome');

    await expect(page.getByRole('button', { name: /start metronome/i })).toBeVisible();

    // Default BPM is shown on the dial; bump it up twice and down once
    await page.getByRole('button', { name: 'Increase BPM' }).click();
    await page.getByRole('button', { name: 'Increase BPM' }).click();
    await page.getByRole('button', { name: 'Decrease BPM' }).click();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vocal-trainer-settings') || '{}')
    );
    expect(typeof stored.metronomeBpm).toBe('number');
  });

  test('editing the BPM number directly', async ({ page }) => {
    await page.goto('/metronome');

    await page.getByRole('button', { name: 'Edit BPM' }).click();
    const input = page.locator('input[type="number"], input[inputmode="numeric"]').first();
    await input.fill('97');
    await input.press('Enter');

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vocal-trainer-settings') || '{}')
    );
    expect(stored.metronomeBpm).toBe(97);
  });

  test('start/stop toggles the running state without page errors', async ({ page }) => {
    await page.goto('/metronome');

    const errors = [];
    page.on('pageerror', (e) => errors.push(e));

    // The dial center is one big toggle button, but its middle is covered by
    // data-no-toggle controls (BPM edit, steppers) — dispatch the click on
    // the overlay itself like a click on the empty dial area.
    await page.getByRole('button', { name: /start metronome/i }).dispatchEvent('click');
    await expect(page.getByRole('button', { name: /stop metronome/i })).toBeVisible();

    // Let it click for a bit (the engine schedules audio in the background)
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: /stop metronome/i }).dispatchEvent('click');
    await expect(page.getByRole('button', { name: /start metronome/i })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('tap tempo button registers taps', async ({ page }) => {
    await page.goto('/metronome');

    const tap = page.getByRole('button', { name: 'Tap tempo' });
    // Tap 4 times at ~500ms (≈120 BPM)
    for (let i = 0; i < 4; i++) {
      await tap.click();
      await page.waitForTimeout(500);
    }

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vocal-trainer-settings') || '{}')
    );
    expect(stored.metronomeBpm).toBeGreaterThan(100);
    expect(stored.metronomeBpm).toBeLessThan(140);
  });
});

test.describe('Metronome — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('settings open in a drawer', async ({ page }) => {
    await page.goto('/metronome');

    await page.getByRole('button', { name: /settings/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
