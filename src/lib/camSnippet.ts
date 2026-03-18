/**
 * CAM post-processor snippet generator.
 *
 * Given one or more LibraryTools, generates a ready-to-paste text block in the
 * dialect of a chosen CNC control. Output is plain text — no file I/O here.
 */
import type { LibraryTool } from '../types/libraryTool';

// ── Dialect definitions ───────────────────────────────────────────────────────

export type CamDialect = 'fanuc' | 'haas' | 'mach3' | 'linuxcnc' | 'siemens';

export interface DialectInfo {
  id:       CamDialect;
  label:    string;
  ext:      string;       // suggested file extension
  example:  string;       // short one-liner shown in UI
}

export const CAM_DIALECTS: DialectInfo[] = [
  {
    id: 'fanuc', label: 'Fanuc / Generic ISO',
    ext: '.nc',
    example: 'T1 M6 (FLAT END MILL D10)',
  },
  {
    id: 'haas', label: 'HAAS',
    ext: '.nc',
    example: 'T1 M6 (T1 - 10.0MM FLAT END MILL)',
  },
  {
    id: 'mach3', label: 'Mach3 / Mach4',
    ext: '.tap',
    example: 'T1 M6 G43 H1',
  },
  {
    id: 'linuxcnc', label: 'LinuxCNC',
    ext: '.ngc',
    example: 'T1 M6 G43 H1 (flat end mill)',
  },
  {
    id: 'siemens', label: 'Siemens Sinumerik',
    ext: '.mpf',
    example: 'T="FLAT_END_MILL_D10" D1',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function safe(s: string): string {
  // Strip characters that confuse G-code parsers; uppercase
  return s.toUpperCase().replace(/[();\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fmt(n: number, dec = 3): string {
  return n.toFixed(dec);
}

/** Convert tool name to a Siemens-safe identifier (no spaces, ≤32 chars) */
function siemensId(tool: LibraryTool): string {
  const base = tool.description
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return base.slice(0, 28) + `_D${Math.round(tool.geometry.diameter)}`;
}

// ── Per-dialect renderers ─────────────────────────────────────────────────────

function renderFanuc(tool: LibraryTool, dec: number): string {
  const tn   = tool.toolNumber;
  const dia  = fmt(tool.geometry.diameter, dec);
  const desc = safe(tool.description);
  const lines: string[] = [];

  lines.push(`( ─── T${tn} ${desc} ─── )`);
  lines.push(`( DIA: ${dia} ${tool.unit} )`);
  if (tool.geometry.numberOfFlutes != null)
    lines.push(`( FLUTES: ${tool.geometry.numberOfFlutes} )`);
  if (tool.geometry.overallLength != null)
    lines.push(`( OAL: ${fmt(tool.geometry.overallLength, dec)} ${tool.unit} )`);
  lines.push('');

  // Tool change
  lines.push(`T${tn} M6`);

  // Length compensation (H = tool number by convention)
  lines.push(`G43 H${tn}`);

  // Spindle + feed if present
  if (tool.cutting?.spindleRpm != null)
    lines.push(`S${tool.cutting.spindleRpm} M3`);
  if (tool.cutting?.feedCutting != null)
    lines.push(`F${fmt(tool.cutting.feedCutting, dec)}`);

  return lines.join('\n');
}

function renderHaas(tool: LibraryTool, dec: number): string {
  const tn   = tool.toolNumber;
  const dia  = fmt(tool.geometry.diameter, dec);
  const desc = safe(tool.description);
  const lines: string[] = [];

  // HAAS uses parenthesised inline comments with T# and description
  lines.push(`( T${tn} - ${dia}${tool.unit} ${desc} )`);
  lines.push('');
  lines.push(`T${tn} M6`);
  lines.push(`( SELECT TOOL ${tn} )`);
  lines.push(`G43 H${tn}`);

  if (tool.cutting?.spindleRpm != null)
    lines.push(`S${tool.cutting.spindleRpm} M3`);
  if (tool.cutting?.feedCutting != null)
    lines.push(`F${fmt(tool.cutting.feedCutting, dec)}`);

  // HAAS tool-life comment
  if (tool.regrindThreshold != null)
    lines.push(`( TOOL LIFE LIMIT: ${tool.regrindThreshold} USES )`);

  return lines.join('\n');
}

function renderMach3(tool: LibraryTool, dec: number): string {
  const tn   = tool.toolNumber;
  const dia  = fmt(tool.geometry.diameter, dec);
  const desc = safe(tool.description);
  const lines: string[] = [];

  lines.push(`; T${tn} ${desc} DIA=${dia}${tool.unit}`);
  lines.push(`T${tn} M6`);
  lines.push(`G43 H${tn}`);

  if (tool.cutting?.spindleRpm != null)
    lines.push(`S${tool.cutting.spindleRpm} M3`);
  if (tool.cutting?.feedCutting != null)
    lines.push(`F${fmt(tool.cutting.feedCutting, dec)}`);

  return lines.join('\n');
}

function renderLinuxCnc(tool: LibraryTool, dec: number): string {
  const tn   = tool.toolNumber;
  const dia  = fmt(tool.geometry.diameter, dec);
  const desc = tool.description.toLowerCase();
  const lines: string[] = [];

  lines.push(`; T${tn}: ${desc} dia=${dia}${tool.unit}`);
  lines.push(`T${tn} M6 G43 H${tn} (${safe(tool.description)})`);

  if (tool.cutting?.spindleRpm != null)
    lines.push(`S${tool.cutting.spindleRpm} M3`);
  if (tool.cutting?.feedCutting != null)
    lines.push(`F${fmt(tool.cutting.feedCutting, dec)}`);

  return lines.join('\n');
}

function renderSiemens(tool: LibraryTool, dec: number): string {
  const id   = siemensId(tool);
  const dia  = fmt(tool.geometry.diameter, dec);
  const lines: string[] = [];

  // Sinumerik tool management block
  lines.push(`; ${tool.description} D=${dia}${tool.unit}`);
  lines.push(`T="${id}" D1`);
  lines.push(`G1 F500`); // placeholder feed

  if (tool.cutting?.spindleRpm != null)
    lines.push(`S${tool.cutting.spindleRpm} M3`);
  if (tool.cutting?.feedCutting != null)
    lines.push(`F${fmt(tool.cutting.feedCutting, dec)}`);

  return lines.join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SnippetOptions {
  dialect:   CamDialect;
  decimals?: number;    // default 3
}

export function generateSnippet(tools: LibraryTool[], opts: SnippetOptions): string {
  const dec = opts.decimals ?? 3;
  const blocks = tools.map((tool) => {
    switch (opts.dialect) {
      case 'fanuc':    return renderFanuc(tool, dec);
      case 'haas':     return renderHaas(tool, dec);
      case 'mach3':    return renderMach3(tool, dec);
      case 'linuxcnc': return renderLinuxCnc(tool, dec);
      case 'siemens':  return renderSiemens(tool, dec);
    }
  });
  return blocks.join('\n\n');
}
