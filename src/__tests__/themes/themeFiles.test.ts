import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const THEMES_DIR = resolve(__dirname, '../../themes');

interface ThemeDef {
  file: string;
  dataTheme: string;
  previewClass: string;
  /** True for Windows/Mac skeuomorphic themes that pin a compact font scale */
  retro: boolean;
}

const THEME_FILES: ThemeDef[] = [
  { file: 'theme-retro90s.css', dataTheme: 'retro90s', previewClass: '.theme-preview-retro', retro: true },
  { file: 'theme-winxp.css',    dataTheme: 'winxp',    previewClass: '.theme-preview-xp',    retro: true },
  { file: 'theme-macos9.css',   dataTheme: 'macos9',   previewClass: '.theme-preview-mac9',  retro: true },
  { file: 'theme-light.css',    dataTheme: 'light',    previewClass: '.theme-preview-light',  retro: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function load(file: string): string {
  return readFileSync(resolve(THEMES_DIR, file), 'utf-8');
}

/**
 * Check that `css` contains each entry in `patterns`.
 * Returns a list of labels for patterns that are missing.
 */
function findMissing(css: string, patterns: { pattern: string; label: string }[]): string[] {
  return patterns
    .filter(({ pattern }) => !css.includes(pattern))
    .map(({ label }) => label);
}

// ── Required rules — every theme must implement these ─────────────────────────
//
// Patterns are literal CSS substrings as they appear in the file.
// Tailwind utility classes containing `:` are escaped with `\:` in CSS selectors.

const REQUIRED_ALL: { pattern: string; label: string }[] = [
  // Layout regions
  { pattern: 'header',                                    label: 'header styles' },
  { pattern: 'aside',                                     label: 'sidebar styles' },
  { pattern: 'main {',                                    label: 'main background' },
  { pattern: '.fixed.right-0',                            label: 'slide-over panel' },
  { pattern: '.fixed.right-0 > div:first-child',          label: 'slide-over title bar' },
  // Scrollbars
  { pattern: '::-webkit-scrollbar-track',                 label: 'scrollbar track' },
  { pattern: '::-webkit-scrollbar-thumb',                 label: 'scrollbar thumb' },
  { pattern: '::-webkit-scrollbar-thumb:hover',           label: 'scrollbar thumb:hover' },
  // Background slate scale
  { pattern: '.bg-slate-900',                             label: 'bg-slate-900' },
  { pattern: '.bg-slate-800',                             label: 'bg-slate-800' },
  { pattern: '.bg-slate-800\\/50',                        label: 'bg-slate-800/50' },
  { pattern: '.bg-slate-700',                             label: 'bg-slate-700' },
  { pattern: '.bg-slate-750',                             label: 'bg-slate-750' },
  { pattern: '.bg-slate-600',                             label: 'bg-slate-600' },
  // Text slate scale
  { pattern: '.text-slate-100',                           label: 'text-slate-100' },
  { pattern: '.text-slate-400',                           label: 'text-slate-400' },
  { pattern: '.text-slate-500',                           label: 'text-slate-500' },
  { pattern: '.text-white',                               label: 'text-white' },
  // Borders
  { pattern: '.border-slate-700',                         label: 'border-slate-700' },
  { pattern: '.divide-slate-700\\/60',                    label: 'divide-slate-700/60' },
  // Blue accent scale
  { pattern: '.bg-blue-600',                              label: 'bg-blue-600' },
  { pattern: '.bg-blue-600\\/20',                         label: 'bg-blue-600/20' },
  { pattern: '.text-blue-400',                            label: 'text-blue-400' },
  { pattern: '.text-blue-300',                            label: 'text-blue-300' },
  { pattern: '.border-blue-600\\/30',                     label: 'border-blue-600/30' },
  { pattern: '.hover\\:bg-blue-700:hover',                label: 'hover:bg-blue-700' },
  { pattern: '.bg-blue-500',                              label: 'bg-blue-500' },
  { pattern: '.bg-blue-500\\/20',                         label: 'bg-blue-500/20' },
  { pattern: '.hover\\:bg-blue-500:hover',                label: 'hover:bg-blue-500' },
  { pattern: '.border-blue-500\\/40',                     label: 'border-blue-500/40' },
  { pattern: '.focus\\:ring-blue-500',                    label: 'focus:ring-blue-500' },
  { pattern: '.focus-visible\\:ring-blue-500',            label: 'focus-visible:ring-blue-500' },
  // Buttons
  { pattern: 'main button',                               label: 'main button styles' },
  { pattern: 'main button:hover',                         label: 'main button:hover' },
  { pattern: 'main button:active',                        label: 'main button:active' },
  { pattern: 'button.bg-blue-600',                        label: 'primary/accent button' },
  { pattern: 'button.text-red-400',                       label: 'destructive button (text-red-400)' },
  { pattern: 'button.hover\\:text-red-400',               label: 'destructive button (hover:text-red-400)' },
  { pattern: 'button.bg-red-600',                         label: 'destructive button (bg-red-600)' },
  // Sidebar nav buttons
  { pattern: 'aside button',                              label: 'sidebar button' },
  { pattern: 'aside button:hover',                        label: 'sidebar button:hover' },
  { pattern: 'aside button.bg-blue-600',                  label: 'sidebar active button' },
  // Inputs
  { pattern: 'input:not([type="checkbox"])',              label: 'text inputs' },
  { pattern: 'input::placeholder',                        label: 'input placeholder' },
  { pattern: 'input:focus',                               label: 'input focus' },
  { pattern: 'select option',                             label: 'select option' },
  // Toggle
  { pattern: 'button[role="switch"]',                     label: 'toggle/switch' },
  { pattern: 'button[role="switch"].bg-blue-600',         label: 'toggle on state' },
  { pattern: 'button[role="switch"].bg-slate-600',        label: 'toggle off state' },
  // Drop zone
  { pattern: '.border-dashed',                            label: 'drop zone' },
  // Tables
  { pattern: ' th',                                       label: 'table header (th)' },
  { pattern: 'tr:hover td',                               label: 'table row hover' },
  { pattern: ' td',                                       label: 'table cell (td)' },
  // Focus
  { pattern: '*:focus-visible',                           label: 'focus-visible outline' },
  // Tooltip
  { pattern: '[role="tooltip"]',                          label: 'tooltip' },
  // Panels with bevel/border
  { pattern: '.border.rounded-xl',                        label: 'rounded panel border' },
  // Colour token overrides — tool type badges, star, warnings, tags
  { pattern: '.text-red-300',                             label: 'text-red-300' },
  { pattern: '.text-red-400',                             label: 'text-red-400' },
  { pattern: '.text-amber-400',                           label: 'text-amber-400' },
  { pattern: '.text-amber-500',                           label: 'text-amber-500' },
  { pattern: '.text-orange-300',                          label: 'text-orange-300' },
  { pattern: '.text-yellow-300',                          label: 'text-yellow-300' },
  { pattern: '.text-green-300',                           label: 'text-green-300' },
  { pattern: '.text-green-400',                           label: 'text-green-400' },
  { pattern: '.text-emerald-300',                         label: 'text-emerald-300' },
  { pattern: '.text-emerald-400',                         label: 'text-emerald-400' },
  { pattern: '.text-teal-300',                            label: 'text-teal-300' },
  { pattern: '.text-cyan-300',                            label: 'text-cyan-300' },
  { pattern: '.text-sky-300',                             label: 'text-sky-300' },
  { pattern: '.text-indigo-300',                          label: 'text-indigo-300' },
  { pattern: '.text-purple-300',                          label: 'text-purple-300' },
  { pattern: '.text-violet-300',                          label: 'text-violet-300' },
  { pattern: '.text-pink-300',                            label: 'text-pink-300' },
  { pattern: '.text-rose-300',                            label: 'text-rose-300' },
  { pattern: '.text-fuchsia-300',                         label: 'text-fuchsia-300' },
  { pattern: '.text-lime-300',                            label: 'text-lime-300' },
  { pattern: '.hover\\:text-amber-300:hover',             label: 'hover:text-amber-300' },
  // Type accent border-left colours (restored after blanket td border-color override)
  { pattern: 'td.border-l-blue-400',                     label: 'type accent border: blue-400' },
  { pattern: 'td.border-l-purple-400',                   label: 'type accent border: purple-400' },
  { pattern: 'td.border-l-green-400',                    label: 'type accent border: green-400' },
  { pattern: 'td.border-l-amber-400',                    label: 'type accent border: amber-400' },
  { pattern: 'td.border-l-red-400',                      label: 'type accent border: red-400' },
  // Warning boxes
  { pattern: '.bg-amber-500\\/10',                        label: 'warning box bg (bg-amber-500/10)' },
  { pattern: '.bg-amber-500\\/5',                         label: 'warning box bg (bg-amber-500/5)' },
  { pattern: '.border-amber-500\\/30',                    label: 'warning box border' },
];

// ── Required rules — retro/skeuomorphic themes only (not light/dark) ──────────
//
// These themes pin a compact pixel font scale to match their era's system font.

const REQUIRED_RETRO: { pattern: string; label: string }[] = [
  { pattern: '.text-lg',   label: 'font scale: text-lg override' },
  { pattern: '.text-base', label: 'font scale: text-base override' },
  { pattern: '.text-sm',   label: 'font scale: text-sm override' },
  { pattern: '.text-xs',   label: 'font scale: text-xs override' },
];

// ─────────────────────────────────────────────────────────────────────────────

describe('Theme CSS files', () => {
  // ── Sanity: file-level checks ───────────────────────────────────────────────
  describe('file sanity', () => {
    for (const { file, dataTheme, previewClass } of THEME_FILES) {
      const path = resolve(THEMES_DIR, file);

      it(`${file} exists`, () => {
        expect(existsSync(path)).toBe(true);
      });

      it(`${file} is non-empty`, () => {
        const content = load(file);
        expect(content.trim().length).toBeGreaterThan(100);
      });

      it(`${file} contains [data-theme="${dataTheme}"] selector`, () => {
        expect(load(file)).toContain(`[data-theme="${dataTheme}"]`);
      });

      it(`${file} contains theme preview class ${previewClass}`, () => {
        expect(load(file)).toContain(previewClass);
      });

      it(`${file} uses !important overrides`, () => {
        expect(load(file)).toContain('!important');
      });
    }
  });

  // ── All-themes required rules ───────────────────────────────────────────────
  describe('required rules — all themes', () => {
    for (const { file } of THEME_FILES) {
      it(`${file} implements all required rules`, () => {
        const css = load(file);
        const missing = findMissing(css, REQUIRED_ALL);
        expect(
          missing,
          `${file} is missing:\n  • ${missing.join('\n  • ')}`,
        ).toEqual([]);
      });
    }
  });

  // ── Retro-themes required rules (compact font scale) ───────────────────────
  describe('required rules — retro/skeuomorphic themes', () => {
    for (const { file, retro } of THEME_FILES) {
      if (!retro) continue;

      it(`${file} implements compact font scale`, () => {
        const css = load(file);
        const missing = findMissing(css, REQUIRED_RETRO);
        expect(
          missing,
          `${file} is missing font-scale rules:\n  • ${missing.join('\n  • ')}`,
        ).toEqual([]);
      });
    }
  });

  // ── Cross-theme consistency: same rules in all retro themes ────────────────
  //
  // Extracts every `.[utility-class]` token that appears scoped under any
  // `[data-theme]` in one retro theme and checks the others also define it.
  // This catches "I added a badge colour to winxp but forgot retro90s" cases.
  describe('cross-theme consistency — retro themes must define the same utility overrides', () => {
    const retroThemes = THEME_FILES.filter(t => t.retro);

    // Build a map of theme → Set<utilityClass> where a utility class is any
    // `.some-class` or `.some-class\/N` token found in a [data-theme] rule.
    function extractUtilityClasses(css: string): Set<string> {
      const set = new Set<string>();
      // Match class selectors inside [data-theme="…"] rules
      const matches = css.matchAll(/\[data-theme="[^"]+"\]\s+([^\s{,]+)/g);
      for (const [, selector] of matches) {
        // Keep only tokens that look like Tailwind utility classes (dot-prefixed)
        const tokens = selector.split(/[\s>+~]/).filter(t => t.startsWith('.'));
        for (const tok of tokens) {
          // Normalise: strip pseudo-class (:hover/:focus) so we only track
          // the class name itself, not the interaction variant
          set.add(tok.replace(/:[a-z-]+$/, ''));
        }
      }
      return set;
    }

    it('all retro themes define the same set of utility class overrides', () => {
      const maps = retroThemes.map(t => ({
        name: t.file,
        classes: extractUtilityClasses(load(t.file)),
      }));

      // For each theme, find classes it defines that at least one other retro
      // theme also defines but some retro theme does NOT define.
      const allClasses = new Set<string>();
      for (const { classes } of maps) {
        for (const c of classes) allClasses.add(c);
      }

      const gaps: string[] = [];
      for (const cls of allClasses) {
        const present = maps.filter(m => m.classes.has(cls)).map(m => m.name);
        const absent  = maps.filter(m => !m.classes.has(cls)).map(m => m.name);
        // Only flag if at least 2 themes define it but some don't (skip
        // single-theme-only classes which are intentional specialisations).
        if (present.length >= 2 && absent.length > 0) {
          gaps.push(`  ${cls}\n    ✓ ${present.join(', ')}\n    ✗ ${absent.join(', ')}`);
        }
      }

      expect(gaps, `Cross-theme utility gaps found:\n${gaps.join('\n')}`).toEqual([]);
    });
  });

  // ── macos9-specific component classes ──────────────────────────────────────
  describe('macos9 component classes', () => {
    it('theme-macos9.css contains .macos9-titlebar', () => {
      expect(load('theme-macos9.css')).toContain('.macos9-titlebar');
    });
    it('theme-macos9.css contains .macos9-winbtn', () => {
      expect(load('theme-macos9.css')).toContain('.macos9-winbtn');
    });
  });

  // ── main.tsx imports all themes ─────────────────────────────────────────────
  it('all theme files are imported in main.tsx', () => {
    const main = readFileSync(resolve(__dirname, '../../main.tsx'), 'utf-8');
    for (const { file } of THEME_FILES) {
      expect(main, `main.tsx missing import for ${file}`).toContain(file.replace('.css', ''));
    }
  });
});
