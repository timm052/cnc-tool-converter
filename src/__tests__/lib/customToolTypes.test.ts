import { describe, it, expect } from 'vitest';
import {
  getAllToolTypeOptions,
  getFieldVisibility,
  getTypeColour,
  getProfileShape,
} from '../../lib/customToolTypes';
import type { CustomToolTypeDefinition } from '../../lib/customToolTypes';

const CUSTOM_TYPE: CustomToolTypeDefinition = {
  id: 'custom-lathe-1',
  label: 'Lathe Insert',
  profileShape: 'flat',
  colour: 'bg-sky-500/20 text-sky-300',
  showsCornerRadius: true,
  showsTaperAngle: false,
  showsTipDiameter: true,
  showsThreadFields: false,
  showsNumTeeth: false,
};

// ── getAllToolTypeOptions ──────────────────────────────────────────────────────

describe('getAllToolTypeOptions', () => {
  it('includes all built-in types', () => {
    const opts = getAllToolTypeOptions([]);
    const values = opts.map((o) => o.value);
    expect(values).toContain('flat end mill');
    expect(values).toContain('ball end mill');
    expect(values).toContain('drill');
    expect(values).toContain('thread mill');
    expect(values).toContain('custom');
  });

  it('appends custom types after built-ins', () => {
    const opts = getAllToolTypeOptions([CUSTOM_TYPE]);
    const last = opts[opts.length - 1];
    expect(last.value).toBe('custom-lathe-1');
    expect(last.label).toContain('Lathe Insert');
  });

  it('prefixes custom type labels with a star marker', () => {
    const opts = getAllToolTypeOptions([CUSTOM_TYPE]);
    const custom = opts.find((o) => o.value === 'custom-lathe-1')!;
    expect(custom.label).toMatch(/★/);
  });

  it('returns only built-ins when no custom types provided', () => {
    const opts = getAllToolTypeOptions([]);
    expect(opts.every((o) => !o.label.includes('★'))).toBe(true);
  });
});

// ── getFieldVisibility ────────────────────────────────────────────────────────

describe('getFieldVisibility — built-in types', () => {
  it('shows corner radius only for bull nose end mill and custom', () => {
    expect(getFieldVisibility('bull nose end mill', []).showsCornerRadius).toBe(true);
    expect(getFieldVisibility('custom', []).showsCornerRadius).toBe(true);
    expect(getFieldVisibility('flat end mill', []).showsCornerRadius).toBe(false);
  });

  it('shows taper angle for drill, spot drill, chamfer mill, tapered mill, engraving, custom', () => {
    for (const t of ['drill', 'spot drill', 'chamfer mill', 'tapered mill', 'engraving', 'custom']) {
      expect(getFieldVisibility(t, []).showsTaperAngle).toBe(true);
    }
    expect(getFieldVisibility('flat end mill', []).showsTaperAngle).toBe(false);
  });

  it('shows thread fields only for thread mill', () => {
    expect(getFieldVisibility('thread mill', []).showsThreadFields).toBe(true);
    expect(getFieldVisibility('drill', []).showsThreadFields).toBe(false);
  });

  it('shows num teeth for thread mill and face mill', () => {
    expect(getFieldVisibility('thread mill', []).showsNumTeeth).toBe(true);
    expect(getFieldVisibility('face mill', []).showsNumTeeth).toBe(true);
    expect(getFieldVisibility('flat end mill', []).showsNumTeeth).toBe(false);
  });
});

describe('getFieldVisibility — custom types', () => {
  it('uses custom type flags instead of built-in logic', () => {
    const vis = getFieldVisibility('custom-lathe-1', [CUSTOM_TYPE]);
    expect(vis.showsCornerRadius).toBe(true);   // custom flag
    expect(vis.showsTaperAngle).toBe(false);    // custom flag
    expect(vis.showsTipDiameter).toBe(true);    // custom flag
    expect(vis.showsThreadFields).toBe(false);
    expect(vis.showsNumTeeth).toBe(false);
  });
});

// ── getTypeColour ─────────────────────────────────────────────────────────────

describe('getTypeColour', () => {
  it('returns unique colours for each built-in type', () => {
    const colours = [
      'flat end mill', 'ball end mill', 'bull nose end mill', 'drill',
    ].map((t) => getTypeColour(t, []));
    const unique = new Set(colours);
    expect(unique.size).toBe(colours.length);
  });

  it('returns custom colour for a custom type', () => {
    expect(getTypeColour('custom-lathe-1', [CUSTOM_TYPE])).toBe(CUSTOM_TYPE.colour);
  });

  it('falls back to slate colour for unknown type', () => {
    expect(getTypeColour('nonexistent-type', [])).toContain('slate');
  });
});

// ── getProfileShape ───────────────────────────────────────────────────────────

describe('getProfileShape', () => {
  it('returns ball for ball end mill', () => {
    expect(getProfileShape('ball end mill', [])).toBe('ball');
  });

  it('returns tapered for drill, chamfer mill, thread mill, engraving', () => {
    for (const t of ['drill', 'spot drill', 'chamfer mill', 'tapered mill', 'engraving', 'thread mill']) {
      expect(getProfileShape(t, [])).toBe('tapered');
    }
  });

  it('returns flat for flat end mill and face mill', () => {
    expect(getProfileShape('flat end mill', [])).toBe('flat');
    expect(getProfileShape('face mill', [])).toBe('flat');
  });

  it('returns custom profileShape for custom types', () => {
    expect(getProfileShape('custom-lathe-1', [CUSTOM_TYPE])).toBe('flat');
    const drillType: CustomToolTypeDefinition = { ...CUSTOM_TYPE, id: 'c2', profileShape: 'drill' };
    expect(getProfileShape('c2', [drillType])).toBe('drill');
  });
});
