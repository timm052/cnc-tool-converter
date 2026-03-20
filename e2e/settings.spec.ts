/**
 * E2E — Settings page
 *
 * Tests settings persistence across page navigations.
 *
 * Notes:
 * - Theme selector uses card <button> elements, not a <select>
 * - Settings page has tabs: General, Profiles, Library, Conversion, Display, Sync, Developer
 * - "Default units" is on the Conversion tab
 * - Operator name is on the General tab (default)
 */
import { test, expect } from '@playwright/test';

async function goToSettings({ page }: { page: import('@playwright/test').Page }) {
  await page.addInitScript(() => {
    localStorage.setItem('cnc-tool-converter:lastSeenVersion', '0.2.0');
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Settings/i }).first().click();
  await page.waitForLoadState('networkidle');
}

test.describe('Settings page — structure', () => {
  test.beforeEach(goToSettings);

  test('Settings page renders without error', async ({ page }) => {
    // Should not show an error boundary
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    // Should have some settings controls
    const inputs = page.locator('input, select');
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test('theme buttons are present (General tab)', async ({ page }) => {
    // Theme selection uses card buttons, not a <select>
    await expect(page.getByRole('button', { name: /Dark/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Light/i }).first()).toBeVisible();
  });
});

test.describe('Settings page — persistence', () => {
  test('operator name persists after page navigation', async ({ page }) => {
    await goToSettings({ page });

    // Operator name field is on the General tab with placeholder "e.g. John"
    const operatorInput = page.getByPlaceholder('e.g. John').first();
    await expect(operatorInput).toBeVisible({ timeout: 3000 });

    const testName = `Test Op ${Date.now()}`;
    await operatorInput.fill(testName);
    await operatorInput.blur();
    await page.waitForTimeout(300);

    // Navigate away and back
    await page.getByRole('button', { name: /Converter/i }).first().click();
    await page.getByRole('button', { name: /Settings/i }).first().click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByPlaceholder('e.g. John').first()).toHaveValue(testName);
  });

  test('theme change is reflected on the page', async ({ page }) => {
    await goToSettings({ page });

    // Click the Light theme card button (on General tab by default)
    await page.getByRole('button', { name: /^Light/i }).first().click();
    await page.waitForTimeout(300);

    // The root div should have data-theme="light"
    const root = page.locator('[data-theme]').first();
    await expect(root).toHaveAttribute('data-theme', 'light');

    // Reset to dark so other tests aren't affected
    await page.getByRole('button', { name: /^Dark/i }).first().click();
  });
});

test.describe('Settings page — display unit', () => {
  test('display unit selector is present on Conversion tab', async ({ page }) => {
    await goToSettings({ page });
    // Click the Conversion tab
    await page.getByRole('button', { name: /Conversion/i }).click();
    await page.waitForTimeout(200);
    // The "Default units" Sel renders a <select> with aria-label="Default units"
    const unitSelect = page.getByLabel('Default units');
    await expect(unitSelect).toBeVisible({ timeout: 3000 });
  });
});
