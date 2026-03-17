/** Definition of a user-created custom tool type. */
export interface CustomToolTypeDefinition {
  id:               string;
  label:            string;
  /** Which SVG profile shape to render */
  profileShape:
    | 'flat'           // flat bottom (end mill, face mill)
    | 'ball'           // hemispherical tip
    | 'bull nose'      // flat with corner radius
    | 'tapered'        // V-shape / cone tip (chamfer, countersink)
    | 'tapered ball'   // tapered body + ball tip
    | 'tapered bull nose' // tapered body + corner radius
    | 'drill'          // pointed tip with drill-point cone
    | 'center drill'   // two-stage center drill
    | 'counter bore'   // flat face + pilot pin
    | 'reamer'         // flat + lead chamfer
    | 'tap'            // threaded with lead chamfer
    | 'thread mill';   // thread teeth only
  colour:           string;   // Tailwind bg/text class pair, e.g. "bg-indigo-500/20 text-indigo-300"
  showsCornerRadius:   boolean;
  showsTaperAngle:     boolean;
  showsTipDiameter:    boolean;
  showsThreadFields:   boolean;
  showsNumTeeth:       boolean;
}

export const BUILTIN_TYPES = [
  // Milling
  'flat end mill', 'ball end mill', 'bull nose end mill', 'chamfer mill',
  'face mill', 'tapered mill', 'dovetail mill', 'slot mill', 'lollipop mill',
  'form mill', 'engraving',
  // Circle segment
  'circle segment barrel', 'circle segment lens', 'circle segment oval',
  // Hole making
  'drill', 'center drill', 'spot drill', 'counter bore', 'counter sink',
  'reamer', 'boring bar',
  // Threading
  'thread mill', 'tap right hand', 'tap left hand',
  // Special
  'probe', 'laser cutter', 'plasma cutter', 'waterjet', 'holder', 'custom',
] as const;

const BUILTIN_LABELS: Record<string, string> = {
  // Milling
  'flat end mill':          'Flat End Mill',
  'ball end mill':          'Ball End Mill',
  'bull nose end mill':     'Bull Nose',
  'chamfer mill':           'Chamfer Mill',
  'face mill':              'Face Mill',
  'tapered mill':           'Tapered Mill',
  'dovetail mill':          'Dovetail Mill',
  'slot mill':              'Slot Mill',
  'lollipop mill':          'Lollipop Mill',
  'form mill':              'Form Mill',
  'engraving':              'Engraving',
  // Circle segment
  'circle segment barrel':  'CS Barrel',
  'circle segment lens':    'CS Lens',
  'circle segment oval':    'CS Oval',
  // Hole making
  'drill':                  'Drill',
  'center drill':           'Center Drill',
  'spot drill':             'Spot Drill',
  'counter bore':           'Counter Bore',
  'counter sink':           'Counter Sink',
  'reamer':                 'Reamer',
  'boring bar':             'Boring Bar',
  // Threading
  'thread mill':            'Thread Mill',
  'tap right hand':         'Tap (RH)',
  'tap left hand':          'Tap (LH)',
  // Special
  'probe':                  'Probe',
  'laser cutter':           'Laser',
  'plasma cutter':          'Plasma',
  'waterjet':               'Waterjet',
  'holder':                 'Holder',
  'custom':                 'Custom',
};

/** Display label for a type (built-in or custom). */
export function getTypeLabel(
  typeId: string,
  customTypes: CustomToolTypeDefinition[],
): string {
  const custom = customTypes.find((c) => c.id === typeId);
  if (custom) return custom.label;
  return BUILTIN_LABELS[typeId] ?? typeId;
}

/** Returns combined list for the <select> options. */
export function getAllToolTypeOptions(
  customTypes: CustomToolTypeDefinition[],
): { value: string; label: string }[] {
  const builtin = BUILTIN_TYPES.map((t) => ({ value: t, label: BUILTIN_LABELS[t] ?? t }));
  const custom  = customTypes.map((c) => ({ value: c.id, label: `★ ${c.label}` }));
  return [...builtin, ...custom];
}

/** Returns the field visibility flags for a given type id. */
export function getFieldVisibility(
  typeId: string,
  customTypes: CustomToolTypeDefinition[],
): {
  isJetCutter:       boolean;
  showsNozzleDiameter: boolean;
  showsCornerRadius: boolean;
  showsTaperAngle:   boolean;
  showsTipDiameter:  boolean;
  showsThreadFields: boolean;
  showsNumTeeth:     boolean;
} {
  // Jet cutters have a completely different set of relevant fields
  const JET_TYPES = ['laser cutter', 'plasma cutter', 'waterjet'];
  if (JET_TYPES.includes(typeId)) {
    return {
      isJetCutter:         true,
      showsNozzleDiameter: true,
      showsCornerRadius:   false,
      showsTaperAngle:     false,
      showsTipDiameter:    false,
      showsThreadFields:   false,
      showsNumTeeth:       false,
    };
  }

  const custom = customTypes.find((c) => c.id === typeId);
  if (custom) {
    return {
      isJetCutter:         false,
      showsNozzleDiameter: false,
      showsCornerRadius: custom.showsCornerRadius,
      showsTaperAngle:   custom.showsTaperAngle,
      showsTipDiameter:  custom.showsTipDiameter,
      showsThreadFields: custom.showsThreadFields,
      showsNumTeeth:     custom.showsNumTeeth,
    };
  }
  // Built-in type fallback
  return {
    isJetCutter:         false,
    showsNozzleDiameter: false,
    showsCornerRadius: [
      'bull nose end mill', 'lollipop mill', 'probe', 'tapered mill',
      'circle segment barrel', 'circle segment lens', 'circle segment oval',
      'custom',
    ].includes(typeId),
    showsTaperAngle: [
      'drill', 'center drill', 'spot drill', 'chamfer mill', 'tapered mill',
      'dovetail mill', 'counter sink', 'engraving', 'custom',
    ].includes(typeId),
    showsTipDiameter: [
      'drill', 'center drill', 'spot drill', 'chamfer mill', 'tapered mill',
      'dovetail mill', 'counter sink', 'counter bore', 'slot mill', 'engraving',
      'thread mill', 'custom',
    ].includes(typeId),
    showsThreadFields: ['thread mill', 'tap right hand', 'tap left hand'].includes(typeId),
    showsNumTeeth:     ['thread mill', 'face mill'].includes(typeId),
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
    // Milling
    'flat end mill':          'bg-blue-500/20 text-blue-300',
    'ball end mill':          'bg-purple-500/20 text-purple-300',
    'bull nose end mill':     'bg-violet-500/20 text-violet-300',
    'chamfer mill':           'bg-orange-500/20 text-orange-300',
    'face mill':              'bg-cyan-500/20 text-cyan-300',
    'tapered mill':           'bg-pink-500/20 text-pink-300',
    'dovetail mill':          'bg-fuchsia-500/20 text-fuchsia-300',
    'slot mill':              'bg-sky-500/20 text-sky-300',
    'lollipop mill':          'bg-lime-500/20 text-lime-300',
    'form mill':              'bg-indigo-500/20 text-indigo-300',
    'engraving':              'bg-rose-500/20 text-rose-300',
    // Circle segment
    'circle segment barrel':  'bg-violet-500/20 text-violet-300',
    'circle segment lens':    'bg-purple-500/20 text-purple-300',
    'circle segment oval':    'bg-fuchsia-500/20 text-fuchsia-300',
    // Hole making
    'drill':                  'bg-green-500/20 text-green-300',
    'center drill':           'bg-emerald-500/20 text-emerald-300',
    'spot drill':             'bg-yellow-500/20 text-yellow-300',
    'counter bore':           'bg-teal-500/20 text-teal-300',
    'counter sink':           'bg-amber-500/20 text-amber-300',
    'reamer':                 'bg-lime-500/20 text-lime-300',
    'boring bar':             'bg-teal-500/20 text-teal-300',
    // Threading
    'thread mill':            'bg-amber-500/20 text-amber-300',
    'tap right hand':         'bg-orange-500/20 text-orange-300',
    'tap left hand':          'bg-orange-500/20 text-orange-300',
    // Special
    'probe':                  'bg-sky-500/20 text-sky-300',
    'laser cutter':           'bg-red-500/20 text-red-300',
    'plasma cutter':          'bg-red-500/20 text-red-300',
    'waterjet':               'bg-blue-500/20 text-blue-300',
    'holder':                 'bg-slate-500/20 text-slate-400',
    'custom':                 'bg-slate-500/20 text-slate-300',
  };
  return BUILTIN_COLOURS[typeId] ?? 'bg-slate-500/20 text-slate-300';
}

/** Gets the SVG profile shape for a type. */
export function getProfileShape(
  typeId: string,
  customTypes: CustomToolTypeDefinition[],
): CustomToolTypeDefinition['profileShape'] {
  const custom = customTypes.find((c) => c.id === typeId);
  if (custom) return custom.profileShape;
  // Built-in type mapping
  switch (typeId) {
    case 'ball end mill':
    case 'lollipop mill':
    case 'probe':             return 'ball';
    case 'bull nose end mill': return 'bull nose';
    case 'tapered mill':      return 'tapered ball';   // default; overridden by cornerRadius at runtime
    case 'drill':
    case 'spot drill':        return 'drill';
    case 'center drill':      return 'center drill';
    case 'counter bore':      return 'counter bore';
    case 'reamer':            return 'reamer';
    case 'tap right hand':
    case 'tap left hand':     return 'tap';
    case 'thread mill':       return 'thread mill';
    case 'chamfer mill':
    case 'dovetail mill':
    case 'counter sink':
    case 'engraving':         return 'tapered';
    default:                  return 'flat';
  }
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
