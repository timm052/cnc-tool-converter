/**
 * Exports a list of LibraryTools to an Excel .xlsx workbook.
 * Returns a Uint8Array suitable for download.
 */
import * as XLSX from 'xlsx';
import type { LibraryTool } from '../types/libraryTool';

export function exportToolsToXlsx(tools: LibraryTool[]): Uint8Array {
  const rows = tools.map((t) => ({
    'T#':           t.toolNumber,
    'Description':  t.description,
    'Type':         t.type,
    'Manufacturer': t.manufacturer ?? '',
    'Unit':         t.unit,
    'Diameter':     t.geometry.diameter,
    'OAL':          t.geometry.overallLength ?? '',
    'Flute Length': t.geometry.fluteLength ?? '',
    'Shaft Dia':    t.geometry.shaftDiameter ?? '',
    'Flutes':       t.geometry.numberOfFlutes ?? '',
    'Corner R':     t.geometry.cornerRadius ?? '',
    'Taper Angle':  t.geometry.taperAngle ?? '',
    'RPM':          t.cutting?.spindleRpm ?? '',
    'Feed':         t.cutting?.feedCutting ?? '',
    'Plunge Feed':  t.cutting?.feedPlunge ?? '',
    'Coolant':      t.cutting?.coolant ?? '',
    'Material':     t.material ?? '',
    'Machine Groups': (t.machineGroups ?? []).join(', '),
    'Tags':         t.tags.join(', '),
    'Qty':          t.quantity ?? '',
    'Reorder Pt':   t.reorderPoint ?? '',
    'Supplier':     t.supplier ?? '',
    'Unit Cost':    t.unitCost ?? '',
    'Location':     t.location ?? '',
    'Comment':      t.comment ?? '',
    'Starred':      t.starred ? 'Yes' : '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-width columns
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? '').length),
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tools');

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}
