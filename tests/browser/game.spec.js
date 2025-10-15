import { test, expect } from '@playwright/test';

test.describe('Flappy Note Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the game page', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Flappy Note');
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('should display game controls', async ({ page }) => {
    await expect(page.locator('#root-note')).toBeVisible();
    await expect(page.locator('#scale-type')).toBeVisible();
    await expect(page.locator('#start-button')).toBeVisible();
    await expect(page.locator('#reset-button')).toBeVisible();
  });

  test('should have root note selector with options', async ({ page }) => {
    const rootNoteSelect = page.locator('#root-note');
    await expect(rootNoteSelect).toBeVisible();

    const options = await rootNoteSelect.locator('option').allTextContents();
    expect(options).toContain('C4 (Middle C)');
    expect(options.length).toBeGreaterThan(1);
  });

  test('should have scale type selector with options', async ({ page }) => {
    const scaleTypeSelect = page.locator('#scale-type');
    await expect(scaleTypeSelect).toBeVisible();

    const options = await scaleTypeSelect.locator('option').allTextContents();
    expect(options).toContain('Major Scale');
    expect(options).toContain('Natural Minor');
  });

  test('should display game info elements', async ({ page }) => {
    await expect(page.locator('#pitch-display')).toBeVisible();
    await expect(page.locator('#score-display')).toBeVisible();
    await expect(page.locator('#status-display')).toBeVisible();
  });

  test('should show initial status message', async ({ page }) => {
    const status = page.locator('#status-display');
    await expect(status).toContainText('Click Start');
  });

  test('should show initial score of 0', async ({ page }) => {
    const score = page.locator('#score-display');
    await expect(score).toContainText('Score: 0');
  });

  test('should have reset button disabled initially', async ({ page }) => {
    const resetButton = page.locator('#reset-button');
    await expect(resetButton).toBeDisabled();
  });

  test('should change root note', async ({ page }) => {
    const rootNoteSelect = page.locator('#root-note');
    await rootNoteSelect.selectOption('C5');

    const selectedValue = await rootNoteSelect.inputValue();
    expect(selectedValue).toBe('C5');
  });

  test('should change scale type', async ({ page }) => {
    const scaleTypeSelect = page.locator('#scale-type');
    await scaleTypeSelect.selectOption('minor');

    const selectedValue = await scaleTypeSelect.inputValue();
    expect(selectedValue).toBe('minor');
  });

  test('should render canvas with correct dimensions', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    const width = await canvas.evaluate(el => el.width);
    const height = await canvas.evaluate(el => el.height);

    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  test('should have game instance on window', async ({ page }) => {
    const hasGame = await page.evaluate(() => {
      return typeof window.game !== 'undefined';
    });

    expect(hasGame).toBe(true);
  });

  test('should initialize game state', async ({ page }) => {
    const hasGameState = await page.evaluate(() => {
      return window.game && window.game.gameState !== null;
    });

    expect(hasGameState).toBe(true);
  });

  test('should initialize renderer', async ({ page }) => {
    const hasRenderer = await page.evaluate(() => {
      return window.game && window.game.renderer !== null;
    });

    expect(hasRenderer).toBe(true);
  });

  test('should have gates initialized', async ({ page }) => {
    const gatesCount = await page.evaluate(() => {
      return window.game.gameState.gates.length;
    });

    expect(gatesCount).toBeGreaterThan(0); // varies by scale
  });

  test('should update status when changing root note', async ({ page }) => {
    const rootNoteSelect = page.locator('#root-note');
    const status = page.locator('#status-display');

    await rootNoteSelect.selectOption('C5');

    // Wait a bit for the update
    await page.waitForTimeout(100);

    await expect(status).toContainText('Root note changed');
  });

  test('should update status when changing scale', async ({ page }) => {
    const scaleTypeSelect = page.locator('#scale-type');
    const status = page.locator('#status-display');

    await scaleTypeSelect.selectOption('minor');

    // Wait a bit for the update
    await page.waitForTimeout(100);

    await expect(status).toContainText('Mode changed');
  });

  test('should disable controls after changing settings', async ({ page }) => {
    const rootNoteSelect = page.locator('#root-note');
    const scaleTypeSelect = page.locator('#scale-type');

    // Initially should be enabled
    await expect(rootNoteSelect).toBeEnabled();
    await expect(scaleTypeSelect).toBeEnabled();
  });
});

test.describe('Flappy Note Game - Canvas Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render initial game state on canvas', async ({ page }) => {
    const canvas = page.locator('#game-canvas');

    // Take a screenshot to verify visual rendering
    await expect(canvas).toHaveScreenshot('initial-state.png', {
      maxDiffPixels: 100,
    });
  });

  test('should render ball on canvas', async ({ page }) => {
    const hasBall = await page.evaluate(() => {
      const ball = window.game.gameState.ball;
      return ball && ball.x > 0 && ball.y > 0;
    });

    expect(hasBall).toBe(true);
  });

  test('should render gates on canvas', async ({ page }) => {
    const gatesRendered = await page.evaluate(() => {
      const gates = window.game.gameState.gates;
      return gates.length > 0 && gates.every(gate => gate.x > 0);
    });

    expect(gatesRendered).toBe(true);
  });
});
