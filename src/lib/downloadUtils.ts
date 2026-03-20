/**
 * File download helpers
 *
 * In a browser / PWA build: triggers a blob download via an anchor click.
 * In the Tauri desktop build: shows a native Save-As dialog then writes the
 * file using tauri-plugin-fs.
 *
 * All existing callers (ExportPanel, LowStockPanel, CamSnippetPanel, …) work
 * unchanged — the Tauri path is chosen automatically at runtime.
 */

import { isTauri, saveTextFile, saveBinaryFile } from './tauri/fs';

/**
 * Download a text / string payload.
 * Tauri: native Save-As dialog.  Browser: blob anchor download.
 */
export async function triggerDownload(
  content:  string,
  mimeType: string,
  filename: string,
): Promise<void> {
  if (isTauri()) {
    await saveTextFile(content, filename, mimeType);
    return;
  }
  const blob = new Blob([content as string], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download a binary (ArrayBuffer / Uint8Array) payload.
 * Tauri: native Save-As dialog.  Browser: blob anchor download.
 */
export async function triggerBinaryDownload(
  content:  ArrayBuffer | Uint8Array,
  mimeType: string,
  filename: string,
): Promise<void> {
  if (isTauri()) {
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
    await saveBinaryFile(bytes, filename, mimeType);
    return;
  }
  const buf  = content instanceof Uint8Array ? content.buffer as ArrayBuffer : content;
  const blob = new Blob([buf], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
