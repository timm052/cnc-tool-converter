/**
 * Fanuc Tool Offset Table Parser (G10 punch format)
 *
 * Parses G-code files output by a Fanuc control's "punch" (export) function.
 * Supports Memory C format (most common on modern Fanuc 0i-MF / 31i / 35i mills):
 *
 *   G10 L10 P{n} R{v}   → H geometry (tool length) for tool n
 *   G10 L11 P{n} R{v}   → H wear for tool n
 *   G10 L12 P{n} R{v}   → D geometry (diameter) for tool n
 *   G10 L13 P{n} R{v}   → D wear for tool n
 *
 * Also accepts Memory A/B variants:
 *   G10 L11 P{n} R{v}   → combined H offset (Memory A)
 *   G10 L10/L11 with no D columns (Memory B)
 *
 * Tool descriptions are not stored in the Fanuc offset format —
 * tools are named "T{n}" with the offset register number used as the tool number.
 */

import type { Tool } from '../../types/tool';
import type { ParseResult } from '../../types/converter';

/** Match a G10 line — fields may appear in any order on the line */
const G10_RE = /G10/i;

/** Extract word values: Lnn, Pnn, Rnn.nnnn */
function extractWords(line: string): Record<string, number> {
  const words: Record<string, number> = {};
  // Match letter followed by optional sign and number
  const re = /([A-Za-z])([-+]?[\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const key = m[1].toUpperCase();
    const val = parseFloat(m[2]);
    if (!isNaN(val)) words[key] = val;
  }
  return words;
}

interface ToolData {
  lenGeo?:  number;
  lenWear?: number;
  diaGeo?:  number;
  diaWear?: number;
}

export async function parseFanuc(
  input: string | ArrayBuffer,
  filename?: string,
): Promise<ParseResult> {
  const warnings: string[] = [];
  const errors:   string[] = [];

  const text = typeof input === 'string'
    ? input
    : new TextDecoder('utf-8').decode(input);

  // Collect offset data indexed by register number (P word)
  const offsetMap = new Map<number, ToolData>();

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip blank lines, pure comments, and tape delimiters
    if (!line || line === '%') continue;

    // Strip inline comments (...)
    const stripped = line.replace(/\([^)]*\)/g, '').trim();
    if (!stripped) continue;

    // Only process G10 lines
    if (!G10_RE.test(stripped)) continue;

    const words = extractWords(stripped);
    const L = words['L'];
    const P = words['P'];
    const R = words['R'];

    if (L === undefined || P === undefined || R === undefined) {
      warnings.push(`Line ${i + 1}: G10 missing L, P, or R word — "${line}" skipped.`);
      continue;
    }

    const reg = Math.round(P);
    if (reg <= 0) continue;

    const entry = offsetMap.get(reg) ?? {};

    switch (Math.round(L)) {
      case 10:  entry.lenGeo  = R; break;
      case 11:  entry.lenWear = R; break;
      case 12:  entry.diaGeo  = R; break;
      case 13:  entry.diaWear = R; break;
      // Extended range (Memory C L110/L111) treated same as L10/L11
      case 110: entry.lenGeo  = R; break;
      case 111: entry.lenWear = R; break;
      default:
        warnings.push(`Line ${i + 1}: unsupported G10 L${Math.round(L)} — ignored.`);
    }

    offsetMap.set(reg, entry);
  }

  // Convert offset map to Tool objects
  const tools: Tool[] = [];

  for (const [reg, data] of [...offsetMap.entries()].sort((a, b) => a[0] - b[0])) {
    // Only emit tools that have at least one non-zero value
    const hasData = (data.lenGeo ?? 0) !== 0 || (data.diaGeo ?? 0) !== 0;
    if (!hasData) continue;

    const tool: Tool = {
      id:          crypto.randomUUID(),
      toolNumber:  reg,
      type:        'flat end mill',
      description: `T${reg}`,
      unit:        'mm',

      geometry: {
        diameter: data.diaGeo ?? 0,
      },

      offsets: {
        z: data.lenGeo ?? 0,
      },

      sourceData: {
        fanucLenWear: data.lenWear ?? 0,
        fanucDiaWear: data.diaWear ?? 0,
      },
    };

    tools.push(tool);
  }

  if (tools.length === 0 && errors.length === 0) {
    warnings.push(`No Fanuc G10 offset entries found in ${filename ?? 'file'}.`);
    warnings.push(
      'Expected lines like: G10 L10 P1 R200.0000 (H geometry), G10 L12 P1 R6.3500 (D geometry).',
    );
  }

  return { tools, warnings, errors };
}
