/**
 * Setup Sheet PDF Generator
 *
 * Produces a single A4 PDF that combines:
 *   1. Header  — job/part name, machine, date, operator
 *   2. Work Offsets  — G54–G59 (and dialect-specific extended offsets)
 *   3. Tool List  — T# / description / Ø / OAL / Z-offset / notes, sorted by T#
 *
 * Machine-group scoped: only tools belonging to the selected machine group
 * are included, and the saved work offset record for that machine is used.
 */

import jsPDF from 'jspdf';
import type { LibraryTool } from '../types/libraryTool';
import {
  type WcsEntry, type WcsDialectInfo,
  loadMachineRecord, getDialect, defaultEntries,
} from './workOffsetSheet';

// ── Layout constants ──────────────────────────────────────────────────────────

const PAGE_W  = 210;   // A4 portrait
const PAGE_H  = 297;
const MARGIN  = 12;
const TABLE_W = PAGE_W - MARGIN * 2;

const TITLE_H  = 14;
const COL_H    =  7;   // header row
const DATA_H   =  6;   // data row
const GAP      =  6;   // gap between sections
const FOOTER_H =  7;

// ── Colour palette (matches app theme) ───────────────────────────────────────

const C_NAVY  = [30, 53, 96]   as [number, number, number];
const C_DARK  = [15, 23, 42]   as [number, number, number];
const C_SLATE = [51, 65, 85]   as [number, number, number];
const C_ROW0  = [30, 41, 59]   as [number, number, number];
const C_ROW1  = [15, 23, 42]   as [number, number, number];
const C_WHITE = [255, 255, 255] as [number, number, number];
const C_LIGHT = [148, 163, 184] as [number, number, number];
const C_BLUE  = [147, 197, 253] as [number, number, number];
const C_AMBER = [251, 191, 36]  as [number, number, number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(doc: jsPDF, text: string, maxW: number): string {
  while (text.length > 1 && doc.getTextWidth(text) > maxW) {
    text = text.slice(0, -1);
  }
  return text;
}

function fmt(n: number | undefined, decimals = 3): string {
  if (n === undefined || n === null) return '—';
  return n.toFixed(decimals);
}

function drawSectionLabel(doc: jsPDF, y: number, label: string): number {
  doc.setFillColor(...C_SLATE);
  doc.rect(MARGIN, y, TABLE_W, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...C_BLUE);
  doc.text(label, MARGIN + 2.5, y + 3.8);
  return y + 5.5;
}

function drawPageHeader(
  doc:      jsPDF,
  jobName:  string,
  machine:  string,
  operator: string,
  dateStr:  string,
  pageNum:  number,
  pageTotal: number,
): void {
  // Title bar
  doc.setFillColor(...C_NAVY);
  doc.rect(MARGIN, MARGIN, TABLE_W, TITLE_H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C_WHITE);
  doc.text('Setup Sheet', MARGIN + 3, MARGIN + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C_BLUE);
  if (jobName) doc.text(jobName, MARGIN + 3, MARGIN + 11);

  // Right-side meta
  doc.setFontSize(6.5);
  doc.setTextColor(...C_BLUE);
  const meta = [machine, operator, dateStr].filter(Boolean).join('  ·  ');
  doc.text(meta, PAGE_W - MARGIN - 2, MARGIN + 6, { align: 'right' });
  if (pageTotal > 1) {
    doc.text(`Page ${pageNum} / ${pageTotal}`, PAGE_W - MARGIN - 2, MARGIN + 11, { align: 'right' });
  }
}

function drawFooter(doc: jsPDF, pageH: number): void {
  doc.setFillColor(...C_DARK);
  doc.rect(0, pageH - FOOTER_H, PAGE_W, FOOTER_H, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...C_LIGHT);
  doc.text('CNC Tool Converter', MARGIN, pageH - 2.2);
  doc.text(new Date().toISOString().slice(0, 10), PAGE_W - MARGIN, pageH - 2.2, { align: 'right' });
}

// ── Work offset section ───────────────────────────────────────────────────────

function drawOffsets(
  doc:     jsPDF,
  entries: WcsEntry[],
  dialect: WcsDialectInfo,
  startY:  number,
): number {
  const filled = entries.filter((e) => e.name || e.x || e.y || e.z);
  if (filled.length === 0) return startY;

  const hasA = filled.some((e) => e.a);
  const hasB = filled.some((e) => e.b);

  const codeW  = 26;
  const axisW  = 22;
  const rotW   = 18;
  const fixedW = codeW + axisW * 3 + (hasA ? rotW : 0) + (hasB ? rotW : 0);
  const nameW  = TABLE_W - fixedW;

  let y = drawSectionLabel(doc, startY, `Work Offsets  (${dialect.label})`);

  // Column headers
  doc.setFillColor(...C_SLATE);
  doc.rect(MARGIN, y, TABLE_W, COL_H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...C_LIGHT);
  doc.text('OFFSET',          MARGIN + 2,            y + 4.5);
  doc.text('FIXTURE / LABEL', MARGIN + codeW + 2,    y + 4.5);
  let ax = MARGIN + codeW + nameW;
  doc.text('X', ax + axisW - 2, y + 4.5, { align: 'right' }); ax += axisW;
  doc.text('Y', ax + axisW - 2, y + 4.5, { align: 'right' }); ax += axisW;
  doc.text('Z', ax + axisW - 2, y + 4.5, { align: 'right' }); ax += axisW;
  if (hasA) { doc.text('A', ax + rotW - 2, y + 4.5, { align: 'right' }); ax += rotW; }
  if (hasB) { doc.text('B', ax + rotW - 2, y + 4.5, { align: 'right' }); }
  y += COL_H;

  // Data rows
  filled.forEach((e, i) => {
    const bg = i % 2 === 0 ? C_ROW0 : C_ROW1;
    doc.setFillColor(...bg);
    doc.rect(MARGIN, y, TABLE_W, DATA_H, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C_WHITE);
    doc.text(e.slotCode,                  MARGIN + 2,          y + 4);
    doc.text(clamp(doc, e.name, nameW - 3), MARGIN + codeW + 2, y + 4);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C_BLUE);
    let bx = MARGIN + codeW + nameW;
    doc.text(e.x || '—', bx + axisW - 2, y + 4, { align: 'right' }); bx += axisW;
    doc.text(e.y || '—', bx + axisW - 2, y + 4, { align: 'right' }); bx += axisW;
    doc.text(e.z || '—', bx + axisW - 2, y + 4, { align: 'right' }); bx += axisW;
    if (hasA) { doc.text(e.a || '—', bx + rotW - 2, y + 4, { align: 'right' }); bx += rotW; }
    if (hasB) { doc.text(e.b || '—', bx + rotW - 2, y + 4, { align: 'right' }); }
    y += DATA_H;
  });

  return y;
}

// ── Tool list section ─────────────────────────────────────────────────────────

function drawToolList(
  doc:    jsPDF,
  tools:  LibraryTool[],
  unit:   'mm' | 'inch',
  startY: number,
  pageH:  number,
  jobName:  string,
  machine:  string,
  operator: string,
  dateStr:  string,
): void {
  const sorted = [...tools].sort((a, b) => a.toolNumber - b.toolNumber);

  // Column widths
  const tNumW  = 11;
  const typeW  = 28;
  const diaW   = 18;
  const oalW   = 16;
  const zOffW  = 20;
  const descW  = TABLE_W - tNumW - typeW - diaW - oalW - zOffW;

  let y     = startY;
  let page  = 1;
  let headerNeeded = true;

  const ensureSpace = (needed: number): boolean => {
    if (y + needed > pageH - FOOTER_H - 4) {
      drawFooter(doc, pageH);
      doc.addPage();
      page++;
      drawPageHeader(doc, jobName, machine, operator, dateStr, page, 0);
      drawFooter(doc, pageH);
      y = MARGIN + TITLE_H + GAP;
      headerNeeded = true;
      return true;
    }
    return false;
  };

  ensureSpace(COL_H + DATA_H);
  y = drawSectionLabel(doc, y, 'Tool List');

  sorted.forEach((tool, i) => {
    ensureSpace(COL_H + DATA_H);

    // Draw column header row when needed
    if (headerNeeded) {
      doc.setFillColor(...C_SLATE);
      doc.rect(MARGIN, y, TABLE_W, COL_H, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...C_LIGHT);
      let hx = MARGIN;
      doc.text('T#',      hx + 2,              y + 4.5); hx += tNumW;
      doc.text('TYPE',    hx + 2,              y + 4.5); hx += typeW;
      doc.text('DESCRIPTION', hx + 2,          y + 4.5); hx += descW;
      doc.text(unit === 'mm' ? 'Ø mm' : 'Ø in', hx + diaW - 2, y + 4.5, { align: 'right' }); hx += diaW;
      doc.text(unit === 'mm' ? 'OAL mm' : 'OAL in', hx + oalW - 2, y + 4.5, { align: 'right' }); hx += oalW;
      doc.text('Z OFF',  hx + zOffW - 2, y + 4.5, { align: 'right' });
      y += COL_H;
      headerNeeded = false;
    }

    const bg = i % 2 === 0 ? C_ROW0 : C_ROW1;
    doc.setFillColor(...bg);
    doc.rect(MARGIN, y, TABLE_W, DATA_H, 'F');

    // T# (highlight by lifecycle status, matching LibraryTable badge logic)
    const lifePct = (tool.useCount != null && tool.regrindThreshold != null && tool.regrindThreshold > 0)
      ? tool.useCount / tool.regrindThreshold : 0;
    const isAtThreshold = lifePct >= 1;
    const isSoon        = !isAtThreshold && lifePct >= 0.8;
    const isOut         = !!tool.checkedOutTo;
    const tNumColor: [number, number, number] =
      isAtThreshold ? C_AMBER :
      isSoon        ? [251, 191, 80]  as [number,number,number] :  // lighter amber
      isOut         ? [251, 146, 60]  as [number,number,number] :  // orange
      C_WHITE;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...tNumColor);
    doc.text(String(tool.toolNumber), MARGIN + 2, y + 4);

    let cx = MARGIN + tNumW;

    // Type
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...C_LIGHT);
    doc.text(clamp(doc, tool.type, typeW - 3), cx + 2, y + 4);
    cx += typeW;

    // Description
    doc.setFontSize(6.5);
    doc.setTextColor(...C_WHITE);
    const desc = clamp(doc, tool.description + (tool.comment ? `  ${tool.comment}` : ''), descW - 3);
    doc.text(desc, cx + 2, y + 4);
    cx += descW;

    // Diameter
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C_BLUE);
    doc.text(fmt(tool.geometry.diameter), cx + diaW - 2, y + 4, { align: 'right' }); cx += diaW;

    // OAL
    doc.text(fmt(tool.geometry.overallLength), cx + oalW - 2, y + 4, { align: 'right' }); cx += oalW;

    // Z offset
    doc.text(fmt(tool.offsets?.z), cx + zOffW - 2, y + 4, { align: 'right' });

    y += DATA_H;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SetupSheetOptions {
  jobName:      string;
  machine:      string;   // machine name (also the work-offset record key)
  operator:     string;
  tools:        LibraryTool[];
  unit:         'mm' | 'inch';
  /** Include work offsets section (requires a saved MachineOffsetRecord) */
  includeOffsets: boolean;
}

export function generateSetupSheetPdf(opts: SetupSheetOptions): void {
  const { jobName, machine, operator, tools, unit, includeOffsets } = opts;

  const doc     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleDateString(undefined, { dateStyle: 'medium' });

  // ── Page 1 header ──────────────────────────────────────────────────────────
  drawPageHeader(doc, jobName, machine, operator, dateStr, 1, 1);
  drawFooter(doc, PAGE_H);

  let y = MARGIN + TITLE_H + GAP;

  // ── Work offsets section ───────────────────────────────────────────────────
  if (includeOffsets) {
    const record  = loadMachineRecord(machine);
    const dialect = getDialect(record?.dialect ?? 'fanuc');
    const entries = record ? defaultEntries(dialect, record.entries) : [];
    const filled  = entries.filter((e) => e.name || e.x || e.y || e.z);

    if (filled.length > 0) {
      y = drawOffsets(doc, filled, dialect, y);
      y += GAP;
    }
  }

  // ── Tool list section ──────────────────────────────────────────────────────
  drawToolList(doc, tools, unit, y, PAGE_H, jobName, machine, operator, dateStr);

  // ── Download ───────────────────────────────────────────────────────────────
  const safe = (machine || jobName || 'setup').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`setup-sheet-${safe}.pdf`);
}
