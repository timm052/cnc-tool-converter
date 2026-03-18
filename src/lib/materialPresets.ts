import type { WorkMaterial } from '../types/material';

/** Factory — stamps a fresh id and timestamps each time presets are loaded. */
export function getMaterialPresets(): WorkMaterial[] {
  const now = Date.now();
  const make = (
    name: string,
    category: WorkMaterial['category'],
    hardness: number | undefined,
    machinability: number,
    sfmMin: number,
    sfmMax: number,
    vcMin: number,
    vcMax: number,
    notes?: string,
  ): WorkMaterial => ({
    id:           crypto.randomUUID(),
    name,
    category,
    hardness,
    machinability,
    sfmMin,
    sfmMax,
    vcMin,
    vcMax,
    notes,
    createdAt:    now,
    updatedAt:    now,
  });

  return [
    // ── Aluminum ──────────────────────────────────────────────────────────────
    make('Aluminum 6061-T6',   'aluminum',   60,  90, 500, 1200, 152, 366, 'Most common aluminium alloy; excellent machinability'),
    make('Aluminum 7075-T6',   'aluminum',   87,  80, 400, 1000, 122, 305, 'High-strength aerospace alloy; work-hardens quickly'),
    make('Aluminum 2024-T4',   'aluminum',   75,  85, 400,  900, 122, 274, 'Good fatigue resistance; widely used in aviation structures'),
    // ── Steel ─────────────────────────────────────────────────────────────────
    make('Mild Steel 1018',    'steel',      71, 100, 100,  300,  30,  91, 'Free-cutting carbon steel; easy to machine'),
    make('Steel 4140 (Ann.)',  'steel',      96,  65,  80,  200,  24,  61, 'Chromoly steel annealed; tougher than mild steel'),
    make('Steel 4140 (HT)',    'steel',     302,  40,  50,  130,  15,  40, 'Heat-treated 4140; reduce SFM 30–40% vs annealed'),
    make('Tool Steel D2',      'steel',     740,  20,  30,   80,   9,  24, 'High-carbon high-chromium; use coated carbide'),
    // ── Stainless ─────────────────────────────────────────────────────────────
    make('Stainless 304',      'stainless',  70,  45,  60,  150,  18,  46, 'Most common austenitic; work-hardens rapidly — use sharp tools'),
    make('Stainless 316',      'stainless',  79,  40,  50,  130,  15,  40, 'Mo-bearing for corrosion resistance; similar to 304 in cutting'),
    make('Stainless 17-4 PH',  'stainless', 388,  35,  40,  100,  12,  30, 'Precipitation-hardened; use carbide with good cooling'),
    // ── Titanium ──────────────────────────────────────────────────────────────
    make('Titanium Ti-6Al-4V', 'titanium',  334,  22,  40,  100,  12,  30, 'Most common Ti alloy; low thermal conductivity — flood coolant essential'),
    // ── Cast Iron ─────────────────────────────────────────────────────────────
    make('Gray Cast Iron',     'cast-iron',  200, 70, 100,  350,  30, 107, 'Good damping; chips dry — avoid coolant thermal shock'),
    // ── Brass ─────────────────────────────────────────────────────────────────
    make('Brass C360 (Free-Cutting)', 'brass', 55, 100, 200, 600,  61, 183, 'Highest machinability rating; great surface finish'),
    // ── Plastic ───────────────────────────────────────────────────────────────
    make('Delrin (Acetal POM)', 'plastic', undefined, 95, 300, 800, 91, 244, 'Self-lubricating; avoid heat build-up'),
  ];
}
