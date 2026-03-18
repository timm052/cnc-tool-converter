/**
 * Surface speed (Vc) lookup table for common material + tool-material combinations.
 *
 * Vc values are in m/min (metric); SFM values are the imperial equivalents.
 * These are conservative starting points — actual values depend on machine rigidity,
 * coolant, depth of cut, and specific grades.
 *
 * Sources: Sandvik Coromant General Turning Catalogue, Kennametal Application Guide,
 *          Harvey Tool General Machining Feeds & Speeds.
 */

export type ToolMaterial = 'carbide' | 'hss' | 'ceramic' | 'cbn' | 'diamond';

export interface SpeedPreset {
  /** Human-readable label */
  label: string;
  /** Tool material category */
  toolMaterial: ToolMaterial;
  /** Recommended Vc min (m/min) */
  vcMin: number;
  /** Recommended Vc max (m/min) */
  vcMax: number;
  /** Recommended chip load per tooth range, as a fraction of diameter */
  chipLoadFactor?: { min: number; max: number };
  /** Short note for the user */
  note?: string;
}

export interface MaterialSpeedGroup {
  /** Material group name — matches common WorkMaterial names */
  material: string;
  /** Short code shown in the Quick fill button */
  code: string;
  presets: SpeedPreset[];
}

/** Convert m/min → SFM */
export function vcToSfm(vc: number): number {
  return Math.round(vc * 3.2808);
}

/** Convert SFM → m/min */
export function sfmToVc(sfm: number): number {
  return Math.round(sfm / 3.2808 * 10) / 10;
}

export const SURFACE_SPEED_GROUPS: MaterialSpeedGroup[] = [
  {
    material: 'Aluminium',
    code: 'Al',
    presets: [
      { label: 'Al — Carbide (general)', toolMaterial: 'carbide', vcMin: 200, vcMax: 500, chipLoadFactor: { min: 0.01, max: 0.04 }, note: 'Use sharp uncoated or DLC carbide; high-flow coolant.' },
      { label: 'Al — HSS', toolMaterial: 'hss', vcMin: 60, vcMax: 120, chipLoadFactor: { min: 0.008, max: 0.025 } },
      { label: 'Al — Diamond (PCD)', toolMaterial: 'diamond', vcMin: 500, vcMax: 3000, note: 'Finishing only; extremely high Vc, near-zero chip load.' },
    ],
  },
  {
    material: 'Mild Steel',
    code: 'St',
    presets: [
      { label: 'Mild Steel — Carbide (coated)', toolMaterial: 'carbide', vcMin: 100, vcMax: 250, chipLoadFactor: { min: 0.01, max: 0.03 }, note: 'TiAlN or AlTiN coating recommended.' },
      { label: 'Mild Steel — HSS', toolMaterial: 'hss', vcMin: 20, vcMax: 40, chipLoadFactor: { min: 0.005, max: 0.015 } },
    ],
  },
  {
    material: 'Alloy Steel',
    code: 'AS',
    presets: [
      { label: 'Alloy Steel (4140) — Carbide', toolMaterial: 'carbide', vcMin: 80, vcMax: 180, chipLoadFactor: { min: 0.008, max: 0.025 }, note: 'Annealed ~28 HRC. Reduce 30 % for hardened.' },
      { label: 'Alloy Steel — HSS', toolMaterial: 'hss', vcMin: 15, vcMax: 30 },
    ],
  },
  {
    material: 'Stainless Steel',
    code: 'SS',
    presets: [
      { label: 'SS 304/316 — Carbide (TiAlN)', toolMaterial: 'carbide', vcMin: 60, vcMax: 150, chipLoadFactor: { min: 0.008, max: 0.02 }, note: 'Work-hardens rapidly — maintain feed; never dwell.' },
      { label: 'SS 304/316 — HSS', toolMaterial: 'hss', vcMin: 15, vcMax: 25 },
    ],
  },
  {
    material: 'Titanium',
    code: 'Ti',
    presets: [
      { label: 'Ti-6Al-4V — Carbide', toolMaterial: 'carbide', vcMin: 30, vcMax: 80, chipLoadFactor: { min: 0.005, max: 0.015 }, note: 'Use flood coolant; Ti is thermally insulating — keep Vc low.' },
      { label: 'Ti-6Al-4V — HSS', toolMaterial: 'hss', vcMin: 10, vcMax: 20 },
    ],
  },
  {
    material: 'Cast Iron',
    code: 'CI',
    presets: [
      { label: 'Gray Cast Iron — Carbide', toolMaterial: 'carbide', vcMin: 100, vcMax: 300, chipLoadFactor: { min: 0.01, max: 0.035 }, note: 'Dry or mist; CI chips are abrasive.' },
      { label: 'Gray Cast Iron — CBN', toolMaterial: 'cbn', vcMin: 400, vcMax: 1000, note: 'High-speed finishing of hardened CI.' },
      { label: 'Gray Cast Iron — HSS', toolMaterial: 'hss', vcMin: 20, vcMax: 50 },
    ],
  },
  {
    material: 'Brass',
    code: 'Br',
    presets: [
      { label: 'Brass C360 — Carbide', toolMaterial: 'carbide', vcMin: 150, vcMax: 400, chipLoadFactor: { min: 0.015, max: 0.05 } },
      { label: 'Brass C360 — HSS', toolMaterial: 'hss', vcMin: 60, vcMax: 130 },
    ],
  },
  {
    material: 'Plastic / Delrin',
    code: 'Pl',
    presets: [
      { label: 'Delrin/Nylon — Carbide (O-flute)', toolMaterial: 'carbide', vcMin: 200, vcMax: 500, chipLoadFactor: { min: 0.02, max: 0.06 }, note: 'Single or O-flute recommended for evacuation.' },
      { label: 'Delrin/Nylon — HSS', toolMaterial: 'hss', vcMin: 80, vcMax: 200 },
    ],
  },
];

/** Flatten all presets into a single array for easy filtering */
export const ALL_SPEED_PRESETS: (SpeedPreset & { material: string; code: string })[] =
  SURFACE_SPEED_GROUPS.flatMap((g) =>
    g.presets.map((p) => ({ ...p, material: g.material, code: g.code })),
  );
