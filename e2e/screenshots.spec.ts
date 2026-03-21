/**
 * One-off screenshot capture for wiki documentation.
 * Run: npx playwright test e2e/screenshots.spec.ts --project=web-chrome
 */
import { test } from '@playwright/test';
import path from 'path';

const OUT     = path.resolve('wiki/screenshots');
const FIXTURE = path.resolve('e2e/fixtures/sample-library.json');
const HSMLIB  = path.resolve('Example Files/Tool Libs/InventorCAM/100 1F Wood.hsmlib');

// Suppress the "What's New" modal and first-run nudges
const SUPPRESS = () => {
  localStorage.setItem('cnc-tool-converter:lastSeenVersion', '1.1.0');
};

test.use({ viewport: { width: 1400, height: 900 } });
test.setTimeout(60_000);

async function goToLibrary(page: any) {
  await page.getByRole('button', { name: /Tool Manager/i }).first().click();
  await page.getByRole('button', { name: /New Tool/i }).waitFor({ state: 'visible' });
}

/**
 * Restore the sample library fixture into IndexedDB via the hidden
 * restore input — no UI dialog, no confirmation required.
 */
async function seedLibrary(page: any) {
  await page.locator('[aria-label="Restore from JSON backup"]').setInputFiles(FIXTURE);
  await page.getByRole('button', { name: /Maintain/i }).waitFor({ state: 'visible', timeout: 10_000 });
}

// ── Converter page ────────────────────────────────────────────────────────────

test('converter page', async ({ page }) => {
  await page.addInitScript(SUPPRESS);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByText(/Source Format/i).first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/converter-page.png` });

  const selects = page.locator('select');
  await selects.nth(0).selectOption({ index: 2 }).catch(() => {});
  await selects.nth(1).selectOption({ index: 3 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/converter-format-selected.png` });
});

// ── Tool Library page + toolbar dropdowns ─────────────────────────────────────

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

// ── Import panel (with a file loaded so it shows parsed tools) ─────────────────

test('import panel', async ({ page }) => {
  await page.addInitScript(SUPPRESS);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await goToLibrary(page);
  await seedLibrary(page);

  await page.getByRole('button', { name: /^Import$/i }).click();
  await page.locator('text=Drop files').first().waitFor({ state: 'visible' });
  // Load the hsmlib file so the panel shows parsed tools instead of empty drop zone
  await page.locator('[aria-label="Select files"]').last().setInputFiles(HSMLIB);
  await page.getByRole('button', { name: /^Add \d+|^Skip \d+/i }).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/import-panel.png` });
});

// ── Tool editor (open an existing tool, not New Tool) ─────────────────────────

test('tool editor tabs', async ({ page }) => {
  await page.addInitScript(SUPPRESS);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await goToLibrary(page);
  await seedLibrary(page);

  // Click the pencil (Open full editor) button on the first row
  await page.locator('tbody tr').first().getByTitle('Open full editor').click();
  await page.locator('text=Tool number').first().waitFor({ state: 'visible' });

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

// ── Settings page ─────────────────────────────────────────────────────────────

test('settings page', async ({ page }) => {
  await page.addInitScript(SUPPRESS);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: /Settings/i }).first().click();
  await page.locator('text=Theme').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/settings-page.png` });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/settings-remote-db.png` });
});
