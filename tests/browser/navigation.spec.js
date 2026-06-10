import { test, expect } from '@playwright/test';

// Smoke tests for the app shell: index page, navigation into each tool,
// back button, and the 404 route.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
});

test('index lists all four tools', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Music practice tools' })).toBeVisible();
  for (const name of ['Vocal Monitor', 'Metronome', 'Circle of Fifths', 'Tuner']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
});

test('navigating to each tool renders it and back returns to the index', async ({ page }) => {
  const toolChecks = [
    { name: 'Vocal Monitor', path: '/vocal-monitor', probe: () => page.getByRole('button', { name: 'Start' }) },
    { name: 'Metronome', path: '/metronome', probe: () => page.getByRole('button', { name: /start metronome/i }) },
    { name: 'Circle of Fifths', path: '/circle-of-fifths', probe: () => page.locator('svg').first() },
    { name: 'Tuner', path: '/tuner', probe: () => page.getByText(/Listening|In tune|Low|High/).first() },
  ];

  for (const tool of toolChecks) {
    await page.goto('/');
    await page.getByText(tool.name, { exact: true }).click();
    await expect(page).toHaveURL(tool.path);
    await expect(tool.probe()).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: /back to tools/i }).click();
    await expect(page).toHaveURL('/');
  }
});

test('unknown route shows the not-found page', async ({ page }) => {
  await page.goto('/this-tool-does-not-exist');
  await expect(page.getByText(/not found|404/i).first()).toBeVisible();
});
