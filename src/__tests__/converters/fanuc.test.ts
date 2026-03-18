import { describe, it, expect } from 'vitest';
import { parseFanuc } from '../../converters/fanuc/parser';
import { writeFanuc } from '../../converters/fanuc/writer';
import type { Tool } from '../../types/tool';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const G10_FILE = `%
O9999 (TOOL OFFSETS)
(H = LENGTH GEOMETRY/WEAR, D = DIAMETER GEOMETRY/WEAR)
G90
G10 L10 P1 R200.0000 (T1 H GEO - 1/2 ENDMILL)
G10 L11 P1 R0.0000 (T1 H WEAR)
G10 L12 P1 R12.7000 (T1 D GEO)
G10 L13 P1 R0.0000 (T1 D WEAR)
G10 L10 P2 R195.3750 (T2 H GEO - 1/4 DRILL)
G10 L11 P2 R0.0050 (T2 H WEAR)
G10 L12 P2 R6.3500 (T2 D GEO)
G10 L13 P2 R0.0010 (T2 D WEAR)
G10 L10 P5 R182.0000 (T5 H GEO - 3/8 BALL)
G10 L12 P5 R9.5250 (T5 D GEO)
M30
%`;

const MINIMAL_TOOL: Tool = {
  id: 'test-id-1',
  toolNumber: 1,
  type: 'flat end mill',
  description: '12mm End Mill',
  unit: 'mm',
  geometry: { diameter: 12 },
  offsets: { z: 200.0 },
};

// ── Parser tests ──────────────────────────────────────────────────────────────

describe('Fanuc G10 parser', () => {
  it('parses tool numbers from P word', async () => {
    const result = await parseFanuc(G10_FILE, 'offsets.nc');
    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(3);
    expect(result.tools[0].toolNumber).toBe(1);
    expect(result.tools[1].toolNumber).toBe(2);
    expect(result.tools[2].toolNumber).toBe(5);
  });

  it('parses diameter from L12 (D geometry)', async () => {
    const result = await parseFanuc(G10_FILE, 'offsets.nc');
    expect(result.tools[0].geometry.diameter).toBeCloseTo(12.7);
    expect(result.tools[1].geometry.diameter).toBeCloseTo(6.35);
    expect(result.tools[2].geometry.diameter).toBeCloseTo(9.525);
  });

  it('stores L10 (H geometry) in offsets.z', async () => {
    const result = await parseFanuc(G10_FILE, 'offsets.nc');
    expect(result.tools[0].offsets?.z).toBeCloseTo(200.0);
    expect(result.tools[1].offsets?.z).toBeCloseTo(195.375);
    expect(result.tools[2].offsets?.z).toBeCloseTo(182.0);
  });

  it('stores wear values in sourceData', async () => {
    const result = await parseFanuc(G10_FILE, 'offsets.nc');
    const sd = result.tools[1].sourceData as Record<string, number>;
    expect(sd.fanucLenWear).toBeCloseTo(0.005);
    expect(sd.fanucDiaWear).toBeCloseTo(0.001);
  });

  it('skips G10 lines missing L, P, or R', async () => {
    const input = 'G10 L10 P1 R100.0\nG10 L12\nG10 P2 R5.0';
    const result = await parseFanuc(input);
    expect(result.tools).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('skips non-G10 lines (M30, G90, O words)', async () => {
    const result = await parseFanuc(G10_FILE, 'offsets.nc');
    expect(result.tools).toHaveLength(3); // not confused by M30/G90/O9999
  });

  it('strips inline comments before parsing words', async () => {
    const input = 'G10 L10 P3 R50.0000 (some comment with P4 R99.0)';
    const result = await parseFanuc(input);
    expect(result.tools[0].toolNumber).toBe(3);
    expect(result.tools[0].offsets?.z).toBeCloseTo(50.0);
  });

  it('returns warning for empty file', async () => {
    const result = await parseFanuc('%\nM30\n%', 'empty.nc');
    expect(result.tools).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('handles ArrayBuffer input', async () => {
    const buf = new TextEncoder().encode(G10_FILE).buffer;
    const result = await parseFanuc(buf, 'test.nc');
    expect(result.tools).toHaveLength(3);
  });

  it('tools are sorted by register number', async () => {
    const input = 'G10 L10 P5 R100.0\nG10 L12 P5 R6.0\nG10 L10 P1 R200.0\nG10 L12 P1 R12.0';
    const result = await parseFanuc(input);
    expect(result.tools[0].toolNumber).toBe(1);
    expect(result.tools[1].toolNumber).toBe(5);
  });
});

// ── Writer tests ──────────────────────────────────────────────────────────────

describe('Fanuc G10 writer', () => {
  it('writes G10 L10 for length geometry', async () => {
    const result = await writeFanuc([MINIMAL_TOOL]);
    expect(result.content).toMatch(/G10 L10 P1 R200\.0000/);
  });

  it('writes G10 L12 for diameter geometry', async () => {
    const result = await writeFanuc([MINIMAL_TOOL]);
    expect(result.content).toMatch(/G10 L12 P1 R12\.0000/);
  });

  it('writes all four L codes per tool', async () => {
    const result = await writeFanuc([MINIMAL_TOOL]);
    expect(result.content).toMatch(/G10 L10 P1/);
    expect(result.content).toMatch(/G10 L11 P1/);
    expect(result.content).toMatch(/G10 L12 P1/);
    expect(result.content).toMatch(/G10 L13 P1/);
  });

  it('uses P = toolNumber', async () => {
    const tool = { ...MINIMAL_TOOL, toolNumber: 7 };
    const result = await writeFanuc([tool]);
    expect(result.content).toMatch(/G10 L10 P7/);
  });

  it('writes .nc file extension', async () => {
    const result = await writeFanuc([MINIMAL_TOOL], { filename: 'machine-a' });
    expect(result.filename).toBe('machine-a.nc');
  });

  it('includes % tape delimiters', async () => {
    const result = await writeFanuc([MINIMAL_TOOL]);
    const lines = result.content.split(/\r?\n/);
    expect(lines[0]).toBe('%');
    expect(lines[lines.length - 2]).toBe('%');
  });

  it('includes M30 before final %', async () => {
    const result = await writeFanuc([MINIMAL_TOOL]);
    expect(result.content).toMatch(/M30/);
  });

  it('preserves wear values from sourceData', async () => {
    const tool: Tool = {
      ...MINIMAL_TOOL,
      sourceData: { fanucLenWear: 0.005, fanucDiaWear: 0.001 },
    };
    const result = await writeFanuc([tool]);
    expect(result.content).toMatch(/G10 L11 P1 R0\.0050/);
    expect(result.content).toMatch(/G10 L13 P1 R0\.0010/);
  });

  it('warns on empty tool list', async () => {
    const result = await writeFanuc([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ── Round-trip tests ──────────────────────────────────────────────────────────

describe('Fanuc G10 round-trip', () => {
  it('preserves tool numbers, diameters, and length offsets', async () => {
    const tools: Tool[] = [
      { id: 'a', toolNumber: 1,  type: 'flat end mill', description: 'EM 12mm', unit: 'mm', geometry: { diameter: 12    }, offsets: { z: 200 } },
      { id: 'b', toolNumber: 10, type: 'drill',          description: 'Drill 6', unit: 'mm', geometry: { diameter: 6     }, offsets: { z: 150 } },
      { id: 'c', toolNumber: 20, type: 'ball end mill',  description: 'BEM 8',   unit: 'mm', geometry: { diameter: 8.001 }, offsets: { z: 175 } },
    ];

    const written = await writeFanuc(tools);
    const parsed  = await parseFanuc(written.content, written.filename);

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.tools).toHaveLength(3);

    expect(parsed.tools[0].toolNumber).toBe(1);
    expect(parsed.tools[0].geometry.diameter).toBeCloseTo(12);
    expect(parsed.tools[0].offsets?.z).toBeCloseTo(200);

    expect(parsed.tools[1].toolNumber).toBe(10);
    expect(parsed.tools[1].geometry.diameter).toBeCloseTo(6);

    expect(parsed.tools[2].toolNumber).toBe(20);
    expect(parsed.tools[2].geometry.diameter).toBeCloseTo(8.001, 2);
  });
});
