/**
 * Tests for src/lib/tauri/fs.ts
 *
 * All tests run in jsdom (no __TAURI_INTERNALS__), so they exercise the
 * browser-fallback paths.  isTauri() detection is tested by temporarily
 * patching window.__TAURI_INTERNALS__.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isTauri, saveTextFile, saveBinaryFile, revealInExplorer } from '../../lib/tauri/fs';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Restore window.__TAURI_INTERNALS__ after each test that sets it. */
afterEach(() => {
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

// ── isTauri() ─────────────────────────────────────────────────────────────────

describe('isTauri()', () => {
  it('returns false when __TAURI_INTERNALS__ is absent', () => {
    expect(isTauri()).toBe(false);
  });

  it('returns true when __TAURI_INTERNALS__ is present', () => {
    (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
  });

  it('returns false after __TAURI_INTERNALS__ is removed', () => {
    (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    expect(isTauri()).toBe(false);
  });
});

// ── saveTextFile (browser path) ───────────────────────────────────────────────

describe('saveTextFile (browser fallback)', () => {
  it('returns null (no native path in browser)', async () => {
    const result = await saveTextFile('hello world', 'output.txt');
    expect(result).toBeNull();
  });

  it('creates an anchor element and clicks it', async () => {
    const clickSpy = vi.fn();
    const anchor = document.createElement('a');
    vi.spyOn(anchor, 'click').mockImplementation(clickSpy);
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor as HTMLAnchorElement);

    await saveTextFile('content', 'file.txt', 'text/plain');

    expect(anchor.download).toBe('file.txt');
    expect(anchor.href).toMatch(/^blob:/);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('uses the provided MIME type', async () => {
    const blobs: Blob[] = [];
    const origBlob = globalThis.Blob;
    globalThis.Blob = class MockBlob extends origBlob {
      constructor(parts: BlobPart[], init?: BlobPropertyBag) {
        super(parts, init);
        blobs.push(this);
      }
    } as typeof Blob;

    await saveTextFile('{}', 'data.json', 'application/json');

    expect(blobs[0].type).toBe('application/json');
    globalThis.Blob = origBlob;
  });
});

// ── saveBinaryFile (browser path) ─────────────────────────────────────────────

describe('saveBinaryFile (browser fallback)', () => {
  it('returns null in browser', async () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02]);
    const result = await saveBinaryFile(bytes, 'output.bin');
    expect(result).toBeNull();
  });

  it('accepts Uint8Array input', async () => {
    const clickSpy = vi.fn();
    const anchor = document.createElement('a');
    vi.spyOn(anchor, 'click').mockImplementation(clickSpy);
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor as HTMLAnchorElement);

    const bytes = new Uint8Array([65, 66, 67]); // "ABC"
    await saveBinaryFile(bytes, 'data.bin');

    expect(anchor.download).toBe('data.bin');
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('accepts ArrayBuffer input', async () => {
    const clickSpy = vi.fn();
    const anchor = document.createElement('a');
    vi.spyOn(anchor, 'click').mockImplementation(clickSpy);
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor as HTMLAnchorElement);

    const buf = new Uint8Array([1, 2, 3]).buffer;
    await saveBinaryFile(buf, 'data.bin');

    expect(anchor.download).toBe('data.bin');
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});

// ── revealInExplorer ──────────────────────────────────────────────────────────

describe('revealInExplorer (browser fallback)', () => {
  it('returns without error when not in Tauri', async () => {
    await expect(revealInExplorer('/some/path/file.txt')).resolves.toBeUndefined();
  });
});
