import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const THEMES_DIR = resolve(__dirname, '../../themes');

const THEME_FILES = [
  { file: 'theme-retro90s.css', dataTheme: 'retro90s', previewClass: '.theme-preview-retro' },
  { file: 'theme-winxp.css',    dataTheme: 'winxp',    previewClass: '.theme-preview-xp' },
  { file: 'theme-macos9.css',   dataTheme: 'macos9',   previewClass: '.theme-preview-mac9' },
  { file: 'theme-light.css',    dataTheme: 'light',    previewClass: '.theme-preview-light' },
];

describe('Theme CSS files', () => {
  for (const { file, dataTheme, previewClass } of THEME_FILES) {
    const path = resolve(THEMES_DIR, file);

    it(`${file} exists`, () => {
      expect(existsSync(path)).toBe(true);
    });

    it(`${file} is non-empty`, () => {
      const content = readFileSync(path, 'utf-8');
      expect(content.trim().length).toBeGreaterThan(100);
    });

    it(`${file} contains [data-theme="${dataTheme}"] selector`, () => {
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain(`[data-theme="${dataTheme}"]`);
    });

    it(`${file} contains theme preview class ${previewClass}`, () => {
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain(previewClass);
    });

    it(`${file} uses !important on overrides (needed to beat Tailwind specificity)`, () => {
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('!important');
    });
  }

  it('theme-macos9.css contains .macos9-titlebar component class', () => {
    const content = readFileSync(resolve(THEMES_DIR, 'theme-macos9.css'), 'utf-8');
    expect(content).toContain('.macos9-titlebar');
  });

  it('theme-macos9.css contains .macos9-winbtn component class', () => {
    const content = readFileSync(resolve(THEMES_DIR, 'theme-macos9.css'), 'utf-8');
    expect(content).toContain('.macos9-winbtn');
  });

  it('all theme files are imported in main.tsx', () => {
    const mainPath = resolve(__dirname, '../../main.tsx');
    const main = readFileSync(mainPath, 'utf-8');
    for (const { file } of THEME_FILES) {
      expect(main).toContain(file.replace('.css', ''));
    }
  });
});
