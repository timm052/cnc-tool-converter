/**
 * Tests for src/lib/gcodeOffsetSheet.ts
 *
 * downloadGcodeOffsetSheet() creates a Blob, builds an anchor and clicks it.
 * We capture the Blob content to verify the generated text without actually
 * triggering a browser download.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadGcodeOffsetSheet } from '../../lib/gcodeOffsetSheet';
import type { LibraryTool } from '../../types/libraryTool';

function tool(overrides?: Partial<LibraryTool>): LibraryTool {
  return {
    id:          crypto.randomUUID(),
    toolNumber:  1,
    type:        'endmill',
    description: 'Flat End Mill 10mm',
    unit:        'mm',
    geometry:    { diameter: 10, numberOfFlutes: 4 },
    tags:        [],
    starred:     false,
    addedAt:     0,
    updatedAt:   0,
    ...overrides,
  };
}

// Capture Blob contents created during the download call
async function captureSheet(tools: LibraryTool[]): Promise<string> {
  let capturedContent = '';
  const OrigBlob = globalThis.Blob;
  globalThis.Blob = class extends OrigBlob {
    constructor(parts: BlobPart[], init?: BlobPropertyBag) {
      super(parts, init);
      // Capture text synchronously from the first part
      if (parts[0] && typeof parts[0] === 'string') capturedContent = parts[0];
    }
  } as typeof Blob;

  // Suppress the anchor click so no real download fires
  vi.spyOn(document, 'createElement').mockImplementationOnce(() => {
    const a = document.createElement('a');
    vi.spyOn(a, 'click').mockImplementation(() => {});
    return a;
  });

  downloadGcodeOffsetSheet(tools);

  globalThis.Blob = OrigBlob;
  return capturedContent;
}

beforeEach(() => vi.restoreAllMocks());

// ── No-op for empty list ──────────────────────────────────────────────────────

describe('downloadGcodeOffsetSheet — empty', () => {
  it('does nothing when the tool list is empty', () => {
    const clickSpy = vi.spyOn(document, 'createElement');
    downloadGcodeOffsetSheet([]);
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

// ── Content structure ─────────────────────────────────────────────────────────

describe('downloadGcodeOffsetSheet — content', () => {
  it('includes the header comment', async () => {
    const content = await captureSheet([tool()]);
    expect(content).toContain('; CNC Tool Offset Reference Sheet');
  });

  it('includes tool count in header', async () => {
    const content = await captureSheet([tool(), tool({ id: 'x', toolNumber: 2 })]);
    expect(content).toContain('2 tools');
  });

  it('uses singular "tool" for exactly 1 tool', async () => {
    const content = await captureSheet([tool()]);
    expect(content).toContain('1 tool');
    expect(content).not.toContain('1 tools');
  });

  it('includes the tool number', async () => {
    const content = await captureSheet([tool({ toolNumber: 7 })]);
    expect(content).toContain('T007');
  });

  it('formats mm diameter with 3 decimal places', async () => {
    const content = await captureSheet([tool({ geometry: { diameter: 6.35 } })]);
    expect(content).toContain('6.350 mm');
  });

  it('formats inch diameter with 4 decimal places', async () => {
    const content = await captureSheet([
      tool({ unit: 'inch', geometry: { diameter: 0.25 } }),
    ]);
    expect(content).toContain('0.2500 in');
  });

  it('shows Z offset from offsets.z when available', async () => {
    const content = await captureSheet([
      tool({ offsets: { z: -50.123 } }),
    ]);
    expect(content).toContain('-50.123');
  });

  it('shows 0.000 Z offset when not set', async () => {
    const content = await captureSheet([tool()]);
    expect(content).toContain('0.000 mm');
  });

  it('includes flute count', async () => {
    const content = await captureSheet([tool({ geometry: { diameter: 10, numberOfFlutes: 4 } })]);
    expect(content).toContain(' 4 ');
  });

  it('includes the tool description', async () => {
    const content = await captureSheet([tool({ description: 'Ball End Mill' })]);
    expect(content).toContain('Ball End Mill');
  });

  it('sorts tools by toolNumber ascending', async () => {
    const tools = [
      tool({ toolNumber: 5, description: 'Five' }),
      tool({ toolNumber: 1, description: 'One', id: 'a' }),
      tool({ toolNumber: 3, description: 'Three', id: 'b' }),
    ];
    const content = await captureSheet(tools);
    const posOne   = content.indexOf('T001');
    const posThree = content.indexOf('T003');
    const posFive  = content.indexOf('T005');
    expect(posOne).toBeLessThan(posThree);
    expect(posThree).toBeLessThan(posFive);
  });
});
