/**
 * G-code Tool Offset Sheet (1.5 Output)
 *
 * Downloads a lightweight plaintext reference card listing every tool's
 * T number, diameter, Z-offset, flute count and description.
 * Formatted for taping to a machine or pasting into a G-code program header.
 */

import type { LibraryTool } from '../types/libraryTool';

export function downloadGcodeOffsetSheet(tools: LibraryTool[]) {
  if (tools.length === 0) return;

  const sorted  = [...tools].sort((a, b) => a.toolNumber - b.toolNumber);
  const date    = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lines: string[] = [
    `; CNC Tool Offset Reference Sheet`,
    `; Generated: ${date}`,
    `; ${tools.length} tool${tools.length !== 1 ? 's' : ''}`,
    ';',
    `; T#     Diameter       Z-Offset    Fl  Description`,
    `; ${'─'.repeat(62)}`,
  ];

  for (const t of sorted) {
    const tNum   = `T${String(t.toolNumber).padStart(3, '0')}`;
    const unit   = t.unit === 'inch' ? 'in' : 'mm';
    const dp     = t.unit === 'inch' ? 4 : 3;
    const diam   = t.geometry?.diameter != null
      ? `${t.geometry.diameter.toFixed(dp)} ${unit}`
      : `--- ${unit}`;
    const zOff   = t.offsets?.z != null
      ? `${t.offsets.z.toFixed(dp)} ${unit}`
      : `0.${'0'.repeat(dp)} ${unit}`;
    const flutes = t.geometry?.numberOfFlutes != null
      ? String(t.geometry.numberOfFlutes).padStart(2)
      : ' -';
    const desc   = (t.description || t.type).replace(/[^\x20-\x7E]/g, '').slice(0, 38);
    lines.push(`${tNum.padEnd(6)}  ${diam.padEnd(14)} ${zOff.padEnd(13)} ${flutes}  ${desc}`);
  }

  lines.push('');
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `tool-offsets-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
