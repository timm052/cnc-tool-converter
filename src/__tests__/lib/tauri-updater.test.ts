/**
 * Tests for src/lib/tauri/updater.ts
 *
 * All tests run in jsdom (no __TAURI_INTERNALS__), so they exercise the
 * browser no-op paths.  The Tauri plugin itself is never loaded.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  checkForUpdate,
  checkAndInstallUpdate,
  scheduleStartupUpdateCheck,
} from '../../lib/tauri/updater';

afterEach(() => {
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  vi.useRealTimers();
});

// ── checkForUpdate ────────────────────────────────────────────────────────────

describe('checkForUpdate()', () => {
  it('returns { available: false } when not in Tauri', async () => {
    const result = await checkForUpdate();
    expect(result).toEqual({ available: false });
  });

  it('returns { available: false } quickly (no network)', async () => {
    const start = Date.now();
    await checkForUpdate();
    expect(Date.now() - start).toBeLessThan(100);
  });
});

// ── checkAndInstallUpdate ─────────────────────────────────────────────────────

describe('checkAndInstallUpdate()', () => {
  it('resolves without error when not in Tauri', async () => {
    await expect(checkAndInstallUpdate()).resolves.toBeUndefined();
  });

  it('does not call window.confirm in browser', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    await checkAndInstallUpdate();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

// ── scheduleStartupUpdateCheck ────────────────────────────────────────────────

describe('scheduleStartupUpdateCheck()', () => {
  it('returns synchronously when not in Tauri', () => {
    vi.useFakeTimers();
    // Should not throw
    scheduleStartupUpdateCheck();
    // No timers should be pending since isTauri() is false
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not schedule any work in browser', () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    scheduleStartupUpdateCheck();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});
