/**
 * Tauri-aware file I/O helpers
 *
 * Each function detects whether the app is running inside Tauri and uses the
 * native desktop APIs if so, otherwise falls back to the browser pattern.
 *
 * Import these instead of directly calling URL.createObjectURL or
 * Tauri APIs — the correct path is chosen at runtime.
 */

declare global {
  interface Window { __TAURI_INTERNALS__?: unknown; }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

// ── Extension → MIME filter mapping for Tauri dialogs ────────────────────────

function extToFilters(filename: string): { name: string; extensions: string[] }[] {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const MAP: Record<string, string> = {
    json: 'JSON', csv: 'CSV', txt: 'Text', pdf: 'PDF',
    nc: 'G-code', hsmlib: 'HSMlib', tbl: 'LinuxCNC table',
    ofs: 'HAAS offsets', xlsx: 'Excel',
  };
  if (ext && MAP[ext]) {
    return [{ name: MAP[ext], extensions: [ext] }];
  }
  return [{ name: 'All files', extensions: ['*'] }];
}

// ── Save text file ────────────────────────────────────────────────────────────

/**
 * Prompt the user for a save location (Tauri) or trigger a browser download.
 * Returns the chosen path (Tauri) or null (browser / cancelled).
 */
export async function saveTextFile(
  content: string,
  defaultName: string,
  mimeType = 'text/plain',
): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({
      defaultPath: defaultName,
      filters: extToFilters(defaultName),
    });
    if (!path) return null;
    await writeTextFile(path, content);
    return path;
  }
  // Browser fallback
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: defaultName });
  a.click();
  URL.revokeObjectURL(url);
  return null;
}

// ── Save binary file ──────────────────────────────────────────────────────────

export async function saveBinaryFile(
  bytes: Uint8Array | ArrayBuffer,
  defaultName: string,
  mimeType = 'application/octet-stream',
): Promise<string | null> {
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({
      defaultPath: defaultName,
      filters: extToFilters(defaultName),
    });
    if (!path) return null;
    await writeFile(path, uint8);
    return path;
  }
  // Browser fallback
  const blob = new Blob([uint8.buffer as ArrayBuffer], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: defaultName });
  a.click();
  URL.revokeObjectURL(url);
  return null;
}

// ── Open file(s) ──────────────────────────────────────────────────────────────

export interface OpenedFile {
  name:    string;
  content: string | Uint8Array;
}

/**
 * Open one or more files via a native dialog (Tauri) or a hidden `<input>`
 * element (browser).  Returns null if the user cancelled.
 */
export async function openFiles(options?: {
  multiple?:   boolean;
  accept?:     string;           // MIME types / extensions for browser input
  filters?:    { name: string; extensions: string[] }[];  // Tauri dialog filters
  binary?:     boolean;          // read as binary (Uint8Array) instead of text
}): Promise<OpenedFile[] | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile, readFile } = await import('@tauri-apps/plugin-fs');

    const result = await open({
      multiple:  options?.multiple ?? false,
      filters:   options?.filters ?? [{ name: 'All files', extensions: ['*'] }],
    });
    if (!result) return null;

    const paths: string[] = Array.isArray(result) ? result : [result];
    const files: OpenedFile[] = [];
    for (const p of paths) {
      const name    = p.split(/[\\/]/).pop() ?? p;
      const content = options?.binary
        ? await readFile(p)
        : await readTextFile(p);
      files.push({ name, content });
    }
    return files;
  }

  // Browser fallback — create a hidden <input type="file">
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type     = 'file';
    input.multiple = options?.multiple ?? false;
    if (options?.accept) input.accept = options.accept;
    input.onchange = async () => {
      const fileList = input.files;
      if (!fileList?.length) { resolve(null); return; }
      const result: OpenedFile[] = [];
      for (const file of Array.from(fileList)) {
        const content = options?.binary
          ? new Uint8Array(await file.arrayBuffer())
          : await file.text();
        result.push({ name: file.name, content });
      }
      resolve(result);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// ── Reveal a file in the OS file explorer ────────────────────────────────────

export async function revealInExplorer(path: string): Promise<void> {
  if (!isTauri()) return;
  const { open } = await import('@tauri-apps/plugin-shell');
  // Open the parent directory
  const dir = path.replace(/[\\/][^\\/]+$/, '');
  await open(dir);
}
