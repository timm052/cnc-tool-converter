/**
 * E2E — Converter page
 *
 * Tests the core format conversion workflow using file upload.
 * The ConverterPage uses a FileDropZone (no textarea) and outputs to a <pre>.
 */
import { test, expect } from '@playwright/test';

// Minimal LinuxCNC tool table fixture
const LINUXCNC_TABLE = `T1 P1 D10.000 Z0.000 ;Flat End Mill 10mm
T2 P2 D6.000  Z0.000 ;Drill 6mm`;

// Minimal Mach3 CSV fixture
const MACH3_CSV = `TOOL,FPT,SFM,Z OFFSET,X OFFSET,DIAMETER,FLUTES,COMMENT
1,0.004,600,0,0,0.500,4,Half inch endmill
2,0.002,300,0,0,0.250,2,Quarter inch drill`;

async function suppressChangelog(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cnc-tool-converter:lastSeenVersion', '0.2.0');
  });
}

/** Upload text content as a named file via the hidden file input. */
async function uploadFile(
  page: import('@playwright/test').Page,
  content: string,
  filename: string,
) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from(content, 'utf-8'),
  });
}

test.describe('Converter page — format selection', () => {
  test.beforeEach(async ({ page }) => {
    await suppressChangelog(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('source and target format selects are present', async ({ page }) => {
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible();
    expect(await selects.count()).toBeGreaterThanOrEqual(2);
  });

  test('LinuxCNC appears in source format list', async ({ page }) => {
    const sourceSelect = page.locator('select').first();
    const options = await sourceSelect.locator('option').allTextContents();
    expect(options.some((o) => /linuxcnc/i.test(o))).toBe(true);
  });

  test('can change source format', async ({ page }) => {
    const sourceSelect = page.locator('select').first();
    await sourceSelect.selectOption({ label: 'LinuxCNC' });
    await expect(sourceSelect).toHaveValue(/.+/);
  });

  test('can change target format', async ({ page }) => {
    const selects = page.locator('select');
    const targetSelect = selects.nth(1);
    await targetSelect.selectOption({ label: 'HAAS' });
  });
});

test.describe('Converter page — file upload and convert', () => {
  test.beforeEach(async ({ page }) => {
    await suppressChangelog(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Select LinuxCNC as source (autoConvertOnLoad defaults to true)
    const sourceSelect = page.locator('select').first();
    await sourceSelect.selectOption({ label: 'LinuxCNC' });
  });

  test('file input is present', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    // File input exists (hidden but in DOM)
    await expect(fileInput).toBeAttached();
  });

  test('uploading a LinuxCNC file shows parsed tools', async ({ page }) => {
    await uploadFile(page, LINUXCNC_TABLE, 'tools.tbl');
    // After parsing, the "Parsed Tools" heading should appear
    await expect(page.getByText('Parsed Tools')).toBeVisible({ timeout: 5000 });
  });

  test('auto-converts to output after upload', async ({ page }) => {
    await uploadFile(page, LINUXCNC_TABLE, 'tools.tbl');
    // The converted output pre block should appear (autoConvertOnLoad=true)
    const outputPre = page.locator('pre').first();
    await expect(outputPre).toBeVisible({ timeout: 5000 });
    const content = await outputPre.textContent();
    expect((content ?? '').length).toBeGreaterThan(10);
  });

  test('convert to Mach3 CSV produces output', async ({ page }) => {
    await page.locator('select').nth(1).selectOption({ label: 'Mach3 / Mach4' });
    await uploadFile(page, LINUXCNC_TABLE, 'tools.tbl');
    const outputPre = page.locator('pre').first();
    await expect(outputPre).toBeVisible({ timeout: 5000 });
    const content = await outputPre.textContent();
    expect((content ?? '').length).toBeGreaterThan(10);
  });

  test('convert to HAAS produces output with tool numbers', async ({ page }) => {
    await page.locator('select').nth(1).selectOption({ label: 'HAAS' });
    await uploadFile(page, LINUXCNC_TABLE, 'tools.tbl');
    const outputPre = page.locator('pre').first();
    await expect(outputPre).toBeVisible({ timeout: 5000 });
    const content = await outputPre.textContent() ?? '';
    // HAAS output should contain the tool descriptions from the input
    expect(content).toMatch(/Flat End Mill|Drill/);
  });
});

test.describe('Converter page — copy output', () => {
  test.beforeEach(async ({ page }) => {
    await suppressChangelog(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('select').first().selectOption({ label: 'LinuxCNC' });
    await uploadFile(page, LINUXCNC_TABLE, 'tools.tbl');
    // Wait for conversion to complete
    await expect(page.locator('pre').first()).toBeVisible({ timeout: 5000 });
  });

  test('copy button is visible after conversion', async ({ page }) => {
    const copyBtn = page.getByRole('button', { name: /copy/i });
    await expect(copyBtn.first()).toBeVisible();
  });
});

test.describe('Converter page — Mach3 source', () => {
  test('parses Mach3 CSV and shows output', async ({ page }) => {
    await suppressChangelog(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('select').first().selectOption({ label: 'Mach3 / Mach4' });
    await uploadFile(page, MACH3_CSV, 'tools.csv');
    await expect(page.getByText('Parsed Tools')).toBeVisible({ timeout: 5000 });
    // Output should also appear (auto-convert)
    const outputPre = page.locator('pre').first();
    await expect(outputPre).toBeVisible({ timeout: 5000 });
  });
});
