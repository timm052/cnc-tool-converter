/**
 * E2E — Tauri-mode simulation  (@tauri)
 *
 * Runs under the web-chrome project (plain browser against the preview server)
 * but injects window.__TAURI_INTERNALS__ via addInitScript so that isTauri()
 * returns true for the entire page lifecycle.
 *
 * Goals:
 *   1. Verify the isTauri() detection logic works as expected.
 *   2. Verify the app renders without uncaught errors in Tauri mode.
 *   3. Verify each page works normally when the Tauri IPC branch is active.
 *   4. Verify Tauri-specific UI paths (backup / restore buttons) do not crash
 *      the page — all IPC calls go through our __TAURI_INTERNALS__.invoke stub,
 *      which returns undefined (simulating a cancelled native dialog).
 *
 * To run only these tests:
 *   npx playwright test --project=web-chrome --grep "@tauri"
 */
import { test, expect, type Page } from '@playwright/test';

// ── Project guard ──────────────────────────────────────────────────────────────

test.beforeEach(({ }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'web-chrome',
    'Tauri-mode simulation tests are scoped to the web-chrome project.',
  );
});

// ── __TAURI_INTERNALS__ stub ───────────────────────────────────────────────────

function injectTauriInternals() {
  // Runs in the browser context — no TypeScript imports available.
  (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {
    metadata: { currentWindow: { label: 'main' } },
    transformCallback: (cb: (arg: unknown) => void, _once?: boolean): number => {
      const id = Math.floor(Math.random() * 1_000_000_000);
      (window as unknown as Record<string, unknown>)[`__tauri_cb_${id}`] = cb;
      return id;
    },
    unregisterCallback: (_id: number): void => { /* no-op */ },
    invoke: async (
      _cmd: string,
      _args?: Record<string, unknown>,
    ): Promise<undefined> => undefined,
    convertFileSrc: (path: string): string => path,
  };
}

// ── Helper: navigate to '/' with Tauri mode active ────────────────────────────

async function gotoWithTauri(page: Page, path = '/'): Promise<void> {
  await page.addInitScript(() => {
    try { localStorage.setItem('cnc-tool-converter:lastSeenVersion', '99.99.99'); } catch { /* ignore */ }
  });
  await page.addInitScript(injectTauriInternals);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

// ── isTauri() detection ────────────────────────────────────────────────────────

test.describe('@tauri isTauri() detection', () => {
  test('window.__TAURI_INTERNALS__ is present after injection', async ({ page }) => {
    await gotoWithTauri(page);
    const present = await page.evaluate(
      () => typeof (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] !== 'undefined',
    );
    expect(present).toBe(true);
  });

  test('__TAURI_INTERNALS__ is truthy', async ({ page }) => {
    await gotoWithTauri(page);
    const truthy = await page.evaluate(
      () => !!(window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'],
    );
    expect(truthy).toBe(true);
  });

  test('stub exposes the expected methods', async ({ page }) => {
    await gotoWithTauri(page);
    const shape = await page.evaluate(() => {
      const t = (window as unknown as Record<string, Record<string, unknown>>)['__TAURI_INTERNALS__'];
      if (!t) return null;
      return {
        hasInvoke:             typeof t['invoke'] === 'function',
        hasTransformCallback:  typeof t['transformCallback'] === 'function',
        hasUnregisterCallback: typeof t['unregisterCallback'] === 'function',
      };
    });
    expect(shape).toEqual({ hasInvoke: true, hasTransformCallback: true, hasUnregisterCallback: true });
  });
});

// ── App renders correctly in Tauri mode ───────────────────────────────────────

test.describe('@tauri app renders correctly in Tauri mode', () => {
  test('page title is correct', async ({ page }) => {
    await gotoWithTauri(page);
    await expect(page).toHaveTitle(/CNC Tool Converter/i);
  });

  test('app loads without uncaught JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoWithTauri(page);
    await page.waitForTimeout(300);
    expect(errors).toHaveLength(0);
  });

  test('sidebar navigation is present', async ({ page }) => {
    await gotoWithTauri(page);
    await expect(page.getByRole('button', { name: /Converter/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Tool Manager/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Machines/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Settings/i }).first()).toBeVisible();
  });

  test('Converter page renders in Tauri mode', async ({ page }) => {
    await gotoWithTauri(page);
    await expect(page.getByText(/Source Format/i).first()).toBeVisible();
  });
});

// ── Page navigation in Tauri mode ─────────────────────────────────────────────

test.describe('@tauri page navigation in Tauri mode', () => {
  test.beforeEach(async ({ page }) => {
    await gotoWithTauri(page);
  });

  test('Settings page renders without a React error boundary', async ({ page }) => {
    await page.getByRole('button', { name: /Settings/i }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    const controls = page.locator('input, select');
    expect(await controls.count()).toBeGreaterThan(0);
  });

  test('Machines page renders without error in Tauri mode', async ({ page }) => {
    await page.getByRole('button', { name: /Machines/i }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'New Machine', exact: true }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Tool Manager page renders without error in Tauri mode', async ({ page }) => {
    await page.getByRole('button', { name: /Tool Manager/i }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /New Tool/i })).toBeVisible();
  });

  test('can navigate between all pages without errors in Tauri mode', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    for (const nav of [/Tool Manager/i, /Machines/i, /Settings/i, /Converter/i]) {
      await page.getByRole('button', { name: nav }).first().click();
      await page.waitForLoadState('networkidle');
    }

    await page.waitForTimeout(200);
    expect(errors).toHaveLength(0);
  });
});

// ── Tauri-specific IPC paths ───────────────────────────────────────────────────

test.describe('@tauri Tauri IPC code paths', () => {
  test.beforeEach(async ({ page }) => {
    await gotoWithTauri(page);
    await page.getByRole('button', { name: /Tool Manager/i }).first().click();
    await page.waitForLoadState('networkidle');
  });

  test('restore button is present in Tool Manager in Tauri mode', async ({ page }) => {
    const restoreBtn = page.getByTitle('Restore tools from a JSON backup');
    await expect(restoreBtn).toBeVisible();
  });

  test('clicking restore in Tauri mode does not crash the page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // In Tauri mode, clicking restore calls openFiles() → plugin-dialog open()
    // → invoke() → undefined. openFiles returns null (no selection), and
    // handleRestoreTauri returns early without error.
    await page.getByTitle('Restore tools from a JSON backup').click();
    await page.waitForTimeout(500);

    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('the stub invoke is called when restore is triggered', async ({ page }) => {
    await page.evaluate(() => {
      const calls: string[] = [];
      (window as unknown as Record<string, unknown>)['__tauriInvokeCalls'] = calls;
      const t = (window as unknown as Record<string, Record<string, unknown>>)['__TAURI_INTERNALS__'];
      if (!t) return;
      const original = t['invoke'] as (...args: unknown[]) => Promise<unknown>;
      t['invoke'] = async (cmd: unknown, ...rest: unknown[]) => {
        calls.push(String(cmd));
        return original(cmd, ...rest);
      };
    });

    await page.getByTitle('Restore tools from a JSON backup').click();
    await page.waitForTimeout(500);

    const calls = await page.evaluate(
      () => (window as unknown as Record<string, string[]>)['__tauriInvokeCalls'] ?? [],
    );
    expect(calls.some((c) => c.includes('dialog') || c.includes('open'))).toBe(true);
  });
});
