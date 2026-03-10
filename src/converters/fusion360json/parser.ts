/**
 * Fusion 360 Cloud Tool Library JSON Parser
 *
 * Parses the JSON format exported from the Fusion 360 cloud tool library.
 * This is distinct from the .hsmlib (XML) format — the JSON format uses
 * abbreviated geometry keys (DC, NOF, OAL, etc.) and stores per-material
 * cutting parameters in start-values.presets[].
 */

import type { Tool, ToolType, ToolMaterial, CoolantMode } from '../../types/tool';
import type { ParseResult } from '../../types/converter';

function mapBMC(bmc: string | undefined): ToolMaterial | undefined {
  switch (bmc?.toLowerCase()) {
    case 'carbide':  return 'carbide';
    case 'hss':      return 'hss';
    case 'ceramics':
    case 'ceramic':  return 'ceramics';
    case 'diamond':  return 'diamond';
    default:         return undefined;
  }
}

function mapCoolant(c: string | undefined): CoolantMode {
  switch (c?.toLowerCase()) {
    case 'flood':    return 'flood';
    case 'air':      return 'air';
    case 'mist':     return 'mist';
    case 'suction':  return 'suction';
    default:         return 'disabled';
  }
}

function numOr(v: unknown, fallback?: number): number | undefined {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n)) return fallback;
  return n || fallback;
}

export async function parseFusion360JSON(
  input: string | ArrayBuffer,
  filename?: string,
): Promise<ParseResult> {
  const warnings: string[] = [];
  const errors:   string[] = [];
  const tools:    Tool[]   = [];

  const text = typeof input === 'string'
    ? input
    : new TextDecoder('utf-8').decode(input);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    errors.push(`JSON parse error in ${filename ?? 'file'}: ${err}`);
    return { tools, warnings, errors };
  }

  // Support both { data: [...] } and bare array formats
  const root = json as Record<string, unknown>;
  const dataArr: unknown[] = Array.isArray(root.data)
    ? root.data
    : Array.isArray(json) ? json as unknown[] : [];

  if (dataArr.length === 0) {
    if (!Array.isArray(root.data) && !Array.isArray(json)) {
      errors.push(
        `Unrecognised Fusion 360 JSON structure in ${filename ?? 'file'}. ` +
        `Expected { "data": [...] } or a bare array of tools.`,
      );
    } else {
      warnings.push(`No tools found in ${filename ?? 'file'}.`);
    }
    return { tools, warnings, errors };
  }

  dataArr.forEach((entry, index) => {
    try {
      const e   = entry as Record<string, unknown>;
      const geo = (e.geometry ?? {}) as Record<string, unknown>;
      const pp  = (e['post-process'] ?? {}) as Record<string, unknown>;

      // Use the first preset for default cutting params; store all presets
      const presetsRaw = ((e['start-values'] as Record<string, unknown>)?.presets ?? []) as Record<string, unknown>[];
      const p0  = presetsRaw[0] ?? {};

      const unit = e.unit === 'inches' ? 'inch' as const : 'mm' as const;
      const toolNumber = typeof pp.number === 'number' ? pp.number : index + 1;

      const tool: Tool = {
        id:           (e.guid as string)  || crypto.randomUUID(),
        toolNumber,
        type:         (e.type as ToolType) || 'custom',
        description:  (e.description as string)?.trim() || `Tool ${index + 1}`,
        manufacturer: (e.vendor as string)?.trim()       || undefined,
        productId:    (e['product-id'] as string)         || undefined,
        productLink:  (e['product-link'] as string)       || undefined,
        unit,

        geometry: {
          diameter:           (geo.DC   as number) ?? 0,
          shaftDiameter:      numOr(geo.SFDM),
          overallLength:      numOr(geo.OAL),
          bodyLength:         numOr(geo.LB),
          fluteLength:        numOr(geo.LCF),
          shoulderLength:     numOr(geo['shoulder-length'] as number),
          numberOfFlutes:     numOr(geo.NOF),
          cornerRadius:       numOr(geo.RE),
          taperAngle:         numOr(geo.TA),
          tipDiameter:        numOr(geo['tip-diameter'] as number),
          threadPitch:        numOr(geo.TP),
          threadProfileAngle: numOr(geo['thread-profile-angle'] as number),
          numberOfTeeth:      numOr(geo.NT),
          coolantSupport:     (geo.CSP as boolean) ?? false,
          pointAngle:         numOr(geo.SIG),
          shoulderDiameter:   numOr(geo['shoulder-diameter'] as number),
          tipLength:          numOr(geo['tip-length'] as number),
          tipOffset:          numOr(geo['tip-offset'] as number),
          profileRadius:      numOr(geo['profile-radius'] as number),
          nozzleDiameter:     numOr(geo.JET_NOZZLE_DIAMETER),
        },

        cutting: {
          spindleRpm:    numOr(p0.n),
          rampSpindleRpm:numOr(p0.n_ramp),
          feedCutting:   numOr(p0.v_f),
          feedPlunge:    numOr(p0.v_f_plunge),
          feedRamp:      numOr(p0.v_f_ramp),
          feedEntry:     numOr(p0.v_f_leadIn),
          feedExit:      numOr(p0.v_f_leadOut),
          coolant:       mapCoolant(p0['tool-coolant'] as string),
          clockwise:     (geo.HAND as boolean) ?? true,
          feedMode:      'per-minute',
        },

        nc: {
          breakControl:    (pp['break-control'] as boolean) ?? false,
          diameterOffset:  !!(pp['diameter-offset']),
          lengthOffset:    !!(pp['length-offset']),
          liveTool:        (pp.live as boolean) ?? false,
          manualToolChange:(pp['manual-tool-change'] as boolean) ?? false,
          turret:          (pp.turret as number) ?? 0,
        },

        material: mapBMC(e.BMC as string),

        // Convert all presets for round-trip fidelity
        presets: presetsRaw.map((p, i) => ({
          id:          (p.guid as string) || crypto.randomUUID(),
          name:        (p.name as string) || `Preset ${i + 1}`,
          description: (p.description as string) || undefined,
          parameters: {
            tool_coolant:         String(p['tool-coolant'] ?? ''),
            tool_spindleSpeed:    String(p.n     ?? ''),
            tool_rampSpindleSpeed:String(p.n_ramp ?? ''),
            tool_feedCutting:     String(p.v_f    ?? ''),
            tool_feedEntry:       String(p.v_f_leadIn  ?? ''),
            tool_feedExit:        String(p.v_f_leadOut  ?? ''),
            tool_feedPlunge:      String(p.v_f_plunge ?? ''),
            tool_feedRamp:        String(p.v_f_ramp   ?? ''),
            tool_feedTransition:  String(p.v_f_transition ?? ''),
            material_name:        String((p.material as Record<string, unknown>)?.category ?? 'all'),
          },
        })),

        sourceData: {
          BMC:           e.BMC,
          GRADE:         e.GRADE,
          sourceFile:    filename,
          // Circle segment round-trip fields
          axialDistance: geo['axial-distance'],
          upperRadius:   geo['upper-radius'],
          lowerRadius:   geo['lower-radius'],
          // Jet cutter round-trip
          jetHeadClearance: geo.JET_HEAD_CLEARANCE,
          // Form mill profile
          formProfile:   geo['profile'],
        },
      };

      tools.push(tool);
    } catch (err) {
      warnings.push(`Skipped tool at index ${index} in ${filename ?? 'file'}: ${err}`);
    }
  });

  return { tools, warnings, errors, metadata: { sourceFile: filename } };
}
