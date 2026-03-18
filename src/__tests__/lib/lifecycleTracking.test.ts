/**
 * Tests for Phase 2 lifecycle / usage-tracking features.
 *
 * Covers:
 * - useCount progress-bar pct calculation
 * - Regrind/soon badge thresholds
 * - shouldShowChangelog / markChangelogSeen (localStorage)
 * - Sidebar collapsed-state persistence (localStorage key)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { shouldShowChangelog, markChangelogSeen } from '../../components/ChangelogModal';
import { version as CURRENT_VERSION } from '../../../package.json';

// ── Usage-tracking progress bar math ──────────────────────────────────────────
// Mirrors the pct calculation in ToolEditor (lifecycle section) and
// the useCount column cell renderer in LibraryTable.

function calcPct(useCount: number, regrindThreshold: number): number {
  if (regrindThreshold <= 0) return 0;
  return useCount / regrindThreshold;
}

type BadgeType = 'regrind' | 'soon' | null;

function getBadge(useCount: number, regrindThreshold: number | undefined): BadgeType {
  if (regrindThreshold == null || regrindThreshold === 0) return null;
  const pct = calcPct(useCount, regrindThreshold);
  if (pct >= 1) return 'regrind';
  if (pct >= 0.8) return 'soon';
  return null;
}

describe('useCount progress bar pct', () => {
  it('returns 0 when useCount is 0', () => {
    expect(calcPct(0, 100)).toBe(0);
  });

  it('returns 0.5 at half the threshold', () => {
    expect(calcPct(50, 100)).toBe(0.5);
  });

  it('returns 1.0 at exactly the threshold', () => {
    expect(calcPct(100, 100)).toBe(1.0);
  });

  it('returns > 1 when useCount exceeds threshold', () => {
    expect(calcPct(120, 100)).toBeGreaterThan(1);
  });

  it('returns 0 for a zero threshold (guard against divide-by-zero)', () => {
    expect(calcPct(5, 0)).toBe(0);
  });
});

describe('regrind / soon badge logic', () => {
  it('shows no badge when threshold is not set', () => {
    expect(getBadge(50, undefined)).toBeNull();
  });

  it('shows no badge when threshold is 0', () => {
    expect(getBadge(10, 0)).toBeNull();
  });

  it('shows no badge when well below threshold', () => {
    expect(getBadge(10, 100)).toBeNull();
  });

  it('shows "soon" at exactly 80 % of threshold', () => {
    expect(getBadge(80, 100)).toBe('soon');
  });

  it('shows "soon" between 80 % and 100 %', () => {
    expect(getBadge(85, 100)).toBe('soon');
    expect(getBadge(99, 100)).toBe('soon');
  });

  it('shows "regrind" at exactly the threshold', () => {
    expect(getBadge(100, 100)).toBe('regrind');
  });

  it('shows "regrind" when useCount exceeds threshold', () => {
    expect(getBadge(120, 100)).toBe('regrind');
  });

  it('79 % shows no badge (just below soon threshold)', () => {
    expect(getBadge(79, 100)).toBeNull();
  });
});

// ── ChangelogModal — shouldShowChangelog / markChangelogSeen ──────────────────

const LAST_SEEN_KEY = 'cnc-tool-converter:lastSeenVersion';

describe('shouldShowChangelog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns true when the key has never been set', () => {
    expect(shouldShowChangelog()).toBe(true);
  });

  it('returns true when the stored version is an older version', () => {
    localStorage.setItem(LAST_SEEN_KEY, '0.0.1');
    expect(shouldShowChangelog()).toBe(true);
  });

  it('returns false when the stored version matches the current version', () => {
    localStorage.setItem(LAST_SEEN_KEY, CURRENT_VERSION);
    expect(shouldShowChangelog()).toBe(false);
  });
});

describe('markChangelogSeen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes the current version to localStorage', () => {
    markChangelogSeen();
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBe(CURRENT_VERSION);
  });

  it('after markChangelogSeen, shouldShowChangelog returns false', () => {
    markChangelogSeen();
    expect(shouldShowChangelog()).toBe(false);
  });
});

// ── Sidebar collapsed-state helpers ──────────────────────────────────────────
// Mirrors the logic in Sidebar.tsx and MachineGroupSidebar in ToolManagerPage.tsx

const SIDEBAR_KEY         = 'sidebar-collapsed';
const MACHINE_SIDEBAR_KEY = 'machine-sidebar-collapsed';

function readCollapsed(key: string): boolean {
  return localStorage.getItem(key) === 'true';
}

function writeCollapsed(key: string, value: boolean): void {
  localStorage.setItem(key, String(value));
}

describe('sidebar collapsed-state persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to expanded when key is absent', () => {
    expect(readCollapsed(SIDEBAR_KEY)).toBe(false);
  });

  it('reads back "true" as collapsed', () => {
    writeCollapsed(SIDEBAR_KEY, true);
    expect(readCollapsed(SIDEBAR_KEY)).toBe(true);
  });

  it('reads back "false" as expanded', () => {
    writeCollapsed(SIDEBAR_KEY, false);
    expect(readCollapsed(SIDEBAR_KEY)).toBe(false);
  });

  it('machine sidebar key is independent of main sidebar key', () => {
    writeCollapsed(SIDEBAR_KEY, true);
    writeCollapsed(MACHINE_SIDEBAR_KEY, false);
    expect(readCollapsed(SIDEBAR_KEY)).toBe(true);
    expect(readCollapsed(MACHINE_SIDEBAR_KEY)).toBe(false);
  });

  it('toggle from expanded to collapsed and back', () => {
    writeCollapsed(SIDEBAR_KEY, false);
    const wasCollapsed = readCollapsed(SIDEBAR_KEY);
    writeCollapsed(SIDEBAR_KEY, !wasCollapsed);
    expect(readCollapsed(SIDEBAR_KEY)).toBe(true);
    writeCollapsed(SIDEBAR_KEY, !readCollapsed(SIDEBAR_KEY));
    expect(readCollapsed(SIDEBAR_KEY)).toBe(false);
  });
});
