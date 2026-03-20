/**
 * G54–G59 Work Offset Reference Sheet
 *
 * Generates a formatted PDF card or CSV listing work coordinate system
 * assignments.  Each dialect has a different set of extended offset codes
 * beyond the standard G54–G59.
 */

import jsPDF from 'jspdf';
import { savePdfDoc } from './tauri/pdfSave';

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

// ── PDF card renderer ─────────────────────────────────────────────────────────

function clampWcsText(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '\u2026') > maxW) t = t.slice(0, -1);
  return t + '\u2026';
}

export async function renderOffsetPdf(
  entries:     WcsEntry[],
  dialect:     WcsDialectInfo,
  machineName: string,
): Promise<void> {
  const filled = entries.filter((e) => e.name || e.x || e.y || e.z || e.a || e.b);
  const hasA   = filled.some((e) => e.a);
  const hasB   = filled.some((e) => e.b);

  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const MARGIN = 12;
  const tableW = PAGE_W - MARGIN * 2;

  // Column widths — nameW fills remaining space
  const codeW   = 28;
  const axisW   = 22;
  const rotW    = 18;
  const fixedW  = codeW + axisW * 3 + (hasA ? rotW : 0) + (hasB ? rotW : 0);
  const nameW   = tableW - fixedW;

  const COL_H   = 7;
  const ROW_H   = 6.5;

  const now     = new Date();
  const dateStr = now.toLocaleDateString(undefined, { dateStyle: 'medium' });

  // ── Title bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(30, 53, 96);
  doc.rect(MARGIN, MARGIN, tableW, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('Work Offset Reference Sheet', MARGIN + 3, MARGIN + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(147, 197, 253);
  const subInfo = [dialect.label, machineName].filter(Boolean).join(' · ');
  doc.text(subInfo, PAGE_W - MARGIN - 3, MARGIN + 5.5, { align: 'right' });
  doc.text(dateStr, PAGE_W - MARGIN - 3, MARGIN + 10,  { align: 'right' });

  const tableTop = MARGIN + 16;

  // ── Column headers ─────────────────────────────────────────────────────────
  doc.setFillColor(51, 65, 85);
  doc.rect(MARGIN, tableTop, tableW, COL_H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);

  doc.text('OFFSET',          MARGIN + 3,        tableTop + 4.5);
  doc.text('FIXTURE / LABEL', MARGIN + codeW + 3, tableTop + 4.5);

  let ax = MARGIN + codeW + nameW;
  doc.text('X', ax + axisW - 2, tableTop + 4.5, { align: 'right' }); ax += axisW;
  doc.text('Y', ax + axisW - 2, tableTop + 4.5, { align: 'right' }); ax += axisW;
  doc.text('Z', ax + axisW - 2, tableTop + 4.5, { align: 'right' }); ax += axisW;
  if (hasA) { doc.text('A', ax + rotW - 2, tableTop + 4.5, { align: 'right' }); ax += rotW; }
  if (hasB) { doc.text('B', ax + rotW - 2, tableTop + 4.5, { align: 'right' }); }

  // ── Data rows ──────────────────────────────────────────────────────────────
  let ry = tableTop + COL_H;
  const fmt = (v: string) => v || '\u2014';

  if (filled.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('No entries', MARGIN + tableW / 2, ry + 10, { align: 'center' });
    ry += 20;
  } else {
    for (let i = 0; i < filled.length; i++) {
      const e = filled[i];

      // Alternating row shading
      if (i % 2 === 1) {
        doc.setFillColor(241, 245, 249);
        doc.rect(MARGIN, ry, tableW, ROW_H, 'F');
      }

      const textY = ry + 4.2;

      // Offset code (courier + blue)
      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(37, 99, 235);
      doc.text(e.slotCode, MARGIN + 3, textY);

      // Fixture label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(clampWcsText(doc, e.name || '\u2014', nameW - 6), MARGIN + codeW + 3, textY);

      // Axis values (right-aligned, monospace)
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);

      let axv = MARGIN + codeW + nameW;
      doc.text(fmt(e.x), axv + axisW - 2, textY, { align: 'right' }); axv += axisW;
      doc.text(fmt(e.y), axv + axisW - 2, textY, { align: 'right' }); axv += axisW;
      doc.text(fmt(e.z), axv + axisW - 2, textY, { align: 'right' }); axv += axisW;
      if (hasA) { doc.text(fmt(e.a), axv + rotW - 2, textY, { align: 'right' }); axv += rotW; }
      if (hasB) { doc.text(fmt(e.b), axv + rotW - 2, textY, { align: 'right' }); }

      ry += ROW_H;
    }
  }

  // ── Table border + column dividers ─────────────────────────────────────────
  const tableH = COL_H + (filled.length > 0 ? ROW_H * filled.length : 20);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.rect(MARGIN, tableTop, tableW, tableH, 'S');

  // Vertical column separators
  const divOffsets = [codeW, codeW + nameW, codeW + nameW + axisW, codeW + nameW + axisW * 2];
  if (hasA || hasB) divOffsets.push(codeW + nameW + axisW * 3);
  if (hasA && hasB) divOffsets.push(codeW + nameW + axisW * 3 + rotW);

  doc.setLineWidth(0.15);
  for (const d of divOffsets) {
    doc.line(MARGIN + d, tableTop, MARGIN + d, tableTop + tableH);
  }

  // Header bottom rule
  doc.setLineWidth(0.3);
  doc.setDrawColor(30, 53, 96);
  doc.line(MARGIN, tableTop + COL_H, MARGIN + tableW, tableTop + COL_H);

  // ── Footer ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(148, 163, 184);
  doc.text('CNC Tool Converter \u2014 Work Offset Reference Sheet', MARGIN, 286);
  doc.text(dateStr, PAGE_W - MARGIN, 286, { align: 'right' });

  await savePdfDoc(doc, `work-offsets-${now.toISOString().slice(0, 10)}.pdf`);
}

// ── localStorage persistence (per-machine) ────────────────────────────────────
//
// Storage shape: { [machineKey: string]: { dialect: WcsDialect; entries: WcsEntry[] } }
// machineKey is the machine-group name, or '__default__' when no group is selected.

const LS_KEY = 'cnc-tool-converter:workOffsets';

export const DEFAULT_MACHINE_KEY = '__default__';

export interface MachineOffsetRecord {
  dialect: WcsDialect;
  entries: WcsEntry[];
}

type StoredOffsets = Record<string, MachineOffsetRecord>;

export function loadMachineRecord(machineKey: string): MachineOffsetRecord | undefined {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return undefined;
    return (JSON.parse(raw) as StoredOffsets)[machineKey];
  } catch { return undefined; }
}

export function saveMachineRecord(machineKey: string, record: MachineOffsetRecord): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const all: StoredOffsets = raw ? JSON.parse(raw) as StoredOffsets : {};
    all[machineKey] = record;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function loadAllMachineKeys(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return Object.keys(JSON.parse(raw) as StoredOffsets);
  } catch { return []; }
}
