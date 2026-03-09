/** Definition of a user-created custom tool type. */
export interface CustomToolTypeDefinition {
  id:               string;
  label:            string;
  /** Which SVG profile shape to render */
  profileShape:     'flat' | 'ball' | 'tapered' | 'drill';
  colour:           string;   // Tailwind bg/text class pair, e.g. "bg-indigo-500/20 text-indigo-300"
  showsCornerRadius:   boolean;
  showsTaperAngle:     boolean;
  showsTipDiameter:    boolean;
  showsThreadFields:   boolean;
  showsNumTeeth:       boolean;
}

const BUILTIN_TYPES = [
  'flat end mill', 'ball end mill', 'bull nose end mill', 'chamfer mill',
  'face mill', 'spot drill', 'drill', 'tapered mill', 'boring bar',
  'thread mill', 'engraving', 'custom',
] as const;

/** Returns combined list for the <select> options. */
export function getAllToolTypeOptions(
  customTypes: CustomToolTypeDefinition[],
): { value: string; label: string }[] {
  const builtin = BUILTIN_TYPES.map((t) => ({ value: t, label: t }));
  const custom  = customTypes.map((c) => ({ value: c.id, label: `★ ${c.label}` }));
  return [...builtin, ...custom];
}

/** Returns the field visibility flags for a given type id. */
export function getFieldVisibility(
  typeId: string,
  customTypes: CustomToolTypeDefinition[],
): {
  showsCornerRadius: boolean;
  showsTaperAngle:   boolean;
  showsTipDiameter:  boolean;
  showsThreadFields: boolean;
  showsNumTeeth:     boolean;
} {
  const custom = customTypes.find((c) => c.id === typeId);
  if (custom) {
    return {
      showsCornerRadius: custom.showsCornerRadius,
      showsTaperAngle:   custom.showsTaperAngle,
      showsTipDiameter:  custom.showsTipDiameter,
      showsThreadFields: custom.showsThreadFields,
      showsNumTeeth:     custom.showsNumTeeth,
    };
  }
  // Built-in type fallback
  return {
    showsCornerRadius: typeId === 'bull nose end mill' || typeId === 'custom',
    showsTaperAngle:   ['drill', 'spot drill', 'chamfer mill', 'tapered mill', 'engraving', 'custom'].includes(typeId),
    showsTipDiameter:  ['drill', 'spot drill', 'chamfer mill', 'tapered mill', 'engraving', 'thread mill', 'custom'].includes(typeId),
    showsThreadFields: typeId === 'thread mill',
    showsNumTeeth:     typeId === 'thread mill' || typeId === 'face mill',
  };
}

/** Tailwind badge colour for a type (built-in or custom). */
export function getTypeColour(
  typeId: string,
  customTypes: CustomToolTypeDefinition[],
): string {
  const custom = customTypes.find((c) => c.id === typeId);
  if (custom) return custom.colour;
  const BUILTIN_COLOURS: Record<string, string> = {
    'flat end mill':       'bg-blue-500/20 text-blue-300',
    'ball end mill':       'bg-purple-500/20 text-purple-300',
    'bull nose end mill':  'bg-violet-500/20 text-violet-300',
    'chamfer mill':        'bg-orange-500/20 text-orange-300',
    'face mill':           'bg-cyan-500/20 text-cyan-300',
    'spot drill':          'bg-yellow-500/20 text-yellow-300',
    'drill':               'bg-green-500/20 text-green-300',
    'tapered mill':        'bg-pink-500/20 text-pink-300',
    'boring bar':          'bg-teal-500/20 text-teal-300',
    'thread mill':         'bg-amber-500/20 text-amber-300',
    'engraving':           'bg-rose-500/20 text-rose-300',
    'custom':              'bg-slate-500/20 text-slate-300',
  };
  return BUILTIN_COLOURS[typeId] ?? 'bg-slate-500/20 text-slate-300';
}

/** Gets the SVG profile shape for a type. */
export function getProfileShape(
  typeId: string,
  customTypes: CustomToolTypeDefinition[],
): 'flat' | 'ball' | 'tapered' | 'drill' {
  const custom = customTypes.find((c) => c.id === typeId);
  if (custom) return custom.profileShape;
  if (typeId === 'ball end mill') return 'ball';
  if (['drill', 'spot drill', 'chamfer mill', 'tapered mill', 'engraving', 'thread mill'].includes(typeId)) return 'tapered';
  return 'flat';
}

export const CUSTOM_TYPE_COLOUR_OPTIONS = [
  { value: 'bg-indigo-500/20 text-indigo-300',   label: 'Indigo'   },
  { value: 'bg-sky-500/20 text-sky-300',          label: 'Sky'      },
  { value: 'bg-emerald-500/20 text-emerald-300',  label: 'Emerald'  },
  { value: 'bg-lime-500/20 text-lime-300',        label: 'Lime'     },
  { value: 'bg-fuchsia-500/20 text-fuchsia-300',  label: 'Fuchsia'  },
  { value: 'bg-rose-500/20 text-rose-300',        label: 'Rose'     },
  { value: 'bg-orange-500/20 text-orange-300',    label: 'Orange'   },
  { value: 'bg-yellow-500/20 text-yellow-300',    label: 'Yellow'   },
  { value: 'bg-teal-500/20 text-teal-300',        label: 'Teal'     },
  { value: 'bg-slate-500/20 text-slate-300',      label: 'Slate'    },
];
