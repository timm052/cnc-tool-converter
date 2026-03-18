/**
 * Shared string utilities.
 */

/**
 * Escape a string for safe embedding in XML / HTML attributes and text nodes.
 * Handles `&`, `<`, `>`, `"`, and `'`.
 */
export function esc(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
