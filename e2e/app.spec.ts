/**
 * E2E — App shell: loads, navigation, theme
 */
import { test, expect } from '@playwright/test';

// Suppress the "What's New" changelog modal that appears on first load.
// The modal shows when stored version !== app version (currently "0.2.0").
const SUPPRESS_CHANGELOG = () => {
  localStorage.setItem('cnc-tool-converter:lastSeenVersion', '0.2.0');
};

test.describe('App shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(SUPPRESS_CHANGELOG);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page title contains "CNC Tool Converter"', async ({ page }) => {
    await expect(page).toHaveTitle(/CNC Tool Converter/i);
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Converter/i }).first()).toBeVisible();
  });

  test('loads on the Converter page by default', async ({ page }) => {
    await expect(page.getByText(/Source Format/i).first()).toBeVisible();
  });

  test('navigates to Tool Manager', async ({ page }) => {
    await page.getByRole('button', { name: /Tool Manager/i }).first().click();
    await expect(page.getByRole('button', { name: /New Tool/i })).toBeVisible();
  });

  test('navigates to Settings', async ({ page }) => {
    await page.getByRole('button', { name: /Settings/i }).first().click();
    await expect(page.getByText(/Theme|Operator|Settings/i).first()).toBeVisible();
  });

  test('navigates back to Converter from another page', async ({ page }) => {
    await page.getByRole('button', { name: /Settings/i }).first().click();
    await page.getByRole('button', { name: /Converter/i }).first().click();
    await expect(page.getByText(/Source Format/i).first()).toBeVisible();
  });

  test('sidebar nav is rendered with expected items', async ({ page }) => {
    const sidebar = page.locator('aside, nav').first();
    await expect(sidebar.getByRole('button', { name: /Tool Manager/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Settings/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Machines/i })).toBeVisible();
  });
});
