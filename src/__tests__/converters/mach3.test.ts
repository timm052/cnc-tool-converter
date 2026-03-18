import { describe, it, expect } from 'vitest';
import { parseMach3 } from '../../converters/mach3/parser';
import { writeMach3 } from '../../converters/mach3/writer';
import type { Tool } from '../../types/tool';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Native Mach3 export: no header row */
const MACH3_NO_HEADER = `1,"1/2 End Mill",0.5000,0.0000,4.2500,0.0000
2,"1/4 Drill",0.2500,0.0000,3.8750,0.0010
5,"3/8 Ball Mill",0.3750,0.0000,4.1250,0.0000`;

/** Export with an optional header row (some third-party exporters add one) */
const MACH3_WITH_HEADER = `Tool Number,Description,Diameter,Diameter Wear,Height,Height Wear
1,"1/2 End Mill",0.5000,0.0000,4.2500,0.0000
2,"1/4 Drill",0.2500,0.0000,3.8750,0.0010`;

const MINIMAL_TOOL: Tool = {
  id: 'test-id-1',
  toolNumber: 1,
  type: 'flat end mill',
  description: '1/2 End Mill',
  unit: 'inch',
  geometry: { diameter: 0.5 },
  offsets: { z: 4.25 },
};

// ── Parser tests ──────────────────────────────────────────────────────────────

describe('Mach3 parser', () => {
  it('parses tool numbers (no header)', async () => {
    const result = await parseMach3(MACH3_NO_HEADER, 'tools.csv');
    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(3);
    expect(result.tools[0].toolNumber).toBe(1);
    expect(result.tools[1].toolNumber).toBe(2);
    expect(result.tools[2].toolNumber).toBe(5);
  });

  it('parses diameter from column 3', async () => {
    const result = await parseMach3(MACH3_NO_HEADER, 'tools.csv');
    expect(result.tools[0].geometry.diameter).toBeCloseTo(0.5);
    expect(result.tools[1].geometry.diameter).toBeCloseTo(0.25);
    expect(result.tools[2].geometry.diameter).toBeCloseTo(0.375);
  });

  it('stores height in offsets.z', async () => {
    const result = await parseMach3(MACH3_NO_HEADER, 'tools.csv');
    expect(result.tools[0].offsets?.z).toBeCloseTo(4.25);
    expect(result.tools[1].offsets?.z).toBeCloseTo(3.875);
  });

  it('parses quoted description', async () => {
    const result = await parseMach3(MACH3_NO_HEADER, 'tools.csv');
    expect(result.tools[0].description).toBe('1/2 End Mill');
    expect(result.tools[1].description).toBe('1/4 Drill');
  });

  it('stores wear values in sourceData', async () => {
    const result = await parseMach3(MACH3_NO_HEADER, 'tools.csv');
    const sd = result.tools[1].sourceData as Record<string, number>;
    expect(sd.mach3HeightWear).toBeCloseTo(0.001);
  });

  it('detects and skips header row', async () => {
    const result = await parseMach3(MACH3_WITH_HEADER, 'tools.csv');
    expect(result.tools).toHaveLength(2);
    expect(result.tools[0].toolNumber).toBe(1);
  });

  it('skips zero-filled blank tool slots', async () => {
    const input = '1,"1/2 End Mill",0.5000,0.0000,4.2500,0.0000\n50,,0.0000,0.0000,0.0000,0.0000';
    const result = await parseMach3(input, 'tools.csv');
    expect(result.tools).toHaveLength(1);
  });

  it('handles quoted description containing comma', async () => {
    const input = '1,"Mill, 1/2 inch",0.5000,0.0000,4.2500,0.0000';
    const result = await parseMach3(input, 'tools.csv');
    expect(result.tools[0].description).toBe('Mill, 1/2 inch');
  });

  it('returns warning for empty file', async () => {
    const result = await parseMach3('', 'empty.csv');
    expect(result.tools).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('handles ArrayBuffer input', async () => {
    const buf = new TextEncoder().encode(MACH3_NO_HEADER).buffer;
    const result = await parseMach3(buf, 'test.csv');
    expect(result.tools).toHaveLength(3);
  });
});

// ── Writer tests ──────────────────────────────────────────────────────────────

describe('Mach3 writer', () => {
  it('writes CSV without header row', async () => {
    const result = await writeMach3([MINIMAL_TOOL]);
    const lines  = result.content.trim().split(/\r?\n/);
    // First line should start with a number (tool number), not a column label
    expect(lines[0]).toMatch(/^1,/);
  });

  it('writes correct column order', async () => {
    const result = await writeMach3([MINIMAL_TOOL]);
    const first  = result.content.trim().split(/\r?\n/)[0];
    const cols   = first.split(',');
    expect(cols[0]).toBe('1');           // Tool number
    expect(cols[1]).toBe('1/2 End Mill'); // Description (no quotes needed — no comma)
    expect(cols[2]).toBe('0.5000');      // Diameter
    expect(cols[4]).toBe('4.2500');      // Height
  });

  it('quotes descriptions containing commas', async () => {
    const tool = { ...MINIMAL_TOOL, description: 'Mill, 1/2"' };
    const result = await writeMach3([tool]);
    expect(result.content).toContain('"Mill, 1/2"""');
  });

  it('writes .csv file extension', async () => {
    const result = await writeMach3([MINIMAL_TOOL], { filename: 'my-mach3-table' });
    expect(result.filename).toBe('my-mach3-table.csv');
  });

  it('returns text/csv mime type', async () => {
    const result = await writeMach3([MINIMAL_TOOL]);
    expect(result.mimeType).toBe('text/csv');
  });

  it('preserves wear values from sourceData', async () => {
    const tool: Tool = {
      ...MINIMAL_TOOL,
      sourceData: { mach3DiaWear: 0.001, mach3HeightWear: 0.002 },
    };
    const result = await writeMach3([tool]);
    const cols   = result.content.trim().split(/\r?\n/)[0].split(',');
    expect(parseFloat(cols[3])).toBeCloseTo(0.001); // DiaWear
    expect(parseFloat(cols[5])).toBeCloseTo(0.002); // HeightWear
  });

  it('warns on empty tool list', async () => {
    const result = await writeMach3([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ── Round-trip tests ──────────────────────────────────────────────────────────

describe('Mach3 round-trip', () => {
  it('preserves tool numbers, descriptions, diameters, and heights', async () => {
    const tools: Tool[] = [
      { id: 'a', toolNumber: 1, type: 'flat end mill', description: '1/2 End Mill',  unit: 'inch', geometry: { diameter: 0.5   }, offsets: { z: 4.25 } },
      { id: 'b', toolNumber: 3, type: 'drill',          description: '3/8 Drill',     unit: 'inch', geometry: { diameter: 0.375 }, offsets: { z: 3.5  } },
      { id: 'c', toolNumber: 7, type: 'ball end mill',  description: 'Ball, 1/4 HSS', unit: 'inch', geometry: { diameter: 0.25  }, offsets: { z: 2.75 } },
    ];

    const written = await writeMach3(tools);
    const parsed  = await parseMach3(written.content, written.filename);

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.tools).toHaveLength(3);

    expect(parsed.tools[0].toolNumber).toBe(1);
    expect(parsed.tools[0].description).toBe('1/2 End Mill');
    expect(parsed.tools[0].geometry.diameter).toBeCloseTo(0.5);
    expect(parsed.tools[0].offsets?.z).toBeCloseTo(4.25);

    expect(parsed.tools[2].description).toBe('Ball, 1/4 HSS');
    expect(parsed.tools[2].geometry.diameter).toBeCloseTo(0.25);
  });
});
