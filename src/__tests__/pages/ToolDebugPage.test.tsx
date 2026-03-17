/**
 * ToolDebugPage — integration tests.
 *
 * Verifies that:
 *  - the page renders without crashing
 *  - the sticky header, DEV badge, Reset button and all 11 sliders are present
 *  - every built-in tool type gets its own card
 *  - the Reset button restores default values after a slider change
 *  - slider interaction updates the displayed value
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import ToolDebugPage from '../../components/pages/ToolDebugPage';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { BUILTIN_TYPES } from '../../lib/customToolTypes';

function renderPage() {
  return render(
    React.createElement(SettingsProvider, null,
      React.createElement(ToolDebugPage),
    ),
  );
}

// ── Rendering ────────────────────────────────────────────────────────────────

describe('ToolDebugPage — rendering', () => {
  it('renders without crashing', () => {
    const { container } = renderPage();
    expect(container.firstChild).not.toBeNull();
  });

  it('shows the DEV badge', () => {
    renderPage();
    expect(screen.getByText('DEV')).toBeTruthy();
  });

  it('shows the page title', () => {
    renderPage();
    expect(screen.getByText(/Tool Preview Debug/i)).toBeTruthy();
  });

  it('shows the Reset button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /reset/i })).toBeTruthy();
  });
});

// ── Sliders ───────────────────────────────────────────────────────────────────

const SLIDER_LABELS = [
  'Diameter', 'Shaft Ø', 'OAL', 'Flute L',
  'Corner R', 'Taper °', 'Tip Ø', 'Profile R',
  'Pitch', 'Teeth', 'Nozzle Ø',
];

describe('ToolDebugPage — sliders', () => {
  it('renders all 11 sliders', () => {
    renderPage();
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(11);
  });

  it.each(SLIDER_LABELS)('slider "%s" label is visible', (label) => {
    renderPage();
    // label text is split across elements; use a regex on all text content
    const allText = document.body.textContent ?? '';
    expect(allText).toContain(label);
  });

  it('slider value is displayed next to the label', () => {
    renderPage();
    // Default diameter is 10 — a <strong> with "10" should be present
    const strongs = Array.from(document.querySelectorAll('strong'));
    expect(strongs.some(s => s.textContent === '10')).toBe(true);
  });

  it('changing a slider updates its displayed value', () => {
    renderPage();
    const sliders = screen.getAllByRole('slider');
    const diamSlider = sliders[0]; // Diameter is first
    fireEvent.change(diamSlider, { target: { value: '20' } });
    const strongs = Array.from(document.querySelectorAll('strong'));
    expect(strongs.some(s => s.textContent === '20')).toBe(true);
  });
});

// ── Tool cards ────────────────────────────────────────────────────────────────

describe('ToolDebugPage — tool type cards', () => {
  it(`renders ${BUILTIN_TYPES.length} tool cards`, () => {
    renderPage();
    // Each card has a <span> with the type name as its text content
    for (const type of BUILTIN_TYPES) {
      const matches = Array.from(document.querySelectorAll('span'))
        .filter(s => s.textContent === type);
      expect(matches.length, `card for "${type}" missing`).toBeGreaterThan(0);
    }
  });

  it('each card contains an <svg> element', () => {
    const { container } = renderPage();
    const cards = container.querySelectorAll('[class*="rounded-lg"]');
    for (const card of Array.from(cards)) {
      const svg = card.querySelector('svg');
      expect(svg, `card missing svg: ${card.textContent?.trim()}`).not.toBeNull();
    }
  });
});

// ── Reset button ──────────────────────────────────────────────────────────────

describe('ToolDebugPage — Reset button', () => {
  it('resets slider value back to default after change', () => {
    renderPage();
    const sliders = screen.getAllByRole('slider');
    const diamSlider = sliders[0]; // Diameter slider, default = 10

    // Change diameter to 25 (not a default value for any other field)
    fireEvent.change(diamSlider, { target: { value: '25' } });
    expect(diamSlider).toHaveValue('25');

    // Reset
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    // Diameter slider should be back to 10
    expect(sliders[0]).toHaveValue('10');
  });
});
