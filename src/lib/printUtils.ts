import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import { savePdfDoc } from './tauri/pdfSave';
import type { LibraryTool, ToolInstance } from '../types/libraryTool';
import { TOOL_CONDITION_LABELS } from '../types/libraryTool';
import { esc } from './stringUtils';
import { getActiveInstance } from './toolInstance';

// ── Label options ─────────────────────────────────────────────────────────────

export interface LabelOptions {
  widthMm:             number;
  heightMm:            number;
  columns:             number;
  gapMm:               number;
  showQr:              boolean;
  /** Whether to use a QR code or a 1D barcode (Code 128) */
  codeType:            'qr' | 'barcode';
  qrContent:           'id' | 'toolnumber' | 'description' | 'full';
  showTNumber:         boolean;
  showDesc:            boolean;
  showType:            boolean;
  showDiameter:        boolean;
  showFlutes:          boolean;
  showMachine:         boolean;
  showTags:            boolean;
  /** Show the active instance letter (e.g. "A") next to the T# */
  showInstanceLetter:  boolean;
  /** Replace nominal diameter with the active instance's measured actual diameter */
  useActualDiameter:   boolean;
  /**
   * How to expand tools with instances into labels:
   * - 'one'          One label per tool, using the active instance (default)
   * - 'per-instance' One label per physical copy — shows each instance's letter,
   *                  condition, actual diameter, and comment
   * - 'range'        One label per tool showing the full letter range (e.g. A–E);
   *                  intended for cases / trays that hold multiple copies
   */
  instanceMode: 'one' | 'per-instance' | 'range';
}

export const DEFAULT_LABEL_OPTIONS: LabelOptions = {
  widthMm:            62,
  heightMm:           29,
  columns:             3,
  gapMm:               2,
  showQr:             true,
  codeType:           'qr',
  qrContent:          'id',
  showTNumber:        true,
  showDesc:           true,
  showType:           true,
  showDiameter:       true,
  showFlutes:         false,
  showMachine:        false,
  showTags:           false,
  showInstanceLetter: false,
  useActualDiameter:  false,
  instanceMode:       'one',
};

// ── Code content builder ──────────────────────────────────────────────────────

/** Builds the text to encode in a QR code or barcode. */
export function buildQrText(tool: LibraryTool, mode: LabelOptions['qrContent']): string {
  switch (mode) {
    case 'id':          return tool.id;
    case 'toolnumber':  return `T${String(tool.toolNumber).padStart(3, '0')}`;
    case 'description': return `T${tool.toolNumber}: ${tool.description}`;
    case 'full':        return [
      `T${tool.toolNumber}: ${tool.description}`,
      `Type: ${tool.type}`,
      `Ø${tool.geometry.diameter}${tool.unit}`,
      tool.geometry.numberOfFlutes ? `${tool.geometry.numberOfFlutes} flutes` : '',
      (tool.machineGroups?.length ?? 0) > 0 ? `Machine: ${tool.machineGroups!.join(', ')}` : '',
    ].filter(Boolean).join('\n');
  }
}

// ── QR data URL helper ────────────────────────────────────────────────────────

export async function generateQrDataUrl(text: string, sizePx = 120): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: sizePx, errorCorrectionLevel: 'M' });
}

// ── Barcode data URL helper ───────────────────────────────────────────────────

/**
 * Generates a Code 128 barcode as a PNG data URL.
 * Synchronous — uses an off-screen canvas.
 * Returns empty string if the text is empty or rendering fails.
 */
export function generateBarcodeDataUrl(text: string, heightPx = 60): string {
  if (!text) return '';
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
      format:       'CODE128',
      width:        1,
      height:       heightPx,
      displayValue: false,
      margin:       4,
      lineColor:    '#000000',
      background:   '#ffffff',
    });
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

// ── Print labels ──────────────────────────────────────────────────────────────

/** Internal — one item to render as a label */
type LabelItem = {
  tool:     LibraryTool;
  instance: ToolInstance | undefined; // specific copy for per-instance mode
  isRange:  boolean;                  // range (case) label
};

function buildLabelItems(tools: LibraryTool[], mode: LabelOptions['instanceMode']): LabelItem[] {
  const items: LabelItem[] = [];
  for (const tool of tools) {
    const hasInstances = (tool.instances?.length ?? 0) > 0;
    if (mode === 'per-instance' && hasInstances) {
      for (const inst of tool.instances!) {
        items.push({ tool, instance: inst, isRange: false });
      }
    } else if (mode === 'range' && hasInstances) {
      items.push({ tool, instance: undefined, isRange: true });
    } else {
      items.push({ tool, instance: undefined, isRange: false });
    }
  }
  return items;
}

export function countLabels(tools: LibraryTool[], mode: LabelOptions['instanceMode']): number {
  return buildLabelItems(tools, mode).length;
}

export async function printLabels(tools: LibraryTool[], opts: LabelOptions): Promise<void> {
  // Open window immediately (before any awaits) to avoid popup blockers
  const win = window.open('', '_blank');
  if (!win) { alert('Could not open print window — check your popup blocker.'); return; }
  win.document.write('<html><head><title>Tool Labels</title></head><body style="font-family:sans-serif;padding:8mm">Generating labels…</body></html>');
  win.document.close();

  // Font sizes scale with label height (29mm is the reference at 7/6/5.5pt)
  const fontScale  = opts.heightMm / 29;
  const fTnum  = (7   * fontScale).toFixed(1);
  const fDesc  = (6   * fontScale).toFixed(1);
  const fField = (5.5 * fontScale).toFixed(1);

  // QR display size: fit within both label dimensions (leave ~3mm padding on each axis)
  const qrDisplayMm = Math.max(4, Math.min(opts.heightMm - 5, opts.widthMm * 0.45 - 3));
  // Generate at ≥180px so the QR is always scannable regardless of label size
  const qrSizePx = Math.max(180, Math.round(qrDisplayMm * 3.78));

  // Expand tools into per-label items
  const items = buildLabelItems(tools, opts.instanceMode);

  const useBarcode = opts.showQr && opts.codeType === 'barcode';
  const barcodeHeightMm = Math.max(6, opts.heightMm * 0.28);

  const qrUrls = opts.showQr
    ? useBarcode
      ? items.map(({ tool }) => generateBarcodeDataUrl(buildQrText(tool, opts.qrContent), 80))
      : await Promise.all(items.map(({ tool }) => generateQrDataUrl(buildQrText(tool, opts.qrContent), qrSizePx)))
    : items.map(() => '');

  const labelCells = items.map(({ tool, instance, isRange }, i) => {
    const qr = qrUrls[i];

    // ── Range (case) label ────────────────────────────────────────────────────
    if (isRange) {
      const instances  = tool.instances!;
      const first      = instances[0].letter;
      const last       = instances[instances.length - 1].letter;
      const rangeText  = first === last ? first : `${first}–${last}`;
      const countText  = instances.length > 1 ? ` · ${instances.length}\u202fpcs` : '';
      const infoLines: string[] = [];
      if (opts.showTNumber) infoLines.push(`<div class="tnum">T${tool.toolNumber}</div>`);
      infoLines.push(`<div class="range">${rangeText}${countText}</div>`);
      if (opts.showDesc)    infoLines.push(`<div class="desc">${esc(tool.description)}</div>`);
      if (opts.showType)    infoLines.push(`<div class="field">${esc(tool.type)}</div>`);
      const nomDiam = tool.geometry.diameter;
      if (opts.showDiameter) infoLines.push(`<div class="field">Ø${nomDiam}&nbsp;${tool.unit}</div>`);
      if (opts.showFlutes && tool.geometry.numberOfFlutes)
                            infoLines.push(`<div class="field">${tool.geometry.numberOfFlutes} flutes</div>`);
      if (opts.showMachine && (tool.machineGroups?.length ?? 0) > 0)
                            infoLines.push(`<div class="field">${esc(tool.machineGroups!.join(', '))}</div>`);
      if (opts.showTags && tool.tags.length)
                            infoLines.push(`<div class="field tags">${tool.tags.map(esc).join(' · ')}</div>`);
      return useBarcode
        ? `<div class="label barcode-label">
            <div class="info">${infoLines.join('')}</div>
            ${opts.showQr && qr ? `<img class="barcode" src="${qr}" alt="" />` : ''}
          </div>`
        : `<div class="label">
            ${opts.showQr && qr ? `<img class="qr" src="${qr}" alt="" />` : ''}
            <div class="info">${infoLines.join('')}</div>
          </div>`;
    }

    // ── Per-instance or normal label ──────────────────────────────────────────
    const activeInst    = instance ?? getActiveInstance(tool);
    const displayDiam   = opts.useActualDiameter && activeInst?.actualDiameter != null
      ? activeInst.actualDiameter
      : tool.geometry.diameter;
    // In per-instance mode always show the letter; otherwise respect showInstanceLetter
    const letterSuffix  = instance
      ? `-${instance.letter}`
      : (opts.showInstanceLetter && activeInst ? `-${activeInst.letter}` : '');

    const infoLines: string[] = [];
    if (opts.showTNumber)  infoLines.push(`<div class="tnum">T${tool.toolNumber}${letterSuffix}</div>`);
    if (opts.showDesc)     infoLines.push(`<div class="desc">${esc(tool.description)}</div>`);
    if (opts.showType)     infoLines.push(`<div class="field">${esc(tool.type)}</div>`);
    if (opts.showDiameter) infoLines.push(`<div class="field">Ø${displayDiam}&nbsp;${tool.unit}${opts.useActualDiameter && activeInst?.actualDiameter != null ? ' <span class="actual">(actual)</span>' : ''}</div>`);
    if (opts.showFlutes && tool.geometry.numberOfFlutes)
                           infoLines.push(`<div class="field">${tool.geometry.numberOfFlutes} flutes</div>`);
    if (opts.showMachine && (tool.machineGroups?.length ?? 0) > 0)
                           infoLines.push(`<div class="field">${esc(tool.machineGroups!.join(', '))}</div>`);
    if (opts.showTags && tool.tags.length)
                           infoLines.push(`<div class="field tags">${tool.tags.map(esc).join(' · ')}</div>`);
    // Per-instance extras: condition + comment from the specific copy
    if (instance?.condition) infoLines.push(`<div class="field inst">${esc(TOOL_CONDITION_LABELS[instance.condition as keyof typeof TOOL_CONDITION_LABELS])}</div>`);
    if (instance?.comment)   infoLines.push(`<div class="field inst">${esc(instance.comment)}</div>`);

    return useBarcode
      ? `<div class="label barcode-label">
          <div class="info">${infoLines.join('')}</div>
          ${opts.showQr && qr ? `<img class="barcode" src="${qr}" alt="" />` : ''}
        </div>`
      : `<div class="label">
          ${opts.showQr && qr ? `<img class="qr" src="${qr}" alt="" />` : ''}
          <div class="info">${infoLines.join('')}</div>
        </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Tool Labels</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
.grid {
  display: grid;
  grid-template-columns: repeat(${opts.columns}, ${opts.widthMm}mm);
  gap: ${opts.gapMm}mm;
  padding: 6mm;
}
.label {
  width: ${opts.widthMm}mm;
  height: ${opts.heightMm}mm;
  border: 0.3mm solid #aaa;
  border-radius: 1.2mm;
  display: flex;
  align-items: center;
  padding: 1.5mm;
  gap: 1.5mm;
  overflow: hidden;
  page-break-inside: avoid;
}
.qr  { width: ${qrDisplayMm}mm; height: ${qrDisplayMm}mm; flex-shrink: 0; image-rendering: crisp-edges; }
.barcode-label { flex-direction: column; align-items: stretch; padding: 1mm 1.5mm 0.8mm; gap: 0.5mm; }
.barcode { width: 100%; height: ${barcodeHeightMm}mm; object-fit: fill; flex-shrink: 0; image-rendering: crisp-edges; }
.info { flex: 1; min-width: 0; overflow: hidden; }
.tnum { font-size: ${fTnum}pt; font-weight: bold; color: #1a4db8; font-family: monospace; white-space: nowrap; }
.desc { font-size: ${fDesc}pt; font-weight: 600; color: #111; line-height: 1.25; margin: 0.4mm 0; word-break: break-word; }
.field { font-size: ${fField}pt; color: #444; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tags   { color: #666; }
.actual { color: #888; font-style: italic; }
.range  { font-size: ${fTnum}pt; font-weight: bold; color: #0d7377; font-family: monospace; white-space: nowrap; letter-spacing: 0.3px; }
.inst   { color: #555; font-style: italic; }
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 0; }
}
</style></head>
<body><div class="grid">${labelCells}</div>
<script>window.onload = () => { setTimeout(() => window.print(), 200); }<\/script>
</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ── Sheet options ─────────────────────────────────────────────────────────────

export interface SheetOptions {
  columns:          1 | 2 | 3;
  showGeometry:     boolean;
  showCutting:      boolean;
  showMaterial:     boolean;
  showMachineGroup: boolean;
  showTags:         boolean;
  showManufacturer: boolean;
  showComment:      boolean;
  showCrib:         boolean;
  /** Include a section listing each instance's letter, condition, actual Ø, comment */
  showInstances:    boolean;
  /** Replace nominal diameter with the active instance's measured actual diameter */
  useActualDiameter: boolean;
}

export const DEFAULT_SHEET_OPTIONS: SheetOptions = {
  columns:           2,
  showGeometry:      true,
  showCutting:       true,
  showMaterial:      true,
  showMachineGroup:  true,
  showTags:          true,
  showManufacturer:  true,
  showComment:       true,
  showCrib:          true,
  showInstances:     true,
  useActualDiameter: false,
};

// ── PDF tool sheet ────────────────────────────────────────────────────────────
//
// Generates a real PDF file (direct download, no browser print dialog).
// Cards are placed with explicit position tracking so they are never split.

type SheetRow =
  | { kind: 'section'; label: string }
  | { kind: 'data';    label: string; value: string; idx: number };

function buildPdfRows(tool: LibraryTool, opts: SheetOptions): SheetRow[] {
  const out: SheetRow[] = [];
  const geo = tool.geometry;
  const cut = tool.cutting ?? {};
  let idx = 0;

  function row(label: string, value: string) {
    out.push({ kind: 'data', label, value, idx: idx++ });
  }
  function section(label: string) {
    out.push({ kind: 'section', label });
  }

  // Resolve diameter — use active instance's actual diameter if requested
  const active       = getActiveInstance(tool);
  const displayDiam  = opts.useActualDiameter && active?.actualDiameter != null
    ? active.actualDiameter
    : geo.diameter;
  const diamLabel    = opts.useActualDiameter && active?.actualDiameter != null ? 'Ø (actual)' : 'Ø';

  // Basic (always shown)
  row('Type', tool.type);
  row(diamLabel, `${displayDiam}\u202f${tool.unit}`);
  if (opts.showGeometry) {
    if (geo.overallLength  != null) row('OAL',      `${geo.overallLength}\u202f${tool.unit}`);
    if (geo.fluteLength    != null) row('Flute L',  `${geo.fluteLength}\u202f${tool.unit}`);
    if (geo.bodyLength     != null) row('Body L',   `${geo.bodyLength}\u202f${tool.unit}`);
    if (geo.shoulderLength != null) row('Shoulder', `${geo.shoulderLength}\u202f${tool.unit}`);
    if (geo.shaftDiameter  != null) row('Shaft Ø',  `${geo.shaftDiameter}\u202f${tool.unit}`);
    if (geo.numberOfFlutes != null) row('Flutes',   String(geo.numberOfFlutes));
    if (geo.cornerRadius   != null) row('Corner R', `${geo.cornerRadius}\u202f${tool.unit}`);
    if (geo.taperAngle     != null) row('Taper',    `${geo.taperAngle}°`);
    if (geo.tipDiameter    != null) row('Tip Ø',    `${geo.tipDiameter}\u202f${tool.unit}`);
    if (geo.threadPitch    != null) row('Pitch',    `${geo.threadPitch}\u202f${tool.unit}`);
  }

  if (opts.showMaterial && tool.material) {
    section('Material');
    row('Material', tool.material);
  }

  if (opts.showCutting) {
    const before = out.length;
    if (cut.spindleRpm  != null) row('RPM',          cut.spindleRpm.toLocaleString());
    if (cut.feedCutting != null) row('Feed (cut)',   `${cut.feedCutting}`);
    if (cut.feedPlunge  != null) row('Feed (plunge)',`${cut.feedPlunge}`);
    if (cut.feedRamp    != null) row('Feed (ramp)',  `${cut.feedRamp}`);
    if (cut.coolant)             row('Coolant',       cut.coolant);
    if (out.length > before)     out.splice(before, 0, { kind: 'section', label: 'Cutting' });
  }

  const cribBefore = out.length;
  if (opts.showCrib) {
    if (tool.quantity         != null) row('Qty on Hand', String(tool.quantity));
    if (tool.reorderPoint     != null) row('Reorder At',  String(tool.reorderPoint));
    if (tool.supplier)                 row('Supplier',    tool.supplier);
    if (tool.unitCost         != null) row('Unit Cost',   String(tool.unitCost));
    if (tool.location)                 row('Location',    tool.location);
    if (tool.holderId)                 row('Holder ID',   tool.holderId);
    if (tool.assemblyStickOut != null) row('Stick-Out',   `${tool.assemblyStickOut}\u202f${tool.unit}`);
  }
  if (out.length > cribBefore) out.splice(cribBefore, 0, { kind: 'section', label: 'Crib' });

  const metaBefore = out.length;
  if (opts.showMachineGroup  && (tool.machineGroups?.length ?? 0) > 0)  row('Machine',  tool.machineGroups!.join(', '));
  if (opts.showTags          && tool.tags.length)   row('Tags',     tool.tags.join(', '));
  if (opts.showManufacturer  && tool.manufacturer)  row('Make',     tool.manufacturer);
  if (opts.showManufacturer  && tool.productId)     row('Prod. ID', tool.productId);
  if (opts.showComment       && tool.comment)       row('Notes',    tool.comment);
  if (out.length > metaBefore) out.splice(metaBefore, 0, { kind: 'section', label: 'Info' });

  if (opts.showInstances && (tool.instances?.length ?? 0) > 0) {
    section('Instances');
    for (const inst of tool.instances!) {
      const parts: string[] = [];
      if (inst.isActive)             parts.push('ACTIVE');
      if (inst.condition)            parts.push(TOOL_CONDITION_LABELS[inst.condition]);
      if (inst.actualDiameter != null) parts.push(`Ø${inst.actualDiameter}\u202f${tool.unit}`);
      if (inst.offsets?.z != null)   parts.push(`Z${inst.offsets.z}`);
      if (inst.comment)              parts.push(inst.comment);
      row(inst.letter, parts.join('  ·  ') || '—');
    }
  }

  return out;
}

const PDF_ROW_H     = 4.2;   // mm — data row height
const PDF_SECTION_H = 3.2;   // mm — section divider height
const PDF_HEADER_H  = 6.5;   // mm — card header height
const PDF_CARD_PAD  = 0.8;   // mm — extra padding below last row

const PDF_PHOTO_H = 16; // mm — photo strip height when present

function pdfCardHeight(rows: SheetRow[], hasPhoto = false): number {
  return (hasPhoto ? PDF_PHOTO_H : 0) + PDF_HEADER_H +
    rows.reduce((s, r) => s + (r.kind === 'section' ? PDF_SECTION_H : PDF_ROW_H), 0) +
    PDF_CARD_PAD;
}

function clampText(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '\u2026') > maxW) t = t.slice(0, -1);
  return t + '\u2026';
}

function drawPageHeader(doc: jsPDF, count: number, date: string, pageW: number, margin: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.text(`Tool Sheet \u2014 ${count} tool${count !== 1 ? 's' : ''}`, margin, margin + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(date, pageW - margin, margin + 4, { align: 'right' });
}

export async function generateToolSheetPdf(tools: LibraryTool[], opts: SheetOptions): Promise<void> {
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W   = 210;
  const PAGE_H   = 297;
  const MARGIN   = 8;
  const COLS     = opts.columns;
  const GAP_X    = 3;
  const GAP_Y    = 3;
  const LABEL_RATIO = 0.38;
  const cardW    = (PAGE_W - 2 * MARGIN - GAP_X * (COLS - 1)) / COLS;
  const labelW   = cardW * LABEL_RATIO;
  const contentY = MARGIN + 8;  // below page header
  const date     = new Date().toLocaleDateString();

  drawPageHeader(doc, tools.length, date, PAGE_W, MARGIN);

  let col = 0;
  let y   = contentY;

  for (const tool of tools) {
    const rows     = buildPdfRows(tool, opts);
    const hasPhoto = !!tool.imageBase64;
    const cardH    = pdfCardHeight(rows, hasPhoto);

    // Move to next column or new page if card doesn't fit
    if (y + cardH > PAGE_H - MARGIN) {
      col++;
      y = contentY;
      if (col >= COLS) {
        col = 0;
        doc.addPage();
        drawPageHeader(doc, tools.length, date, PAGE_W, MARGIN);
      }
    }

    const x = MARGIN + col * (cardW + GAP_X);

    // ── Card border ───────────────────────────────────────────────────────
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardW, cardH, 0.8, 0.8, 'S');  // cardH already includes PDF_PHOTO_H

    // ── Tool photo (optional image strip above card) ───────────────────
    if (hasPhoto && tool.imageBase64) {
      const imgFormat = tool.imageBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(tool.imageBase64, imgFormat, x, y, cardW, PDF_PHOTO_H, undefined, 'FAST');
      doc.setDrawColor(190, 190, 190);
      doc.setLineWidth(0.2);
      doc.line(x, y + PDF_PHOTO_H, x + cardW, y + PDF_PHOTO_H);
    }

    // ── Card header ───────────────────────────────────────────────────────
    const hdrY = y + (hasPhoto ? PDF_PHOTO_H : 0);
    doc.setFillColor(30, 53, 96);
    doc.roundedRect(x, hdrY, cardW, PDF_HEADER_H, 0.8, 0.8, 'F');
    doc.rect(x, hdrY + PDF_HEADER_H - 1.5, cardW, 1.5, 'F'); // square off bottom corners

    // T#
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(147, 197, 253);
    const tLabel = `T${tool.toolNumber}`;
    doc.text(tLabel, x + 2, hdrY + PDF_HEADER_H - 1.8);
    const tLabelW = doc.getTextWidth(tLabel) + 2.5;

    // Pocket number (right-aligned)
    let pLabelW = 2;
    if (tool.pocketNumber != null) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      const pLabel = `P${tool.pocketNumber}`;
      doc.text(pLabel, x + cardW - 2, hdrY + PDF_HEADER_H - 1.8, { align: 'right' });
      pLabelW = doc.getTextWidth(pLabel) + 3;
    }

    // Description
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    const descMaxW = cardW - tLabelW - pLabelW;
    doc.text(clampText(doc, tool.description, descMaxW), x + tLabelW, hdrY + PDF_HEADER_H - 1.8);

    // ── Data rows ─────────────────────────────────────────────────────────
    let ry = hdrY + PDF_HEADER_H;

    for (const row of rows) {
      if (row.kind === 'section') {
        doc.setFillColor(237, 241, 249);
        doc.rect(x, ry, cardW, PDF_SECTION_H, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(4.5);
        doc.setTextColor(107, 135, 187);
        doc.text(row.label.toUpperCase(), x + 2, ry + PDF_SECTION_H - 0.9);
        ry += PDF_SECTION_H;
      } else {
        if (row.idx % 2 === 1) {
          doc.setFillColor(245, 247, 251);
          doc.rect(x, ry, cardW, PDF_ROW_H, 'F');
        }
        // Label/value divider
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(x + labelW, ry, x + labelW, ry + PDF_ROW_H);

        const textY = ry + PDF_ROW_H - 1.2;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(85, 85, 85);
        doc.text(row.label, x + 1.5, textY);

        doc.setFont('courier', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(17, 17, 17);
        const valMaxW = cardW - labelW - 2.5;
        doc.text(clampText(doc, row.value, valMaxW), x + labelW + 1.5, textY);

        ry += PDF_ROW_H;
      }
    }

    y += cardH + GAP_Y;
  }

  await savePdfDoc(doc, `tool-sheet-${new Date().toISOString().slice(0, 10)}.pdf`);
}


