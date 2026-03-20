/**
 * Tests for src/lib/toolValidation.ts
 */
import { describe, it, expect } from 'vitest';
import { validateTool, findDuplicates, getErrors } from '../../lib/toolValidation';
import type { LibraryTool } from '../../types/libraryTool';

// ── Helpers ───────────────────────────────────────────────────────────────────

function validTool(overrides?: object) {
  return {
    description: 'Flat End Mill 10mm',
    toolNumber:  1,
    geometry:    { diameter: 10 },
    ...overrides,
  };
}

function libTool(overrides?: Partial<LibraryTool>): LibraryTool {
  return {
    id:          crypto.randomUUID(),
    toolNumber:  1,
    type:        'endmill',
    description: 'Flat End Mill 10mm',
    unit:        'mm',
    geometry:    { diameter: 10 },
    tags:        [],
    starred:     false,
    addedAt:     0,
    updatedAt:   0,
    ...overrides,
  };
}

// ── validateTool — valid input ─────────────────────────────────────────────────

describe('validateTool — no issues', () => {
  it('returns empty array for a minimal valid tool', () => {
    expect(validateTool(validTool())).toEqual([]);
  });

  it('passes with all length fields set in valid hierarchy', () => {
    const issues = validateTool(validTool({
      geometry: {
        diameter:      10,
        fluteLength:   20,
        shoulderLength: 22,
        bodyLength:    30,
        overallLength: 75,
      },
    }));
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });
});

// ── validateTool — errors ──────────────────────────────────────────────────────

describe('validateTool — required field errors', () => {
  it('errors when description is empty', () => {
    const issues = validateTool(validTool({ description: '' }));
    expect(issues.some((i) => i.field === 'description' && i.severity === 'error')).toBe(true);
  });

  it('errors when description is whitespace only', () => {
    const issues = validateTool(validTool({ description: '   ' }));
    expect(issues.some((i) => i.field === 'description')).toBe(true);
  });

  it('errors when toolNumber is negative', () => {
    const issues = validateTool(validTool({ toolNumber: -1 }));
    expect(issues.some((i) => i.field === 'toolNumber' && i.severity === 'error')).toBe(true);
  });

  it('errors when toolNumber is not an integer', () => {
    const issues = validateTool(validTool({ toolNumber: 1.5 }));
    expect(issues.some((i) => i.field === 'toolNumber' && i.severity === 'error')).toBe(true);
  });

  it('errors when diameter is 0', () => {
    const issues = validateTool(validTool({ geometry: { diameter: 0 } }));
    expect(issues.some((i) => i.field === 'diameter' && i.severity === 'error')).toBe(true);
  });

  it('errors when diameter is negative', () => {
    const issues = validateTool(validTool({ geometry: { diameter: -5 } }));
    expect(issues.some((i) => i.field === 'diameter' && i.severity === 'error')).toBe(true);
  });
});

describe('validateTool — length hierarchy errors', () => {
  it('errors when bodyLength ≤ shoulderLength', () => {
    const issues = validateTool(validTool({
      geometry: { diameter: 10, shoulderLength: 30, bodyLength: 30 },
    }));
    expect(issues.some((i) => i.field === 'bodyLength' && i.severity === 'error')).toBe(true);
  });

  it('errors when bodyLength < fluteLength (no shoulder)', () => {
    const issues = validateTool(validTool({
      geometry: { diameter: 10, fluteLength: 40, bodyLength: 30 },
    }));
    expect(issues.some((i) => i.field === 'bodyLength' && i.severity === 'error')).toBe(true);
  });

  it('errors when overallLength < bodyLength', () => {
    const issues = validateTool(validTool({
      geometry: { diameter: 10, bodyLength: 60, overallLength: 50 },
    }));
    expect(issues.some((i) => i.field === 'overallLength' && i.severity === 'error')).toBe(true);
  });

  it('errors when overallLength < shoulderLength (no body)', () => {
    const issues = validateTool(validTool({
      geometry: { diameter: 10, shoulderLength: 50, overallLength: 40 },
    }));
    expect(issues.some((i) => i.field === 'overallLength' && i.severity === 'error')).toBe(true);
  });

  it('no error when all lengths undefined', () => {
    const issues = validateTool(validTool({ geometry: { diameter: 10 } }));
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });
});

describe('validateTool — warnings', () => {
  it('warns for very small diameter (< 0.01)', () => {
    const issues = validateTool(validTool({ geometry: { diameter: 0.005 } }));
    expect(issues.some((i) => i.field === 'diameter' && i.severity === 'warning')).toBe(true);
  });

  it('warns for very large diameter (> 500)', () => {
    const issues = validateTool(validTool({ geometry: { diameter: 600 } }));
    expect(issues.some((i) => i.field === 'diameter' && i.severity === 'warning')).toBe(true);
  });

  it('no warning for a normal diameter', () => {
    const issues = validateTool(validTool({ geometry: { diameter: 12 } }));
    expect(issues.some((i) => i.field === 'diameter' && i.severity === 'warning')).toBe(false);
  });

  it('warns when spindleRpm > 50000', () => {
    const issues = validateTool(validTool({ cutting: { spindleRpm: 60_000 } }));
    expect(issues.some((i) => i.field === 'spindleRpm' && i.severity === 'warning')).toBe(true);
  });

  it('warns when spindle set but feed is 0', () => {
    const issues = validateTool(validTool({ cutting: { spindleRpm: 8000, feedCutting: 0 } }));
    expect(issues.some((i) => i.field === 'feedCutting' && i.severity === 'warning')).toBe(true);
  });

  it('no feed warning when feedCutting is set', () => {
    const issues = validateTool(validTool({ cutting: { spindleRpm: 8000, feedCutting: 500 } }));
    expect(issues.some((i) => i.field === 'feedCutting' && i.severity === 'warning')).toBe(false);
  });
});

// ── pocketNumber validation ───────────────────────────────────────────────────

describe('validateTool — pocketNumber', () => {
  it('errors when pocketNumber is negative', () => {
    const issues = validateTool(validTool({ pocketNumber: -1 }));
    expect(issues.some((i) => i.field === 'pocketNumber' && i.severity === 'error')).toBe(true);
  });

  it('errors when pocketNumber is a float', () => {
    const issues = validateTool(validTool({ pocketNumber: 1.7 }));
    expect(issues.some((i) => i.field === 'pocketNumber' && i.severity === 'error')).toBe(true);
  });

  it('no error when pocketNumber is 0', () => {
    const issues = validateTool(validTool({ pocketNumber: 0 }));
    expect(issues.some((i) => i.field === 'pocketNumber')).toBe(false);
  });

  it('no error when pocketNumber is undefined', () => {
    const issues = validateTool(validTool());
    expect(issues.some((i) => i.field === 'pocketNumber')).toBe(false);
  });
});

// ── getErrors ─────────────────────────────────────────────────────────────────

describe('getErrors()', () => {
  it('returns empty object for no issues', () => {
    expect(getErrors([])).toEqual({});
  });

  it('maps error issues to field keys', () => {
    const issues = validateTool(validTool({ description: '', geometry: { diameter: 0 } }));
    const errors = getErrors(issues);
    expect(errors.description).toBeDefined();
    expect(errors.diameter).toBeDefined();
  });

  it('excludes warnings', () => {
    const issues = validateTool(validTool({ geometry: { diameter: 600 } }));
    const errors = getErrors(issues);
    // diameter warning — must not appear as error
    expect(errors.diameter).toBeUndefined();
  });

  it('only records the first error per field', () => {
    const issues = validateTool(validTool({ description: '' }));
    const errors = getErrors(issues);
    // Should be a string, not an array
    expect(typeof errors.description).toBe('string');
  });
});

// ── findDuplicates ────────────────────────────────────────────────────────────

describe('findDuplicates()', () => {
  const existing = [
    libTool({ id: 'e1', toolNumber: 1, type: 'endmill', geometry: { diameter: 10 }, description: 'Flat End Mill 10mm' }),
    libTool({ id: 'e2', toolNumber: 5, type: 'drill',   geometry: { diameter: 6  }, description: 'Drill 6mm' }),
  ];

  it('returns empty for non-matching tools', () => {
    const incoming = [libTool({ toolNumber: 99, geometry: { diameter: 50 }, description: 'Big boring bar' })];
    expect(findDuplicates(incoming, existing)).toHaveLength(0);
  });

  it('detects same-number duplicate', () => {
    const incoming = [libTool({ toolNumber: 1, geometry: { diameter: 20 }, description: 'Something else' })];
    const matches = findDuplicates(incoming, existing);
    expect(matches.some((m) => m.reason === 'same-number' && m.existingId === 'e1')).toBe(true);
  });

  it('detects same-diameter-type duplicate', () => {
    const incoming = [libTool({ toolNumber: 99, type: 'endmill', geometry: { diameter: 10 }, description: 'Another mill' })];
    const matches = findDuplicates(incoming, existing);
    expect(matches.some((m) => m.reason === 'same-diameter-type' && m.existingId === 'e1')).toBe(true);
  });

  it('detects similar-description duplicate (≥ 75% similarity)', () => {
    const incoming = [libTool({ toolNumber: 99, geometry: { diameter: 99 }, description: 'Flat End Mill 10mm' })];
    const matches = findDuplicates(incoming, existing);
    expect(matches.some((m) => m.reason === 'similar-description')).toBe(true);
  });

  it('does not flag dissimilar descriptions', () => {
    const incoming = [libTool({ toolNumber: 99, geometry: { diameter: 99 }, description: 'Chamfer bit 90deg' })];
    const matches = findDuplicates(incoming, existing);
    expect(matches.filter((m) => m.reason === 'similar-description')).toHaveLength(0);
  });

  it('uses incomingIndex correctly for multiple incoming tools', () => {
    const incoming = [
      libTool({ toolNumber: 99, geometry: { diameter: 99 }, description: 'Unique' }),
      libTool({ toolNumber: 1,  geometry: { diameter: 10 }, description: 'Flat End Mill 10mm' }),
    ];
    const matches = findDuplicates(incoming, existing);
    const match = matches.find((m) => m.existingId === 'e1');
    expect(match?.incomingIndex).toBe(1);
  });

  it('reports each existing tool at most once per incoming tool', () => {
    // An incoming tool could match on both same-number and same-diameter — only first match reported
    const incoming = [libTool({ toolNumber: 1, type: 'endmill', geometry: { diameter: 10 }, description: 'Flat End Mill 10mm' })];
    const matches = findDuplicates(incoming, existing);
    const forE1 = matches.filter((m) => m.existingId === 'e1');
    expect(forE1).toHaveLength(1);
  });
});
