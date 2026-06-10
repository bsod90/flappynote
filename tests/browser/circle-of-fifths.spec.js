import { test, expect } from '@playwright/test';

// Circle of Fifths flows: key selection persists, diatonic chord row updates,
// chords are playable buttons, settings drawer works on mobile.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
});

test.describe('Circle of Fifths — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('default key C major shows its diatonic chords', async ({ page }) => {
    await page.goto('/circle-of-fifths');

    // Diatonic chord row for C major: C Dm Em F G Am B°
    for (const chord of ['Play C', 'Play Dm', 'Play Em', 'Play F', 'Play G', 'Play Am']) {
      await expect(page.getByRole('button', { name: chord, exact: true })).toBeVisible();
    }
  });

  test('clicking a chord button does not crash (synth plays)', async ({ page }) => {
    await page.goto('/circle-of-fifths');

    const errors = [];
    page.on('pageerror', (e) => errors.push(e));

    await page.getByRole('button', { name: 'Play C', exact: true }).click();
    await page.getByRole('button', { name: 'Play G', exact: true }).click();
    await page.waitForTimeout(300);

    expect(errors).toEqual([]);
  });

  test('selecting G major updates the chord row and persists', async ({ page }) => {
    await page.goto('/circle-of-fifths');

    // Each key segment is a <path> with an onPointerDown handler; its label
    // <text> has pointer-events: none. Dispatch pointerdown on the major-ring
    // path that immediately precedes the "G" label.
    await page
      .locator('//*[name()="svg"]//*[name()="text"][.="G"]/preceding-sibling::*[name()="path"][1]')
      .first()
      .dispatchEvent('pointerdown');

    await expect(page.getByRole('button', { name: 'Play D', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play Bm', exact: true })).toBeVisible();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vocal-trainer-settings') || '{}')
    );
    expect(stored.circleSelectedPos).toBe(1);
  });
});

test.describe('Circle of Fifths — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('settings open in a drawer', async ({ page }) => {
    await page.goto('/circle-of-fifths');

    await page.getByRole('button', { name: /settings/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
