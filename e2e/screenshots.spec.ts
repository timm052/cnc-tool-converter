/**
 * One-off screenshot capture for wiki documentation.
 * Run: npx playwright test e2e/screenshots.spec.ts --project=web-chrome
 */
import { test } from '@playwright/test';
import path from 'path';

const OUT = path.resolve('wiki/screenshots');
const EXAMPLE_HSMLIB = path.resolve('Example Files/Tool Libs/InventorCAM/100 1F Wood.hsmlib');

// Suppress the "What's New" modal
const SUPPRESS = () => {
  localStorage.setItem('cnc-tool-converter:lastSeenVersion', '1.1.0');
};

test.use({ viewport: { width: 1400, height: 900 } });
test.setTimeout(60_000);

async function goToLibrary(page: any) {
  await page.getByRole('button', { name: /Tool Manager/i }).first().click();
  await page.getByRole('button', { name: /New Tool/i }).waitFor({ state: 'visible' });
}

/** Import a sample hsmlib file so the toolbar shows Maintain and Print */
async function seedLibrary(page: any) {
  await page.getByRole('button', { name: /^Import$/i }).click();
  await page.locator('text=Drop files').first().waitFor({ state: 'visible' });
  // Target the hidden file input by aria-label
  const fileInput = page.locator('[aria-label="Select files"]').last();
  await fileInput.setInputFiles(EXAMPLE_HSMLIB);
  // Wait for tools to appear and click the import button
  const importBtn = page.getByRole('button', { name: /^Add \d+/i });
  await importBtn.waitFor({ state: 'visible', timeout: 10000 });
  await importBtn.click();
  // Wait for "Import complete" then close the panel
  await page.locator('text=Import complete').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: /^Close$/i }).last().click();
  await page.locator('.fixed.right-0.top-0.h-full').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  await page.getByRole('button', { name: /Maintain/i }).waitFor({ state: 'visible', timeout: 5000 });
}

test('converter page', async ({ page }) => {
  await page.addInitScript(SUPPRESS);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByText(/Source Format/i).first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/converter-page.png` });

  // Pick a source and target format
  const selects = page.locator('select');
  await selects.nth(0).selectOption({ index: 2 }).catch(() => {});
  await selects.nth(1).selectOption({ index: 3 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/converter-format-selected.png` });
});

test('tool library page + dropdowns', async ({ page }) => {
  await page.addInitScript(SUPPRESS);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await goToLibrary(page);
  await seedLibrary(page);
  await page.screenshot({ path: `${OUT}/tool-library-page.png` });

  // Libraries dropdown
  await page.getByRole('button', { name: /Libraries/i }).click();
  await page.locator('text=Materials').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/libraries-dropdown.png` });
  // Close by clicking the button again
  await page.getByRole('button', { name: /Libraries/i }).click();
  await page.locator('text=Materials').first().waitFor({ state: 'hidden' });

  // Maintain dropdown
  await page.getByRole('button', { name: /Maintain/i }).click();
  await page.locator('text=Renumber').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/maintain-dropdown.png` });
  await page.getByRole('button', { name: /Maintain/i }).click();
  await page.locator('text=Renumber').first().waitFor({ state: 'hidden' });

  // Print dropdown
  await page.getByRole('button', { name: /Print/i }).click();
  await page.locator('text=Tool Sheet').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/print-dropdown.png` });
  await page.getByRole('button', { name: /Print/i }).click();
});

test('import panel', async ({ page }) => {
  await page.addInitScript(SUPPRESS);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await goToLibrary(page);
  await page.getByRole('button', { name: /^Import$/i }).click();
  await page.locator('text=Drop').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/import-panel.png` });
});

test('tool editor tabs', async ({ page }) => {
  await page.addInitScript(SUPPRESS);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await goToLibrary(page);
  await page.getByRole('button', { name: /New Tool/i }).click();
  await page.locator('text=Tool Number').first().waitFor({ state: 'visible' });

  await page.screenshot({ path: `${OUT}/tool-editor-library-tab.png` });

  await page.getByRole('button', { name: /^Geometry$/i }).click();
  await page.locator('text=Diameter').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/tool-editor-geometry.png` });

  await page.getByRole('button', { name: /^Cutting$/i }).click();
  await page.locator('text=RPM').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/tool-editor-cutting.png` });

  await page.getByRole('button', { name: /^Crib$/i }).click();
  await page.locator('text=Use').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/tool-editor-crib.png` });
});

test('settings page', async ({ page }) => {
  await page.addInitScript(SUPPRESS);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: /Settings/i }).first().click();
  await page.locator('text=Theme').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/settings-page.png` });

  // Scroll to bottom to show Remote Database section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/settings-remote-db.png` });
});
