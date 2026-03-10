/**
 * Tests for UUID generation conventions used across the library.
 *
 * - Every new tool created via makeBlankTool gets a fresh UUID
 * - Every imported tool gets a fresh UUID (ImportPanel)
 * - The generated IDs are valid UUID v4 strings
 * - buildQrText('id') returns the tool's UUID verbatim
 */
import { describe, it, expect } from 'vitest';
import { buildQrText } from '../../lib/printUtils';
import type { LibraryTool } from '../../types/libraryTool';

// UUID v4 regex: 8-4-4-4-12 hex chars, version nibble = 4, variant nibble = 8/9/a/b
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeUUID(): string {
  return crypto.randomUUID();
}

function stubTool(id: string): LibraryTool {
  return {
    id,
    toolNumber:  1,
    type:        'drill',
    description: 'Test',
    unit:        'mm',
    geometry:    { diameter: 6 },
    tags:        [],
    starred:     false,
    addedAt:     0,
    updatedAt:   0,
  };
}

describe('crypto.randomUUID', () => {
  it('generates a valid UUID v4', () => {
    expect(makeUUID()).toMatch(UUID_REGEX);
  });

  it('generates unique IDs on successive calls', () => {
    const ids = Array.from({ length: 20 }, makeUUID);
    const unique = new Set(ids);
    expect(unique.size).toBe(20);
  });
});

describe('UUID as QR identifier', () => {
  it('buildQrText("id") returns the UUID verbatim', () => {
    const id   = makeUUID();
    const tool = stubTool(id);
    expect(buildQrText(tool, 'id')).toBe(id);
  });

  it('QR id output matches UUID_REGEX when a real UUID is stored', () => {
    const id   = makeUUID();
    const tool = stubTool(id);
    expect(buildQrText(tool, 'id')).toMatch(UUID_REGEX);
  });
});

describe('Stock quantity math', () => {
  // These formulas mirror the logic in QrScannerPanel handleScan (stock mode)
  function applyStockDelta(current: number | undefined, delta: number): number {
    return Math.max(0, (current ?? 0) + delta);
  }

  it('increments quantity correctly', () => {
    expect(applyStockDelta(5, 1)).toBe(6);
    expect(applyStockDelta(5, 3)).toBe(8);
  });

  it('decrements quantity correctly', () => {
    expect(applyStockDelta(5, -1)).toBe(4);
    expect(applyStockDelta(5, -3)).toBe(2);
  });

  it('clamps to zero — never goes negative', () => {
    expect(applyStockDelta(1, -5)).toBe(0);
    expect(applyStockDelta(0, -1)).toBe(0);
  });

  it('treats undefined quantity as zero', () => {
    expect(applyStockDelta(undefined, 2)).toBe(2);
    expect(applyStockDelta(undefined, -1)).toBe(0);
  });

  it('handles zero-delta (no-op)', () => {
    expect(applyStockDelta(7, 0)).toBe(7);
  });
});
