import { test, expect } from '@playwright/test';

// Vocal monitor UI flows without a microphone: toolbar, canvas mount,
// settings sidebar, exercise selection persistence.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
});

test.describe('Vocal Monitor — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('renders toolbar, canvas and sidebar', async ({ page }) => {
    await page.goto('/vocal-monitor');

    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    // Desktop sidebar collapse control present
    await expect(page.getByRole('button', { name: 'Collapse settings' })).toBeVisible();
  });

  test('mic permission failure shows an error banner', async ({ page }) => {
    await page.goto('/vocal-monitor');

    // Headless chromium without fake-mic flags rejects getUserMedia
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(
      page.getByText(/microphone permission denied|could not start the microphone/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('sidebar collapse/expand persists', async ({ page }) => {
    await page.goto('/vocal-monitor');

    await page.getByRole('button', { name: 'Collapse settings' }).click();
    await expect(page.getByRole('button', { name: 'Expand settings' })).toBeVisible();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vocal-trainer-settings') || '{}')
    );
    expect(stored.settingsCollapsed).toBe(true);

    await page.getByRole('button', { name: 'Expand settings' }).click();
    await expect(page.getByRole('button', { name: 'Collapse settings' })).toBeVisible();
  });
});

test.describe('Vocal Monitor — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('settings open in a drawer', async ({ page }) => {
    await page.goto('/vocal-monitor');

    await page.getByRole('button', { name: /settings/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
  });
});
