import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { CustomToolTypeDefinition } from '../lib/customToolTypes';

export interface TableColumnVisibility {
  type:        boolean;
  description: boolean;
  diameter:    boolean;
  length:      boolean;
  flutes:      boolean;
  rpm:         boolean;
  feed:        boolean;
  material:    boolean;
  qty:         boolean;
}

export interface Settings {
  // Conversion Defaults
  defaultUnits:           'metric' | 'imperial';
  rememberLastFormatPair: boolean;
  autoConvertOnLoad:      boolean;

  // LinuxCNC Writer
  linuxcncStartingToolNumber:   number;
  linuxcncPocketAssignment:     'match-t' | 'sequential';
  linuxcncDecimalPlaces:        number;
  linuxcncIncludeHeaderComment: boolean;

  // HSMLib Writer
  hsmlibDefaultMachineVendor: string;
  hsmlibDefaultMachineModel:  string;

  // Display
  tableDecimalPrecision: number;
  tableRowDensity:       'compact' | 'comfortable';
  tableColumnVisibility: TableColumnVisibility;

  // File Handling
  mergeBehavior:  'merge' | 'separate';
  warnOnDataLoss: boolean;

  // Tool Library — New Tool Defaults
  libraryDefaultMachineGroup: string;
  libraryDefaultToolNumber:   number;
  libraryDefaultType:         string;

  // Tool Library — Import Defaults
  libraryImportDefaultMachineGroup: string;
  libraryImportOverwrite:           boolean;

  // Tool Library — Display
  librarySortKey: 'toolNumber' | 'description' | 'type' | 'diameter' | 'addedAt';
  librarySortDir: 'asc' | 'desc';
  libraryMaxTagsShown: number;

  // Validation
  validationWarningsEnabled: boolean;

  // Custom Tool Types
  customToolTypes: CustomToolTypeDefinition[];

  // Appearance
  theme: 'dark' | 'retro90s' | 'winxp' | 'macos9' | 'light';
}

export const DEFAULT_SETTINGS: Settings = {
  defaultUnits:           'metric',
  rememberLastFormatPair: true,
  autoConvertOnLoad:      true,

  linuxcncStartingToolNumber:   0,
  linuxcncPocketAssignment:     'match-t',
  linuxcncDecimalPlaces:        6,
  linuxcncIncludeHeaderComment: true,

  hsmlibDefaultMachineVendor: '',
  hsmlibDefaultMachineModel:  '',

  tableDecimalPrecision: 3,
  tableRowDensity:       'comfortable',
  tableColumnVisibility: {
    type:        true,
    description: true,
    diameter:    true,
    length:      true,
    flutes:      true,
    rpm:         true,
    feed:        true,
    material:    true,
    qty:         false,
  },

  mergeBehavior:  'merge',
  warnOnDataLoss: true,

  libraryDefaultMachineGroup:       '',
  libraryDefaultToolNumber:         1,
  libraryDefaultType:               'flat end mill',
  libraryImportDefaultMachineGroup: '',
  libraryImportOverwrite:           false,
  librarySortKey:                   'addedAt',
  librarySortDir:                   'desc',
  libraryMaxTagsShown:              3,

  validationWarningsEnabled: true,

  customToolTypes: [],

  theme: 'dark',
};

const STORAGE_KEY     = 'cnc-tool-converter:settings';
const FORMAT_PAIR_KEY = 'cnc-tool-converter:last-format-pair';

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Settings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        tableColumnVisibility: {
          ...DEFAULT_SETTINGS.tableColumnVisibility,
          ...(parsed.tableColumnVisibility ?? {}),
        },
      };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_SETTINGS };
}

export function loadLastFormatPair(): { source: string; target: string } | null {
  try {
    const stored = localStorage.getItem(FORMAT_PAIR_KEY);
    if (stored) return JSON.parse(stored) as { source: string; target: string };
  } catch {
    // ignore
  }
  return null;
}

export function saveLastFormatPair(source: string, target: string): void {
  try {
    localStorage.setItem(FORMAT_PAIR_KEY, JSON.stringify({ source, target }));
  } catch {
    // quota exceeded — ignore
  }
}

interface SettingsContextValue {
  settings:       Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings:  () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // quota exceeded — ignore
    }
  }, [settings]);

  function updateSettings(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  function resetSettings() {
    setSettings({ ...DEFAULT_SETTINGS });
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
