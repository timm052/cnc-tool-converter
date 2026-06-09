import { test, expect } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function goToMachines({ page }: { page: import('@playwright/test').Page }) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('cnc-tool-converter:lastSeenVersion', '99.99.99');
    } catch { /* ignore */ }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Machines/i }).first().click();
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
  await page.getByRole('button', { name: /Machines/i }).first().click();
  await page.waitForLoadState('networkidle');
}

async function createMachine(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: 'New Machine', exact: true }).click();
  await page.getByPlaceholder(/VF-2/i).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 5_000 });
}

// ── Empty state ────────────────────────────────────────────────────────────────

test.describe('Machines page — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await goToMachines({ page });
    await clearAndReload(page);
  });

  test('shows "No machines yet" heading when library is empty', async ({ page }) => {
    await expect(page.getByText('No machines yet')).toBeVisible();
  });

  test('"Add your first machine" button is visible in the empty state', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Add your first machine/i }),
    ).toBeVisible();
  });

  test('"New Machine" button in the top bar is always visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'New Machine', exact: true }),
    ).toBeVisible();
  });
});

// ── Create ─────────────────────────────────────────────────────────────────────

test.describe('Machines page — create', () => {
  test.beforeEach(async ({ page }) => {
    await goToMachines({ page });
    await clearAndReload(page);
  });

  test('clicking "New Machine" opens the editor slide-over', async ({ page }) => {
    await page.getByRole('button', { name: 'New Machine', exact: true }).click();
    await expect(page.getByText('New Machine').nth(1)).toBeVisible();
  });

  test('clicking "Add your first machine" also opens the editor', async ({ page }) => {
    await page.getByRole('button', { name: /Add your first machine/i }).click();
    await expect(page.getByPlaceholder(/VF-2/i)).toBeVisible();
  });

  test('Save button is disabled when the name field is empty', async ({ page }) => {
    await page.getByRole('button', { name: 'New Machine', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  });

  test('can create a machine and it appears in the list', async ({ page }) => {
    await createMachine(page, 'Haas VF-2');
    await expect(page.getByText('Haas VF-2')).toBeVisible();
  });

  test('empty state disappears after the first machine is created', async ({ page }) => {
    await createMachine(page, 'Lathe 1');
    await expect(page.getByText('No machines yet')).not.toBeVisible();
  });

  test('cancelling the editor does not create a machine', async ({ page }) => {
    await page.getByRole('button', { name: 'New Machine', exact: true }).click();
    await page.getByPlaceholder(/VF-2/i).fill('Should Not Exist');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText('No machines yet')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Should Not Exist')).not.toBeVisible();
  });
});

// ── Edit ───────────────────────────────────────────────────────────────────────

test.describe('Machines page — edit', () => {
  test.beforeEach(async ({ page }) => {
    await goToMachines({ page });
    await clearAndReload(page);
    await createMachine(page, 'Mill to Edit');
  });

  test('clicking a machine row opens the editor for that machine', async ({ page }) => {
    await page.getByText('Mill to Edit').first().click();
    await expect(page.getByPlaceholder(/VF-2/i)).toBeVisible();
  });

  test('can rename a machine and the change persists in the list', async ({ page }) => {
    await page.getByText('Mill to Edit').first().click();
    const nameInput = page.getByPlaceholder(/VF-2/i);
    await nameInput.fill('Mill Renamed');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Mill Renamed')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Mill to Edit')).not.toBeVisible();
  });

  test('Cancel closes the editor without saving changes', async ({ page }) => {
    await page.getByText('Mill to Edit').first().click();
    await page.getByPlaceholder(/VF-2/i).fill('Unsaved Name');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText('Mill to Edit')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Unsaved Name')).not.toBeVisible();
  });
});

// ── Delete ─────────────────────────────────────────────────────────────────────

test.describe('Machines page — delete', () => {
  test.beforeEach(async ({ page }) => {
    await goToMachines({ page });
    await clearAndReload(page);
    await createMachine(page, 'Mill to Delete');
  });

  test('the first Delete click shows a confirmation prompt', async ({ page }) => {
    await page.getByText('Mill to Delete').first().click();
    await page.getByTitle('Delete machine').click();
    await expect(page.getByRole('button', { name: 'Yes, delete' })).toBeVisible();
  });

  test('confirming delete removes the machine from the list', async ({ page }) => {
    await page.getByText('Mill to Delete').first().click();
    await page.getByTitle('Delete machine').click();
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await expect(page.getByText('Mill to Delete')).not.toBeVisible({ timeout: 5_000 });
  });

  test('deleting the last machine restores the empty state', async ({ page }) => {
    await page.getByText('Mill to Delete').first().click();
    await page.getByTitle('Delete machine').click();
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await expect(page.getByText('No machines yet')).toBeVisible({ timeout: 5_000 });
  });
});

// ── Multiple machines ──────────────────────────────────────────────────────────

test.describe('Machines page — multiple machines', () => {
  test.beforeEach(async ({ page }) => {
    await goToMachines({ page });
    await clearAndReload(page);
    for (const name of ['Mill A', 'Lathe B', 'Router C']) {
      await createMachine(page, name);
    }
  });

  test('all created machines appear in the list', async ({ page }) => {
    await expect(page.getByText('Mill A')).toBeVisible();
    await expect(page.getByText('Lathe B')).toBeVisible();
    await expect(page.getByText('Router C')).toBeVisible();
  });

  test('each machine row is clickable and opens the correct editor', async ({ page }) => {
    await page.getByText('Lathe B').first().click();
    const nameInput = page.getByPlaceholder(/VF-2/i);
    await expect(nameInput).toHaveValue('Lathe B');
  });
});
