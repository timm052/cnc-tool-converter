/**
 * LinuxCNC Tool Table (.tbl) Parser
 *
 * Parses the LinuxCNC/EMC2 tool table format as described in:
 *   LinuxCNC documentation — tool table format (v2.4.x and later)
 *
 * Format overview:
 *   First line:  ;  (lone semicolon — header marker)
 *   Tool lines:  T{n} P{p} [axis-offsets] D{dia} [I{fa} J{ba} Q{ori}] ; comment
 *
 * Fields:
 *   T  - Tool number   (required)
 *   P  - Pocket number (required)
 *   X..W - Axis offsets (optional, floating-point)
 *   D  - Tool diameter (optional, floating-point)
 *   I  - Front angle, lathe only
 *   J  - Back angle, lathe only
 *   Q  - Orientation, lathe only (integer 0-9)
 *   ;  - Start of comment
 */

import type { Tool } from '../../types/tool';
import type { ParseResult } from '../../types/converter';

export async function parseLinuxCNC(
  input: string | ArrayBuffer,
  filename?: string,
): Promise<ParseResult> {
  const warnings: string[] = [];
  const errors:   string[] = [];
  const tools:    Tool[]   = [];

  // LinuxCNC files are plain text; handle ArrayBuffer just in case
  let text: string;
  if (typeof input === 'string') {
    text = input;
  } else {
    text = new TextDecoder('utf-8').decode(input);
  }

  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();

    // Skip blank lines and the header ; line
    if (!line) return;
    if (line === ';') return;   // tool table header marker
    if (line.startsWith(';')) return;   // pure comment line

    // Tool lines must start with T (case-insensitive)
    if (!/^T/i.test(line)) return;

    try {
      // Separate data fields from trailing comment
      const semiIdx = line.indexOf(';');
      const dataPart   = semiIdx >= 0 ? line.substring(0, semiIdx).trim() : line;
      const commentStr = semiIdx >= 0 ? line.substring(semiIdx + 1).trim() : '';

      // Tokenise and parse field=value pairs (e.g. "T1", "P3", "D10.5")
      const fields: Record<string, number> = {};
      const tokens = dataPart.split(/\s+/);
      for (const token of tokens) {
        const m = token.match(/^([A-Za-z])([+-]?[\d.]+)$/);
        if (m) {
          const key = m[1].toUpperCase();
          const val = parseFloat(m[2]);
          if (!isNaN(val)) fields[key] = val;
        }
      }

      if (!('T' in fields)) return; // Not a valid tool line

      const toolNumber   = Math.round(fields['T']);
      const pocketNumber = 'P' in fields ? Math.round(fields['P']) : toolNumber;
      const diameter     = fields['D'] ?? 0;

      const tool: Tool = {
        id:           crypto.randomUUID(),
        toolNumber,
        pocketNumber,
        type:         'flat end mill',  // LinuxCNC has no type field; default
        description:  commentStr || `T${toolNumber}`,
        unit:         'mm',             // LinuxCNC uses machine units; assume mm

        geometry: {
          diameter,
        },

        offsets: {
          x: fields['X'],
          y: fields['Y'],
          z: fields['Z'],
          a: fields['A'],
          b: fields['B'],
          c: fields['C'],
          u: fields['U'],
          v: fields['V'],
          w: fields['W'],
        },
      };

      // Preserve lathe-specific fields for round-trip fidelity
      if ('I' in fields || 'J' in fields || 'Q' in fields) {
        tool.sourceData = {
          frontAngle:  fields['I'] ?? 0,
          backAngle:   fields['J'] ?? 0,
          orientation: fields['Q'] ?? 0,
        };
      }

      tools.push(tool);
    } catch (err) {
      warnings.push(
        `Line ${lineIndex + 1}: failed to parse "${rawLine.trim()}" — ${err}`,
      );
    }
  });

  if (tools.length === 0 && errors.length === 0) {
    warnings.push(`No tool entries found in ${filename ?? 'file'}.`);
  }

  return { tools, warnings, errors };
}
