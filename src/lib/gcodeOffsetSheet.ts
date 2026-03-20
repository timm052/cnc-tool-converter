/**
 * Tool Offset Sheet
 *
 * Generates a reference card (PDF or TXT) listing every tool's T number,
 * type, diameter, Z-offset, flute count and description.
 * Formatted for taping to a machine or pasting into a G-code program header.
 */

import jsPDF from 'jspdf';
import type { LibraryTool } from '../types/libraryTool';
import { getActiveInstance } from './toolInstance';
import { savePdfDoc } from './tauri/pdfSave';
import { triggerDownload } from './downloadUtils';

// ── Options ────────────────────────────────────────────────────────────────────

export interface ToolOffsetOptions {
  showType:          boolean;
  showDiameter:      boolean;
  showZOffset:       boolean;
  showFlutes:        boolean;
  showMachine:       boolean;
  sortBy:            'toolNumber' | 'description';
  useActualDiameter: boolean;
}

export const DEFAULT_TOOL_OFFSET_OPTIONS: ToolOffsetOptions = {
  showType:          true,
  showDiameter:      true,
  showZOffset:       true,
  showFlutes:        true,
  showMachine:       false,
  sortBy:            'toolNumber',
  useActualDiameter: false,
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

function sortTools(tools: LibraryTool[], opts: ToolOffsetOptions): LibraryTool[] {
  const copy = [...tools];
  if (opts.sortBy === 'description') {
    copy.sort((a, b) => a.description.localeCompare(b.description));
  } else {
    copy.sort((a, b) => a.toolNumber - b.toolNumber);
  }
  return copy;
}

function resolveRow(t: LibraryTool, opts: ToolOffsetOptions) {
  const active = getActiveInstance(t);
  const dp     = t.unit === 'inch' ? 4 : 3;
  const unitStr = t.unit === 'inch' ? '"' : 'mm';

  const displayDiam = opts.useActualDiameter && active?.actualDiameter != null
    ? active.actualDiameter
    : t.geometry?.diameter;

  return {
    tnum:    `T${String(t.toolNumber).padStart(3, '0')}`,
    type:    t.type || '—',
    diam:    displayDiam != null ? `${displayDiam.toFixed(dp)}${unitStr}` : '—',
    zoff:    t.offsets?.z != null ? `${t.offsets.z.toFixed(dp)}${unitStr}` : `0.${'0'.repeat(dp)}${unitStr}`,
    flutes:  t.geometry?.numberOfFlutes != null ? String(t.geometry.numberOfFlutes) : '—',
    desc:    t.description || t.type || '—',
    machine: (t.machineGroups?.length ?? 0) > 0 ? t.machineGroups!.join(', ') : '',
  };
}

// ── TXT export ─────────────────────────────────────────────────────────────────

export function buildOffsetTxt(tools: LibraryTool[], opts: ToolOffsetOptions): string {
  if (tools.length === 0) return '';
  const sorted = sortTools(tools, opts);
  const date   = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const lines: string[] = [
    `; CNC Tool Offset Reference Sheet`,
    `; Generated: ${date}`,
    `; ${tools.length} tool${tools.length !== 1 ? 's' : ''}`,
    ';',
  ];

  // Column widths
  const W = { tnum: 6, type: 16, diam: 14, zoff: 14, fl: 4, desc: 38, machine: 22 };

  const hdr = [
    `; ${'T#'.padEnd(W.tnum)}`,
    opts.showType     ? `  ${'Type'.padEnd(W.type)}`     : '',
    opts.showDiameter ? `  ${'Diameter'.padEnd(W.diam)}` : '',
    opts.showZOffset  ? `  ${'Z-Offset'.padEnd(W.zoff)}` : '',
    opts.showFlutes   ? `  ${'Fl'.padEnd(W.fl)}`         : '',
    `  Description`,
    opts.showMachine  ? `  Machine` : '',
  ].join('');
  lines.push(hdr);
  lines.push(`; ${'─'.repeat(hdr.length - 2)}`);

  for (const t of sorted) {
    const r = resolveRow(t, opts);
    const row = [
      r.tnum.padEnd(W.tnum),
      opts.showType     ? `  ${r.type.slice(0, W.type).padEnd(W.type)}`     : '',
      opts.showDiameter ? `  ${r.diam.padEnd(W.diam)}`                      : '',
      opts.showZOffset  ? `  ${r.zoff.padEnd(W.zoff)}`                      : '',
      opts.showFlutes   ? `  ${r.flutes.padEnd(W.fl)}`                      : '',
      `  ${r.desc.replace(/[^\x20-\x7E]/g, '').slice(0, W.desc)}`,
      opts.showMachine && r.machine ? `  ${r.machine.slice(0, W.machine)}` : '',
    ].join('');
    lines.push(row);
  }

  lines.push('');
  return lines.join('\n');
}

export async function downloadOffsetTxt(tools: LibraryTool[], opts: ToolOffsetOptions): Promise<void> {
  const content = buildOffsetTxt(tools, opts);
  if (!content) return;
  const date = new Date().toISOString().slice(0, 10);
  await triggerDownload(content, 'text/plain', `tool-offsets-${date}.txt`);
}

// ── PDF export ─────────────────────────────────────────────────────────────────

export async function generateOffsetPdf(tools: LibraryTool[], opts: ToolOffsetOptions): Promise<void> {
  if (tools.length === 0) return;
  const sorted = sortTools(tools, opts);

  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 10;
  const tableW = PAGE_W - MARGIN * 2;
  const date   = new Date().toLocaleDateString();

  // Build column definitions — description fills remaining space
  type Col = { key: keyof ReturnType<typeof resolveRow>; label: string; width: number; align?: 'right' };
  const cols: Col[] = [{ key: 'tnum', label: 'T#', width: 13 }];
  if (opts.showType)    cols.push({ key: 'type',    label: 'Type',      width: 26 });
  if (opts.showDiameter)cols.push({ key: 'diam',    label: 'Diameter',  width: 22, align: 'right' });
  if (opts.showZOffset) cols.push({ key: 'zoff',    label: 'Z-Offset',  width: 22, align: 'right' });
  if (opts.showFlutes)  cols.push({ key: 'flutes',  label: 'Fl',        width: 10, align: 'right' });
  if (opts.showMachine) cols.push({ key: 'machine', label: 'Machine',   width: 28 });
  const fixedW = cols.reduce((s, c) => s + c.width, 0);
  cols.splice(cols.length - (opts.showMachine ? 1 : 0), 0,
    { key: 'desc', label: 'Description', width: tableW - fixedW });

  const ROW_H = 5.5;
  const HDR_H = 6.5;
  let y       = MARGIN + 8;

  function clamp(doc: jsPDF, text: string, maxW: number): string {
    if (doc.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 1 && doc.getTextWidth(t + '\u2026') > maxW) t = t.slice(0, -1);
    return t + '\u2026';
  }

  function drawPageHeader() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(`Tool Offset Sheet \u2014 ${tools.length} tool${tools.length !== 1 ? 's' : ''}`, MARGIN, MARGIN + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(date, PAGE_W - MARGIN, MARGIN + 4, { align: 'right' });
  }

  function drawTableHeader() {
    doc.setFillColor(30, 53, 96);
    doc.rect(MARGIN, y, tableW, HDR_H, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(200, 220, 255);
    let x = MARGIN;
    for (const col of cols) {
      const pad = 1.5;
      const tx  = col.align === 'right' ? x + col.width - pad : x + pad;
      doc.text(col.label.toUpperCase(), tx, y + HDR_H - 1.8, { align: col.align ?? 'left' });
      x += col.width;
    }
    y += HDR_H;
  }

  drawPageHeader();
  drawTableHeader();

  let rowIdx = 0;
  for (const t of sorted) {
    if (y + ROW_H > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN + 8;
      drawPageHeader();
      rowIdx = 0;
      drawTableHeader();
    }

    if (rowIdx % 2 === 1) {
      doc.setFillColor(245, 247, 251);
      doc.rect(MARGIN, y, tableW, ROW_H, 'F');
    }

    const r = resolveRow(t, opts);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(17, 17, 17);

    let x = MARGIN;
    for (const col of cols) {
      const text  = String(r[col.key] ?? '—');
      const pad   = 1.5;
      const maxW  = col.width - pad * 2;
      const tx    = col.align === 'right' ? x + col.width - pad : x + pad;
      doc.text(clamp(doc, text, maxW), tx, y + ROW_H - 1.5, { align: col.align ?? 'left' });
      x += col.width;
    }

    // Row divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.1);
    doc.line(MARGIN, y + ROW_H, PAGE_W - MARGIN, y + ROW_H);

    y += ROW_H;
    rowIdx++;
  }

  const fileDate = new Date().toISOString().slice(0, 10);
  await savePdfDoc(doc, `tool-offsets-${fileDate}.pdf`);
}

// ── Legacy direct-download (kept for backwards compat if called elsewhere) ─────

/** @deprecated Use the ToolOffsetSheetPanel instead */
export function downloadGcodeOffsetSheet(tools: LibraryTool[]) {
  void downloadOffsetTxt(tools, DEFAULT_TOOL_OFFSET_OPTIONS);
}
