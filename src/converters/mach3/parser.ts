/**
 * Mach3 Tool Table CSV Parser
 *
 * Parses the CSV format exported by Mach3 CNC controller software.
 * Column order (no header row in native Mach3 export):
 *
 *   Tool Number, Description, Diameter, Diameter Wear, Height (Length), Height Wear
 *
 * Example:
 *   1,"1/2 End Mill",0.5000,0.0000,4.2500,0.0000
 *   2,"1/4 Drill",0.2500,0.0000,3.8750,0.0010
 *
 * Notes:
 *  - Header row is auto-detected if present (first cell = "tool" or "tool number")
 *  - Zero-filled records (all numeric fields = 0) are skipped — Mach3 writes
 *    blank entries for unoccupied tool slots
 *  - Height (column 5) maps to offsets.z
 *  - Diameter maps to geometry.diameter
 */

import type { Tool } from '../../types/tool';
import type { ParseResult } from '../../types/converter';

function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

const HEADER_FIRST_CELL_RE = /^(tool|t#|tool\s*number|toolnumber)$/i;

export async function parseMach3(
  input: string | ArrayBuffer,
  filename?: string,
): Promise<ParseResult> {
  const warnings: string[] = [];
  const errors:   string[] = [];
  const tools:    Tool[]   = [];

  const text = typeof input === 'string'
    ? input
    : new TextDecoder('utf-8').decode(input);

  const rawLines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (rawLines.length === 0) {
    warnings.push(`No data found in ${filename ?? 'file'}.`);
    return { tools, warnings, errors };
  }

  // Detect header row
  const firstCells = parseCsvRow(rawLines[0]);
  const hasHeader  = HEADER_FIRST_CELL_RE.test(firstCells[0].trim());
  const dataLines  = hasHeader ? rawLines.slice(1) : rawLines;

  // Build column index from header (or use Mach3 defaults)
  // Default column order: ToolNum, Description, Diameter, DiaWear, Height, HeightWear
  const colIdx = { toolNum: 0, description: 1, diameter: 2, diaWear: 3, height: 4, heightWear: 5 };

  if (hasHeader) {
    const hdr = firstCells.map((c) => c.trim().toLowerCase().replace(/\s+/g, ''));
    const map: Record<string, keyof typeof colIdx> = {
      'toolnumber': 'toolNum', 'tool#': 'toolNum', 'tool': 'toolNum', 't#': 'toolNum',
      'description': 'description', 'name': 'description',
      'diameter': 'diameter', 'dia': 'diameter',
      'diameterwear': 'diaWear', 'diawear': 'diaWear',
      'height': 'height', 'length': 'height', 'heightoffset': 'height', 'lengthoffset': 'height',
      'heightwear': 'heightWear', 'lengthwear': 'heightWear',
    };
    hdr.forEach((h, i) => { if (map[h]) colIdx[map[h]] = i; });
  }

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    const cells = parseCsvRow(line);
    const lineNum = i + (hasHeader ? 2 : 1);

    const toolNumStr = (cells[colIdx.toolNum] ?? '').trim();
    const toolNumber = parseInt(toolNumStr, 10);
    if (isNaN(toolNumber)) {
      if (toolNumStr !== '') warnings.push(`Row ${lineNum}: invalid tool number "${toolNumStr}" — skipped.`);
      continue;
    }

    const diameter    = parseFloat((cells[colIdx.diameter]   ?? '').trim()) || 0;
    const diaWear     = parseFloat((cells[colIdx.diaWear]    ?? '').trim()) || 0;
    const height      = parseFloat((cells[colIdx.height]     ?? '').trim()) || 0;
    const heightWear  = parseFloat((cells[colIdx.heightWear] ?? '').trim()) || 0;
    const description = (cells[colIdx.description] ?? '').trim() || `T${toolNumber}`;

    // Skip blank/empty slots (Mach3 writes zero-filled rows for all 255 slots)
    if (diameter === 0 && height === 0 && description === `T${toolNumber}`) continue;

    const tool: Tool = {
      id:          crypto.randomUUID(),
      toolNumber,
      type:        'flat end mill',
      description,
      unit:        'inch',     // Mach3 is typically inch-based; caller may override

      geometry: {
        diameter,
      },

      offsets: {
        z: height,
      },

      sourceData: {
        mach3DiaWear:    diaWear,
        mach3HeightWear: heightWear,
      },
    };

    tools.push(tool);
  }

  if (tools.length === 0 && errors.length === 0) {
    warnings.push(`No Mach3 tool entries found in ${filename ?? 'file'}.`);
    warnings.push('Expected CSV columns: Tool Number, Description, Diameter, Diameter Wear, Height, Height Wear');
  }

  return { tools, warnings, errors };
}
