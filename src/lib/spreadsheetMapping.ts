/**
 * Spreadsheet → LibraryTool column mapping
 *
 * Lets users import an arbitrary CSV/XLSX by manually mapping its columns to
 * LibraryTool fields, instead of requiring the app's fixed CSV layout
 * (see csvLibrary.ts).
 */
import * as XLSX from 'xlsx';
import { csvParse } from './csvLibrary';
import type { LibraryTool } from '../types/libraryTool';
import type { CuttingParameters, ToolType, ToolUnit } from '../types/tool';

// ── File parsing ──────────────────────────────────────────────────────────────

export interface ParsedSpreadsheet {
  headers: string[];
  rows:    Record<string, string>[];
}

function rowsFromAoa(aoa: unknown[][]): ParsedSpreadsheet {
  if (aoa.length === 0) return { headers: [], rows: [] };
  const headers = aoa[0].map((h) => String(h ?? '').trim());
  const rows = aoa.slice(1)
    .map((r) => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = String(r[i] ?? '').trim(); });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => v !== ''));
  return { headers, rows };
}

/** Parses a loaded CSV or Excel file's content into headers + row records, keyed by header. */
export function parseSpreadsheetFile(content: string | ArrayBuffer, filename: string): ParsedSpreadsheet {
  const name = filename.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const wb = XLSX.read(content as ArrayBuffer, { type: 'array' });
    const wsName = wb.SheetNames[0];
    if (!wsName) return { headers: [], rows: [] };
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wsName], { header: 1, defval: '' });
    return rowsFromAoa(aoa);
  }

  return rowsFromAoa(csvParse((content as string).trim()));
}

// ── Mappable fields ───────────────────────────────────────────────────────────

export interface MappableField {
  key:     string;
  label:   string;
  group:   string;
  numeric?: boolean;
}

export const MAPPABLE_FIELDS: MappableField[] = [
  // Identity
  { key: 'toolNumber',  label: 'Tool Number (T#)', group: 'Identity', numeric: true },
  { key: 'type',        label: 'Type',             group: 'Identity' },
  { key: 'description', label: 'Description',      group: 'Identity' },
  { key: 'manufacturer',label: 'Manufacturer',     group: 'Identity' },
  { key: 'comment',     label: 'Comment',          group: 'Identity' },
  { key: 'unit',        label: 'Unit (mm/inch)',   group: 'Identity' },

  // Geometry
  { key: 'diameter',       label: 'Diameter',          group: 'Geometry', numeric: true },
  { key: 'overallLength',  label: 'Overall Length',    group: 'Geometry', numeric: true },
  { key: 'fluteLength',    label: 'Flute Length',      group: 'Geometry', numeric: true },
  { key: 'shaftDiameter',  label: 'Shaft Diameter',    group: 'Geometry', numeric: true },
  { key: 'numberOfFlutes', label: 'Number of Flutes',  group: 'Geometry', numeric: true },
  { key: 'cornerRadius',   label: 'Corner Radius',     group: 'Geometry', numeric: true },
  { key: 'taperAngle',     label: 'Taper Angle',       group: 'Geometry', numeric: true },

  // Cutting
  { key: 'spindleRpm',  label: 'Spindle RPM',  group: 'Cutting', numeric: true },
  { key: 'feedCutting', label: 'Feed Rate',    group: 'Cutting', numeric: true },
  { key: 'feedPlunge',  label: 'Plunge Feed',  group: 'Cutting', numeric: true },

  // Library / Crib
  { key: 'machineGroup', label: 'Machine Group(s)', group: 'Library' },
  { key: 'tags',         label: 'Tags',             group: 'Library' },
  { key: 'quantity',     label: 'Quantity',         group: 'Library', numeric: true },
  { key: 'reorderPoint', label: 'Reorder Point',    group: 'Library', numeric: true },
  { key: 'supplier',     label: 'Supplier',         group: 'Library' },
  { key: 'unitCost',     label: 'Unit Cost',        group: 'Library', numeric: true },
  { key: 'location',     label: 'Location',         group: 'Library' },
];

/** Best-effort default mapping — matches header text to a field's key or label. */
export function guessMapping(headers: string[]): Record<string, string> {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const byNormalized = new Map<string, string>();
  for (const f of MAPPABLE_FIELDS) {
    byNormalized.set(normalize(f.key), f.key);
    byNormalized.set(normalize(f.label), f.key);
  }
  // A few common spreadsheet header aliases
  const ALIASES: Record<string, string> = {
    't': 'toolNumber', 'tno': 'toolNumber', 'toolno': 'toolNumber', 'tnumber': 'toolNumber',
    'desc': 'description', 'name': 'description',
    'dia': 'diameter', 'diam': 'diameter',
    'oal': 'overallLength', 'length': 'overallLength',
    'flutelen': 'fluteLength', 'fl': 'fluteLength',
    'shankdiameter': 'shaftDiameter', 'shank': 'shaftDiameter',
    'flutes': 'numberOfFlutes', 'numflutes': 'numberOfFlutes',
    'rpm': 'spindleRpm', 'speed': 'spindleRpm',
    'feed': 'feedCutting', 'feedrate': 'feedCutting',
    'plungefeed': 'feedPlunge', 'plunge': 'feedPlunge',
    'machine': 'machineGroup', 'machinegroup': 'machineGroup', 'machinegroups': 'machineGroup',
    'qty': 'quantity', 'onhand': 'quantity',
    'reorder': 'reorderPoint', 'reorderqty': 'reorderPoint',
    'cost': 'unitCost', 'price': 'unitCost',
    'mfr': 'manufacturer', 'make': 'manufacturer', 'brand': 'manufacturer',
    'corner': 'cornerRadius', 'cornerr': 'cornerRadius',
    'taper': 'taperAngle',
  };
  for (const [k, v] of Object.entries(ALIASES)) byNormalized.set(k, v);

  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const match = byNormalized.get(normalize(header));
    if (match) mapping[header] = match;
  }
  return mapping;
}

// ── Build LibraryTools ────────────────────────────────────────────────────────

export interface MappingDefaults {
  unit: ToolUnit;
  type: ToolType;
}

/**
 * Builds LibraryTool records from parsed spreadsheet rows.
 * @param mapping field key → source column header (or undefined/empty to skip)
 */
export function buildToolsFromMapping(
  rows:     Record<string, string>[],
  mapping:  Record<string, string | undefined>,
  defaults: MappingDefaults,
): LibraryTool[] {
  const now = Date.now();
  let autoNumber = 1;

  return rows.map((row) => {
    const get = (key: string): string => {
      const col = mapping[key];
      return col ? (row[col] ?? '').trim() : '';
    };
    const getNum = (key: string): number | undefined => {
      const v = get(key);
      if (!v) return undefined;
      const n = Number(v);
      return Number.isNaN(n) ? undefined : n;
    };
    const splitList = (key: string): string[] => {
      const v = get(key);
      return v ? v.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [];
    };

    const toolNumber = getNum('toolNumber') != null ? Math.round(getNum('toolNumber')!) : autoNumber;
    autoNumber = Math.max(autoNumber, toolNumber) + 1;

    const unitRaw = get('unit').toLowerCase();
    const unit: ToolUnit = unitRaw === 'inch' || unitRaw === 'in' ? 'inch' : unitRaw === 'mm' ? 'mm' : defaults.unit;

    const cutting: CuttingParameters = {};
    const spindleRpm  = getNum('spindleRpm');
    const feedCutting = getNum('feedCutting');
    const feedPlunge  = getNum('feedPlunge');
    if (spindleRpm  !== undefined) cutting.spindleRpm  = spindleRpm;
    if (feedCutting !== undefined) cutting.feedCutting = feedCutting;
    if (feedPlunge  !== undefined) cutting.feedPlunge  = feedPlunge;

    return {
      id:           crypto.randomUUID(),
      toolNumber,
      type:         (get('type') || defaults.type) as ToolType,
      description:  get('description') || `Tool ${toolNumber}`,
      manufacturer: get('manufacturer') || undefined,
      comment:      get('comment') || undefined,
      unit,
      geometry: {
        diameter:       getNum('diameter') ?? 0,
        overallLength:  getNum('overallLength'),
        fluteLength:    getNum('fluteLength'),
        shaftDiameter:  getNum('shaftDiameter'),
        numberOfFlutes: getNum('numberOfFlutes'),
        cornerRadius:   getNum('cornerRadius'),
        taperAngle:     getNum('taperAngle'),
      },
      cutting: Object.keys(cutting).length ? cutting : undefined,
      tags:          splitList('tags'),
      starred:       false,
      machineGroups: splitList('machineGroup'),
      addedAt:       now,
      updatedAt:     now,
      quantity:      getNum('quantity'),
      reorderPoint:  getNum('reorderPoint'),
      supplier:      get('supplier') || undefined,
      unitCost:      getNum('unitCost'),
      location:      get('location') || undefined,
    };
  });
}
