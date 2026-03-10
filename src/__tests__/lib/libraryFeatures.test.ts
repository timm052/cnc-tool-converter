/**
 * Tests for minor library features added in this session:
 * - Low-stock filter logic
 * - Duplicate tool creation (new UUID, description suffix)
 * - Inline qty patch math (mirrors LibraryTable ± buttons)
 * - Column visibility toggle logic
 */
import { describe, it, expect } from 'vitest';
import type { LibraryTool } from '../../types/libraryTool';

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

// ── Low-stock filter ──────────────────────────────────────────────────────────
// Mirrors the predicate used in ToolManagerPage filteredTools:
//   t.reorderPoint != null && t.quantity != null && t.quantity <= t.reorderPoint

function isLowStock(tool: LibraryTool): boolean {
  return tool.reorderPoint != null && tool.quantity != null && tool.quantity <= tool.reorderPoint;
}

describe('low-stock filter predicate', () => {
  it('returns true when qty equals reorderPoint', () => {
    expect(isLowStock(makeTool({ quantity: 5, reorderPoint: 5 }))).toBe(true);
  });

  it('returns true when qty is below reorderPoint', () => {
    expect(isLowStock(makeTool({ quantity: 2, reorderPoint: 5 }))).toBe(true);
  });

  it('returns false when qty is above reorderPoint', () => {
    expect(isLowStock(makeTool({ quantity: 10, reorderPoint: 5 }))).toBe(false);
  });

  it('returns false when reorderPoint is not set', () => {
    expect(isLowStock(makeTool({ quantity: 2 }))).toBe(false);
  });

  it('returns false when quantity is not set', () => {
    expect(isLowStock(makeTool({ reorderPoint: 5 }))).toBe(false);
  });

  it('returns false when both are not set', () => {
    expect(isLowStock(makeTool())).toBe(false);
  });

  it('filters a list correctly', () => {
    const tools = [
      makeTool({ quantity: 0,  reorderPoint: 5  }),  // low
      makeTool({ quantity: 10, reorderPoint: 5  }),  // ok
      makeTool({ quantity: 5,  reorderPoint: 5  }),  // low (equal)
      makeTool({ quantity: 3                    }),  // no reorderPoint
      makeTool({               reorderPoint: 5  }),  // no quantity
    ];
    const low = tools.filter(isLowStock);
    expect(low).toHaveLength(2);
  });
});

// ── Inline qty ± patch math ───────────────────────────────────────────────────
// Mirrors LibraryTable ± button handlers

function decrementQty(qty: number | undefined): number {
  return Math.max(0, (qty ?? 0) - 1);
}

function incrementQty(qty: number | undefined): number {
  return (qty ?? 0) + 1;
}

describe('inline quantity ± buttons', () => {
  it('increments by 1', () => {
    expect(incrementQty(5)).toBe(6);
  });

  it('increments from undefined (treats as 0)', () => {
    expect(incrementQty(undefined)).toBe(1);
  });

  it('decrements by 1', () => {
    expect(decrementQty(5)).toBe(4);
  });

  it('clamps decrement to zero', () => {
    expect(decrementQty(0)).toBe(0);
    expect(decrementQty(undefined)).toBe(0);
  });
});

// ── Duplicate tool creation ───────────────────────────────────────────────────
// Mirrors the duplicate button handler in ToolManagerPage

function duplicateTool(original: LibraryTool): LibraryTool {
  return {
    ...original,
    id:          crypto.randomUUID(),
    toolNumber:  original.toolNumber + 1000,
    description: `${original.description} (copy)`,
    addedAt:     Date.now(),
    updatedAt:   Date.now(),
  };
}

describe('duplicate tool', () => {
  it('generates a new UUID different from the original', () => {
    const original  = makeTool({ id: 'original-id' });
    const duplicate = duplicateTool(original);
    expect(duplicate.id).not.toBe('original-id');
  });

  it('appends "(copy)" to the description', () => {
    const original  = makeTool({ description: '6mm End Mill' });
    const duplicate = duplicateTool(original);
    expect(duplicate.description).toBe('6mm End Mill (copy)');
  });

  it('offsets tool number by 1000', () => {
    const original  = makeTool({ toolNumber: 3 });
    const duplicate = duplicateTool(original);
    expect(duplicate.toolNumber).toBe(1003);
  });

  it('copies all geometry from the original', () => {
    const original  = makeTool({ geometry: { diameter: 12, numberOfFlutes: 4, fluteLength: 25 } });
    const duplicate = duplicateTool(original);
    expect(duplicate.geometry).toEqual(original.geometry);
  });

  it('each duplicate gets a unique ID', () => {
    const original = makeTool();
    const copies   = Array.from({ length: 10 }, () => duplicateTool(original));
    const ids      = new Set(copies.map((c) => c.id));
    expect(ids.size).toBe(10);
  });
});

// ── Column visibility toggle ──────────────────────────────────────────────────
// Mirrors toggleCol in LibraryTable

type ColVis = Record<string, boolean>;

function toggleCol(vis: ColVis, key: string): ColVis {
  return { ...vis, [key]: !vis[key] };
}

describe('column visibility toggle', () => {
  it('hides a visible column', () => {
    const vis    = { qty: true, rpm: true };
    const result = toggleCol(vis, 'qty');
    expect(result.qty).toBe(false);
    expect(result.rpm).toBe(true);  // others unchanged
  });

  it('shows a hidden column', () => {
    const vis    = { qty: false, rpm: true };
    const result = toggleCol(vis, 'qty');
    expect(result.qty).toBe(true);
  });

  it('does not mutate the original object', () => {
    const vis    = { qty: true };
    toggleCol(vis, 'qty');
    expect(vis.qty).toBe(true);
  });
});
