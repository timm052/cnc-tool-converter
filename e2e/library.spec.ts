/**
 * E2E — Tool Library page (Tool Manager)
 *
 * Tests the persistent tool library: CRUD, search, filtering.
 * Each test clears IndexedDB first so tests are isolated.
 *
 * Notes on ToolEditor selectors:
 * - Description field (TextF) has no aria-label; use locator('input[type="text"]').first()
 * - Diameter field is on the Geometry tab (not the default Library tab)
 *   — tests that only need description skip the diameter entirely (defaults to 6mm)
 */
import { test, expect } from '@playwright/test';

async function goToLibrary({ page }: { page: import('@playwright/test').Page }) {
  await page.addInitScript(() => {
    localStorage.setItem('cnc-tool-converter:lastSeenVersion', '0.2.0');
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Tool Manager/i }).first().click();
  await page.waitForLoadState('networkidle');
}

async function clearAndReload(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const req = indexedDB.deleteDatabase('cnc-tool-library');
    await new Promise<void>((res) => {
      req.onsuccess = () => res();
      req.onerror   = () => res();
      req.onblocked = () => res();
    });
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  // Navigate back to library after reload
  await page.getByRole('button', { name: /Tool Manager/i }).first().click();
  await page.waitForLoadState('networkidle');
}

/**
 * Return a locator for the Description field in the ToolEditor slide-over.
 * The TextF component has no aria-label; navigate via XPath from its label sibling.
 * Structure: outer-div > [inner-div > label "Description *"], [input type="text"]
 */
function descriptionInput(page: import('@playwright/test').Page) {
  return page.locator('xpath=//label[contains(text(),"Description")]/../following-sibling::input');
}

/** Fill description and save a new tool (description is the only required field). */
async function createTool(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: /New Tool/i }).click();
  await descriptionInput(page).fill(name);
  await page.getByRole('button', { name: /Add to Library/i }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
}

test.describe('Tool Library — empty state', () => {
  test.beforeEach(goToLibrary);

  test('"New Tool" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /New Tool/i })).toBeVisible();
  });
});

test.describe('Tool Library — create a tool', () => {
  test.beforeEach(async ({ page }) => {
    await goToLibrary({ page });
    await clearAndReload(page);
  });

  test('opens the tool editor when "New Tool" is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /New Tool/i }).click();
    // Slide-over panel should appear with a save button
    await expect(page.getByRole('button', { name: /Add to Library/i }).first()).toBeVisible();
  });

  test('can create a new tool and it appears in the list', async ({ page }) => {
    await createTool(page, 'Test End Mill 10mm');
  });

  test('save button is disabled when description is empty', async ({ page }) => {
    await page.getByRole('button', { name: /New Tool/i }).click();
    // Description is empty by default; the save button should be disabled
    const saveBtn = page.getByRole('button', { name: /Add to Library/i });
    await expect(saveBtn).toBeDisabled();
  });
});

test.describe('Tool Library — edit and delete', () => {
  test.beforeEach(async ({ page }) => {
    await goToLibrary({ page });
    await clearAndReload(page);
    await createTool(page, 'Mill to Edit');
  });

  test('can open the editor via the pencil button', async ({ page }) => {
    // Rows open the full editor via the pencil (title="Open full editor") button
    await page.getByRole('button', { name: 'Open full editor' }).first().click();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 3000 });
  });

  test('can edit tool description and save', async ({ page }) => {
    await page.getByRole('button', { name: 'Open full editor' }).first().click();
    await page.waitForTimeout(300);
    await descriptionInput(page).fill('Mill Edited');
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.getByText('Mill Edited')).toBeVisible({ timeout: 5000 });
  });

  test('can delete a tool', async ({ page }) => {
    await page.getByRole('button', { name: 'Open full editor' }).first().click();
    await page.waitForTimeout(300);
    // Delete button has title="Delete this tool" (icon only, no text)
    await page.getByTitle('Delete this tool').click();
    // Confirm dialog shows "Yes, delete" button
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await expect(page.getByText('Mill to Edit')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Tool Library — search', () => {
  test.beforeEach(async ({ page }) => {
    await goToLibrary({ page });
    await clearAndReload(page);
    // Add two tools with different names
    for (const name of ['Roughing Mill', 'Center Drill']) {
      await createTool(page, name);
    }
  });

  test('search filters the tool list', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i);
    await search.fill('Roughing');
    await page.waitForTimeout(300);
    await expect(page.getByText('Roughing Mill')).toBeVisible();
    await expect(page.getByText('Center Drill')).not.toBeVisible();
  });

  test('clearing search restores all tools', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i);
    await search.fill('Roughing');
    await search.fill('');
    await page.waitForTimeout(300);
    await expect(page.getByText('Roughing Mill')).toBeVisible();
    await expect(page.getByText('Center Drill')).toBeVisible();
  });
});

test.describe('Tool Library — keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await goToLibrary({ page });
    await clearAndReload(page);
    // Add a tool so the search bar is visible (it only renders when tools exist)
    await createTool(page, 'Shortcut Test Mill');
  });

  test('"/" key focuses search', async ({ page }) => {
    await page.locator('main').click();
    await page.keyboard.press('/');
    const search = page.getByPlaceholder(/search/i);
    await expect(search).toBeFocused();
  });

  test('"?" key shows keyboard shortcut help', async ({ page }) => {
    await page.locator('main').click();
    await page.keyboard.press('?');
    await expect(page.getByText(/keyboard shortcuts|shortcuts/i).first()).toBeVisible({ timeout: 3000 });
  });
});
