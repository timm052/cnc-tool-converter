/**
 * RhinoCAM / VisualMill Tool Library (.vkb) Parser — Import Only
 *
 * Parses the proprietary binary format used by RhinoCAM (MecSoft) and
 * VisualMill.  The format is reverse-engineered from observed .vkb files.
 *
 * Binary layout (all values little-endian):
 *   File header:  "VisualMill Part File" in UTF-16 LE at offset 0x20
 *   Record size:  7298 bytes per tool record
 *   Within each record:
 *     0x0DE  — tool name string (UTF-16 LE, null-terminated)
 *     0x1E0  — number of flutes (int32)
 *     0x1E4  — diameter         (float64)
 *     0x1EC  — corner radius / secondary dimension (float64, type-dependent)
 *     0x1F4  — flute/body length (float64)
 *     0x1FC  — overall length   (float64)
 *     0x204  — taper or other angle (float64, type-dependent)
 *     0x220  — material string  (UTF-16 LE, null-terminated)
 */

import type { Tool, ToolType, ToolMaterial } from '../../types/tool';
import type { ParseResult } from '../../types/converter';

// ── Binary layout constants ────────────────────────────────────────────────

const MAGIC_OFFSET  = 0x20;
const MAGIC_STR     = 'VisualMill Part File';
const RECORD_SIZE   = 7298;
const NAME_OFFSET   = 0x0DE;
const NOF_OFFSET    = 0x1E0;
const DATA_OFFSET   = 0x1E4;   // float64[0] = diameter
const MAT_OFFSET    = 0x220;   // material string

// ── Helpers ────────────────────────────────────────────────────────────────

function readUTF16(view: DataView, byteOffset: number, maxChars = 64): string {
  let s = '';
  for (let i = 0; i < maxChars; i++) {
    const offset = byteOffset + i * 2;
    if (offset + 2 > view.byteLength) break;
    const c = view.getUint16(offset, true);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function readF64(view: DataView, byteOffset: number): number {
  if (byteOffset + 8 > view.byteLength) return 0;
  return view.getFloat64(byteOffset, true);
}

function readI32(view: DataView, byteOffset: number): number {
  if (byteOffset + 4 > view.byteLength) return 0;
  return view.getInt32(byteOffset, true);
}

// ── Tool type inference ────────────────────────────────────────────────────

const NAME_TO_TYPE: [RegExp, ToolType][] = [
  [/^ballmill/i,       'ball end mill'],
  [/^flatmill/i,       'flat end mill'],
  [/^cradmill/i,       'bull nose end mill'],
  [/^chamfermill/i,    'chamfer mill'],
  [/^threadmill/i,     'thread mill'],
  [/^thread\s*mill/i,  'thread mill'],
  [/^dovetailmill/i,   'tapered mill'],
  [/^lollipopmill/i,   'ball end mill'],
  [/^centerdrill/i,    'spot drill'],
  [/^tap$/i,           'thread mill'],
  [/^rbore/i,          'boring bar'],
  [/^drillmill/i,      'drill'],
  [/^drill/i,          'drill'],
  [/^reammill/i,       'drill'],
];

function inferType(name: string): ToolType {
  for (const [pattern, type] of NAME_TO_TYPE) {
    if (pattern.test(name.trim())) return type;
  }
  return 'custom';
}

// ── Material mapping ───────────────────────────────────────────────────────

const MAT_MAP: Record<string, ToolMaterial> = {
  carbide:  'carbide',
  hss:      'hss',
  ceramics: 'ceramics',
  ceramic:  'ceramics',
  diamond:  'diamond',
};

function inferMaterial(s: string): ToolMaterial | undefined {
  return MAT_MAP[s.trim().toLowerCase()];
}

// ── Main parser ────────────────────────────────────────────────────────────

export async function parseRhinoCamVKB(
  input: string | ArrayBuffer,
  filename?: string,
): Promise<ParseResult> {
  const warnings: string[] = [];
  const errors:   string[] = [];
  const tools:    Tool[]   = [];

  // Always need a raw ArrayBuffer
  const arrayBuf: ArrayBuffer = typeof input === 'string'
    ? new TextEncoder().encode(input).buffer
    : input;

  const view = new DataView(arrayBuf);

  // Verify magic header
  const magic = readUTF16(view, MAGIC_OFFSET, MAGIC_STR.length + 2);
  if (!magic.startsWith(MAGIC_STR)) {
    errors.push(
      `Not a RhinoCAM/VisualMill file — expected "${MAGIC_STR}" at offset 0x20, ` +
      `got "${magic.slice(0, 24)}".`,
    );
    return { tools, warnings, errors };
  }

  const numRecords = Math.floor(view.byteLength / RECORD_SIZE);
  if (numRecords === 0) {
    warnings.push(`File too small to contain any tool records (${view.byteLength} bytes).`);
    return { tools, warnings, errors };
  }

  for (let i = 0; i < numRecords; i++) {
    const base = i * RECORD_SIZE;

    try {
      const name = readUTF16(view, base + NAME_OFFSET, 64).trim();

      // Skip empty or binary-garbage records
      if (!name || name.charCodeAt(0) < 0x20) continue;

      const toolType   = inferType(name);
      const matStr     = readUTF16(view, base + MAT_OFFSET, 16).trim();
      const material   = inferMaterial(matStr);
      const nof        = readI32(view, base + NOF_OFFSET);

      const diam       = readF64(view, base + DATA_OFFSET);
      const d1         = readF64(view, base + DATA_OFFSET +  8);
      const d2         = readF64(view, base + DATA_OFFSET + 16);
      const d3         = readF64(view, base + DATA_OFFSET + 24);
      const d4         = readF64(view, base + DATA_OFFSET + 32);

      const geo: Tool['geometry'] = { diameter: diam };

      switch (toolType) {
        case 'ball end mill':
          geo.cornerRadius  = diam / 2;                // ball radius = D/2
          geo.fluteLength   = d2 > 0 ? d2 : undefined;
          geo.overallLength = d3 > 0 ? d3 : undefined;
          break;

        case 'bull nose end mill':
          geo.cornerRadius  = d1 > 0 ? d1 : undefined;
          geo.fluteLength   = d2 > 0 ? d2 : undefined;
          geo.overallLength = d3 > 0 ? d3 : undefined;
          break;

        case 'chamfer mill':
          geo.taperAngle    = d4 > 0 ? d4 : undefined;
          geo.fluteLength   = d2 > 0 ? d2 : undefined;
          geo.overallLength = d3 > 0 ? d3 : undefined;
          break;

        case 'tapered mill':
          geo.taperAngle    = d4 > 0 ? d4 : undefined;
          geo.tipDiameter   = d2 > 0 ? d2 : undefined;
          geo.overallLength = d3 > 0 ? d3 : undefined;
          break;

        default:
          geo.fluteLength   = d2 > 0 ? d2 : undefined;
          geo.overallLength = d3 > 0 ? d3 : undefined;
          break;
      }

      if (nof > 0) geo.numberOfFlutes = nof;

      tools.push({
        id:          crypto.randomUUID(),
        toolNumber:  i + 1,
        type:        toolType,
        description: name,
        unit:        'mm',
        geometry:    geo,
        material,
        sourceData: {
          rhinocamName: name,
          sourceFile:   filename,
        },
      });
    } catch (err) {
      warnings.push(`Skipped record ${i} in ${filename ?? 'file'}: ${err}`);
    }
  }

  if (tools.length === 0 && errors.length === 0) {
    warnings.push(
      `No recognisable tool records found in ${filename ?? 'file'}. ` +
      `The file may use an unsupported RhinoCAM version.`,
    );
  }

  return { tools, warnings, errors, metadata: { sourceFile: filename } };
}
