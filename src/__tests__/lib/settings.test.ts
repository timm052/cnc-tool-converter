import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

import {
  DEFAULT_SETTINGS,
  SettingsProvider,
  useSettings,
  loadLastFormatPair,
  saveLastFormatPair,
} from '../../contexts/SettingsContext';

const STORAGE_KEY     = 'cnc-tool-converter:settings';
const FORMAT_PAIR_KEY = 'cnc-tool-converter:last-format-pair';

beforeEach(() => localStorage.clear());
afterEach(()  => localStorage.clear());

function renderSettings() {
  return renderHook(() => useSettings(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(SettingsProvider, null, children),
  });
}

// ── DEFAULT_SETTINGS shape ────────────────────────────────────────────────────

describe('DEFAULT_SETTINGS', () => {
  it('fsPresets is an empty array', () => {
    expect(Array.isArray(DEFAULT_SETTINGS.fsPresets)).toBe(true);
    expect(DEFAULT_SETTINGS.fsPresets).toHaveLength(0);
  });

  it('customToolTypes is an empty array', () => {
    expect(Array.isArray(DEFAULT_SETTINGS.customToolTypes)).toBe(true);
    expect(DEFAULT_SETTINGS.customToolTypes).toHaveLength(0);
  });

  it('customFieldColumns is an empty array', () => {
    expect(Array.isArray(DEFAULT_SETTINGS.customFieldColumns)).toBe(true);
    expect(DEFAULT_SETTINGS.customFieldColumns).toHaveLength(0);
  });

  it('tableColumnVisibility has boolean keys', () => {
    const vis = DEFAULT_SETTINGS.tableColumnVisibility;
    for (const key of Object.keys(vis) as (keyof typeof vis)[]) {
      expect(typeof vis[key], `tableColumnVisibility.${key} should be boolean`).toBe('boolean');
    }
  });

  it('default-visible columns are true', () => {
    const vis = DEFAULT_SETTINGS.tableColumnVisibility;
    expect(vis.type).toBe(true);
    expect(vis.description).toBe(true);
    expect(vis.diameter).toBe(true);
    expect(vis.length).toBe(true);
    expect(vis.flutes).toBe(true);
    expect(vis.rpm).toBe(true);
    expect(vis.feed).toBe(true);
    expect(vis.material).toBe(true);
  });

  it('has expected scalar defaults', () => {
    expect(DEFAULT_SETTINGS.defaultUnits).toBe('metric');
    expect(DEFAULT_SETTINGS.theme).toBe('dark');
    expect(DEFAULT_SETTINGS.tableDecimalPrecision).toBe(3);
    expect(DEFAULT_SETTINGS.devMode).toBe(false);
    expect(DEFAULT_SETTINGS.validationWarningsEnabled).toBe(true);
  });

  it('has expected startup and notification defaults', () => {
    expect(DEFAULT_SETTINGS.defaultPage).toBe('dashboard');
    expect(DEFAULT_SETTINGS.notifyMaintenanceEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.notifyLowStockEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.notifyBackupEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.maintenanceLeadDays).toBe(0);
  });
});

// ── Initial state from empty localStorage ─────────────────────────────────────

describe('SettingsProvider — empty localStorage', () => {
  it('initialises with DEFAULT_SETTINGS when localStorage is empty', () => {
    const { result } = renderSettings();
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });
});

// ── updateSettings — tableColumnVisibility deep-merge ─────────────────────────

describe('updateSettings — tableColumnVisibility deep-merge', () => {
  it('patches a single column to false without erasing other columns', () => {
    const { result } = renderSettings();

    act(() => {
      result.current.updateSettings({ tableColumnVisibility: { diameter: false } });
    });

    const vis = result.current.settings.tableColumnVisibility;
    expect(vis.diameter).toBe(false);
    expect(vis.type).toBe(true);
    expect(vis.description).toBe(true);
    expect(vis.length).toBe(true);
    expect(vis.feed).toBe(true);
  });

  it('patches a single column to true without erasing others', () => {
    const { result } = renderSettings();

    act(() => {
      result.current.updateSettings({ tableColumnVisibility: { manufacturer: true } });
    });

    const vis = result.current.settings.tableColumnVisibility;
    expect(vis.manufacturer).toBe(true);
    expect(vis.diameter).toBe(DEFAULT_SETTINGS.tableColumnVisibility.diameter);
  });

  it('applies two sequential patches correctly', () => {
    const { result } = renderSettings();

    act(() => { result.current.updateSettings({ tableColumnVisibility: { diameter: false } }); });
    act(() => { result.current.updateSettings({ tableColumnVisibility: { manufacturer: true } }); });

    const vis = result.current.settings.tableColumnVisibility;
    expect(vis.diameter).toBe(false);
    expect(vis.manufacturer).toBe(true);
    expect(vis.type).toBe(true);
  });

  it('patching tableColumnVisibility does not affect other top-level settings', () => {
    const { result } = renderSettings();

    act(() => { result.current.updateSettings({ tableColumnVisibility: { diameter: false } }); });

    expect(result.current.settings.fsPresets).toEqual([]);
    expect(result.current.settings.defaultUnits).toBe(DEFAULT_SETTINGS.defaultUnits);
  });
});

// ── updateSettings — top-level scalar patch ───────────────────────────────────

describe('updateSettings — top-level scalar patch', () => {
  it('updates defaultUnits without affecting unrelated settings', () => {
    const { result } = renderSettings();

    act(() => { result.current.updateSettings({ defaultUnits: 'imperial' }); });

    expect(result.current.settings.defaultUnits).toBe('imperial');
    expect(result.current.settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(result.current.settings.devMode).toBe(DEFAULT_SETTINGS.devMode);
  });

  it('updates multiple keys in one patch call', () => {
    const { result } = renderSettings();

    act(() => {
      result.current.updateSettings({
        defaultUnits:          'imperial',
        tableDecimalPrecision: 4,
        devMode:               true,
      });
    });

    expect(result.current.settings.defaultUnits).toBe('imperial');
    expect(result.current.settings.tableDecimalPrecision).toBe(4);
    expect(result.current.settings.devMode).toBe(true);
    expect(result.current.settings.theme).toBe(DEFAULT_SETTINGS.theme);
  });
});

// ── resetSettings ─────────────────────────────────────────────────────────────

describe('resetSettings', () => {
  it('restores DEFAULT_SETTINGS after scalar updates', () => {
    const { result } = renderSettings();

    act(() => { result.current.updateSettings({ defaultUnits: 'imperial', devMode: true }); });
    expect(result.current.settings.defaultUnits).toBe('imperial');

    act(() => { result.current.resetSettings(); });

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('restores tableColumnVisibility after patching', () => {
    const { result } = renderSettings();

    act(() => { result.current.updateSettings({ tableColumnVisibility: { diameter: false } }); });
    act(() => { result.current.resetSettings(); });

    expect(result.current.settings.tableColumnVisibility).toEqual(
      DEFAULT_SETTINGS.tableColumnVisibility,
    );
  });
});

// ── loadSettings — stored data scenarios ──────────────────────────────────────

describe('SettingsProvider — loading stored data', () => {
  it('falls back to [] for customToolTypes when key is absent', () => {
    const stored = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    delete stored['customToolTypes'];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderSettings();
    expect(Array.isArray(result.current.settings.customToolTypes)).toBe(true);
    expect(result.current.settings.customToolTypes).toHaveLength(0);
  });

  it('falls back to [] for fsPresets when key is absent', () => {
    const stored = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    delete stored['fsPresets'];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderSettings();
    expect(Array.isArray(result.current.settings.fsPresets)).toBe(true);
    expect(result.current.settings.fsPresets).toHaveLength(0);
  });

  it('falls back to [] for customFieldColumns when key is absent', () => {
    const stored = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    delete stored['customFieldColumns'];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderSettings();
    expect(Array.isArray(result.current.settings.customFieldColumns)).toBe(true);
    expect(result.current.settings.customFieldColumns).toHaveLength(0);
  });

  it('falls back to [] when stored array fields hold non-array values', () => {
    const corrupted = {
      ...DEFAULT_SETTINGS,
      customToolTypes:    'not-an-array',
      fsPresets:          42,
      customFieldColumns: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corrupted));

    const { result } = renderSettings();
    expect(Array.isArray(result.current.settings.customToolTypes)).toBe(true);
    expect(Array.isArray(result.current.settings.fsPresets)).toBe(true);
    expect(Array.isArray(result.current.settings.customFieldColumns)).toBe(true);
  });

  it('deep-merges tableColumnVisibility so absent keys get their defaults', () => {
    const partial = {
      ...DEFAULT_SETTINGS,
      tableColumnVisibility: { type: false, description: true },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(partial));

    const { result } = renderSettings();
    const vis = result.current.settings.tableColumnVisibility;

    expect(vis.type).toBe(false);
    expect(vis.description).toBe(true);
    expect(vis.diameter).toBe(DEFAULT_SETTINGS.tableColumnVisibility.diameter);
  });

  it('uses stored scalar values over defaults', () => {
    const stored = {
      ...DEFAULT_SETTINGS,
      defaultUnits:          'imperial',
      tableDecimalPrecision: 5,
      devMode:               true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderSettings();
    expect(result.current.settings.defaultUnits).toBe('imperial');
    expect(result.current.settings.tableDecimalPrecision).toBe(5);
    expect(result.current.settings.devMode).toBe(true);
  });

  it('returns DEFAULT_SETTINGS when localStorage contains invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid { json |||');

    const { result } = renderSettings();
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });
});

// ── loadLastFormatPair / saveLastFormatPair ────────────────────────────────────

describe('loadLastFormatPair / saveLastFormatPair', () => {
  it('returns null when nothing is stored', () => {
    expect(loadLastFormatPair()).toBeNull();
  });

  it('round-trips source and target correctly', () => {
    saveLastFormatPair('hsmlib', 'linuxcnc');
    const pair = loadLastFormatPair();
    expect(pair).not.toBeNull();
    expect(pair!.source).toBe('hsmlib');
    expect(pair!.target).toBe('linuxcnc');
  });

  it('overwrites a previous pair on subsequent save', () => {
    saveLastFormatPair('hsmlib', 'linuxcnc');
    saveLastFormatPair('fanuc', 'csv');
    const pair = loadLastFormatPair();
    expect(pair!.source).toBe('fanuc');
    expect(pair!.target).toBe('csv');
  });

  it('returns null when the stored value is invalid JSON', () => {
    localStorage.setItem(FORMAT_PAIR_KEY, 'bad json <<<');
    expect(loadLastFormatPair()).toBeNull();
  });

  it('stores the correct shape', () => {
    saveLastFormatPair('fusion360json', 'haas');
    const raw = localStorage.getItem(FORMAT_PAIR_KEY);
    expect(JSON.parse(raw!)).toEqual({ source: 'fusion360json', target: 'haas' });
  });
});
