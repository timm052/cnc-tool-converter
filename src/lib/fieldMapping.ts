/**
 * Post-parse field mapping: copy values from one Tool field path to another.
 * Stored per format-pair key in localStorage.
 */
import type { Tool } from '../types/tool';

const STORAGE_KEY = 'cnc-tool-converter:field-mappings';

export interface FieldMappingRule {
  sourceField: string;
  targetField: string;
}

export interface FieldMapping {
  formatPairKey: string;   // e.g. "hsmlib→linuxcnc"
  rules:         FieldMappingRule[];
}

export function formatPairKey(source: string, target: string): string {
  return `${source}→${target}`;
}

// ── Persistence ───────────────────────────────────────────────────────────────

function loadAll(): FieldMapping[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as FieldMapping[];
  } catch { /* ignore */ }
  return [];
}

function saveAll(mappings: FieldMapping[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings)); }
  catch { /* quota */ }
}

export function loadMapping(source: string, target: string): FieldMapping {
  const key  = formatPairKey(source, target);
  const all  = loadAll();
  return all.find((m) => m.formatPairKey === key) ?? { formatPairKey: key, rules: [] };
}

export function saveMapping(mapping: FieldMapping): void {
  const all = loadAll().filter((m) => m.formatPairKey !== mapping.formatPairKey);
  saveAll([...all, mapping]);
}

// ── Dot-path helpers ──────────────────────────────────────────────────────────

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object') return (cur as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object')
      cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

// ── Apply ─────────────────────────────────────────────────────────────────────

export function applyFieldMapping(tools: Tool[], mapping: FieldMapping): Tool[] {
  if (mapping.rules.length === 0) return tools;
  return tools.map((tool) => {
    const copy = JSON.parse(JSON.stringify(tool)) as Record<string, unknown>;
    for (const rule of mapping.rules) {
      const val = getPath(copy, rule.sourceField);
      if (val !== undefined) setPath(copy, rule.targetField, val);
    }
    return copy as unknown as Tool;
  });
}

// ── Available fields for the UI dropdowns ─────────────────────────────────────

export const MAPPABLE_FIELDS: { path: string; label: string }[] = [
  { path: 'description',          label: 'Description'         },
  { path: 'toolNumber',           label: 'Tool Number (T#)'    },
  { path: 'pocketNumber',         label: 'Pocket Number (P#)'  },
  { path: 'comment',              label: 'Comment'             },
  { path: 'manufacturer',         label: 'Manufacturer'        },
  { path: 'productId',            label: 'Product ID'          },
  { path: 'unit',                 label: 'Unit'                },
  { path: 'material',             label: 'Material'            },
  { path: 'geometry.diameter',    label: 'Geometry — Diameter' },
  { path: 'geometry.fluteLength', label: 'Geometry — Flute Length' },
  { path: 'geometry.overallLength', label: 'Geometry — Overall Length' },
  { path: 'geometry.numberOfFlutes', label: 'Geometry — # Flutes' },
  { path: 'geometry.cornerRadius',   label: 'Geometry — Corner Radius' },
  { path: 'geometry.taperAngle',     label: 'Geometry — Taper Angle' },
  { path: 'cutting.spindleRpm',   label: 'Cutting — Spindle RPM' },
  { path: 'cutting.feedCutting',  label: 'Cutting — Feed (Cut)' },
  { path: 'cutting.feedPlunge',   label: 'Cutting — Feed (Plunge)' },
  { path: 'cutting.coolant',      label: 'Cutting — Coolant'   },
];
