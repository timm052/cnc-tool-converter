import { describe, it, expect } from 'vitest';
import type { LibraryTool } from '../../types/libraryTool';
import { isLowStock, isRegrindDue, countByType } from '../../lib/libraryStats';

function makeTool(overrides: Partial<LibraryTool> = {}): LibraryTool {
  return {
    id:          crypto.randomUUID(),
    toolNumber:  1,
    type:        'flat end mill',
    description: 'Test Tool',
    unit:        'mm',
    geometry:    { diameter: 10 },
    tags:        [],
    starred:     false,
    addedAt:     0,
    updatedAt:   0,
    ...overrides,
  };
}

describe('isLowStock', () => {
  it('true when quantity at or below reorder point', () => {
    expect(isLowStock(makeTool({ quantity: 2, reorderPoint: 5 }))).toBe(true);
    expect(isLowStock(makeTool({ quantity: 5, reorderPoint: 5 }))).toBe(true);
  });

  it('false when above reorder point or fields missing', () => {
    expect(isLowStock(makeTool({ quantity: 10, reorderPoint: 5 }))).toBe(false);
    expect(isLowStock(makeTool({ quantity: 1 }))).toBe(false);
    expect(isLowStock(makeTool({ reorderPoint: 5 }))).toBe(false);
  });
});

describe('isRegrindDue', () => {
  it('true when use count reaches the regrind threshold', () => {
    expect(isRegrindDue(makeTool({ useCount: 50, regrindThreshold: 50 }))).toBe(true);
    expect(isRegrindDue(makeTool({ useCount: 60, regrindThreshold: 50 }))).toBe(true);
  });

  it('false when below threshold or fields missing', () => {
    expect(isRegrindDue(makeTool({ useCount: 10, regrindThreshold: 50 }))).toBe(false);
    expect(isRegrindDue(makeTool({ useCount: 60 }))).toBe(false);
    expect(isRegrindDue(makeTool({ regrindThreshold: 50 }))).toBe(false);
  });
});

describe('countByType', () => {
  it('counts and sorts tools by type, descending', () => {
    const tools = [
      makeTool({ type: 'drill' }),
      makeTool({ type: 'flat end mill' }),
      makeTool({ type: 'flat end mill' }),
      makeTool({ type: 'ball end mill' }),
      makeTool({ type: 'flat end mill' }),
    ];
    expect(countByType(tools)).toEqual([
      { type: 'flat end mill', count: 3 },
      { type: 'drill', count: 1 },
      { type: 'ball end mill', count: 1 },
    ]);
  });

  it('returns an empty array for an empty library', () => {
    expect(countByType([])).toEqual([]);
  });
});
