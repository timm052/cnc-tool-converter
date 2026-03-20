/**
 * Auto-updater helpers (Tauri only)
 *
 * Checks for an available update and shows a native dialog asking the user
 * whether to install now or later.  The actual update endpoints are
 * configured in src-tauri/tauri.conf.json under `plugins.updater.endpoints`.
 *
 * In a browser / PWA build this module is a no-op.
 */

import { isTauri } from './fs';

export interface UpdateCheckResult {
  available:  boolean;
  version?:   string;
  notes?:     string;
}

/**
 * Silently check for an update and return the result.
 * Does nothing and returns `{ available: false }` when running in a browser.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!isTauri()) return { available: false };
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update?.available) return { available: false };
    return {
      available: true,
      version:   update.version,
      notes:     update.body ?? undefined,
    };
  } catch {
    // Network unavailable, endpoint not configured, etc.
    return { available: false };
  }
}

/**
 * Check for an update and, if one is available, install it.
 * Shows a browser `confirm()` dialog before downloading.
 * Safe to call on startup — errors are swallowed silently.
 */
export async function checkAndInstallUpdate(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update?.available) return;

    const message =
      `CNC Tool Converter ${update.version} is available.\n\n` +
      (update.body ? `What's new:\n${update.body}\n\n` : '') +
      'Install now?';

    if (!window.confirm(message)) return;

    await update.downloadAndInstall();
    // App will restart after install
  } catch {
    // Silently ignore — updater is a convenience, not critical
  }
}

/**
 * Schedule an update check ~10 seconds after startup to avoid
 * blocking the initial render.
 */
export function scheduleStartupUpdateCheck(): void {
  if (!isTauri()) return;
  setTimeout(() => { checkAndInstallUpdate().catch(() => {}); }, 10_000);
}
