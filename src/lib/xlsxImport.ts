/**
 * Imports tools from an Excel .xlsx workbook.
 * Expects the sheet to have the same column headers as xlsxExport produces,
 * but is permissive — unknown columns are ignored, missing ones get defaults.
 */
import * as XLSX from 'xlsx';
import type { Tool } from '../types/tool';

function parseNum(v: unknown): number | undefined {
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function parseStr(v: unknown): string | undefined {
  const s = String(v ?? '').trim();
  return s || undefined;
}

export function importToolsFromXlsx(buffer: ArrayBuffer): { tools: Tool[]; errors: string[] } {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch (e) {
    return { tools: [], errors: [`Failed to parse Excel file: ${String(e)}`] };
  }

  const wsName = wb.SheetNames[0];
  if (!wsName) return { tools: [], errors: ['Workbook contains no sheets'] };

  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  if (rows.length === 0) return { tools: [], errors: ['Sheet is empty'] };

  const tools: Tool[] = [];

  for (const row of rows) {
    const tn = parseNum(row['T#'] ?? row['Tool Number'] ?? row['ToolNumber']);
    if (tn == null) continue; // skip rows without a tool number

    const unit = String(row['Unit'] ?? 'mm').trim().toLowerCase() === 'inch' ? 'inch' : 'mm';

    const tool: Tool = {
      id:           crypto.randomUUID(),
      toolNumber:   Math.round(tn),
      description:  String(row['Description'] ?? `Tool ${tn}`).trim(),
      type:         (parseStr(row['Type']) ?? 'flat end mill') as Tool['type'],
      unit:         unit as 'mm' | 'inch',
      manufacturer: parseStr(row['Manufacturer']),
      comment:      parseStr(row['Comment']),
      geometry: {
        diameter:        parseNum(row['Diameter']) ?? 0,
        overallLength:   parseNum(row['OAL']),
        fluteLength:     parseNum(row['Flute Length']),
        shaftDiameter:   parseNum(row['Shaft Dia']),
        numberOfFlutes:  parseNum(row['Flutes']) != null ? Math.round(parseNum(row['Flutes'])!) : undefined,
        cornerRadius:    parseNum(row['Corner R']),
        taperAngle:      parseNum(row['Taper Angle']),
      },
      cutting: {
        spindleRpm:  parseNum(row['RPM']),
        feedCutting: parseNum(row['Feed']),
        feedPlunge:  parseNum(row['Plunge Feed']),
        coolant:     parseStr(row['Coolant']) as import('../types/tool').CoolantMode | undefined,
      },
    };

    tools.push(tool);
  }

  if (tools.length === 0) {
    return { tools: [], errors: ['No valid tools found — ensure the sheet has a "T#" column'] };
  }

  return { tools, errors: [] };
}
