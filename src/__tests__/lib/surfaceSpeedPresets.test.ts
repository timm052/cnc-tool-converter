/**
 * Tests for src/lib/surfaceSpeedPresets.ts
 *
 * Covers:
 * - vcToSfm / sfmToVc unit-conversion utilities
 * - SURFACE_SPEED_GROUPS data-integrity invariants
 * - ALL_SPEED_PRESETS flattened view
 */
import { describe, it, expect } from 'vitest';
import {
  vcToSfm,
  sfmToVc,
  SURFACE_SPEED_GROUPS,
  ALL_SPEED_PRESETS,
} from '../../lib/surfaceSpeedPresets';

// ── Unit conversion ───────────────────────────────────────────────────────────

describe('vcToSfm', () => {
  it('converts 100 m/min to ~328 SFM', () => {
    expect(vcToSfm(100)).toBe(Math.round(100 * 3.2808));
  });

  it('converts 0 to 0', () => {
    expect(vcToSfm(0)).toBe(0);
  });

  it('returns an integer (Math.round)', () => {
    const result = vcToSfm(123.45);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('converts 200 m/min', () => {
    expect(vcToSfm(200)).toBe(Math.round(200 * 3.2808));
  });
});

describe('sfmToVc', () => {
  it('converts 328 SFM to ~100 m/min', () => {
    const result = sfmToVc(328);
    // Should be within 1 m/min of 100 given rounding
    expect(result).toBeCloseTo(100, 0);
  });

  it('converts 0 to 0', () => {
    expect(sfmToVc(0)).toBe(0);
  });

  it('returns a number with at most 1 decimal place', () => {
    const result = sfmToVc(500);
    const str = String(result);
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(1);
  });
});

describe('vcToSfm / sfmToVc round-trip', () => {
  it('round-trips 100 m/min within 1 m/min', () => {
    expect(sfmToVc(vcToSfm(100))).toBeCloseTo(100, 0);
  });

  it('round-trips 250 m/min within 1 m/min', () => {
    expect(sfmToVc(vcToSfm(250))).toBeCloseTo(250, 0);
  });

  it('round-trips 500 m/min within 1 m/min', () => {
    expect(sfmToVc(vcToSfm(500))).toBeCloseTo(500, 0);
  });
});

// ── SURFACE_SPEED_GROUPS data integrity ───────────────────────────────────────

describe('SURFACE_SPEED_GROUPS', () => {
  it('contains at least 5 material groups', () => {
    expect(SURFACE_SPEED_GROUPS.length).toBeGreaterThanOrEqual(5);
  });

  it('every group has a non-empty material name', () => {
    for (const g of SURFACE_SPEED_GROUPS) {
      expect(typeof g.material).toBe('string');
      expect(g.material.length).toBeGreaterThan(0);
    }
  });

  it('every group has a non-empty code', () => {
    for (const g of SURFACE_SPEED_GROUPS) {
      expect(typeof g.code).toBe('string');
      expect(g.code.length).toBeGreaterThan(0);
    }
  });

  it('every group has at least one preset', () => {
    for (const g of SURFACE_SPEED_GROUPS) {
      expect(g.presets.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every preset has vcMin <= vcMax', () => {
    for (const g of SURFACE_SPEED_GROUPS) {
      for (const p of g.presets) {
        expect(p.vcMin).toBeLessThanOrEqual(p.vcMax);
      }
    }
  });

  it('every preset has a positive vcMin', () => {
    for (const g of SURFACE_SPEED_GROUPS) {
      for (const p of g.presets) {
        expect(p.vcMin).toBeGreaterThan(0);
      }
    }
  });

  it('every preset has a non-empty label', () => {
    for (const g of SURFACE_SPEED_GROUPS) {
      for (const p of g.presets) {
        expect(p.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('every preset toolMaterial is a recognised value', () => {
    const validMaterials = new Set(['carbide', 'hss', 'ceramic', 'cbn', 'diamond']);
    for (const g of SURFACE_SPEED_GROUPS) {
      for (const p of g.presets) {
        expect(validMaterials.has(p.toolMaterial)).toBe(true);
      }
    }
  });

  it('chipLoadFactor min <= max when present', () => {
    for (const g of SURFACE_SPEED_GROUPS) {
      for (const p of g.presets) {
        if (p.chipLoadFactor) {
          expect(p.chipLoadFactor.min).toBeLessThanOrEqual(p.chipLoadFactor.max);
        }
      }
    }
  });

  it('includes Aluminium group', () => {
    const al = SURFACE_SPEED_GROUPS.find((g) => g.material === 'Aluminium');
    expect(al).toBeDefined();
  });

  it('includes Stainless Steel group', () => {
    const ss = SURFACE_SPEED_GROUPS.find((g) => g.material === 'Stainless Steel');
    expect(ss).toBeDefined();
  });

  it('group codes are unique', () => {
    const codes = SURFACE_SPEED_GROUPS.map((g) => g.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

// ── ALL_SPEED_PRESETS ─────────────────────────────────────────────────────────

describe('ALL_SPEED_PRESETS', () => {
  it('contains all presets from all groups', () => {
    const expected = SURFACE_SPEED_GROUPS.reduce((sum, g) => sum + g.presets.length, 0);
    expect(ALL_SPEED_PRESETS.length).toBe(expected);
  });

  it('every entry has material and code fields', () => {
    for (const p of ALL_SPEED_PRESETS) {
      expect(typeof p.material).toBe('string');
      expect(typeof p.code).toBe('string');
    }
  });

  it('material and code match the parent group', () => {
    for (const group of SURFACE_SPEED_GROUPS) {
      for (const preset of group.presets) {
        const flat = ALL_SPEED_PRESETS.find(
          (p) => p.label === preset.label && p.material === group.material,
        );
        expect(flat).toBeDefined();
        expect(flat?.code).toBe(group.code);
      }
    }
  });
});
