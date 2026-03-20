/**
 * Shared E2E test helpers
 */
import type { Page } from '@playwright/test';

/** Suppress the changelog modal by pre-seeding the lastSeenVersion key. */
export async function suppressChangelog(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('cnc-tool-converter:lastSeenVersion', '99.99.99');
    } catch { /* ignore */ }
  });
}

/** Close any open modal/overlay by pressing Escape. */
export async function closeModal(page: Page) {
  const overlay = page.locator('.fixed.inset-0').first();
  if (await overlay.isVisible()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
}

/** Navigate to a named page by clicking the sidebar link. */
export async function goTo(page: Page, name: 'Converter' | 'Tool Manager' | 'Machines' | 'Settings') {
  await page.getByRole('button', { name, exact: false }).first().click();
  // Wait for the main content to settle
  await page.waitForLoadState('networkidle');
}

/** Clear all tools from the library via IndexedDB (web) or SQLite (Tauri).
 *  Works by opening the Settings → Dev Reset if available, otherwise via
 *  browser script on the IndexedDB. */
export async function clearLibrary(page: Page) {
  await page.evaluate(async () => {
    const req = indexedDB.deleteDatabase('cnc-tool-library');
    await new Promise<void>((res, rej) => {
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
      req.onblocked = () => res(); // proceed anyway
    });
  });
  // Reload so React contexts re-initialise
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/** Return the text lines from the converter output textarea. */
export async function getConverterOutput(page: Page): Promise<string> {
  const textarea = page.locator('textarea').last();
  return textarea.inputValue();
}
