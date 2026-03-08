export type MaterialCategory =
  | 'aluminum' | 'steel' | 'stainless' | 'titanium' | 'cast-iron'
  | 'brass' | 'copper' | 'wood' | 'plastic' | 'foam' | 'composite' | 'other';

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'aluminum', 'steel', 'stainless', 'titanium', 'cast-iron',
  'brass', 'copper', 'wood', 'plastic', 'foam', 'composite', 'other',
];

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  aluminum:    'Aluminum',
  steel:       'Steel',
  stainless:   'Stainless',
  titanium:    'Titanium',
  'cast-iron': 'Cast Iron',
  brass:       'Brass',
  copper:      'Copper',
  wood:        'Wood',
  plastic:     'Plastic',
  foam:        'Foam',
  composite:   'Composite',
  other:       'Other',
};

export const MATERIAL_CATEGORY_COLOURS: Record<MaterialCategory, string> = {
  aluminum:    'bg-slate-400/20 text-slate-300',
  steel:       'bg-blue-500/20 text-blue-300',
  stainless:   'bg-cyan-500/20 text-cyan-300',
  titanium:    'bg-purple-500/20 text-purple-300',
  'cast-iron': 'bg-zinc-500/20 text-zinc-400',
  brass:       'bg-yellow-500/20 text-yellow-300',
  copper:      'bg-orange-500/20 text-orange-300',
  wood:        'bg-amber-600/20 text-amber-400',
  plastic:     'bg-green-500/20 text-green-300',
  foam:        'bg-emerald-500/20 text-emerald-300',
  composite:   'bg-violet-500/20 text-violet-300',
  other:       'bg-slate-500/20 text-slate-400',
};

/** A workpiece / stock material stored in the material library. */
export interface WorkMaterial {
  id:             string;
  name:           string;
  category:       MaterialCategory;
  /** Hardness in HRC */
  hardness?:      number;
  /** Machinability rating 0–100 (100 = easiest) */
  machinability?: number;
  /** Surface speed lower bound (ft/min) */
  sfmMin?:        number;
  /** Surface speed upper bound (ft/min) */
  sfmMax?:        number;
  /** Surface speed lower bound (m/min) */
  vcMin?:         number;
  /** Surface speed upper bound (m/min) */
  vcMax?:         number;
  notes?:         string;
  createdAt:      number;
  updatedAt:      number;
}
