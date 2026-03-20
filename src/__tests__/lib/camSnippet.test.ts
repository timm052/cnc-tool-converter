/**
 * Tests for src/lib/camSnippet.ts
 */
import { describe, it, expect } from 'vitest';
import { generateSnippet, CAM_DIALECTS } from '../../lib/camSnippet';
import type { LibraryTool } from '../../types/libraryTool';

function tool(overrides?: Partial<LibraryTool>): LibraryTool {
  return {
    id:          'test',
    toolNumber:  3,
    type:        'endmill',
    description: 'Flat End Mill',
    unit:        'mm',
    geometry:    { diameter: 10, numberOfFlutes: 4, overallLength: 75 },
    tags:        [],
    starred:     false,
    addedAt:     0,
    updatedAt:   0,
    ...overrides,
  };
}

// ── CAM_DIALECTS metadata ─────────────────────────────────────────────────────

describe('CAM_DIALECTS', () => {
  it('exports exactly 5 dialects', () => {
    expect(CAM_DIALECTS).toHaveLength(5);
  });

  it('includes fanuc, haas, mach3, linuxcnc, siemens', () => {
    const ids = CAM_DIALECTS.map((d) => d.id);
    expect(ids).toContain('fanuc');
    expect(ids).toContain('haas');
    expect(ids).toContain('mach3');
    expect(ids).toContain('linuxcnc');
    expect(ids).toContain('siemens');
  });

  it('every dialect has id, label, ext, example', () => {
    for (const d of CAM_DIALECTS) {
      expect(d.id).toBeTruthy();
      expect(d.label).toBeTruthy();
      expect(d.ext).toMatch(/^\./);
      expect(d.example).toBeTruthy();
    }
  });
});

// ── generateSnippet — Fanuc ───────────────────────────────────────────────────

describe('generateSnippet — fanuc', () => {
  it('includes the tool-change command T# M6', () => {
    const s = generateSnippet([tool()], { dialect: 'fanuc' });
    expect(s).toContain('T3 M6');
  });

  it('includes G43 H# for length compensation', () => {
    const s = generateSnippet([tool()], { dialect: 'fanuc' });
    expect(s).toContain('G43 H3');
  });

  it('includes the diameter in a comment', () => {
    const s = generateSnippet([tool()], { dialect: 'fanuc' });
    expect(s).toContain('10.000');
  });

  it('includes spindle speed when set', () => {
    const s = generateSnippet([tool({ cutting: { spindleRpm: 5000 } })], { dialect: 'fanuc' });
    expect(s).toContain('S5000 M3');
  });

  it('includes feed rate when set', () => {
    const s = generateSnippet([tool({ cutting: { feedCutting: 1200 } })], { dialect: 'fanuc' });
    expect(s).toContain('F1200.000');
  });

  it('omits spindle/feed lines when not set', () => {
    const s = generateSnippet([tool()], { dialect: 'fanuc' });
    expect(s).not.toContain(' M3');
    expect(s).not.toMatch(/^F\d/m);
  });

  it('includes flute count in comment', () => {
    const s = generateSnippet([tool()], { dialect: 'fanuc' });
    expect(s).toContain('FLUTES: 4');
  });

  it('respects decimal precision', () => {
    const s = generateSnippet([tool()], { dialect: 'fanuc', decimals: 2 });
    expect(s).toContain('10.00');
    expect(s).not.toContain('10.000');
  });
});

// ── generateSnippet — HAAS ───────────────────────────────────────────────────

describe('generateSnippet — haas', () => {
  it('includes the tool-change command', () => {
    const s = generateSnippet([tool()], { dialect: 'haas' });
    expect(s).toContain('T3 M6');
  });

  it('includes G43 H# offset', () => {
    const s = generateSnippet([tool()], { dialect: 'haas' });
    expect(s).toContain('G43 H3');
  });

  it('includes tool-life comment when regrindThreshold is set', () => {
    const s = generateSnippet(
      [tool({ regrindThreshold: 200 })],
      { dialect: 'haas' },
    );
    expect(s).toContain('TOOL LIFE LIMIT: 200 USES');
  });

  it('omits tool-life comment when regrindThreshold is not set', () => {
    const s = generateSnippet([tool()], { dialect: 'haas' });
    expect(s).not.toContain('TOOL LIFE');
  });
});

// ── generateSnippet — Mach3 ──────────────────────────────────────────────────

describe('generateSnippet — mach3', () => {
  it('starts with a semicolon comment line', () => {
    const s = generateSnippet([tool()], { dialect: 'mach3' });
    expect(s.trimStart()).toMatch(/^;/);
  });

  it('includes the tool change command', () => {
    const s = generateSnippet([tool()], { dialect: 'mach3' });
    expect(s).toContain('T3 M6');
  });

  it('includes G43 H# offset', () => {
    const s = generateSnippet([tool()], { dialect: 'mach3' });
    expect(s).toContain('G43 H3');
  });
});

// ── generateSnippet — LinuxCNC ────────────────────────────────────────────────

describe('generateSnippet — linuxcnc', () => {
  it('combines T# M6 G43 H# on one line', () => {
    const s = generateSnippet([tool()], { dialect: 'linuxcnc' });
    expect(s).toContain('T3 M6 G43 H3');
  });

  it('uses lowercase description in the header comment', () => {
    const s = generateSnippet([tool({ description: 'Flat End Mill' })], { dialect: 'linuxcnc' });
    expect(s).toContain('flat end mill');
  });
});

// ── generateSnippet — Siemens ─────────────────────────────────────────────────

describe('generateSnippet — siemens', () => {
  it('uses T="NAME" D1 syntax', () => {
    const s = generateSnippet([tool()], { dialect: 'siemens' });
    expect(s).toContain('D1');
    expect(s).toMatch(/T="[A-Z0-9_]+" D1/);
  });

  it('includes tool name from description', () => {
    const s = generateSnippet([tool({ description: 'Ball End Mill' })], { dialect: 'siemens' });
    // Siemens id converts spaces to underscores
    expect(s).toContain('BALL_END_MILL');
  });

  it('does not exceed 32 char identifier limit', () => {
    const s = generateSnippet(
      [tool({ description: 'This Is A Very Long Tool Description That Exceeds The Limit', geometry: { diameter: 10 } })],
      { dialect: 'siemens' },
    );
    const match = s.match(/T="([^"]+)"/);
    expect(match![1].length).toBeLessThanOrEqual(32);
  });
});

// ── generateSnippet — multiple tools ─────────────────────────────────────────

describe('generateSnippet — multiple tools', () => {
  it('joins blocks with a blank line', () => {
    const tools = [tool({ toolNumber: 1 }), tool({ toolNumber: 2 })];
    const s = generateSnippet(tools, { dialect: 'fanuc' });
    expect(s).toContain('T1 M6');
    expect(s).toContain('T2 M6');
  });

  it('returns empty string for empty array', () => {
    expect(generateSnippet([], { dialect: 'fanuc' })).toBe('');
  });
});

// ── safe() character stripping (tested indirectly) ───────────────────────────

describe('generateSnippet — safe() character stripping', () => {
  it('strips parentheses from description', () => {
    const s = generateSnippet(
      [tool({ description: 'Mill (roughing)' })],
      { dialect: 'fanuc' },
    );
    // Parentheses must not appear inside the comment text unescaped
    // The description in the Fanuc header comment is wrapped in () so inner () must be stripped
    expect(s).not.toMatch(/\([^)]*\([^)]*\)/);  // no nested parens
  });

  it('strips semicolons from description', () => {
    const s = generateSnippet(
      [tool({ description: 'Mill; 10mm' })],
      { dialect: 'mach3' },
    );
    // After the first-line comment, semicolons in content area would break parsers
    const lines = s.split('\n');
    const nonCommentLines = lines.filter((l) => !l.startsWith(';'));
    for (const line of nonCommentLines) {
      expect(line).not.toContain(';');
    }
  });
});
