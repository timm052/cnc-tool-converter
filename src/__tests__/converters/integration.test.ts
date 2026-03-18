/**
 * Integration tests against the real example tool files.
 *
 * These complement the unit tests (which use inline synthetic fixtures) by
 * parsing actual files from "Example Tool Files/", catching real-world format
 * quirks that hand-crafted fixtures might miss.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseHSMLib }       from '../../converters/hsmlib/parser';
import { parseLinuxCNC }     from '../../converters/linuxcnc/parser';
import { parseFusion360JSON } from '../../converters/fusion360json/parser';
import { parseRhinoCamVKB }  from '../../converters/rhinocam/parser';
import { parseHaas }   from '../../converters/haas/parser';
import { parseFanuc }  from '../../converters/fanuc/parser';
import { parseMach3 }  from '../../converters/mach3/parser';

// ── Path helpers ──────────────────────────────────────────────────────────────

const EXAMPLES = resolve(__dirname, '../../..', 'Example Files/Tool Libs');

function examplePath(...parts: string[]): string {
  return resolve(EXAMPLES, ...parts);
}

/** Read a file as an ArrayBuffer (needed for binary / UTF-16 files) */
function readAsArrayBuffer(filePath: string): ArrayBuffer {
  const buf = readFileSync(filePath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

// ── HSMLib / .hsmlib ─────────────────────────────────────────────────────────

describe('HSMLib integration — Fusion 360 Tool Export.hsmlib', () => {
  const FILE = examplePath('Fusion 360', 'Fusion 360 Tool Export.hsmlib');

  it('parses without errors', async () => {
    const result = await parseHSMLib(readAsArrayBuffer(FILE), FILE);
    expect(result.errors).toHaveLength(0);
  });

  it('returns 29 tools', async () => {
    const result = await parseHSMLib(readAsArrayBuffer(FILE), FILE);
    expect(result.tools).toHaveLength(29);
  });

  it('first tool has correct id, type and description', async () => {
    const result = await parseHSMLib(readAsArrayBuffer(FILE), FILE);
    const t = result.tools[0];
    expect(t.id).toBe('{00000000-0000-0000-0000-000000000001}');
    expect(t.type).toBe('ball end mill');
    expect(t.description).toBe('Example Bit');
    expect(t.unit).toBe('mm');
  });

  it('every tool has a valid diameter ≥ 0', async () => {
    const result = await parseHSMLib(readAsArrayBuffer(FILE), FILE);
    for (const tool of result.tools) {
      expect(tool.geometry.diameter).toBeGreaterThanOrEqual(0);
    }
  });

  it('every tool has a unique id', async () => {
    const result = await parseHSMLib(readAsArrayBuffer(FILE), FILE);
    const ids = result.tools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('HSMLib integration — InventorCAM 100 1F Wood.hsmlib', () => {
  const FILE = examplePath('InventorCAM', '100 1F Wood.hsmlib');

  it('parses without errors', async () => {
    const result = await parseHSMLib(readAsArrayBuffer(FILE), FILE);
    expect(result.errors).toHaveLength(0);
  });

  it('returns 7 tools', async () => {
    const result = await parseHSMLib(readAsArrayBuffer(FILE), FILE);
    expect(result.tools).toHaveLength(7);
  });

  it('all tools have cutting parameters (spindle RPM)', async () => {
    const result = await parseHSMLib(readAsArrayBuffer(FILE), FILE);
    for (const tool of result.tools) {
      expect(tool.cutting?.spindleRpm).toBeGreaterThan(0);
    }
  });
});

describe('HSMLib integration — InventorCAM 000 Utility.hsmlib (empty library)', () => {
  const FILE = examplePath('InventorCAM', '000 Utility.hsmlib');

  it('parses without errors', async () => {
    const result = await parseHSMLib(readAsArrayBuffer(FILE), FILE);
    expect(result.errors).toHaveLength(0);
  });

  it('returns 0 tools with a warning', async () => {
    const result = await parseHSMLib(readAsArrayBuffer(FILE), FILE);
    expect(result.tools).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('HSMLib integration — all InventorCAM libraries', () => {
  const FILES: { name: string; expectedCount: number }[] = [
    { name: '000 Utility.hsmlib',            expectedCount: 0  },
    { name: '100 1F Wood.hsmlib',             expectedCount: 7  },
    { name: '200 2F Wood.hsmlib',             expectedCount: 19 },
    { name: '300 3F Wood.hsmlib',             expectedCount: 0  },
    { name: '400 4F Wood.hsmlib',             expectedCount: 1  },
    { name: '500 Chamfer Bits.hsmlib',        expectedCount: 6  },
    { name: '700 Special Bits.hsmlib',        expectedCount: 5  },
    { name: '800 Router Bits.hsmlib',         expectedCount: 2  },
    { name: '900 Engraving & Cutting.hsmlib', expectedCount: 2  },
  ];

  for (const { name, expectedCount } of FILES) {
    it(`${name} — parses without errors and returns ${expectedCount} tool(s)`, async () => {
      const path   = examplePath('InventorCAM', name);
      const result = await parseHSMLib(readAsArrayBuffer(path), path);
      expect(result.errors).toHaveLength(0);
      expect(result.tools).toHaveLength(expectedCount);
    });
  }

  it('all tools across all non-empty libraries have a diameter > 0', async () => {
    for (const { name } of FILES) {
      const path   = examplePath('InventorCAM', name);
      const result = await parseHSMLib(readAsArrayBuffer(path), path);
      for (const tool of result.tools) {
        expect(tool.geometry.diameter).toBeGreaterThan(0);
      }
    }
  });
});

// ── LinuxCNC / .tbl ───────────────────────────────────────────────────────────

describe('LinuxCNC integration — 200 2F Wood(1).tbl', () => {
  const FILE = examplePath('LinuxCNC', '200 2F Wood(1).tbl');

  it('parses without errors', async () => {
    const result = await parseLinuxCNC(readFileSync(FILE, 'utf-8'), FILE);
    expect(result.errors).toHaveLength(0);
  });

  it('returns 19 tools', async () => {
    const result = await parseLinuxCNC(readFileSync(FILE, 'utf-8'), FILE);
    expect(result.tools).toHaveLength(19);
  });

  it('first tool is T2700 with diameter 10', async () => {
    const result = await parseLinuxCNC(readFileSync(FILE, 'utf-8'), FILE);
    const t = result.tools[0];
    expect(t.toolNumber).toBe(2700);
    expect(t.pocketNumber).toBe(2700);
    expect(t.geometry.diameter).toBe(10);
    expect(t.description).toContain('Ball Endmill');
  });

  it('all tools have a valid tool number and diameter ≥ 0', async () => {
    const result = await parseLinuxCNC(readFileSync(FILE, 'utf-8'), FILE);
    for (const tool of result.tools) {
      expect(tool.toolNumber).toBeGreaterThan(0);
      expect(tool.geometry.diameter).toBeGreaterThanOrEqual(0);
    }
  });

  it('all tools have unique tool numbers', async () => {
    const result = await parseLinuxCNC(readFileSync(FILE, 'utf-8'), FILE);
    const nums = result.tools.map((t) => t.toolNumber);
    expect(new Set(nums).size).toBe(nums.length);
  });
});

// ── Fusion 360 Cloud JSON ─────────────────────────────────────────────────────

describe('Fusion360JSON integration — Fusion Tool Libary.json', () => {
  const FILE = examplePath('Fusion 360', 'Fusion Tool Libary.json');

  it('parses without errors', async () => {
    const result = await parseFusion360JSON(readFileSync(FILE, 'utf-8'), FILE);
    expect(result.errors).toHaveLength(0);
  });

  it('returns 30 tools', async () => {
    const result = await parseFusion360JSON(readFileSync(FILE, 'utf-8'), FILE);
    expect(result.tools).toHaveLength(30);
  });

  it('first tool has correct guid, type, description, diameter', async () => {
    const result = await parseFusion360JSON(readFileSync(FILE, 'utf-8'), FILE);
    const t = result.tools[0];
    expect(t.id).toBe('78c47213-a6cb-4bd1-8fd9-6b03bdb6b568');
    expect(t.type).toBe('ball end mill');
    expect(t.description).toBe('Example Bit');
    expect(t.geometry.diameter).toBe(2);
    expect(t.unit).toBe('mm');
  });

  it('every tool has a unique guid', async () => {
    const result = await parseFusion360JSON(readFileSync(FILE, 'utf-8'), FILE);
    const ids = result.tools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every tool has a valid diameter ≥ 0', async () => {
    const result = await parseFusion360JSON(readFileSync(FILE, 'utf-8'), FILE);
    for (const tool of result.tools) {
      expect(tool.geometry.diameter).toBeGreaterThanOrEqual(0);
    }
  });

  it('at least half of tools have cutting parameters', async () => {
    const result = await parseFusion360JSON(readFileSync(FILE, 'utf-8'), FILE);
    const withCutting = result.tools.filter(
      (t) => t.cutting?.spindleRpm && t.cutting.spindleRpm > 0,
    );
    expect(withCutting.length).toBeGreaterThan(result.tools.length / 2);
  });
});

// ── RhinoCAM / .vkb ──────────────────────────────────────────────────────────

describe('RhinoCAM integration — RhinoCAM.vkb', () => {
  const FILE = examplePath('RhinoCAM', 'RhinoCAM.vkb');

  it('parses without errors', async () => {
    const result = await parseRhinoCamVKB(readAsArrayBuffer(FILE), FILE);
    expect(result.errors).toHaveLength(0);
  });

  it('returns 6 named tool records (3 empty records are skipped)', async () => {
    const result = await parseRhinoCamVKB(readAsArrayBuffer(FILE), FILE);
    expect(result.tools).toHaveLength(6);
  });

  it('correctly infers tool types from names', async () => {
    const result = await parseRhinoCamVKB(readAsArrayBuffer(FILE), FILE);
    const byName = Object.fromEntries(result.tools.map((t) => [t.description, t.type]));
    expect(byName['BallMill1']).toBe('ball end mill');
    expect(byName['CRadMill1']).toBe('bull nose end mill');
    expect(byName['ChamferMill1']).toBe('chamfer mill');
    expect(byName['Thread Mill1']).toBe('thread mill');
    expect(byName['DoveTailMill1']).toBe('tapered mill');
    expect(byName['LollipopMill1']).toBe('lollipop mill');
  });

  it('all tools have diameter 6', async () => {
    const result = await parseRhinoCamVKB(readAsArrayBuffer(FILE), FILE);
    for (const tool of result.tools) {
      expect(tool.geometry.diameter).toBe(6);
    }
  });

  it('all tools have sourceData with rhinocamName and sourceFile', async () => {
    const result = await parseRhinoCamVKB(readAsArrayBuffer(FILE), FILE);
    for (const tool of result.tools) {
      expect(tool.sourceData?.rhinocamName).toBeTruthy();
      expect(tool.sourceData?.sourceFile).toBe(FILE);
    }
  });
});

// ── HAAS / .ofs ───────────────────────────────────────────────────────────────

describe('HAAS integration — example.ofs', () => {
  const FILE = examplePath('HAAS', 'example.ofs');

  it('parses without errors', async () => {
    const result = await parseHaas(readFileSync(FILE, 'utf-8'), FILE);
    expect(result.errors).toHaveLength(0);
  });

  it('returns 8 tools', async () => {
    const result = await parseHaas(readFileSync(FILE, 'utf-8'), FILE);
    expect(result.tools).toHaveLength(8);
  });

  it('every tool has toolNumber > 0 and diameter ≥ 0', async () => {
    const result = await parseHaas(readFileSync(FILE, 'utf-8'), FILE);
    for (const tool of result.tools) {
      expect(tool.toolNumber).toBeGreaterThan(0);
      expect(tool.geometry.diameter).toBeGreaterThanOrEqual(0);
    }
  });

  it('first tool has correct offset and diameter', async () => {
    const result = await parseHaas(readFileSync(FILE, 'utf-8'), FILE);
    const t1 = result.tools.find((t) => t.toolNumber === 1)!;
    expect(t1).toBeDefined();
    expect(t1.offsets?.z).toBeCloseTo(203.2, 3);
    expect(t1.geometry.diameter).toBeCloseTo(12.7, 3);
  });

  it('all tools have sourceData with haasLengthWear and haasDiaWear', async () => {
    const result = await parseHaas(readFileSync(FILE, 'utf-8'), FILE);
    for (const tool of result.tools) {
      expect(tool.sourceData).toHaveProperty('haasLengthWear');
      expect(tool.sourceData).toHaveProperty('haasDiaWear');
    }
  });
});

// ── Fanuc G10 / .nc ───────────────────────────────────────────────────────────

describe('Fanuc integration — example.nc', () => {
  const FILE = examplePath('Fanuc', 'example.nc');

  it('parses without errors', async () => {
    const result = await parseFanuc(readFileSync(FILE, 'utf-8'), FILE);
    expect(result.errors).toHaveLength(0);
  });

  it('returns 5 tools', async () => {
    const result = await parseFanuc(readFileSync(FILE, 'utf-8'), FILE);
    expect(result.tools).toHaveLength(5);
  });

  it('every tool has toolNumber > 0 and diameter ≥ 0', async () => {
    const result = await parseFanuc(readFileSync(FILE, 'utf-8'), FILE);
    for (const tool of result.tools) {
      expect(tool.toolNumber).toBeGreaterThan(0);
      expect(tool.geometry.diameter).toBeGreaterThanOrEqual(0);
    }
  });

  it('first tool has correct length geometry and diameter', async () => {
    const result = await parseFanuc(readFileSync(FILE, 'utf-8'), FILE);
    const t1 = result.tools.find((t) => t.toolNumber === 1)!;
    expect(t1).toBeDefined();
    expect(t1.offsets?.z).toBeCloseTo(203.2, 3);
    expect(t1.geometry.diameter).toBeCloseTo(12.7, 3);
  });

  it('all tools have sourceData with fanucLenWear and fanucDiaWear', async () => {
    const result = await parseFanuc(readFileSync(FILE, 'utf-8'), FILE);
    for (const tool of result.tools) {
      expect(tool.sourceData).toHaveProperty('fanucLenWear');
      expect(tool.sourceData).toHaveProperty('fanucDiaWear');
    }
  });
});

// ── Mach3 / .csv ─────────────────────────────────────────────────────────────

describe('Mach3 integration — tooltable.csv', () => {
  const FILE = examplePath('Mach3', 'tooltable.csv');

  it('parses without errors', async () => {
    const result = await parseMach3(readFileSync(FILE, 'utf-8'), FILE);
    expect(result.errors).toHaveLength(0);
  });

  it('returns 8 tools', async () => {
    const result = await parseMach3(readFileSync(FILE, 'utf-8'), FILE);
    expect(result.tools).toHaveLength(8);
  });

  it('every tool has toolNumber > 0 and diameter ≥ 0', async () => {
    const result = await parseMach3(readFileSync(FILE, 'utf-8'), FILE);
    for (const tool of result.tools) {
      expect(tool.toolNumber).toBeGreaterThan(0);
      expect(tool.geometry.diameter).toBeGreaterThanOrEqual(0);
    }
  });

  it('first tool has correct description and diameter', async () => {
    const result = await parseMach3(readFileSync(FILE, 'utf-8'), FILE);
    const t1 = result.tools.find((t) => t.toolNumber === 1)!;
    expect(t1).toBeDefined();
    expect(t1.description).toBe('1/2 Flat End Mill');
    expect(t1.geometry.diameter).toBeCloseTo(0.5, 4);
    expect(t1.offsets?.z).toBeCloseTo(4.25, 4);
  });

  it('all tools have sourceData with mach3DiaWear and mach3HeightWear', async () => {
    const result = await parseMach3(readFileSync(FILE, 'utf-8'), FILE);
    for (const tool of result.tools) {
      expect(tool.sourceData).toHaveProperty('mach3DiaWear');
      expect(tool.sourceData).toHaveProperty('mach3HeightWear');
    }
  });
});
