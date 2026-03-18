import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildQrText,
  generateQrDataUrl,
  DEFAULT_LABEL_OPTIONS,
  DEFAULT_SHEET_OPTIONS,
  type LabelOptions,
} from '../../lib/printUtils';
import type { LibraryTool } from '../../types/libraryTool';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_TOOL: LibraryTool = {
  id:          'abc-123-def-456',
  toolNumber:  5,
  type:        'flat end mill',
  description: 'My End Mill',
  unit:        'mm',
  geometry:    { diameter: 12, numberOfFlutes: 4 },
  tags:        ['roughing', 'aluminium'],
  starred:     false,
  addedAt:     0,
  updatedAt:   0,
};

// ── DEFAULT_LABEL_OPTIONS ─────────────────────────────────────────────────────

describe('DEFAULT_LABEL_OPTIONS', () => {
  it('has qrContent set to "id" (UUID mode)', () => {
    expect(DEFAULT_LABEL_OPTIONS.qrContent).toBe('id');
  });

  it('has showQr enabled by default', () => {
    expect(DEFAULT_LABEL_OPTIONS.showQr).toBe(true);
  });

  it('has showTNumber, showDesc, showType, showDiameter enabled', () => {
    expect(DEFAULT_LABEL_OPTIONS.showTNumber).toBe(true);
    expect(DEFAULT_LABEL_OPTIONS.showDesc).toBe(true);
    expect(DEFAULT_LABEL_OPTIONS.showType).toBe(true);
    expect(DEFAULT_LABEL_OPTIONS.showDiameter).toBe(true);
  });

  it('has showFlutes, showMachine, showTags disabled', () => {
    expect(DEFAULT_LABEL_OPTIONS.showFlutes).toBe(false);
    expect(DEFAULT_LABEL_OPTIONS.showMachine).toBe(false);
    expect(DEFAULT_LABEL_OPTIONS.showTags).toBe(false);
  });

  it('has sensible default dimensions', () => {
    expect(DEFAULT_LABEL_OPTIONS.widthMm).toBeGreaterThan(0);
    expect(DEFAULT_LABEL_OPTIONS.heightMm).toBeGreaterThan(0);
    expect(DEFAULT_LABEL_OPTIONS.columns).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_LABEL_OPTIONS.gapMm).toBeGreaterThanOrEqual(0);
  });
});

// ── DEFAULT_SHEET_OPTIONS ─────────────────────────────────────────────────────

describe('DEFAULT_SHEET_OPTIONS', () => {
  it('defaults to 2 columns', () => {
    expect(DEFAULT_SHEET_OPTIONS.columns).toBe(2);
  });

  it('enables all section toggles', () => {
    expect(DEFAULT_SHEET_OPTIONS.showGeometry).toBe(true);
    expect(DEFAULT_SHEET_OPTIONS.showCutting).toBe(true);
    expect(DEFAULT_SHEET_OPTIONS.showMaterial).toBe(true);
    expect(DEFAULT_SHEET_OPTIONS.showMachineGroup).toBe(true);
    expect(DEFAULT_SHEET_OPTIONS.showTags).toBe(true);
    expect(DEFAULT_SHEET_OPTIONS.showManufacturer).toBe(true);
    expect(DEFAULT_SHEET_OPTIONS.showComment).toBe(true);
    expect(DEFAULT_SHEET_OPTIONS.showCrib).toBe(true);
  });
});

// ── buildQrText ───────────────────────────────────────────────────────────────

describe('buildQrText', () => {
  it('"id" mode returns the tool UUID verbatim', () => {
    expect(buildQrText(BASE_TOOL, 'id')).toBe('abc-123-def-456');
  });

  it('"description" mode returns "T{n}: {description}"', () => {
    expect(buildQrText(BASE_TOOL, 'description')).toBe('T5: My End Mill');
  });

  it('"full" mode includes tool number, description, type, and diameter', () => {
    const text = buildQrText(BASE_TOOL, 'full');
    expect(text).toContain('T5: My End Mill');
    expect(text).toContain('flat end mill');
    expect(text).toContain('Ø12mm');
  });

  it('"full" mode includes flute count when present', () => {
    const text = buildQrText(BASE_TOOL, 'full');
    expect(text).toContain('4 flutes');
  });

  it('"full" mode omits flute count when absent', () => {
    const noFlutes: LibraryTool = { ...BASE_TOOL, geometry: { diameter: 10 } };
    const text = buildQrText(noFlutes, 'full');
    expect(text).not.toContain('flutes');
  });

  it('"full" mode includes machineGroups when present', () => {
    const withMachine: LibraryTool = { ...BASE_TOOL, machineGroups: ['VF-2'] };
    const text = buildQrText(withMachine, 'full');
    expect(text).toContain('Machine: VF-2');
  });

  it('"full" mode shows multiple machine groups joined', () => {
    const withMachines: LibraryTool = { ...BASE_TOOL, machineGroups: ['VF-2', 'VF-4'] };
    const text = buildQrText(withMachines, 'full');
    expect(text).toContain('Machine: VF-2, VF-4');
  });

  it('"full" mode omits Machine line when machineGroups is absent', () => {
    const text = buildQrText(BASE_TOOL, 'full');
    expect(text).not.toContain('Machine:');
  });

  it('"full" mode lines are newline-separated', () => {
    const text = buildQrText(BASE_TOOL, 'full');
    expect(text).toContain('\n');
  });
});

// ── generateQrDataUrl ─────────────────────────────────────────────────────────

describe('generateQrDataUrl', () => {
  it('returns a data URL string for a valid UUID', async () => {
    const url = await generateQrDataUrl('abc-123-def-456', 80);
    expect(typeof url).toBe('string');
    expect(url.startsWith('data:')).toBe(true);
  });

  it('returns a data URL for longer full-mode text', async () => {
    const text = buildQrText(BASE_TOOL, 'full');
    const url  = await generateQrDataUrl(text, 120);
    expect(url.startsWith('data:')).toBe(true);
  });

  it('uses default size when not specified', async () => {
    const url = await generateQrDataUrl('T1: Test');
    expect(url.startsWith('data:')).toBe(true);
  });
});
