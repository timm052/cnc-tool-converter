/**
 * Mach3 Tool Table CSV Writer
 *
 * Produces the CSV format natively used by Mach3 CNC controller software.
 * No header row is written (matching Mach3's native export behaviour).
 *
 * Column order:
 *   Tool Number, Description, Diameter, Diameter Wear, Height (Length), Height Wear
 *
 * Example output:
 *   1,"1/2 End Mill",0.5000,0.0000,4.2500,0.0000
 *   2,"1/4 Drill",0.2500,0.0000,3.8750,0.0010
 *
 * Notes:
 *  - Diameter ← geometry.diameter
 *  - Height   ← offsets.z (if present), otherwise 0
 *  - Wear values preserved from sourceData if available, else 0
 */

import type { Tool } from '../../types/tool';
import type { WriteResult, WriteOptions } from '../../types/converter';

function f(val: number | undefined, decimals = 4): string {
  return (val ?? 0).toFixed(decimals);
}

function csvCell(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

export async function writeMach3(
  tools: Tool[],
  options?: WriteOptions,
): Promise<WriteResult> {
  const warnings: string[] = [];

  if (tools.length === 0) warnings.push('No tools to write.');

  const rows: string[] = [];

  for (const tool of tools) {
    const sd         = (tool.sourceData ?? {}) as Record<string, number>;
    const diameter   = tool.geometry.diameter;
    const diaWear    = sd.mach3DiaWear    ?? 0;
    const height     = tool.offsets?.z    ?? 0;
    const heightWear = sd.mach3HeightWear ?? 0;
    const desc       = tool.description ?? `T${tool.toolNumber}`;

    rows.push([
      String(tool.toolNumber),
      csvCell(desc),
      f(diameter),
      f(diaWear),
      f(height),
      f(heightWear),
    ].join(','));
  }

  const baseName = (options?.filename as string | undefined)?.replace(/\.[^.]+$/, '') ?? 'mach3-tools';

  return {
    content:  rows.join('\r\n') + '\r\n',
    filename: `${baseName}.csv`,
    mimeType: 'text/csv',
    warnings,
  };
}
