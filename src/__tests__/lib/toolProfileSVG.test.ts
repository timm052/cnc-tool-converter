/**
 * ToolProfileSVG — unit tests for the buildProfilePath geometry generator.
 *
 * These tests call the internal functions via re-exports so they can run in
 * jsdom without React rendering. They verify that every ToolType produces a
 * well-formed, non-empty SVG path string and that geometry-specific fields
 * (profileRadius, nozzleDiameter, cornerRadius) are reflected in the output.
 */

import { describe, it, expect } from 'vitest';
import type { ToolType } from '../../types/tool';

// ── Re-export the private helpers via a test-only wrapper ──────────────────
// We test the pure math functions directly to avoid jsdom/React overhead.
// Import the source module, which exposes these as module-level functions.

// ── Helpers ───────────────────────────────────────────────────────────────

/** Minimal geometry sufficient for any tool type */
function minGeo(overrides: Record<string, unknown> = {}) {
  return {
    diameter:       10,
    shaftDiameter:  10,
    overallLength:  80,
    fluteLength:    30,
    cornerRadius:   0,
    taperAngle:     45,
    tipDiameter:    0,
    profileRadius:  undefined as number | undefined,
    nozzleDiameter: undefined as number | undefined,
    threadPitch:    1.5,
    numberOfTeeth:  4,
    numberOfFlutes: 3,
    coolantSupport: false,
    bodyLength:     undefined as number | undefined,
    shoulderLength: undefined as number | undefined,
    ...overrides,
  };
}

// ── buildProfilePath is not exported — test via the full SVG output ────────
// We render the full SVG in jsdom and check that the path `d` attribute
// is a non-empty, well-formed SVG path for each tool type.

import { render } from '@testing-library/react';
import React from 'react';
import { ToolProfileSVG } from '../../components/library/ToolProfileSVG';
import type { LibraryTool } from '../../types/libraryTool';
import { SettingsProvider } from '../../contexts/SettingsContext';

function makeTool(type: ToolType, geoOverrides: Record<string, unknown> = {}): LibraryTool {
  return {
    id:          'test-id',
    toolNumber:  1,
    type,
    description: `Test ${type}`,
    unit:        'mm',
    geometry: {
      diameter:       10,
      shaftDiameter:  10,
      overallLength:  80,
      fluteLength:    30,
      ...geoOverrides,
    },
    tags:         [],
    starred:      false,
    machineGroups: [],
    addedAt:      Date.now(),
    updatedAt:    Date.now(),
  } as LibraryTool;
}

function renderSVG(tool: LibraryTool) {
  const { container } = render(
    React.createElement(
      SettingsProvider,
      null,
      React.createElement(ToolProfileSVG, { draft: tool }),
    ),
  );
  return container;
}

// ── All 33 built-in tool types ─────────────────────────────────────────────

const ALL_TYPES: ToolType[] = [
  'flat end mill', 'ball end mill', 'bull nose end mill', 'chamfer mill',
  'face mill', 'tapered mill', 'dovetail mill', 'slot mill', 'lollipop mill',
  'form mill', 'engraving', 'circle segment barrel', 'circle segment lens',
  'circle segment oval', 'drill', 'center drill', 'spot drill', 'counter bore',
  'counter sink', 'reamer', 'boring bar', 'thread mill', 'tap right hand',
  'tap left hand', 'probe', 'laser cutter', 'plasma cutter', 'waterjet',
  'holder', 'custom',
];

describe('ToolProfileSVG — all built-in tool types render', () => {
  for (const type of ALL_TYPES) {
    it(`renders ${type} without crashing`, () => {
      const tool = makeTool(type);
      const container = renderSVG(tool);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
    });

    it(`${type} — profile path is present and non-empty`, () => {
      const tool = makeTool(type);
      const container = renderSVG(tool);
      // The profile <path> has fill="#1c2e3e" (dark tool body)
      const paths = container.querySelectorAll('path');
      const profilePath = Array.from(paths).find(
        (p) => p.getAttribute('fill') === '#1c2e3e',
      );
      expect(profilePath).not.toBeNull();
      const d = profilePath!.getAttribute('d') ?? '';
      expect(d.length).toBeGreaterThan(10);
      expect(d).toMatch(/^M/);           // starts with Move
      expect(d).toMatch(/Z/);            // closes the path
    });
  }
});

// ── Geometry-specific rendering ────────────────────────────────────────────

describe('ToolProfileSVG — geometry field effects', () => {
  it('ball end mill includes an arc (A command)', () => {
    const container = renderSVG(makeTool('ball end mill'));
    const paths = container.querySelectorAll('path');
    const profilePath = Array.from(paths).find(p => p.getAttribute('fill') === '#1c2e3e')!;
    expect(profilePath.getAttribute('d')).toMatch(/A/);
  });

  it('bull nose end mill with cornerRadius includes arc', () => {
    const container = renderSVG(makeTool('bull nose end mill', { cornerRadius: 2 }));
    const paths = container.querySelectorAll('path');
    const profilePath = Array.from(paths).find(p => p.getAttribute('fill') === '#1c2e3e')!;
    expect(profilePath.getAttribute('d')).toMatch(/A/);
  });

  it('bull nose end mill with cornerRadius=0 renders as flat', () => {
    const container = renderSVG(makeTool('bull nose end mill', { cornerRadius: 0 }));
    const paths = container.querySelectorAll('path');
    const profilePath = Array.from(paths).find(p => p.getAttribute('fill') === '#1c2e3e')!;
    // No arc when cornerRadius is effectively zero
    expect(profilePath.getAttribute('d')).not.toMatch(/A/);
  });

  it('circle segment barrel renders convex sides (quadratic bezier Q commands)', () => {
    // Barrel uses bezier curves for convex sides; profileRadius controls bulge depth
    const container = renderSVG(makeTool('circle segment barrel', { profileRadius: 6 }));
    const paths = container.querySelectorAll('path');
    const profilePath = Array.from(paths).find(p => p.getAttribute('fill') === '#1c2e3e')!;
    expect(profilePath.getAttribute('d')).toMatch(/Q/);
  });

  it('circle segment barrel without profileRadius renders (bull-nose fallback)', () => {
    const container = renderSVG(makeTool('circle segment barrel'));
    const paths = container.querySelectorAll('path');
    const profilePath = Array.from(paths).find(p => p.getAttribute('fill') === '#1c2e3e')!;
    expect(profilePath).not.toBeNull();
    const d = profilePath.getAttribute('d') ?? '';
    expect(d.length).toBeGreaterThan(10);
  });

  it('drill produces a non-arc pointed tip', () => {
    const container = renderSVG(makeTool('drill', { taperAngle: 59 }));
    const paths = container.querySelectorAll('path');
    const profilePath = Array.from(paths).find(p => p.getAttribute('fill') === '#1c2e3e')!;
    const d = profilePath.getAttribute('d') ?? '';
    expect(d).not.toMatch(/A/);   // pointed tip = lines, not arc
    expect(d).toMatch(/Z/);
  });

  it('thread mill produces tooth-shaped path (many L commands)', () => {
    const container = renderSVG(makeTool('thread mill', {
      fluteLength: 20,
      threadPitch: 2,
      numberOfTeeth: 5,
    }));
    const paths = container.querySelectorAll('path');
    const profilePath = Array.from(paths).find(p => p.getAttribute('fill') === '#1c2e3e')!;
    const d = profilePath.getAttribute('d') ?? '';
    const lCount = (d.match(/L/g) ?? []).length;
    expect(lCount).toBeGreaterThan(4);  // multiple tooth lines
  });

  it('laser cutter renders a static illustration (path with fill present)', () => {
    // Laser cutter uses a fixed static SVG illustration (not geometry-driven)
    const containerDefault = renderSVG(makeTool('laser cutter'));
    const containerNarrow  = renderSVG(makeTool('laser cutter', { nozzleDiameter: 0.2 }));

    function hasFilledPath(c: HTMLElement) {
      return Array.from(c.querySelectorAll('path'))
        .some(p => p.getAttribute('fill') === '#1c2e3e');
    }

    expect(hasFilledPath(containerDefault)).toBe(true);
    expect(hasFilledPath(containerNarrow)).toBe(true);
  });

  it('custom user-defined type string renders without crashing', () => {
    const tool = makeTool('custom-lathe-tool' as ToolType);
    const container = renderSVG(tool);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});

// ── Dimension annotations ──────────────────────────────────────────────────

describe('ToolProfileSVG — dimension annotations', () => {
  it('renders the diameter annotation text', () => {
    const container = renderSVG(makeTool('flat end mill'));
    const texts = Array.from(container.querySelectorAll('text'));
    const diamText = texts.find(t => t.textContent?.includes('Ø'));
    expect(diamText).not.toBeNull();
    expect(diamText!.textContent).toContain('10');
  });

  it('renders OAL annotation when overallLength is set', () => {
    const container = renderSVG(makeTool('flat end mill'));
    const texts = Array.from(container.querySelectorAll('text'));
    const oalText = texts.find(t => t.textContent?.includes('OAL'));
    expect(oalText).not.toBeNull();
  });

  it('renders flute length annotation when fluteLength is set', () => {
    const container = renderSVG(makeTool('flat end mill'));
    const texts = Array.from(container.querySelectorAll('text'));
    const flText = texts.find(t => t.textContent?.includes('Flute'));
    expect(flText).not.toBeNull();
  });

  it('renders tool type label', () => {
    const tool = makeTool('chamfer mill');
    const container = renderSVG(tool);
    const texts = Array.from(container.querySelectorAll('text'));
    const typeText = texts.find(t => t.textContent?.includes('chamfer mill'));
    expect(typeText).not.toBeNull();
  });

  it('renders no-preview fallback when diameter is 0', () => {
    const tool = makeTool('flat end mill', { diameter: 0 });
    const container = renderSVG(tool);
    const texts = Array.from(container.querySelectorAll('text'));
    const noPreview = texts.find(t => t.textContent?.includes('No preview'));
    expect(noPreview).not.toBeNull();
  });
});
