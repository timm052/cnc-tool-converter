/**
 * Fusion 360 Cloud Tool Library JSON Writer
 *
 * Produces a JSON file compatible with Fusion 360's cloud tool library import.
 */

import type { Tool, CoolantMode } from '../../types/tool';
import type { WriteResult, WriteOptions } from '../../types/converter';

function bmc(material: string | undefined): string {
  switch (material) {
    case 'carbide':  return 'carbide';
    case 'hss':      return 'hss';
    case 'ceramics': return 'ceramics';
    case 'diamond':  return 'diamond';
    default:         return 'hss';
  }
}

function coolantStr(c: CoolantMode | undefined): string {
  switch (c) {
    case 'flood':   return 'flood';
    case 'air':     return 'air';
    case 'mist':    return 'mist';
    case 'suction': return 'suction';
    default:        return 'disabled';
  }
}

export async function writeFusion360JSON(
  tools: Tool[],
  options?: WriteOptions,
): Promise<WriteResult> {
  const warnings: string[] = [];

  if (tools.length === 0) {
    warnings.push('No tools to write.');
  }

  const data = tools.map((tool) => {
    const geo = tool.geometry;
    const cut = tool.cutting ?? {};
    const nc  = tool.nc ?? {};

    // Build presets — restore from stored presets or derive from cutting params
    const presets = (tool.presets && tool.presets.length > 0)
      ? tool.presets.map((p) => {
          const n    = parseFloat(p.parameters.tool_spindleSpeed ?? '0')    || (cut.spindleRpm ?? 0);
          const nRamp = parseFloat(p.parameters.tool_rampSpindleSpeed ?? '0') || (cut.rampSpindleRpm ?? cut.spindleRpm ?? 0);
          const vf   = parseFloat(p.parameters.tool_feedCutting ?? '0')     || (cut.feedCutting ?? 0);
          return {
            description:    p.description ?? '',
            guid:           p.id,
            name:           p.name,
            material:       { category: p.parameters.material_name ?? 'all', query: '', 'use-hardness': false },
            n,
            n_ramp:         nRamp,
            v_f:            vf,
            v_f_leadIn:     parseFloat(p.parameters.tool_feedEntry ?? '0')  || (cut.feedEntry ?? 0),
            v_f_leadOut:    parseFloat(p.parameters.tool_feedExit  ?? '0')  || (cut.feedExit  ?? 0),
            v_f_plunge:     parseFloat(p.parameters.tool_feedPlunge ?? '0') || (cut.feedPlunge ?? 0),
            v_f_ramp:       parseFloat(p.parameters.tool_feedRamp  ?? '0')  || (cut.feedRamp  ?? 0),
            v_f_transition: parseFloat(p.parameters.tool_feedTransition ?? '0') || vf,
            'tool-coolant': p.parameters.tool_coolant || coolantStr(cut.coolant),
            'ramp-angle':   2,
            'use-stepdown': false,
            'use-stepover': false,
            f_n: 0,
            f_z: 0,
            v_c: 0,
          };
        })
      : [{
          description:    '',
          guid:           crypto.randomUUID(),
          name:           'Default',
          material:       { category: 'all', query: '', 'use-hardness': false },
          n:              cut.spindleRpm    ?? 0,
          n_ramp:         cut.rampSpindleRpm ?? cut.spindleRpm ?? 0,
          v_f:            cut.feedCutting   ?? 0,
          v_f_leadIn:     cut.feedEntry     ?? 0,
          v_f_leadOut:    cut.feedExit      ?? 0,
          v_f_plunge:     cut.feedPlunge    ?? 0,
          v_f_ramp:       cut.feedRamp      ?? 0,
          v_f_transition: cut.feedCutting   ?? 0,
          'tool-coolant': coolantStr(cut.coolant),
          'ramp-angle':   2,
          'use-stepdown': false,
          'use-stepover': false,
          f_n: 0,
          f_z: 0,
          v_c: 0,
        }];

    return {
      BMC:   bmc(tool.material),
      GRADE: (tool.sourceData?.GRADE as string) ?? 'Mill Generic',
      description: tool.description,
      geometry: {
        CSP:  geo.coolantSupport ?? false,
        DC:   geo.diameter,
        HAND: cut.clockwise ?? true,
        LB:   geo.bodyLength    ?? 0,
        LCF:  geo.fluteLength   ?? 0,
        NOF:  geo.numberOfFlutes ?? 1,
        NT:   geo.numberOfTeeth  ?? 1,
        OAL:  geo.overallLength  ?? 0,
        RE:   geo.cornerRadius   ?? 0,
        SFDM: geo.shaftDiameter  ?? geo.diameter,
        ...(geo.pointAngle     !== undefined ? { SIG: geo.pointAngle }     : {}),
        TA:   geo.taperAngle     ?? 0,
        TP:   geo.threadPitch    ?? 0,
        ...(geo.nozzleDiameter !== undefined ? { JET_NOZZLE_DIAMETER: geo.nozzleDiameter, CW: 2 } : {}),
        ...(tool.sourceData?.jetHeadClearance !== undefined ? { JET_HEAD_CLEARANCE: tool.sourceData.jetHeadClearance } : {}),
        'assemblyGaugeLength':  0,
        'shoulder-diameter':    geo.shoulderDiameter ?? geo.diameter,
        'shoulder-length':      geo.shoulderLength ?? 0,
        'thread-profile-angle': geo.threadProfileAngle ?? 60,
        'tip-diameter':         geo.tipDiameter ?? 0,
        'tip-length':           geo.tipLength   ?? 0,
        'tip-offset':           geo.tipOffset   ?? 0,
        ...(geo.profileRadius  !== undefined ? { 'profile-radius': geo.profileRadius } : {}),
        ...(tool.sourceData?.axialDistance !== undefined ? { 'axial-distance': tool.sourceData.axialDistance } : {}),
        ...(tool.sourceData?.upperRadius   !== undefined ? { 'upper-radius':   tool.sourceData.upperRadius   } : {}),
        ...(tool.sourceData?.lowerRadius   !== undefined ? { 'lower-radius':   tool.sourceData.lowerRadius   } : {}),
        ...(tool.sourceData?.formProfile   !== undefined ? { profile:          tool.sourceData.formProfile   } : {}),
      },
      guid:   tool.id,
      'post-process': {
        'break-control':    nc.breakControl    ?? false,
        comment:            tool.comment       ?? '',
        'diameter-offset':  nc.diameterOffset  ? 1 : 0,
        'length-offset':    nc.lengthOffset    ? 1 : 0,
        live:               nc.liveTool        ?? false,
        'manual-tool-change': nc.manualToolChange ?? false,
        number:             tool.toolNumber,
        turret:             nc.turret          ?? 0,
      },
      'product-id':   tool.productId   ?? '',
      'product-link': tool.productLink ?? '',
      'start-values': { presets },
      type:   tool.type,
      unit:   tool.unit === 'inch' ? 'inches' : 'millimeters',
      vendor: tool.manufacturer ?? '',
    };
  });

  const sourceFile = options?.filename as string | undefined;
  const baseName   = sourceFile
    ? sourceFile.replace(/\.[^.]+$/, '')
    : 'fusion360-export';

  return {
    content:  JSON.stringify({ data }, null, 2),
    filename: `${baseName}.json`,
    mimeType: 'application/json',
    warnings,
  };
}
