import type { LibraryTool } from '../types/libraryTool';
import type { ToolType, ToolUnit, ToolMaterial } from '../types/tool';

// ── Column schema ─────────────────────────────────────────────────────────────
// Fixed order: T#,Type,Description,Diameter,Unit,FluteLength,OverallLength,
//              Flutes,RPM,FeedCutting,Material,MachineGroup,Tags,Starred

const HEADER = [
  'T#', 'Type', 'Description', 'Diameter', 'Unit',
  'FluteLength', 'OverallLength', 'Flutes', 'RPM', 'FeedCutting',
  'Material', 'MachineGroup', 'Tags', 'Starred',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function csvParse(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuote = false;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];
    if (inQuote) {
      if (ch === '"' && raw[i + 1] === '"') { cur += '"'; i += 2; continue; }
      if (ch === '"') { inQuote = false; i++; continue; }
      cur += ch;
    } else {
      if (ch === '"') { inQuote = true; i++; continue; }
      if (ch === ',') { row.push(cur); cur = ''; i++; continue; }
      if (ch === '\n' || (ch === '\r' && raw[i + 1] === '\n')) {
        row.push(cur); cur = '';
        rows.push(row); row = [];
        if (ch === '\r') i++;
        i++; continue;
      }
      cur += ch;
    }
    i++;
  }
  row.push(cur);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

// ── Export ────────────────────────────────────────────────────────────────────

export function toolsToCsv(tools: LibraryTool[]): string {
  const lines: string[] = [HEADER.join(',')];

  for (const t of tools) {
    const row = [
      String(t.toolNumber),
      t.type,
      t.description,
      String(t.geometry.diameter),
      t.unit,
      t.geometry.fluteLength  !== undefined ? String(t.geometry.fluteLength)  : '',
      t.geometry.overallLength !== undefined ? String(t.geometry.overallLength) : '',
      t.geometry.numberOfFlutes !== undefined ? String(t.geometry.numberOfFlutes) : '',
      t.cutting?.spindleRpm !== undefined ? String(t.cutting.spindleRpm) : '',
      t.cutting?.feedCutting !== undefined ? String(t.cutting.feedCutting) : '',
      t.material ?? '',
      t.machineGroup ?? '',
      t.tags.join(';'),
      t.starred ? 'true' : 'false',
    ];
    lines.push(row.map(csvEscape).join(','));
  }

  return lines.join('\n');
}

// ── Import ────────────────────────────────────────────────────────────────────

const TOOL_TYPES = new Set<string>([
  'flat end mill', 'ball end mill', 'bull nose end mill', 'chamfer mill',
  'face mill', 'spot drill', 'drill', 'tapered mill', 'boring bar',
  'thread mill', 'engraving', 'custom',
]);

const UNITS = new Set<string>(['mm', 'inch']);
const MATERIALS = new Set<string>(['carbide', 'hss', 'ceramics', 'diamond', 'other']);

export interface CsvImportResult {
  tools:  LibraryTool[];
  errors: string[];
}

export function csvToTools(csv: string): CsvImportResult {
  const rows = csvParse(csv.trim());
  if (rows.length < 2) return { tools: [], errors: ['CSV is empty or has no data rows.'] };

  // Detect header row
  const firstRow = rows[0].map((c) => c.trim().toLowerCase());
  const hasHeader = firstRow.includes('t#') || firstRow.includes('type') || firstRow.includes('description');
  const dataRows  = hasHeader ? rows.slice(1) : rows;

  // Build column index map from header (or use defaults)
  const colMap: Record<string, number> = {};
  if (hasHeader) {
    const headerRow = rows[0].map((c) => c.trim().toLowerCase());
    const COL_ALIASES: Record<string, string> = {
      't#': 't#', 'type': 'type', 'description': 'description',
      'diameter': 'diameter', 'unit': 'unit', 'flutelength': 'flutelength',
      'overalllength': 'overalllength', 'flutes': 'flutes', 'rpm': 'rpm',
      'feedcutting': 'feedcutting', 'material': 'material',
      'machinegroup': 'machinegroup', 'tags': 'tags', 'starred': 'starred',
    };
    headerRow.forEach((col, i) => {
      const key = COL_ALIASES[col.replace(/\s/g, '').toLowerCase()];
      if (key) colMap[key] = i;
    });
  } else {
    // Default column positions
    HEADER.forEach((h, i) => { colMap[h.toLowerCase().replace('#', '#')] = i; });
    colMap['t#'] = 0; colMap['type'] = 1; colMap['description'] = 2;
    colMap['diameter'] = 3; colMap['unit'] = 4; colMap['flutelength'] = 5;
    colMap['overalllength'] = 6; colMap['flutes'] = 7; colMap['rpm'] = 8;
    colMap['feedcutting'] = 9; colMap['material'] = 10; colMap['machinegroup'] = 11;
    colMap['tags'] = 12; colMap['starred'] = 13;
  }

  const get = (row: string[], key: string): string =>
    (colMap[key] !== undefined ? (row[colMap[key]] ?? '').trim() : '');

  const tools: LibraryTool[] = [];
  const errors: string[] = [];
  const now = Date.now();

  dataRows.forEach((row, idx) => {
    const lineNum = idx + (hasHeader ? 2 : 1);
    if (row.every((c) => c.trim() === '')) return; // skip blank lines

    const tNumStr = get(row, 't#');
    const tNum    = parseInt(tNumStr, 10);
    if (isNaN(tNum)) { errors.push(`Row ${lineNum}: invalid T# "${tNumStr}".`); return; }

    const diaStr = get(row, 'diameter');
    const dia    = parseFloat(diaStr);
    if (isNaN(dia) || dia <= 0) { errors.push(`Row ${lineNum}: invalid diameter "${diaStr}".`); return; }

    const rawType = get(row, 'type').toLowerCase();
    const type: ToolType = TOOL_TYPES.has(rawType) ? rawType as ToolType : 'custom';

    const rawUnit = get(row, 'unit').toLowerCase();
    const unit: ToolUnit = UNITS.has(rawUnit) ? rawUnit as ToolUnit : 'mm';

    const rawMat  = get(row, 'material').toLowerCase();
    const material = MATERIALS.has(rawMat) ? rawMat as ToolMaterial : undefined;

    const fluteLength    = parseFloat(get(row, 'flutelength'))  || undefined;
    const overallLength  = parseFloat(get(row, 'overalllength')) || undefined;
    const numberOfFlutes = parseInt(get(row, 'flutes'), 10) || undefined;
    const spindleRpm     = parseFloat(get(row, 'rpm'))          || undefined;
    const feedCutting    = parseFloat(get(row, 'feedcutting'))  || undefined;

    const tagsRaw = get(row, 'tags');
    const tags    = tagsRaw ? tagsRaw.split(';').map((t) => t.trim()).filter(Boolean) : [];

    const starredRaw = get(row, 'starred').toLowerCase();
    const starred    = starredRaw === 'true' || starredRaw === '1' || starredRaw === 'yes';

    const machineGroup = get(row, 'machinegroup') || undefined;
    const description  = get(row, 'description') || `T${tNum}`;

    tools.push({
      id:          crypto.randomUUID(),
      toolNumber:  tNum,
      type,
      description,
      unit,
      geometry: {
        diameter: dia,
        fluteLength,
        overallLength,
        numberOfFlutes,
      },
      cutting: (spindleRpm !== undefined || feedCutting !== undefined)
        ? { spindleRpm, feedCutting }
        : undefined,
      material,
      machineGroup,
      tags,
      starred,
      addedAt:   now,
      updatedAt: now,
    });
  });

  return { tools, errors };
}
