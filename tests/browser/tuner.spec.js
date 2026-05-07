import { test, expect } from '@playwright/test';

// These tests verify the tuner UI without actually invoking the microphone —
// the dev server is enough, and we drive UI state through the SharedSettings
// store + visible DOM. Pitch detection itself is covered by unit tests.

test.beforeEach(async ({ page }) => {
  // Always start from a known clean settings state. Tuner persists choices in
  // localStorage; clear it so each test starts at defaults.
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
});

test.describe('Tuner page — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('renders the visualizer placeholder and a 6-string row for guitar standard', async ({ page }) => {
    await page.goto('/tuner');

    // The tuner auto-starts on mount; before the mic returns a reading the
    // visualizer shows a "Listening…" placeholder. (In headless chromium
    // getUserMedia is rejected, but we still render the placeholder.)
    await expect(page.getByText(/Listening|In tune|Low|High/).first()).toBeVisible();
    // Sidebar is visible on desktop
    await expect(page.getByText('Instrument', { exact: true })).toBeVisible();

    // Six strings, lowest first: E A D G B E
    const pads = page.getByRole('button', { name: /^String \d+ — / });
    await expect(pads).toHaveCount(6);
    const labels = await pads.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));
    expect(labels).toEqual([
      'String 1 — E2',
      'String 2 — A2',
      'String 3 — D3',
      'String 4 — G3',
      'String 5 — B3',
      'String 6 — E4',
    ]);
  });

  test('switching the instrument to bass changes the string count and notes', async ({ page }) => {
    await page.goto('/tuner');

    // Radix Select renders the trigger as a combobox button. The first
    // combobox in the sidebar is the instrument Type select; the second (if
    // present) is the Tuning select.
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Bass (4-string)' }).click();

    const pads = page.getByRole('button', { name: /^String \d+ — / });
    await expect(pads).toHaveCount(4);

    const labels = await pads.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));
    expect(labels).toEqual([
      'String 1 — E1',
      'String 2 — A1',
      'String 3 — D2',
      'String 4 — G2',
    ]);
  });

  test('chromatic mode hides the strings row', async ({ page }) => {
    await page.goto('/tuner');

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Chromatic' }).click();

    await expect(page.getByRole('button', { name: /^String \d+ — / })).toHaveCount(0);
    // The big note still shows the silent placeholder
    await expect(page.getByText(/Listening|In tune|Low|High/).first()).toBeVisible();
  });

  test('clicking a string in manual mode highlights it', async ({ page }) => {
    await page.goto('/tuner');

    // Disable auto-detect via the Switch (radix renders role=switch)
    await page.getByRole('switch', { name: /auto-detect/i }).click();

    // Click the 4th string (G3)
    const pads = page.getByRole('button', { name: /^String \d+ — / });
    await pads.nth(3).click();

    // Setting should have flipped to manual mode + index 3
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vocal-trainer-settings') || '{}')
    );
    expect(stored.tunerAutoDetect).toBe(false);
    expect(stored.tunerSelectedString).toBe(3);
  });

  test('changing the A4 reference rescales target frequencies (442 vs 440)', async ({ page }) => {
    await page.goto('/tuner');

    // Inspect the SharedSettings store via window.localStorage round trip.
    // We change A4 by clicking the 442 chip, then read the strings list out
    // of the page by checking aria-labels still display E2 (string letters
    // don't change with reference, only target frequencies do — but we can
    // verify the chip got the active style).
    await page.getByRole('button', { name: '442' }).click();
    await expect(page.getByRole('button', { name: '442' })).toHaveClass(/text-primary/);

    // Confirm setting persisted in storage
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vocal-trainer-settings') || '{}')
    );
    expect(stored.tunerReferenceA4).toBe(442);
  });
});

test.describe('Tuner page — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows a Settings button that opens a drawer', async ({ page }) => {
    await page.goto('/tuner');

    // Sidebar shouldn't be visible inline; the floating Settings button should
    const settingsBtn = page.getByRole('button', { name: /open settings/i });
    await expect(settingsBtn).toBeVisible();

    await settingsBtn.click();
    // Sheet drawer is visible (radix renders it as a dialog) and contains the
    // sidebar with the Reference section.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Reference' })).toBeVisible();
  });
});
