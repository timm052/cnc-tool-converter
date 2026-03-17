import { describe, it, expect } from 'vitest';
import { parseFusion360JSON } from '../../converters/fusion360json/parser';
import { writeFusion360JSON } from '../../converters/fusion360json/writer';
import type { Tool } from '../../types/tool';

// ── Fixtures ────────────────────────────────────────────────────────────────

const FLAT_END_MILL_ENTRY = {
  guid: 'f360-guid-1',
  type: 'flat end mill',
  description: '10mm Flat End Mill',
  vendor: 'Sandvik',
  'product-id': 'R216.3',
  'product-link': 'https://example.com/tool',
  unit: 'millimeters',
  BMC: 'carbide',
  GRADE: 'GC4240',
  geometry: {
    DC: 10,
    SFDM: 10,
    OAL: 72,
    LB: 32,
    LCF: 22,
    'shoulder-length': 30,
    NOF: 4,
    RE: 0,
    TA: 0,
    CSP: true,
    HAND: true,
  },
  'post-process': {
    number: 1,
    'break-control': true,
    'diameter-offset': 1,
    'length-offset': 1,
    live: false,
    'manual-tool-change': false,
    turret: 0,
    comment: 'roughing tool',
  },
  'start-values': {
    presets: [
      {
        guid: 'preset-guid-1',
        name: 'Aluminium',
        description: 'Al 6061 preset',
        n: 8000,
        n_ramp: 4000,
        v_f: 1200,
        v_f_plunge: 400,
        v_f_ramp: 600,
        v_f_leadIn: 800,
        v_f_leadOut: 800,
        v_f_transition: 1200,
        'tool-coolant': 'flood',
        'ramp-angle': 2,
        'use-stepdown': false,
        'use-stepover': false,
        f_n: 0,
        f_z: 0,
        v_c: 0,
        material: { category: 'aluminium', query: '', 'use-hardness': false },
      },
    ],
  },
};

const DRILL_ENTRY = {
  guid: 'f360-guid-2',
  type: 'drill',
  description: '6mm Drill',
  unit: 'millimeters',
  BMC: 'hss',
  geometry: {
    DC: 6,
    OAL: 60,
    LCF: 30,
    NOF: 2,
    SIG: 118,
    'tip-diameter': 0,
    'tip-length': 1.8,
  },
  'post-process': { number: 2 },
  'start-values': { presets: [] },
};

const VALID_JSON = JSON.stringify({ data: [FLAT_END_MILL_ENTRY, DRILL_ENTRY] });
const BARE_ARRAY_JSON = JSON.stringify([FLAT_END_MILL_ENTRY]);

const MINIMAL_TOOL: Tool = {
  id: 'test-id-1',
  toolNumber: 1,
  type: 'flat end mill',
  description: '10mm Flat End Mill',
  manufacturer: 'Sandvik',
  unit: 'mm',
  geometry: { diameter: 10, numberOfFlutes: 4, fluteLength: 22, overallLength: 72 },
  cutting: { spindleRpm: 8000, feedCutting: 1200, feedPlunge: 400, coolant: 'flood' },
};

// ── Parser tests ─────────────────────────────────────────────────────────────

describe('Fusion360JSON parser', () => {
  it('parses { data: [...] } wrapper format', async () => {
    const result = await parseFusion360JSON(VALID_JSON, 'test.json');
    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(2);
  });

  it('parses bare array format', async () => {
    const result = await parseFusion360JSON(BARE_ARRAY_JSON, 'test.json');
    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(1);
  });

  it('returns error on invalid JSON', async () => {
    const result = await parseFusion360JSON('not json at all', 'bad.json');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.tools).toHaveLength(0);
  });

  it('returns error on unrecognised JSON structure', async () => {
    const result = await parseFusion360JSON('{"foo":"bar"}', 'bad.json');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.tools).toHaveLength(0);
  });

  it('returns warning on empty data array', async () => {
    const result = await parseFusion360JSON('{"data":[]}', 'empty.json');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.tools).toHaveLength(0);
  });

  it('maps tool id, type, description, vendor', async () => {
    const result = await parseFusion360JSON(VALID_JSON, 'test.json');
    const tool = result.tools[0];
    expect(tool.id).toBe('f360-guid-1');
    expect(tool.type).toBe('flat end mill');
    expect(tool.description).toBe('10mm Flat End Mill');
    expect(tool.manufacturer).toBe('Sandvik');
    expect(tool.productId).toBe('R216.3');
    expect(tool.productLink).toBe('https://example.com/tool');
    expect(tool.unit).toBe('mm');
  });

  it('maps geometry fields', async () => {
    const result = await parseFusion360JSON(VALID_JSON, 'test.json');
    const geo = result.tools[0].geometry;
    expect(geo.diameter).toBe(10);
    expect(geo.shaftDiameter).toBe(10);
    expect(geo.overallLength).toBe(72);
    expect(geo.bodyLength).toBe(32);
    expect(geo.fluteLength).toBe(22);
    expect(geo.shoulderLength).toBe(30);
    expect(geo.numberOfFlutes).toBe(4);
    expect(geo.coolantSupport).toBe(true);
  });

  it('maps pointAngle (SIG field) for drills', async () => {
    const result = await parseFusion360JSON(VALID_JSON, 'test.json');
    const drill = result.tools[1];
    expect(drill.geometry.pointAngle).toBe(118);
    expect(drill.geometry.tipLength).toBeCloseTo(1.8);
  });

  it('maps cutting parameters from first preset', async () => {
    const result = await parseFusion360JSON(VALID_JSON, 'test.json');
    const cut = result.tools[0].cutting!;
    expect(cut.spindleRpm).toBe(8000);
    expect(cut.rampSpindleRpm).toBe(4000);
    expect(cut.feedCutting).toBe(1200);
    expect(cut.feedPlunge).toBe(400);
    expect(cut.feedRamp).toBe(600);
    expect(cut.feedEntry).toBe(800);
    expect(cut.feedExit).toBe(800);
    expect(cut.coolant).toBe('flood');
    expect(cut.clockwise).toBe(true);
  });

  it('maps NC properties', async () => {
    const result = await parseFusion360JSON(VALID_JSON, 'test.json');
    const nc = result.tools[0].nc!;
    expect(nc.breakControl).toBe(true);
    expect(nc.diameterOffset).toBe(true);
    expect(nc.lengthOffset).toBe(true);
    expect(nc.liveTool).toBe(false);
    expect(nc.manualToolChange).toBe(false);
    expect(nc.turret).toBe(0);
  });

  it('maps material (BMC field)', async () => {
    const result = await parseFusion360JSON(VALID_JSON, 'test.json');
    expect(result.tools[0].material).toBe('carbide');
    expect(result.tools[1].material).toBe('hss');
  });

  it('stores all presets with names and parameters', async () => {
    const result = await parseFusion360JSON(VALID_JSON, 'test.json');
    const tool = result.tools[0];
    expect(tool.presets).toHaveLength(1);
    expect(tool.presets![0].name).toBe('Aluminium');
    expect(tool.presets![0].parameters.tool_spindleSpeed).toBe('8000');
    expect(tool.presets![0].parameters.tool_coolant).toBe('flood');
    expect(tool.presets![0].parameters.material_name).toBe('aluminium');
  });

  it('stores sourceData for round-trip fields', async () => {
    const result = await parseFusion360JSON(VALID_JSON, 'test.json');
    expect(result.tools[0].sourceData?.BMC).toBe('carbide');
    expect(result.tools[0].sourceData?.GRADE).toBe('GC4240');
    expect(result.tools[0].sourceData?.sourceFile).toBe('test.json');
  });

  it('uses index+1 as toolNumber when post-process.number missing', async () => {
    const entry = { ...FLAT_END_MILL_ENTRY, 'post-process': {} };
    const result = await parseFusion360JSON(JSON.stringify({ data: [entry] }), 'test.json');
    expect(result.tools[0].toolNumber).toBe(1);
  });

  it('skips malformed tool entries and adds warning', async () => {
    const badEntry = null;
    const json = JSON.stringify({ data: [FLAT_END_MILL_ENTRY, badEntry] });
    const result = await parseFusion360JSON(json, 'test.json');
    expect(result.tools).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ── Writer tests ──────────────────────────────────────────────────────────────

describe('Fusion360JSON writer', () => {
  it('produces valid JSON with data array', async () => {
    const result = await writeFusion360JSON([MINIMAL_TOOL]);
    expect(result.warnings).toHaveLength(0);
    const parsed = JSON.parse(result.content as string);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data).toHaveLength(1);
  });

  it('sets correct filename extension', async () => {
    const result = await writeFusion360JSON([MINIMAL_TOOL]);
    expect(result.filename).toMatch(/\.json$/);
  });

  it('writes required geometry fields', async () => {
    const result = await writeFusion360JSON([MINIMAL_TOOL]);
    const entry = JSON.parse(result.content as string).data[0];
    expect(entry.geometry.DC).toBe(10);
    expect(entry.geometry.NOF).toBe(4);
    expect(entry.geometry.LCF).toBe(22);
    expect(entry.geometry.OAL).toBe(72);
  });

  it('writes tool type, description, vendor', async () => {
    const result = await writeFusion360JSON([MINIMAL_TOOL]);
    const entry = JSON.parse(result.content as string).data[0];
    expect(entry.type).toBe('flat end mill');
    expect(entry.description).toBe('10mm Flat End Mill');
    expect(entry.vendor).toBe('Sandvik');
  });

  it('derives default preset from cutting params when no presets stored', async () => {
    const result = await writeFusion360JSON([MINIMAL_TOOL]);
    const entry = JSON.parse(result.content as string).data[0];
    const presets = entry['start-values'].presets;
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('Default');
    expect(presets[0].n).toBe(8000);
    expect(presets[0].v_f).toBe(1200);
    expect(presets[0]['tool-coolant']).toBe('flood');
  });

  it('warns when writing empty tool list', async () => {
    const result = await writeFusion360JSON([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('uses stored presets when available (round-trip)', async () => {
    const toolWithPresets: Tool = {
      ...MINIMAL_TOOL,
      presets: [{
        id: 'p-guid-1',
        name: 'Steel',
        description: 'Steel preset',
        parameters: {
          tool_spindleSpeed: '5000',
          tool_rampSpindleSpeed: '2500',
          tool_feedCutting: '800',
          tool_feedEntry: '500',
          tool_feedExit: '500',
          tool_feedPlunge: '300',
          tool_feedRamp: '400',
          tool_feedTransition: '800',
          tool_coolant: 'mist',
          material_name: 'steel',
        },
      }],
    };
    const result = await writeFusion360JSON([toolWithPresets]);
    const entry = JSON.parse(result.content as string).data[0];
    const presets = entry['start-values'].presets;
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('Steel');
    expect(presets[0].guid).toBe('p-guid-1');
    expect(presets[0]['tool-coolant']).toBe('mist');
    expect(presets[0].material.category).toBe('steel');
  });
});

// ── Round-trip tests ──────────────────────────────────────────────────────────

describe('Fusion360JSON round-trip', () => {
  it('parse → write → parse preserves tool count', async () => {
    const first = await parseFusion360JSON(VALID_JSON, 'test.json');
    const written = await writeFusion360JSON(first.tools);
    const second = await parseFusion360JSON(written.content as string, 'roundtrip.json');
    expect(second.errors).toHaveLength(0);
    expect(second.tools).toHaveLength(first.tools.length);
  });

  it('round-trip preserves type, description, diameter', async () => {
    const first = await parseFusion360JSON(VALID_JSON, 'test.json');
    const written = await writeFusion360JSON(first.tools);
    const second = await parseFusion360JSON(written.content as string, 'roundtrip.json');
    expect(second.tools[0].type).toBe(first.tools[0].type);
    expect(second.tools[0].description).toBe(first.tools[0].description);
    expect(second.tools[0].geometry.diameter).toBe(first.tools[0].geometry.diameter);
  });

  it('round-trip preserves cutting parameters via preset', async () => {
    const first = await parseFusion360JSON(VALID_JSON, 'test.json');
    const written = await writeFusion360JSON(first.tools);
    const second = await parseFusion360JSON(written.content as string, 'roundtrip.json');
    expect(second.tools[0].cutting?.spindleRpm).toBe(first.tools[0].cutting?.spindleRpm);
    expect(second.tools[0].cutting?.feedCutting).toBe(first.tools[0].cutting?.feedCutting);
  });

  it('round-trip preserves material', async () => {
    const first = await parseFusion360JSON(VALID_JSON, 'test.json');
    const written = await writeFusion360JSON(first.tools);
    const second = await parseFusion360JSON(written.content as string, 'roundtrip.json');
    expect(second.tools[0].material).toBe(first.tools[0].material);
  });
});
