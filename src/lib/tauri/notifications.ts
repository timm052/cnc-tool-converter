/**
 * Native OS notification helpers (Tauri only)
 *
 * Falls back to a no-op in the browser / PWA build so callers don't need
 * to guard every call site.
 */

import { isTauri } from './fs';

export interface NotificationOptions {
  title:   string;
  body:    string;
  icon?:   string;
}

/**
 * Send an OS notification.
 * Does nothing when running in the browser.
 */
export async function sendNotification(opts: NotificationOptions): Promise<void> {
  if (!isTauri()) return;
  try {
    const { sendNotification: tauriSend, isPermissionGranted, requestPermission }
      = await import('@tauri-apps/plugin-notification');

    let allowed = await isPermissionGranted();
    if (!allowed) {
      const permission = await requestPermission();
      allowed = permission === 'granted';
    }
    if (!allowed) return;

    tauriSend({ title: opts.title, body: opts.body, icon: opts.icon });
  } catch {
    // Silently ignore — notifications are non-critical
  }
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

export function notifyLowStock(toolCount: number): void {
  sendNotification({
    title: 'Low Stock Alert',
    body:  `${toolCount} tool${toolCount !== 1 ? 's are' : ' is'} at or below reorder point.`,
  }).catch(() => {});
}

export function notifyBackupDue(): void {
  sendNotification({
    title: 'Backup Reminder',
    body:  'You haven\'t backed up your tool library in over 7 days. Open the library to back up now.',
  }).catch(() => {});
}
