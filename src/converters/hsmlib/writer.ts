/**
 * Autodesk Inventor CAM / HSMWorks Tool Library (.hsmlib) Writer
 *
 * Produces UTF-8 encoded XML compatible with Autodesk Inventor CAM.
 * Note: Inventor accepts UTF-8 as well as UTF-16; we output UTF-8 for
 * simpler browser handling while keeping full schema compatibility.
 */

import type { Tool } from '../../types/tool';
import type { WriteResult, WriteOptions } from '../../types/converter';

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function n(val: number | undefined, fallback = 0): string {
  if (val === undefined || isNaN(val)) return String(fallback);
  // Trim unnecessary trailing zeros while keeping decimal precision
  return parseFloat(val.toPrecision(10)).toString();
}

function bool01(val: boolean | undefined): string {
  return val ? '1' : '0';
}

function boolYN(val: boolean | undefined, defaultVal = true): string {
  return (val ?? defaultVal) ? 'yes' : 'no';
}

function indent(lines: string[], level: number): string {
  const pad = '  '.repeat(level);
  return lines.filter(Boolean).map((l) => pad + l).join('\n');
}

// ── Tool serialiser ────────────────────────────────────────────────────────

function serialiseTool(tool: Tool): string {
  const geo = tool.geometry;
  const cut = tool.cutting ?? {};
  const nc  = tool.nc ?? {};

  const presetsXml = (tool.presets ?? []).map((p) => {
    const params = Object.entries(p.parameters)
      .map(([k, v]) => `      <parameter key="${esc(k)}" value="${esc(v)}"/>`)
      .join('\n');
    return [
      `    <preset description="${esc(p.description)}" id="${esc(p.id)}" name="${esc(p.name)}">`,
      params,
      `    </preset>`,
    ].join('\n');
  }).join('\n');

  const lines: string[] = [
    `  <tool guid="${esc(tool.id)}" type="${esc(tool.type)}" unit="${tool.unit === 'mm' ? 'millimeters' : 'inches'}" version="1.5">`,
    `    <description>${esc(tool.description)}</description>`,
    tool.comment      ? `    <comment>${esc(tool.comment)}</comment>` : '',
    tool.manufacturer ? `    <manufacturer>${esc(tool.manufacturer)}</manufacturer>` : '',
    tool.productId    ? `    <product-id>${esc(tool.productId)}</product-id>` : '',
    tool.productLink  ? `    <product-link>${esc(tool.productLink)}</product-link>` : '',
    // NC
    `    <nc` +
      ` break-control="${bool01(nc.breakControl)}"` +
      ` diameter-offset="${bool01(nc.diameterOffset)}"` +
      ` length-offset="${bool01(nc.lengthOffset)}"` +
      ` live-tool="${bool01(nc.liveTool)}"` +
      ` manual-tool-change="${bool01(nc.manualToolChange)}"` +
      ` number="${tool.toolNumber}"` +
      ` turret="${n(nc.turret)}"/>`,
    // Coolant
    `    <coolant mode="${cut.coolant ?? 'disabled'}"/>`,
    // Material
    tool.material ? `    <material name="${tool.material}"/>` : '',
    // Body geometry
    `    <body` +
      ` body-length="${n(geo.bodyLength)}"` +
      ` coolant-support="${boolYN(geo.coolantSupport, false)}"` +
      ` diameter="${n(geo.diameter)}"` +
      ` flute-length="${n(geo.fluteLength)}"` +
      ` number-of-flutes="${n(geo.numberOfFlutes, 1)}"` +
      ` overall-length="${n(geo.overallLength)}"` +
      ` shaft-diameter="${n(geo.shaftDiameter ?? geo.diameter)}"` +
      ` shoulder-length="${n(geo.shoulderLength)}"` +
      ` taper-angle="${n(geo.taperAngle)}"` +
      ` thread-pitch="${n(geo.threadPitch)}"` +
      ` thread-profile-angle="${n(geo.threadProfileAngle, 60)}"` +
      (geo.tipDiameter !== undefined ? ` tip-diameter="${n(geo.tipDiameter)}"` : '') +
      (geo.cornerRadius !== undefined ? ` corner-radius="${n(geo.cornerRadius)}"` : '') +
      `/>`,
    // Motion / cutting parameters
    `    <motion` +
      ` clockwise="${boolYN(cut.clockwise)}"` +
      ` cutting-feedrate="${n(cut.feedCutting)}"` +
      ` entry-feedrate="${n(cut.feedEntry)}"` +
      ` exit-feedrate="${n(cut.feedExit)}"` +
      ` feed-mode="${cut.feedMode ?? 'per-minute'}"` +
      ` plunge-feedrate="${n(cut.feedPlunge)}"` +
      ` ramp-feedrate="${n(cut.feedRamp)}"` +
      ` ramp-spindle-rpm="${n(cut.rampSpindleRpm ?? cut.spindleRpm)}"` +
      ` retract-feedrate="${n(cut.feedRetract)}"` +
      ` spindle-rpm="${n(cut.spindleRpm)}"` +
      `/>`,
    // Presets
    tool.presets && tool.presets.length > 0
      ? `    <presets>\n${presetsXml}\n    </presets>`
      : '',
    `  </tool>`,
  ];

  return lines.filter(Boolean).join('\n');
}

// ── Main writer ────────────────────────────────────────────────────────────

export async function writeHSMLib(
  tools: Tool[],
  options?: WriteOptions,
): Promise<WriteResult> {
  const warnings: string[] = [];

  if (tools.length === 0) {
    warnings.push('No tools to write.');
  }

  const libraryGuid   = `{${crypto.randomUUID().toUpperCase()}}`;
  const toolsXml      = tools.map(serialiseTool).join('\n');

  const machineVendor = options?.hsmlibMachineVendor as string | undefined;
  const machineModel  = options?.hsmlibMachineModel  as string | undefined;
  const machineComment = (machineVendor || machineModel)
    ? `<!-- Machine: ${[machineVendor, machineModel].filter(Boolean).join(' ')} -->`
    : '';

  const parts = [
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`,
    `<?xml-stylesheet type='text/xsl' href='tool-library.xsl'?>`,
    `<!-- Generated by CNC Tool Converter -->`,
    machineComment,
    `<tool-library xmlns="http://www.hsmworks.com/xml/2004/cnc/tool-library" guid="${libraryGuid}" version="14">`,
    toolsXml,
    `</tool-library>`,
  ];

  const xml = parts.filter(Boolean).join('\n');

  const sourceFile = options?.filename as string | undefined;
  const baseName = sourceFile
    ? sourceFile.replace(/\.[^.]+$/, '')
    : 'converted-tools';

  return {
    content:  xml,
    filename: `${baseName}.hsmlib`,
    mimeType: 'application/xml',
    warnings,
  };
}
