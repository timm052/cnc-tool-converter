/**
 * G54–G59 Work Offset Reference Sheet
 *
 * Generates a formatted plaintext or G-code comment block listing work
 * coordinate system assignments.  Each dialect has a different set of
 * extended offset codes beyond the standard G54–G59.
 */

export type WcsDialect = 'fanuc' | 'haas' | 'mach3' | 'linuxcnc' | 'siemens';

export interface WcsDialectInfo {
  id:       WcsDialect;
  label:    string;
  commentChar: string;
  /** All offset slots for this dialect, in display order */
  slots:    WcsSlotDef[];
}

export interface WcsSlotDef {
  code:  string;   // e.g. "G54", "G54.1 P1", "G110"
  label: string;   // e.g. "WCS 1"
}

export interface WcsEntry {
  slotCode: string;
  name:     string;   // user-assigned fixture / machine group name
  x:        string;
  y:        string;
  z:        string;
  a:        string;
  b:        string;
}

// ── Slot definitions per dialect ──────────────────────────────────────────────

function standardSlots(): WcsSlotDef[] {
  return [
    { code: 'G54', label: 'WCS 1' },
    { code: 'G55', label: 'WCS 2' },
    { code: 'G56', label: 'WCS 3' },
    { code: 'G57', label: 'WCS 4' },
    { code: 'G58', label: 'WCS 5' },
    { code: 'G59', label: 'WCS 6' },
  ];
}

const DIALECTS: WcsDialectInfo[] = [
  {
    id: 'fanuc', label: 'Fanuc / ISO', commentChar: ';',
    slots: [
      ...standardSlots(),
      ...Array.from({ length: 48 }, (_, i) => ({
        code:  `G54.1 P${i + 1}`,
        label: `Extended ${i + 1}`,
      })),
    ],
  },
  {
    id: 'haas', label: 'HAAS', commentChar: ';',
    slots: [
      ...standardSlots(),
      ...Array.from({ length: 20 }, (_, i) => ({
        code:  `G${110 + i}`,
        label: `Extended ${i + 1}`,
      })),
    ],
  },
  {
    id: 'mach3', label: 'Mach3', commentChar: ';',
    slots: standardSlots(),
  },
  {
    id: 'linuxcnc', label: 'LinuxCNC', commentChar: ';',
    slots: [
      ...standardSlots(),
      { code: 'G59.1', label: 'WCS 7' },
      { code: 'G59.2', label: 'WCS 8' },
      { code: 'G59.3', label: 'WCS 9' },
    ],
  },
  {
    id: 'siemens', label: 'Siemens Sinumerik', commentChar: ';',
    slots: [
      { code: 'G54',    label: 'WCS 1' },
      { code: 'G55',    label: 'WCS 2' },
      { code: 'G56',    label: 'WCS 3' },
      { code: 'G57',    label: 'WCS 4' },
      ...Array.from({ length: 96 }, (_, i) => ({
        code:  `G505 D${i + 1}`,
        label: `Frame ${i + 1}`,
      })),
    ],
  },
];

export function getDialect(id: WcsDialect): WcsDialectInfo {
  return DIALECTS.find((d) => d.id === id) ?? DIALECTS[0];
}

export { DIALECTS };

// ── Default entries for a dialect ─────────────────────────────────────────────

export function defaultEntries(dialect: WcsDialectInfo, existing?: WcsEntry[]): WcsEntry[] {
  // Only create defaults for the first 6 (standard) slots; extras are opt-in
  const visibleSlots = dialect.slots.slice(0, 6);
  return visibleSlots.map((slot) => {
    const ex = existing?.find((e) => e.slotCode === slot.code);
    return ex ?? { slotCode: slot.code, name: '', x: '', y: '', z: '', a: '', b: '' };
  });
}

// ── Sheet renderer ────────────────────────────────────────────────────────────

export function renderOffsetSheet(
  entries:  WcsEntry[],
  dialect:  WcsDialectInfo,
  machineName: string,
): string {
  const c   = dialect.commentChar;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lines: string[] = [
    `${c} Work Offset Reference Sheet`,
    `${c} Dialect  : ${dialect.label}`,
    machineName ? `${c} Machine  : ${machineName}` : '',
    `${c} Generated: ${now}`,
    `${c} ${'─'.repeat(58)}`,
    '',
  ].filter((l) => l !== undefined);

  const filled = entries.filter((e) => e.name || e.x || e.y || e.z);
  if (filled.length === 0) {
    lines.push(`${c} (no entries)`);
    return lines.join('\n');
  }

  for (const e of filled) {
    const header = e.name ? `${e.slotCode}  (${e.name})` : e.slotCode;
    lines.push(`${c} ${header}`);

    const axes: string[] = [];
    if (e.x) axes.push(`X${e.x}`);
    if (e.y) axes.push(`Y${e.y}`);
    if (e.z) axes.push(`Z${e.z}`);
    if (e.a) axes.push(`A${e.a}`);
    if (e.b) axes.push(`B${e.b}`);
    if (axes.length > 0) {
      lines.push(`${c}   ${axes.join('  ')}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

// ── CSV renderer ──────────────────────────────────────────────────────────────

export function renderOffsetCsv(entries: WcsEntry[]): string {
  const header = 'Offset Code,Name,X,Y,Z,A,B';
  const rows = entries
    .filter((e) => e.name || e.x || e.y || e.z)
    .map((e) => [e.slotCode, e.name, e.x, e.y, e.z, e.a, e.b]
      .map((v) => `"${(v ?? '').replace(/"/g, '""')}"`)
      .join(','));
  return [header, ...rows].join('\n');
}

// ── localStorage persistence ──────────────────────────────────────────────────

const LS_KEY = 'cnc-tool-converter:workOffsets';

interface StoredOffsets {
  [dialectId: string]: WcsEntry[];
}

export function loadStoredEntries(dialectId: WcsDialect): WcsEntry[] | undefined {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return undefined;
    return (JSON.parse(raw) as StoredOffsets)[dialectId];
  } catch { return undefined; }
}

export function saveStoredEntries(dialectId: WcsDialect, entries: WcsEntry[]): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const all: StoredOffsets = raw ? JSON.parse(raw) as StoredOffsets : {};
    all[dialectId] = entries;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}
