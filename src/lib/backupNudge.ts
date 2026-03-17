/**
 * Backup nudge helpers (roadmap 1.4)
 *
 * Track the last-backup timestamp in localStorage so the sidebar footer
 * can show a nudge after 7 days without a backup.
 */

const KEY = 'cnc-tool-converter:last-backup';

export function recordBackup() {
  localStorage.setItem(KEY, String(Date.now()));
}

/** Returns the timestamp (ms) of the last backup, or null if never. */
export function getLastBackupTime(): number | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

/** Returns the number of whole days since the last backup, or null if never. */
export function daysSinceBackup(): number | null {
  const ts = getLastBackupTime();
  if (ts === null) return null;
  return Math.floor((Date.now() - ts) / 86_400_000);
}
