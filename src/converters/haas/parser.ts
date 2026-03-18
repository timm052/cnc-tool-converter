/**
 * HAAS Tool Offset Table Parser
 *
 * Supports HAAS Format A (NGC / Next Generation Control and classic):
 *
 *   % (TOOL OFFSETS)
 *   (  TOOL  LENGTH GEOMETRY  LENGTH WEAR   DIA GEOMETRY   DIA WEAR  DESCRIPTION  CLNT POS)
 *   (    1     200.0000         0.0000        0.5000         0.0000   1/2 ENDMILL       0)
 *   %
 *
 * Each tool is a parenthesised comment line containing (in order):
 *   TOOL#, LENGTH GEOMETRY, LENGTH WEAR, DIA GEOMETRY, DIA WEAR, DESCRIPTION, CLNT POS
 *
 * Also accepts plain-text lines (no parens) in the same column order,
 * and skips the header row that contains "TOOL" / "LENGTH" / "DIA" tokens.
 *
 * DIA GEOMETRY is stored as the full tool diameter (Setting 40 = diameter mode).
 * LENGTH GEOMETRY is stored in offsets.z as the Z-length offset.
 */

import type { Tool } from '../../types/tool';
import type { ParseResult } from '../../types/converter';

/** Match a parenthesised line that looks like a HAAS data row:
 *  (  <num>  <float>  <float>  <float>  <float>  <text>  <int>  ) */
const DATA_LINE_RE = /^\(\s*(\d+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+(.*?)\s+(\d+)\s*\)$/;

/** Header keywords — lines containing these tokens are column-header rows, not data */
const HEADER_TOKENS = /LENGTH\s+GEOMETRY|DIA\s+GEOMETRY|LEN-GEO|DIA-GEO/i;

export async function parseHaas(
  input: string | ArrayBuffer,
  filename?: string,
): Promise<ParseResult> {
  const warnings: string[] = [];
  const errors:   string[] = [];
  const tools:    Tool[]   = [];

  const text = typeof input === 'string'
    ? input
    : new TextDecoder('utf-8').decode(input);

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw  = lines[i];
    const line = raw.trim();

    // Skip tape delimiters, blank lines, and pure % lines
    if (!line || line === '%') continue;

    // Skip header rows (contain column label keywords)
    if (HEADER_TOKENS.test(line)) continue;

    // Skip lines that are just labels/titles (no leading digit after strip)
    const m = DATA_LINE_RE.exec(line);
    if (!m) continue;

    const toolNumber  = parseInt(m[1], 10);
    const lenGeo      = parseFloat(m[2]);   // H offset — length geometry
    const lenWear     = parseFloat(m[3]);   // H offset — length wear
    const diaGeo      = parseFloat(m[4]);   // D offset — diameter geometry
    // const diaWear  = parseFloat(m[5]);   // D offset — diameter wear (informational)
    const description = m[6].trim() || `T${toolNumber}`;
    const clntPos     = parseInt(m[7], 10);

    if (isNaN(toolNumber) || toolNumber <= 0) {
      warnings.push(`Line ${i + 1}: invalid tool number "${m[1]}" — skipped.`);
      continue;
    }

    const tool: Tool = {
      id:          crypto.randomUUID(),
      toolNumber,
      type:        'flat end mill', // HAAS format has no type field; default
      description,
      unit:        'mm',            // machine units; caller may override

      geometry: {
        diameter: diaGeo,
      },

      offsets: {
        z: lenGeo,     // H length geometry → Z offset
      },

      sourceData: {
        haasLengthWear: lenWear,
        haasDiaWear:    parseFloat(m[5]),
        haasClntPos:    clntPos,
      },
    };

    tools.push(tool);
  }

  if (tools.length === 0 && errors.length === 0) {
    warnings.push(`No tool entries found in ${filename ?? 'file'}.`);
    warnings.push(
      'Expected HAAS Format A: parenthesised lines like ' +
      '(  TOOL  LENGTH GEOMETRY  ... ) with a header row.',
    );
  }

  return { tools, warnings, errors };
}
