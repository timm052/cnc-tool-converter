/**
 * Tests for src/lib/unitConvert.ts
 */
import { describe, it, expect } from 'vitest';
import { convertToolUnit } from '../../lib/unitConvert';
import type { LibraryTool } from '../../types/libraryTool';

const MM_PER_INCH = 25.4;

function baseTool(overrides?: Partial<LibraryTool>): LibraryTool {
  return {
    id:          'test-id',
    toolNumber:  1,
    type:        'endmill',
    description: 'Test tool',
    unit:        'mm',
    geometry:    { diameter: 10 },
    tags:        [],
    starred:     false,
    addedAt:     0,
    updatedAt:   0,
    ...overrides,
  };
}

// ── No-op when already in target unit ────────────────────────────────────────

describe('convertToolUnit — no-op', () => {
  it('returns the same object when already in mm', () => {
    const tool = baseTool({ unit: 'mm' });
    expect(convertToolUnit(tool, 'mm')).toBe(tool);
  });

  it('returns the same object when already in inch', () => {
    const tool = baseTool({ unit: 'inch' });
    expect(convertToolUnit(tool, 'inch')).toBe(tool);
  });
});

// ── mm → inch ─────────────────────────────────────────────────────────────────

describe('convertToolUnit — mm → inch', () => {
  it('converts diameter correctly', () => {
    const tool = baseTool({ geometry: { diameter: 25.4 } });
    const result = convertToolUnit(tool, 'inch');
    expect(result.geometry.diameter).toBeCloseTo(1.0, 5);
    expect(result.unit).toBe('inch');
  });

  it('converts a 10mm diameter to ~0.3937 inch', () => {
    const tool = baseTool({ geometry: { diameter: 10 } });
    const result = convertToolUnit(tool, 'inch');
    expect(result.geometry.diameter).toBeCloseTo(10 / MM_PER_INCH, 4);
  });

  it('converts all geometry fields', () => {
    const tool = baseTool({
      geometry: {
        diameter:       25.4,
        shaftDiameter:  12.7,
        overallLength:  76.2,
        fluteLength:    38.1,
        bodyLength:     50.8,
        shoulderLength: 38.1,
        cornerRadius:   1.27,
        tipDiameter:    2.54,
      },
    });
    const r = convertToolUnit(tool, 'inch');
    expect(r.geometry.diameter).toBeCloseTo(1.0, 5);
    expect(r.geometry.shaftDiameter).toBeCloseTo(0.5, 5);
    expect(r.geometry.overallLength).toBeCloseTo(3.0, 5);
    expect(r.geometry.fluteLength).toBeCloseTo(1.5, 5);
    expect(r.geometry.bodyLength).toBeCloseTo(2.0, 5);
    expect(r.geometry.cornerRadius).toBeCloseTo(0.05, 5);
  });

  it('converts cutting feed rates', () => {
    const tool = baseTool({
      cutting: {
        spindleRpm:  8000,
        feedCutting: 508,    // 508 mm/min = 20 in/min
        feedPlunge:  254,
        feedRamp:    381,
      },
    });
    const r = convertToolUnit(tool, 'inch');
    expect(r.cutting!.feedCutting).toBeCloseTo(20, 4);
    expect(r.cutting!.feedPlunge).toBeCloseTo(10, 4);
    expect(r.cutting!.feedRamp).toBeCloseTo(15, 4);
    // rpm is unit-independent — unchanged
    expect(r.cutting!.spindleRpm).toBe(8000);
  });

  it('leaves undefined geometry fields as undefined', () => {
    const tool = baseTool({ geometry: { diameter: 10 } });
    const r = convertToolUnit(tool, 'inch');
    expect(r.geometry.overallLength).toBeUndefined();
    expect(r.geometry.cornerRadius).toBeUndefined();
  });

  it('leaves undefined cutting as undefined', () => {
    const tool = baseTool();
    expect(convertToolUnit(tool, 'inch').cutting).toBeUndefined();
  });

  it('does not mutate the original tool', () => {
    const tool = baseTool({ geometry: { diameter: 10 } });
    convertToolUnit(tool, 'inch');
    expect(tool.geometry.diameter).toBe(10);
    expect(tool.unit).toBe('mm');
  });
});

// ── inch → mm ─────────────────────────────────────────────────────────────────

describe('convertToolUnit — inch → mm', () => {
  it('converts 1 inch diameter to 25.4 mm', () => {
    const tool = baseTool({ unit: 'inch', geometry: { diameter: 1 } });
    const r = convertToolUnit(tool, 'mm');
    expect(r.geometry.diameter).toBeCloseTo(25.4, 5);
    expect(r.unit).toBe('mm');
  });

  it('converts 0.5 inch to 12.7 mm', () => {
    const tool = baseTool({ unit: 'inch', geometry: { diameter: 0.5 } });
    expect(convertToolUnit(tool, 'mm').geometry.diameter).toBeCloseTo(12.7, 5);
  });

  it('converts feed from in/min to mm/min', () => {
    const tool = baseTool({
      unit: 'inch',
      geometry: { diameter: 0.5 },
      cutting: { feedCutting: 10 },  // 10 in/min → 254 mm/min
    });
    expect(convertToolUnit(tool, 'mm').cutting!.feedCutting).toBeCloseTo(254, 4);
  });

  it('round-trip: mm → inch → mm preserves values within rounding', () => {
    const original = baseTool({
      geometry: {
        diameter:    12,
        overallLength: 75,
        fluteLength:   38,
      },
    });
    const asInch = convertToolUnit(original, 'inch');
    const backMm = convertToolUnit(asInch, 'mm');
    expect(backMm.geometry.diameter).toBeCloseTo(original.geometry.diameter, 3);
    expect(backMm.geometry.overallLength).toBeCloseTo(original.geometry.overallLength!, 3);
    expect(backMm.geometry.fluteLength).toBeCloseTo(original.geometry.fluteLength!, 3);
  });
});

// ── Unit-independent fields ───────────────────────────────────────────────────

describe('convertToolUnit — unit-independent fields', () => {
  it('preserves numberOfFlutes', () => {
    const tool = baseTool({ geometry: { diameter: 10, numberOfFlutes: 4 } });
    expect(convertToolUnit(tool, 'inch').geometry.numberOfFlutes).toBe(4);
  });

  it('preserves taperAngle', () => {
    const tool = baseTool({ geometry: { diameter: 10, taperAngle: 30 } });
    expect(convertToolUnit(tool, 'inch').geometry.taperAngle).toBe(30);
  });

  it('preserves spindleRpm', () => {
    const tool = baseTool({ geometry: { diameter: 10 }, cutting: { spindleRpm: 12000 } });
    expect(convertToolUnit(tool, 'inch').cutting!.spindleRpm).toBe(12000);
  });

  it('preserves all non-geometry fields (id, description, tags, etc.)', () => {
    const tool = baseTool({ id: 'abc', description: 'My Mill', tags: ['roughing'] });
    const r = convertToolUnit(tool, 'inch');
    expect(r.id).toBe('abc');
    expect(r.description).toBe('My Mill');
    expect(r.tags).toEqual(['roughing']);
    expect(r.toolNumber).toBe(1);
  });
});
