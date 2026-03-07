import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import type { LibraryTool } from '../types/libraryTool';

// ── Label options ─────────────────────────────────────────────────────────────

export interface LabelOptions {
  widthMm:      number;
  heightMm:     number;
  columns:      number;
  gapMm:        number;
  showQr:       boolean;
  qrContent:    'id' | 'description' | 'full';
  showTNumber:  boolean;
  showDesc:     boolean;
  showType:     boolean;
  showDiameter: boolean;
  showFlutes:   boolean;
  showMachine:  boolean;
  showTags:     boolean;
}

export const DEFAULT_LABEL_OPTIONS: LabelOptions = {
  widthMm:      62,
  heightMm:     29,
  columns:       3,
  gapMm:         2,
  showQr:       true,
  qrContent:    'full',
  showTNumber:  true,
  showDesc:     true,
  showType:     true,
  showDiameter: true,
  showFlutes:   false,
  showMachine:  false,
  showTags:     false,
};

// ── QR content builder ────────────────────────────────────────────────────────

export function buildQrText(tool: LibraryTool, mode: LabelOptions['qrContent']): string {
  switch (mode) {
    case 'id':          return tool.id;
    case 'description': return `T${tool.toolNumber}: ${tool.description}`;
    case 'full':        return [
      `T${tool.toolNumber}: ${tool.description}`,
      `Type: ${tool.type}`,
      `Ø${tool.geometry.diameter}${tool.unit}`,
      tool.geometry.numberOfFlutes ? `${tool.geometry.numberOfFlutes} flutes` : '',
      tool.machineGroup ? `Machine: ${tool.machineGroup}` : '',
    ].filter(Boolean).join('\n');
  }
}

// ── QR data URL helper ────────────────────────────────────────────────────────

export async function generateQrDataUrl(text: string, sizePx = 120): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: sizePx, errorCorrectionLevel: 'M' });
}

// ── Print labels ──────────────────────────────────────────────────────────────

export async function printLabels(tools: LibraryTool[], opts: LabelOptions): Promise<void> {
  // Open window immediately (before any awaits) to avoid popup blockers
  const win = window.open('', '_blank');
  if (!win) { alert('Could not open print window — check your popup blocker.'); return; }
  win.document.write('<html><head><title>Tool Labels</title></head><body style="font-family:sans-serif;padding:8mm">Generating labels…</body></html>');
  win.document.close();

  const qrSizePx = Math.round((opts.heightMm - 6) * 3.78); // mm → px at 96dpi

  const qrUrls = opts.showQr
    ? await Promise.all(tools.map((t) => generateQrDataUrl(buildQrText(t, opts.qrContent), qrSizePx)))
    : tools.map(() => '');

  const labelCells = tools.map((tool, i) => {
    const qr = qrUrls[i];
    const infoLines: string[] = [];
    if (opts.showTNumber)  infoLines.push(`<div class="tnum">T${tool.toolNumber}</div>`);
    if (opts.showDesc)     infoLines.push(`<div class="desc">${esc(tool.description)}</div>`);
    if (opts.showType)     infoLines.push(`<div class="field">${esc(tool.type)}</div>`);
    if (opts.showDiameter) infoLines.push(`<div class="field">Ø${tool.geometry.diameter}&nbsp;${tool.unit}</div>`);
    if (opts.showFlutes && tool.geometry.numberOfFlutes)
                           infoLines.push(`<div class="field">${tool.geometry.numberOfFlutes} flutes</div>`);
    if (opts.showMachine && tool.machineGroup)
                           infoLines.push(`<div class="field">${esc(tool.machineGroup)}</div>`);
    if (opts.showTags && tool.tags.length)
                           infoLines.push(`<div class="field tags">${tool.tags.map(esc).join(' · ')}</div>`);

    return `<div class="label">
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
.qr  { width: ${opts.heightMm - 5}mm; height: ${opts.heightMm - 5}mm; flex-shrink: 0; image-rendering: pixelated; }
.info { flex: 1; min-width: 0; overflow: hidden; }
.tnum { font-size: 7pt; font-weight: bold; color: #1a4db8; font-family: monospace; white-space: nowrap; }
.desc { font-size: 6pt; font-weight: 600; color: #111; line-height: 1.25; margin: 0.4mm 0; word-break: break-word; }
.field { font-size: 5.5pt; color: #444; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tags { color: #666; }
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
  columns:         1 | 2 | 3;
  showGeometry:    boolean;
  showCutting:     boolean;
  showMaterial:    boolean;
  showMachineGroup: boolean;
  showTags:        boolean;
  showManufacturer: boolean;
  showComment:     boolean;
}

export const DEFAULT_SHEET_OPTIONS: SheetOptions = {
  columns:          2,
  showGeometry:     true,
  showCutting:      true,
  showMaterial:     true,
  showMachineGroup: true,
  showTags:         true,
  showManufacturer: true,
  showComment:      true,
};

// ── Print tool sheet ──────────────────────────────────────────────────────────

export function printToolSheet(tools: LibraryTool[], opts: SheetOptions = DEFAULT_SHEET_OPTIONS): void {
  const cards = tools.map((tool) => {
    const geo = tool.geometry;
    const cut = tool.cutting ?? {};

    type Row = [string, string];
    type Section = { header: string; rows: Row[] };
    const sections: Section[] = [];

    // ── Basic (always shown) ───────────────────────────────────────────────
    const basicRows: Row[] = [['Type', tool.type], ['Ø', `${geo.diameter}\u202f${tool.unit}`]];
    if (opts.showGeometry) {
      if (geo.overallLength  != null) basicRows.push(['OAL',      `${geo.overallLength}\u202f${tool.unit}`]);
      if (geo.fluteLength    != null) basicRows.push(['Flute L',  `${geo.fluteLength}\u202f${tool.unit}`]);
      if (geo.bodyLength     != null) basicRows.push(['Body L',   `${geo.bodyLength}\u202f${tool.unit}`]);
      if (geo.shoulderLength != null) basicRows.push(['Shoulder', `${geo.shoulderLength}\u202f${tool.unit}`]);
      if (geo.shaftDiameter  != null) basicRows.push(['Shaft Ø',  `${geo.shaftDiameter}\u202f${tool.unit}`]);
      if (geo.numberOfFlutes != null) basicRows.push(['Flutes',   String(geo.numberOfFlutes)]);
      if (geo.cornerRadius   != null) basicRows.push(['Corner R', `${geo.cornerRadius}\u202f${tool.unit}`]);
      if (geo.taperAngle     != null) basicRows.push(['Taper',    `${geo.taperAngle}°`]);
      if (geo.tipDiameter    != null) basicRows.push(['Tip Ø',    `${geo.tipDiameter}\u202f${tool.unit}`]);
      if (geo.threadPitch    != null) basicRows.push(['Pitch',    `${geo.threadPitch}\u202f${tool.unit}`]);
    }
    sections.push({ header: '', rows: basicRows });

    // ── Material ───────────────────────────────────────────────────────────
    if (opts.showMaterial && tool.material) {
      sections.push({ header: 'Material', rows: [['Material', tool.material]] });
    }

    // ── Cutting ────────────────────────────────────────────────────────────
    if (opts.showCutting) {
      const rows: Row[] = [];
      if (cut.spindleRpm  != null) rows.push(['RPM',         cut.spindleRpm.toLocaleString()]);
      if (cut.feedCutting != null) rows.push(['Feed (cut)',   `${cut.feedCutting}`]);
      if (cut.feedPlunge  != null) rows.push(['Feed (plunge)',`${cut.feedPlunge}`]);
      if (cut.feedRamp    != null) rows.push(['Feed (ramp)',  `${cut.feedRamp}`]);
      if (cut.coolant)             rows.push(['Coolant',       cut.coolant]);
      if (rows.length) sections.push({ header: 'Cutting', rows });
    }

    // ── Meta ───────────────────────────────────────────────────────────────
    const metaRows: Row[] = [];
    if (opts.showMachineGroup  && tool.machineGroup)  metaRows.push(['Machine',  tool.machineGroup]);
    if (opts.showTags          && tool.tags.length)   metaRows.push(['Tags',     tool.tags.join(', ')]);
    if (opts.showManufacturer  && tool.manufacturer)  metaRows.push(['Make',     tool.manufacturer]);
    if (opts.showManufacturer  && tool.productId)     metaRows.push(['Prod. ID', tool.productId]);
    if (opts.showComment       && tool.comment)       metaRows.push(['Notes',    tool.comment]);
    if (metaRows.length) sections.push({ header: 'Info', rows: metaRows });

    const bodyHtml = sections.map((sec) => {
      const header = sec.header
        ? `<tr class="sh"><td colspan="2">${esc(sec.header)}</td></tr>`
        : '';
      const rows = sec.rows
        .map(([l, v]) => `<tr><td class="fl">${esc(l)}</td><td class="fv">${esc(v)}</td></tr>`)
        .join('');
      return header + rows;
    }).join('');

    return `<div class="card">
  <div class="card-header">
    <span class="tnum">T${tool.toolNumber}</span>
    <span class="desc">${esc(tool.description)}</span>
    ${tool.pocketNumber != null ? `<span class="pocket">P${tool.pocketNumber}</span>` : ''}
  </div>
  <table class="ftable"><tbody>${bodyHtml}</tbody></table>
</div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Tool Sheet \u2014 ${tools.length} tool${tools.length !== 1 ? 's' : ''}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; color: #111; padding: 6mm; background: #fff; }
h1   { font-size: 8.5pt; color: #333; margin-bottom: 3mm; }
.grid { display: grid; grid-template-columns: repeat(${opts.columns}, 1fr); gap: 3mm; align-items: start; }
.card { border: 0.4pt solid #ccc; border-radius: 2pt; page-break-inside: avoid; overflow: hidden; }
.card-header { background: #1e3560; color: #fff; padding: 1.5mm 3mm; display: flex; align-items: baseline; gap: 2mm; }
.tnum   { font-size: 7pt; font-weight: bold; font-family: monospace; color: #93c5fd; flex-shrink: 0; }
.desc   { font-size: 7pt; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pocket { font-size: 6pt; color: #94a3b8; font-family: monospace; flex-shrink: 0; }
.ftable { width: 100%; border-collapse: collapse; }
.ftable tr:nth-child(even) td { background: #f5f7fb; }
.sh td  { padding: 0.5mm 3mm; font-size: 5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
          color: #6b87bb; background: #edf1f9 !important; border-top: 0.3pt solid #d8e1f0; }
.fl { padding: 0.65mm 3mm; font-size: 6.5pt; color: #555; width: 38%; border-right: 0.3pt solid #e2e8f0; white-space: nowrap; }
.fv { padding: 0.65mm 3mm; font-size: 6.5pt; font-family: monospace; word-break: break-all; }
@media print {
  body { padding: 5mm; }
  @page { margin: 8mm; size: A4; }
}
</style></head>
<body>
<h1>Tool Sheet \u2014 ${tools.length} tool${tools.length !== 1 ? 's' : ''}</h1>
<div class="grid">${cards}</div>
<script>window.onload = () => { setTimeout(() => window.print(), 150); }<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Could not open print window — check your popup blocker.'); return; }
  win.document.write(html);
  win.document.close();
}

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

  // Basic (always shown)
  row('Type', tool.type);
  row('Ø', `${geo.diameter}\u202f${tool.unit}`);
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

  const metaBefore = out.length;
  if (opts.showMachineGroup  && tool.machineGroup)  row('Machine',  tool.machineGroup);
  if (opts.showTags          && tool.tags.length)   row('Tags',     tool.tags.join(', '));
  if (opts.showManufacturer  && tool.manufacturer)  row('Make',     tool.manufacturer);
  if (opts.showManufacturer  && tool.productId)     row('Prod. ID', tool.productId);
  if (opts.showComment       && tool.comment)       row('Notes',    tool.comment);
  if (out.length > metaBefore) out.splice(metaBefore, 0, { kind: 'section', label: 'Info' });

  return out;
}

const PDF_ROW_H     = 4.2;   // mm — data row height
const PDF_SECTION_H = 3.2;   // mm — section divider height
const PDF_HEADER_H  = 6.5;   // mm — card header height
const PDF_CARD_PAD  = 0.8;   // mm — extra padding below last row

function pdfCardHeight(rows: SheetRow[]): number {
  return PDF_HEADER_H +
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

export function generateToolSheetPdf(tools: LibraryTool[], opts: SheetOptions): void {
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
    const rows  = buildPdfRows(tool, opts);
    const cardH = pdfCardHeight(rows);

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
    doc.roundedRect(x, y, cardW, cardH, 0.8, 0.8, 'S');

    // ── Card header ───────────────────────────────────────────────────────
    doc.setFillColor(30, 53, 96);
    doc.roundedRect(x, y, cardW, PDF_HEADER_H, 0.8, 0.8, 'F');
    doc.rect(x, y + PDF_HEADER_H - 1.5, cardW, 1.5, 'F'); // square off bottom corners

    // T#
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(147, 197, 253);
    const tLabel = `T${tool.toolNumber}`;
    doc.text(tLabel, x + 2, y + PDF_HEADER_H - 1.8);
    const tLabelW = doc.getTextWidth(tLabel) + 2.5;

    // Pocket number (right-aligned)
    let pLabelW = 2;
    if (tool.pocketNumber != null) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      const pLabel = `P${tool.pocketNumber}`;
      doc.text(pLabel, x + cardW - 2, y + PDF_HEADER_H - 1.8, { align: 'right' });
      pLabelW = doc.getTextWidth(pLabel) + 3;
    }

    // Description
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    const descMaxW = cardW - tLabelW - pLabelW;
    doc.text(clampText(doc, tool.description, descMaxW), x + tLabelW, y + PDF_HEADER_H - 1.8);

    // ── Data rows ─────────────────────────────────────────────────────────
    let ry = y + PDF_HEADER_H;

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

  doc.save(`tool-sheet-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
