/**
 * Tests for src/lib/backupNudge.ts
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { recordBackup, getLastBackupTime, daysSinceBackup } from '../../lib/backupNudge';

const KEY = 'cnc-tool-converter:last-backup';

beforeEach(() => localStorage.clear());
afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('getLastBackupTime()', () => {
  it('returns null when nothing is stored', () => {
    expect(getLastBackupTime()).toBeNull();
  });

  it('returns the stored timestamp after recordBackup()', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    recordBackup();
    expect(getLastBackupTime()).toBe(1_700_000_000_000);
  });

  it('returns null if stored value is not a number', () => {
    localStorage.setItem(KEY, 'not-a-number');
    expect(getLastBackupTime()).toBeNull();
  });
});

describe('recordBackup()', () => {
  it('writes the current timestamp to localStorage', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    recordBackup();
    expect(localStorage.getItem(KEY)).toBe('1000000');
  });

  it('overwrites a previous backup timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    recordBackup();
    vi.setSystemTime(2_000_000);
    recordBackup();
    expect(getLastBackupTime()).toBe(2_000_000);
  });
});

describe('daysSinceBackup()', () => {
  it('returns null when no backup has been recorded', () => {
    expect(daysSinceBackup()).toBeNull();
  });

  it('returns 0 on the same day as the backup', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    recordBackup();
    vi.setSystemTime(3_600_000);   // 1 hour later
    expect(daysSinceBackup()).toBe(0);
  });

  it('returns 1 after exactly 24 hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    recordBackup();
    vi.setSystemTime(86_400_000);  // exactly 1 day later
    expect(daysSinceBackup()).toBe(1);
  });

  it('returns 7 after 7 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    recordBackup();
    vi.setSystemTime(7 * 86_400_000);
    expect(daysSinceBackup()).toBe(7);
  });

  it('returns 0 for a partial first day (23h59m)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    recordBackup();
    vi.setSystemTime(86_400_000 - 60_000);  // 23h59m
    expect(daysSinceBackup()).toBe(0);
  });
});
