import { useState, useMemo, memo, type ChangeEvent } from 'react';
import { X, CheckCircle, Trash2, ChevronDown, Plus } from 'lucide-react';
import type { LibraryTool, ToolMaterialEntry, ToolCondition } from '../../types/libraryTool';
import { TOOL_CONDITION_LABELS } from '../../types/libraryTool';
import type { ToolType, ToolMaterial, CoolantMode, FeedMode } from '../../types/tool';
import type { WorkMaterial } from '../../types/material';
import { MATERIAL_CATEGORY_COLOURS, MATERIAL_CATEGORY_LABELS } from '../../types/material';
import MachineGroupInput from './MachineGroupInput';

interface BulkEditPanelProps {
  tools:        LibraryTool[];
  allGroups:    string[];
  allTags:      string[];
  allMaterials: WorkMaterial[];
  onApply:      (updates: { id: string; patch: Partial<LibraryTool> }[]) => Promise<void>;
  onClose:      () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

type Tab = 'library' | 'geometry' | 'cutting' | 'nc' | 'crib';
const TABS: { id: Tab; label: string }[] = [
  { id: 'library',  label: 'Library'  },
  { id: 'geometry', label: 'Geometry' },
  { id: 'cutting',  label: 'Cutting'  },
  { id: 'nc',       label: 'NC'       },
  { id: 'crib',     label: 'Crib'     },
];

const TOOL_TYPES: ToolType[] = [
  'flat end mill', 'ball end mill', 'bull nose end mill', 'chamfer mill',
  'face mill', 'spot drill', 'drill', 'tapered mill', 'boring bar',
  'thread mill', 'engraving', 'custom',
];
const TOOL_MATERIALS: ToolMaterial[] = ['carbide', 'hss', 'ceramics', 'diamond', 'other'];
const COOLANT_MODES: CoolantMode[]   = ['flood', 'mist', 'air', 'suction', 'disabled'];
const FEED_MODES:   FeedMode[]       = ['per-minute', 'per-revolution'];

// ── Per-material card values ───────────────────────────────────────────────────

interface MatCardValues {
  rpm?:            number;
  rampSpindleRpm?: number;
  surfaceSpeed?:   number;
  feedRate?:       number;
  feedPlunge?:     number;
  feedRamp?:       number;
  feedEntry?:      number;
  feedExit?:       number;
  feedRetract?:    number;
  feedPerTooth?:   number;
  depthOfCut?:     number;
  widthOfCut?:     number;
  coolant:         CoolantMode;
  feedMode:        FeedMode;
  clockwise:       boolean;
  notes?:          string;
}

const MAT_DEFAULTS: MatCardValues = { coolant: 'flood', feedMode: 'per-minute', clockwise: true };

// ── Field primitives ───────────────────────────────────────────────────────────

function TextF({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}

function NumF({ value, onChange, min, step = 'any', label }: {
  value: number | undefined; onChange: (v: number | undefined) => void;
  min?: number; step?: string | number; label?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      min={min}
      step={step}
      aria-label={label}
      title={label}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const n = parseFloat(e.target.value);
        onChange(isNaN(n) ? undefined : n);
      }}
      className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
    />
  );
}

function SelF<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      title={label}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function BoolToggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value ? 'true' : 'false'}
      title={label ?? (value ? 'On' : 'Off')}
      aria-label={label ?? (value ? 'On' : 'Off')}
      className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${value ? 'bg-blue-600' : 'bg-slate-600'}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ── FieldRow — main tab fields ─────────────────────────────────────────────────

function FieldRow({ field, label, checked, onToggle, children }: {
  field: string; label: string; checked: Set<string>; onToggle: (f: string) => void; children: React.ReactNode;
}) {
  const active = checked.has(field);
  return (
    <div className={`rounded border p-2 space-y-1.5 transition-colors ${active ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-700/60 bg-slate-800/30'}`}>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={active} onChange={() => onToggle(field)} className="w-3 h-3 rounded border-slate-500 bg-slate-700 text-blue-500 cursor-pointer" />
        <span className={`text-xs font-medium leading-none ${active ? 'text-slate-200' : 'text-slate-500'}`}>{label}</span>
      </label>
      {active && children}
    </div>
  );
}

// ── MatFieldRow — material card sub-fields ─────────────────────────────────────

function MatFieldRow({ label, active, onToggle, children }: {
  label: string; active: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`rounded border p-2 space-y-1.5 transition-colors ${active ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-700/60 bg-slate-800/30'}`}>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={active} onChange={onToggle} className="w-3 h-3 rounded border-slate-500 bg-slate-700 text-blue-500 cursor-pointer" />
        <span className={`text-xs font-medium leading-none ${active ? 'text-slate-200' : 'text-slate-500'}`}>{label}</span>
      </label>
      {active && children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function BulkEditPanel({
  tools, allGroups, allTags, allMaterials, onApply, onClose,
}: BulkEditPanelProps) {
  const [activeTab,  setActiveTab]  = useState<Tab>('library');
  const [checked,    setChecked]    = useState<Set<string>>(new Set());
  const [isDone,      setIsDone]      = useState(false);
  const [isApplying,  setIsApplying]  = useState(false);
  const [confirming,  setConfirming]  = useState(false);

  // ── Library ──────────────────────────────────────────────────────────────────
  const [description,  setDescription]  = useState('');
  const [type,         setType]         = useState<ToolType>('flat end mill');
  const [material,     setMaterial]     = useState<ToolMaterial>('carbide');
  const [manufacturer, setManufacturer] = useState('');
  const [productId,    setProductId]    = useState('');
  const [comment,      setComment]      = useState('');
  const [machineGroups,     setMachineGroups]     = useState<string[]>([]);
  const [machineGroupMode, setMachineGroupMode] = useState<'add' | 'replace'>('add');
  const [starred,      setStarred]      = useState(false);
  const [tagMode,      setTagMode]      = useState<'add' | 'replace'>('add');
  const [tags,         setTags]         = useState<string[]>([]);
  const [tagInput,     setTagInput]     = useState('');

  // ── Geometry ─────────────────────────────────────────────────────────────────
  const [diameter,       setDiameter]       = useState<number | undefined>(undefined);
  const [shaftDiameter,  setShaftDiameter]  = useState<number | undefined>(undefined);
  const [overallLength,  setOverallLength]  = useState<number | undefined>(undefined);
  const [bodyLength,     setBodyLength]     = useState<number | undefined>(undefined);
  const [fluteLength,    setFluteLength]    = useState<number | undefined>(undefined);
  const [shoulderLength, setShoulderLength] = useState<number | undefined>(undefined);
  const [numberOfFlutes, setNumberOfFlutes] = useState<number | undefined>(undefined);
  const [cornerRadius,   setCornerRadius]   = useState<number | undefined>(undefined);
  const [taperAngle,     setTaperAngle]     = useState<number | undefined>(undefined);
  const [tipDiameter,    setTipDiameter]    = useState<number | undefined>(undefined);
  const [coolantSupport, setCoolantSupport] = useState(false);

  // ── Cutting (base) ────────────────────────────────────────────────────────────
  const [spindleRpm,     setSpindleRpm]     = useState<number | undefined>(undefined);
  const [rampSpindleRpm, setRampSpindleRpm] = useState<number | undefined>(undefined);
  const [feedCutting,    setFeedCutting]    = useState<number | undefined>(undefined);
  const [feedPlunge,     setFeedPlunge]     = useState<number | undefined>(undefined);
  const [feedRamp,       setFeedRamp]       = useState<number | undefined>(undefined);
  const [feedEntry,      setFeedEntry]      = useState<number | undefined>(undefined);
  const [feedExit,       setFeedExit]       = useState<number | undefined>(undefined);
  const [feedRetract,    setFeedRetract]    = useState<number | undefined>(undefined);
  const [coolant,        setCoolant]        = useState<CoolantMode>('flood');
  const [feedMode,       setFeedMode]       = useState<FeedMode>('per-minute');
  const [clockwise,      setClockwise]      = useState(true);

  // ── NC ───────────────────────────────────────────────────────────────────────
  const [breakControl,     setBreakControl]     = useState(false);
  const [diameterOffset,   setDiameterOffset]   = useState(false);
  const [lengthOffset,     setLengthOffset]     = useState(false);
  const [liveTool,         setLiveTool]         = useState(false);
  const [manualToolChange, setManualToolChange] = useState(false);

  // ── Crib ─────────────────────────────────────────────────────────────────────
  const [quantity,     setQuantity]     = useState<number | undefined>(undefined);
  const [reorderPoint, setReorderPoint] = useState<number | undefined>(undefined);
  const [supplier,     setSupplier]     = useState('');
  const [unitCost,     setUnitCost]     = useState<number | undefined>(undefined);
  const [location,     setLocation]     = useState('');
  const [condition,    setCondition]    = useState<ToolCondition | ''>('');

  // ── Per-material state ────────────────────────────────────────────────────────
  const [addedMatIds,  setAddedMatIds]  = useState<Set<string>>(new Set());
  const [matCards,     setMatCards]     = useState<Record<string, Partial<MatCardValues>>>({});
  const [matChecked,   setMatChecked]   = useState<Record<string, Set<string>>>({});
  const [matRemovals,  setMatRemovals]  = useState<Set<string>>(new Set());
  const [expandedMats, setExpandedMats] = useState<Set<string>>(new Set());
  const [addMatId,     setAddMatId]     = useState('');

  // ── Shared materials (present in ALL selected tools) ──────────────────────────
  const sharedMatIds = useMemo<Set<string>>(() => {
    if (tools.length === 0) return new Set();
    const allSets = tools.map((t) => new Set((t.toolMaterials ?? []).map((e) => e.materialId)));
    const [first, ...rest] = allSets;
    return new Set([...first].filter((id) => rest.every((s) => s.has(id))));
  }, [tools]);

  // ── Shared value helpers ──────────────────────────────────────────────────────

  const sharedValues = useMemo(() => {
    function gs<T>(vals: (T | undefined)[]): T | undefined {
      if (!vals.length) return undefined;
      const f = vals[0];
      if (f === undefined) return undefined;
      return vals.every((v) => v === f) ? f : undefined;
    }
    return {
      description:     gs(tools.map((t) => t.description)),
      type:            gs(tools.map((t) => t.type)),
      material:        gs(tools.map((t) => t.material)),
      manufacturer:    gs(tools.map((t) => t.manufacturer)),
      productId:       gs(tools.map((t) => t.productId)),
      comment:         gs(tools.map((t) => t.comment)),
      machineGroups:   undefined, // arrays — not reduced to a shared scalar
      starred:         gs(tools.map((t) => t.starred)),
      diameter:        gs(tools.map((t) => t.geometry?.diameter)),
      shaftDiameter:   gs(tools.map((t) => t.geometry?.shaftDiameter)),
      overallLength:   gs(tools.map((t) => t.geometry?.overallLength)),
      bodyLength:      gs(tools.map((t) => t.geometry?.bodyLength)),
      fluteLength:     gs(tools.map((t) => t.geometry?.fluteLength)),
      shoulderLength:  gs(tools.map((t) => t.geometry?.shoulderLength)),
      numberOfFlutes:  gs(tools.map((t) => t.geometry?.numberOfFlutes)),
      cornerRadius:    gs(tools.map((t) => t.geometry?.cornerRadius)),
      taperAngle:      gs(tools.map((t) => t.geometry?.taperAngle)),
      tipDiameter:     gs(tools.map((t) => t.geometry?.tipDiameter)),
      coolantSupport:  gs(tools.map((t) => t.geometry?.coolantSupport)),
      spindleRpm:      gs(tools.map((t) => t.cutting?.spindleRpm)),
      rampSpindleRpm:  gs(tools.map((t) => t.cutting?.rampSpindleRpm)),
      feedCutting:     gs(tools.map((t) => t.cutting?.feedCutting)),
      feedPlunge:      gs(tools.map((t) => t.cutting?.feedPlunge)),
      feedRamp:        gs(tools.map((t) => t.cutting?.feedRamp)),
      feedEntry:       gs(tools.map((t) => t.cutting?.feedEntry)),
      feedExit:        gs(tools.map((t) => t.cutting?.feedExit)),
      feedRetract:     gs(tools.map((t) => t.cutting?.feedRetract)),
      coolant:         gs(tools.map((t) => t.cutting?.coolant)),
      feedMode:        gs(tools.map((t) => t.cutting?.feedMode)),
      clockwise:       gs(tools.map((t) => t.cutting?.clockwise)),
      breakControl:    gs(tools.map((t) => t.nc?.breakControl)),
      diameterOffset:  gs(tools.map((t) => t.nc?.diameterOffset)),
      lengthOffset:    gs(tools.map((t) => t.nc?.lengthOffset)),
      liveTool:        gs(tools.map((t) => t.nc?.liveTool)),
      manualToolChange:gs(tools.map((t) => t.nc?.manualToolChange)),
      quantity:        gs(tools.map((t) => t.quantity)),
      reorderPoint:    gs(tools.map((t) => t.reorderPoint)),
      supplier:        gs(tools.map((t) => t.supplier)),
      unitCost:        gs(tools.map((t) => t.unitCost)),
      location:        gs(tools.map((t) => t.location)),
    };
  }, [tools]);

  function prefillField(field: string, value: unknown) {
    const v = value;
    switch (field) {
      case 'description':     setDescription(v as string);         break;
      case 'type':            setType(v as ToolType);               break;
      case 'material':        setMaterial(v as ToolMaterial);       break;
      case 'manufacturer':    setManufacturer(v as string);         break;
      case 'productId':       setProductId(v as string);            break;
      case 'comment':         setComment(v as string);              break;
      case 'machineGroups':   setMachineGroups(v as string[]);      break;
      case 'starred':         setStarred(v as boolean);             break;
      case 'diameter':        setDiameter(v as number);             break;
      case 'shaftDiameter':   setShaftDiameter(v as number);        break;
      case 'overallLength':   setOverallLength(v as number);        break;
      case 'bodyLength':      setBodyLength(v as number);           break;
      case 'fluteLength':     setFluteLength(v as number);          break;
      case 'shoulderLength':  setShoulderLength(v as number);       break;
      case 'numberOfFlutes':  setNumberOfFlutes(v as number);       break;
      case 'cornerRadius':    setCornerRadius(v as number);         break;
      case 'taperAngle':      setTaperAngle(v as number);           break;
      case 'tipDiameter':     setTipDiameter(v as number);          break;
      case 'coolantSupport':  setCoolantSupport(v as boolean);      break;
      case 'spindleRpm':      setSpindleRpm(v as number);           break;
      case 'rampSpindleRpm':  setRampSpindleRpm(v as number);       break;
      case 'feedCutting':     setFeedCutting(v as number);          break;
      case 'feedPlunge':      setFeedPlunge(v as number);           break;
      case 'feedRamp':        setFeedRamp(v as number);             break;
      case 'feedEntry':       setFeedEntry(v as number);            break;
      case 'feedExit':        setFeedExit(v as number);             break;
      case 'feedRetract':     setFeedRetract(v as number);          break;
      case 'coolant':         setCoolant(v as CoolantMode);         break;
      case 'feedMode':        setFeedMode(v as FeedMode);           break;
      case 'clockwise':       setClockwise(v as boolean);           break;
      case 'breakControl':    setBreakControl(v as boolean);        break;
      case 'diameterOffset':  setDiameterOffset(v as boolean);      break;
      case 'lengthOffset':    setLengthOffset(v as boolean);        break;
      case 'liveTool':        setLiveTool(v as boolean);            break;
      case 'manualToolChange':setManualToolChange(v as boolean);    break;
      case 'quantity':        setQuantity(v as number);             break;
      case 'reorderPoint':    setReorderPoint(v as number);         break;
      case 'supplier':        setSupplier(v as string);             break;
      case 'unitCost':        setUnitCost(v as number);             break;
      case 'location':        setLocation(v as string);             break;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function toggleChecked(field: string) {
    if (!checked.has(field)) {
      const sv = sharedValues[field as keyof typeof sharedValues];
      if (sv !== undefined) prefillField(field, sv);
    }
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  }

  const tagSuggestions = allTags.filter(
    (t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t),
  ).slice(0, 6);

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  }

  // ── Material helpers ──────────────────────────────────────────────────────────

  function getMatCard(matId: string): MatCardValues {
    return { ...MAT_DEFAULTS, ...matCards[matId] };
  }

  function isMatFieldChecked(matId: string, field: string): boolean {
    return matChecked[matId]?.has(field) ?? false;
  }

  // Returns the shared value for a material's field across all tools (undefined if not unanimous)
  function getSharedMatFieldValue(matId: string, field: string): unknown {
    const vals = tools.map((t) => {
      const entry = (t.toolMaterials ?? []).find((e) => e.materialId === matId);
      if (!entry) return undefined;
      return (entry as unknown as Record<string, unknown>)[field];
    });
    if (!vals.length) return undefined;
    const f = vals[0];
    if (f === undefined) return undefined;
    return vals.every((v) => v === f) ? f : undefined;
  }

  function toggleMatField(matId: string, field: string) {
    if (!isMatFieldChecked(matId, field)) {
      const shared = getSharedMatFieldValue(matId, field);
      if (shared !== undefined) {
        setMatCards((prev) => ({ ...prev, [matId]: { ...(prev[matId] ?? {}), [field]: shared } }));
      } else if (field === 'coolant' && !matCards[matId]?.coolant) {
        setMatCards((prev) => ({ ...prev, [matId]: { ...(prev[matId] ?? {}), coolant: 'flood' } }));
      } else if (field === 'feedMode' && !matCards[matId]?.feedMode) {
        setMatCards((prev) => ({ ...prev, [matId]: { ...(prev[matId] ?? {}), feedMode: 'per-minute' } }));
      }
    }
    setMatChecked((prev) => {
      const s = new Set(prev[matId] ?? []);
      s.has(field) ? s.delete(field) : s.add(field);
      return { ...prev, [matId]: s };
    });
  }

  function patchMatCard(matId: string, values: Partial<MatCardValues>) {
    setMatCards((prev) => ({ ...prev, [matId]: { ...(prev[matId] ?? {}), ...values } }));
  }

  function addMatCard(matId: string) {
    if (addedMatIds.has(matId)) return;
    setAddedMatIds((prev) => new Set([...prev, matId]));
    setExpandedMats((prev) => new Set([...prev, matId]));
    setMatRemovals((prev) => { const n = new Set(prev); n.delete(matId); return n; });
    setAddMatId('');
  }

  function removeAddedMat(matId: string) {
    setAddedMatIds((prev) => { const n = new Set(prev); n.delete(matId); return n; });
    setExpandedMats((prev) => { const n = new Set(prev); n.delete(matId); return n; });
    setMatChecked((prev) => { const n = { ...prev }; delete n[matId]; return n; });
    setMatCards((prev) => { const n = { ...prev }; delete n[matId]; return n; });
  }

  function queueMatRemoval(matId: string) {
    if (addedMatIds.has(matId)) {
      removeAddedMat(matId);
    } else {
      setExpandedMats((prev) => { const n = new Set(prev); n.delete(matId); return n; });
      setMatChecked((prev) => { const n = { ...prev }; delete n[matId]; return n; });
      setMatCards((prev) => { const n = { ...prev }; delete n[matId]; return n; });
    }
    setMatRemovals((prev) => new Set([...prev, matId]));
  }

  function undoMatRemoval(matId: string) {
    setMatRemovals((prev) => { const n = new Set(prev); n.delete(matId); return n; });
  }

  function toggleMatExpand(matId: string) {
    setExpandedMats((prev) => {
      const n = new Set(prev);
      n.has(matId) ? n.delete(matId) : n.add(matId);
      return n;
    });
  }

  // Visible cards = shared (not removed) + manually added (not removed, not already shared)
  const visibleMatIds = [
    ...[...sharedMatIds].filter((id) => !matRemovals.has(id)),
    ...[...addedMatIds].filter((id) => !sharedMatIds.has(id) && !matRemovals.has(id)),
  ];
  const assignedMatIds = new Set([...visibleMatIds, ...matRemovals]);
  const unassignedMats = allMaterials.filter((m) => !assignedMatIds.has(m.id));

  // ── Apply ──────────────────────────────────────────────────────────────────────

  async function handleApply() {
    setIsApplying(true);
    try {
      const updates = tools.map((tool) => {
        const patch: Partial<LibraryTool> = {};

        // Library
        if (checked.has('description'))  patch.description  = description;
        if (checked.has('type'))         patch.type         = type;
        if (checked.has('material'))     patch.material     = material;
        if (checked.has('manufacturer')) patch.manufacturer = manufacturer;
        if (checked.has('productId'))    patch.productId    = productId;
        if (checked.has('comment'))      patch.comment      = comment;
        if (checked.has('machineGroups')) {
          patch.machineGroups = machineGroupMode === 'replace'
            ? machineGroups
            : [...new Set([...(tool.machineGroups ?? []), ...machineGroups])];
        }
        if (checked.has('starred'))      patch.starred      = starred;
        if (checked.has('tags')) {
          patch.tags = tagMode === 'replace'
            ? tags
            : [...new Set([...(tool.tags ?? []), ...tags])];
        }

        // Geometry
        const geom: Record<string, unknown> = {};
        if (checked.has('diameter'))       geom.diameter       = diameter;
        if (checked.has('shaftDiameter'))  geom.shaftDiameter  = shaftDiameter;
        if (checked.has('overallLength'))  geom.overallLength  = overallLength;
        if (checked.has('bodyLength'))     geom.bodyLength     = bodyLength;
        if (checked.has('fluteLength'))    geom.fluteLength    = fluteLength;
        if (checked.has('shoulderLength')) geom.shoulderLength = shoulderLength;
        if (checked.has('numberOfFlutes')) geom.numberOfFlutes = numberOfFlutes;
        if (checked.has('cornerRadius'))   geom.cornerRadius   = cornerRadius;
        if (checked.has('taperAngle'))     geom.taperAngle     = taperAngle;
        if (checked.has('tipDiameter'))    geom.tipDiameter    = tipDiameter;
        if (checked.has('coolantSupport')) geom.coolantSupport = coolantSupport;
        if (Object.keys(geom).length > 0) patch.geometry = { ...tool.geometry, ...geom };

        // Cutting base
        const cut: Record<string, unknown> = {};
        if (checked.has('spindleRpm'))     cut.spindleRpm     = spindleRpm;
        if (checked.has('rampSpindleRpm')) cut.rampSpindleRpm = rampSpindleRpm;
        if (checked.has('feedCutting'))    cut.feedCutting    = feedCutting;
        if (checked.has('feedPlunge'))     cut.feedPlunge     = feedPlunge;
        if (checked.has('feedRamp'))       cut.feedRamp       = feedRamp;
        if (checked.has('feedEntry'))      cut.feedEntry      = feedEntry;
        if (checked.has('feedExit'))       cut.feedExit       = feedExit;
        if (checked.has('feedRetract'))    cut.feedRetract    = feedRetract;
        if (checked.has('coolant'))        cut.coolant        = coolant;
        if (checked.has('feedMode'))       cut.feedMode       = feedMode;
        if (checked.has('clockwise'))      cut.clockwise      = clockwise;
        if (Object.keys(cut).length > 0) patch.cutting = { ...(tool.cutting ?? {}), ...cut };

        // NC
        const nc: Record<string, unknown> = {};
        if (checked.has('breakControl'))     nc.breakControl     = breakControl;
        if (checked.has('diameterOffset'))   nc.diameterOffset   = diameterOffset;
        if (checked.has('lengthOffset'))     nc.lengthOffset     = lengthOffset;
        if (checked.has('liveTool'))         nc.liveTool         = liveTool;
        if (checked.has('manualToolChange')) nc.manualToolChange = manualToolChange;
        if (Object.keys(nc).length > 0) patch.nc = { ...(tool.nc ?? {}), ...nc };

        // Crib
        if (checked.has('quantity'))     patch.quantity     = quantity;
        if (checked.has('reorderPoint')) patch.reorderPoint = reorderPoint;
        if (checked.has('supplier'))     patch.supplier     = supplier;
        if (checked.has('unitCost'))     patch.unitCost     = unitCost;
        if (checked.has('location'))     patch.location     = location;
        if (checked.has('condition'))    patch.condition    = condition as ToolCondition || undefined;

        // Per-material
        const hasMatWork = visibleMatIds.some((id) => (matChecked[id]?.size ?? 0) > 0) || matRemovals.size > 0;
        if (hasMatWork) {
          let entries = [...(tool.toolMaterials ?? [])];
          if (matRemovals.size > 0) {
            entries = entries.filter((e) => !matRemovals.has(e.materialId));
          }
          for (const matId of visibleMatIds) {
            const fc = matChecked[matId] ?? new Set<string>();
            if (fc.size === 0) continue;
            const vals = getMatCard(matId);
            const idx = entries.findIndex((e) => e.materialId === matId);
            const base: ToolMaterialEntry = idx >= 0 ? entries[idx] : { materialId: matId };
            const updated: ToolMaterialEntry = { ...base };
            if (fc.has('rpm')            && vals.rpm !== undefined)            updated.rpm            = vals.rpm;
            if (fc.has('rampSpindleRpm') && vals.rampSpindleRpm !== undefined) updated.rampSpindleRpm = vals.rampSpindleRpm;
            if (fc.has('surfaceSpeed')   && vals.surfaceSpeed !== undefined)   updated.surfaceSpeed   = vals.surfaceSpeed;
            if (fc.has('feedRate')       && vals.feedRate !== undefined)       updated.feedRate       = vals.feedRate;
            if (fc.has('feedPlunge')     && vals.feedPlunge !== undefined)     updated.feedPlunge     = vals.feedPlunge;
            if (fc.has('feedRamp')       && vals.feedRamp !== undefined)       updated.feedRamp       = vals.feedRamp;
            if (fc.has('feedEntry')      && vals.feedEntry !== undefined)      updated.feedEntry      = vals.feedEntry;
            if (fc.has('feedExit')       && vals.feedExit !== undefined)       updated.feedExit       = vals.feedExit;
            if (fc.has('feedRetract')    && vals.feedRetract !== undefined)    updated.feedRetract    = vals.feedRetract;
            if (fc.has('feedPerTooth')   && vals.feedPerTooth !== undefined)   updated.feedPerTooth   = vals.feedPerTooth;
            if (fc.has('depthOfCut')     && vals.depthOfCut !== undefined)     updated.depthOfCut     = vals.depthOfCut;
            if (fc.has('widthOfCut')     && vals.widthOfCut !== undefined)     updated.widthOfCut     = vals.widthOfCut;
            if (fc.has('coolant'))   updated.coolant   = vals.coolant;
            if (fc.has('feedMode'))  updated.feedMode  = vals.feedMode;
            if (fc.has('clockwise')) updated.clockwise = vals.clockwise;
            if (fc.has('notes'))     updated.notes     = vals.notes || undefined;
            entries = idx >= 0
              ? entries.map((e, i) => (i === idx ? updated : e))
              : [...entries, updated];
          }
          patch.toolMaterials = entries;
        }

        return { id: tool.id, patch };
      });

      await onApply(updates);
      setIsDone(true);
    } finally {
      setIsApplying(false);
    }
  }

  const hasChanges = checked.size > 0
    || visibleMatIds.some((id) => (matChecked[id]?.size ?? 0) > 0)
    || matRemovals.size > 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Bulk Edit</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {tools.length} tool{tools.length !== 1 ? 's' : ''} — check a field to include it
            </p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 shrink-0">
          {TABS.map(({ id, label }) => (
            <button
              key={id} type="button" onClick={() => setActiveTab(id)}
              className={['flex-1 px-2 py-2 text-xs font-medium transition-colors',
                activeTab === id ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">

          {/* ── Library ──────────────────────────────────────────────────────── */}
          {activeTab === 'library' && (<>
            <FieldRow field="description" label="Description" checked={checked} onToggle={toggleChecked}>
              <TextF value={description} onChange={setDescription} placeholder="e.g. 6mm Flat End Mill" />
            </FieldRow>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow field="type" label="Tool type" checked={checked} onToggle={toggleChecked}>
                <SelF value={type} options={TOOL_TYPES.map((t) => ({ value: t, label: t }))} onChange={setType} label="Tool type" />
              </FieldRow>
              <FieldRow field="material" label="Tool material" checked={checked} onToggle={toggleChecked}>
                <SelF value={material} options={TOOL_MATERIALS.map((m) => ({ value: m, label: m }))} onChange={setMaterial} label="Tool material" />
              </FieldRow>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow field="manufacturer" label="Manufacturer" checked={checked} onToggle={toggleChecked}>
                <TextF value={manufacturer} onChange={setManufacturer} placeholder="e.g. Sandvik" />
              </FieldRow>
              <FieldRow field="productId" label="Product ID" checked={checked} onToggle={toggleChecked}>
                <TextF value={productId} onChange={setProductId} placeholder="e.g. R216…" />
              </FieldRow>
            </div>
            <FieldRow field="comment" label="Comment" checked={checked} onToggle={toggleChecked}>
              <TextF value={comment} onChange={setComment} />
            </FieldRow>
            <FieldRow field="machineGroups" label="Machines" checked={checked} onToggle={toggleChecked}>
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  {(['add', 'replace'] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => setMachineGroupMode(mode)}
                      className={`px-2 py-1 rounded text-xs font-medium border ${machineGroupMode === mode ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                      {mode === 'add' ? 'Add to machines' : 'Replace machines'}
                    </button>
                  ))}
                </div>
                <MachineGroupInput values={machineGroups} allGroups={allGroups} onChange={setMachineGroups} />
              </div>
            </FieldRow>
            <FieldRow field="starred" label="Starred / Favourite" checked={checked} onToggle={toggleChecked}>
              <BoolToggle value={starred} onChange={setStarred} label="Starred / Favourite" />
            </FieldRow>
            <FieldRow field="tags" label="Tags" checked={checked} onToggle={toggleChecked}>
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  {(['add', 'replace'] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => setTagMode(mode)}
                      className={`px-2 py-1 rounded text-xs font-medium border ${tagMode === mode ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                      {mode === 'add' ? 'Add tags' : 'Replace tags'}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input type="text" value={tagInput} placeholder="Add tag…"
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); addTag(tagInput); } }}
                    className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {tagSuggestions.length > 0 && tagInput && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded shadow-xl overflow-hidden">
                      {tagSuggestions.map((t) => (
                        <button key={t} type="button" onMouseDown={() => addTag(t)}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">{t}</button>
                      ))}
                    </div>
                  )}
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">
                        {tag}
                        <button type="button" title={`Remove ${tag}`} onClick={() => setTags((p) => p.filter((t) => t !== tag))} className="hover:text-white"><X size={9} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </FieldRow>
          </>)}

          {/* ── Geometry ─────────────────────────────────────────────────────── */}
          {activeTab === 'geometry' && (<>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow field="diameter"       label="Diameter"        checked={checked} onToggle={toggleChecked}><NumF value={diameter}       onChange={setDiameter}       min={0} label="Diameter" /></FieldRow>
              <FieldRow field="shaftDiameter"  label="Shaft diameter"  checked={checked} onToggle={toggleChecked}><NumF value={shaftDiameter}  onChange={setShaftDiameter}  min={0} label="Shaft diameter" /></FieldRow>
              <FieldRow field="overallLength"  label="Overall length"  checked={checked} onToggle={toggleChecked}><NumF value={overallLength}  onChange={setOverallLength}  min={0} label="Overall length" /></FieldRow>
              <FieldRow field="bodyLength"     label="Body length"     checked={checked} onToggle={toggleChecked}><NumF value={bodyLength}     onChange={setBodyLength}     min={0} label="Body length" /></FieldRow>
              <FieldRow field="fluteLength"    label="Flute length"    checked={checked} onToggle={toggleChecked}><NumF value={fluteLength}    onChange={setFluteLength}    min={0} label="Flute length" /></FieldRow>
              <FieldRow field="shoulderLength" label="Shoulder length" checked={checked} onToggle={toggleChecked}><NumF value={shoulderLength} onChange={setShoulderLength} min={0} label="Shoulder length" /></FieldRow>
              <FieldRow field="numberOfFlutes" label="No. of flutes"   checked={checked} onToggle={toggleChecked}><NumF value={numberOfFlutes} onChange={setNumberOfFlutes} min={1} step={1} label="Number of flutes" /></FieldRow>
              <FieldRow field="cornerRadius"   label="Corner radius"   checked={checked} onToggle={toggleChecked}><NumF value={cornerRadius}   onChange={setCornerRadius}   min={0} label="Corner radius" /></FieldRow>
              <FieldRow field="taperAngle"     label="Taper angle (°)" checked={checked} onToggle={toggleChecked}><NumF value={taperAngle}     onChange={setTaperAngle}     min={0} label="Taper angle" /></FieldRow>
              <FieldRow field="tipDiameter"    label="Tip diameter"    checked={checked} onToggle={toggleChecked}><NumF value={tipDiameter}    onChange={setTipDiameter}    min={0} label="Tip diameter" /></FieldRow>
            </div>
            <FieldRow field="coolantSupport" label="Internal coolant channels" checked={checked} onToggle={toggleChecked}>
              <BoolToggle value={coolantSupport} onChange={setCoolantSupport} label="Internal coolant channels" />
            </FieldRow>
          </>)}

          {/* ── Cutting + Per-material ────────────────────────────────────────── */}
          {activeTab === 'cutting' && (<>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow field="spindleRpm"     label="Spindle RPM"      checked={checked} onToggle={toggleChecked}><NumF value={spindleRpm}     onChange={setSpindleRpm}     min={0} label="Spindle RPM" /></FieldRow>
              <FieldRow field="rampSpindleRpm" label="Ramp spindle RPM" checked={checked} onToggle={toggleChecked}><NumF value={rampSpindleRpm} onChange={setRampSpindleRpm} min={0} label="Ramp spindle RPM" /></FieldRow>
              <FieldRow field="feedCutting"    label="Cutting feed"     checked={checked} onToggle={toggleChecked}><NumF value={feedCutting}    onChange={setFeedCutting}    min={0} label="Cutting feed" /></FieldRow>
              <FieldRow field="feedPlunge"     label="Plunge feed"      checked={checked} onToggle={toggleChecked}><NumF value={feedPlunge}     onChange={setFeedPlunge}     min={0} label="Plunge feed" /></FieldRow>
              <FieldRow field="feedRamp"       label="Ramp feed"        checked={checked} onToggle={toggleChecked}><NumF value={feedRamp}       onChange={setFeedRamp}       min={0} label="Ramp feed" /></FieldRow>
              <FieldRow field="feedEntry"      label="Entry feed"       checked={checked} onToggle={toggleChecked}><NumF value={feedEntry}      onChange={setFeedEntry}      min={0} label="Entry feed" /></FieldRow>
              <FieldRow field="feedExit"       label="Exit feed"        checked={checked} onToggle={toggleChecked}><NumF value={feedExit}       onChange={setFeedExit}       min={0} label="Exit feed" /></FieldRow>
              <FieldRow field="feedRetract"    label="Retract feed"     checked={checked} onToggle={toggleChecked}><NumF value={feedRetract}    onChange={setFeedRetract}    min={0} label="Retract feed" /></FieldRow>
              <FieldRow field="coolant"        label="Coolant mode"     checked={checked} onToggle={toggleChecked}><SelF value={coolant} options={COOLANT_MODES.map((m) => ({ value: m, label: m }))} onChange={setCoolant} label="Coolant mode" /></FieldRow>
              <FieldRow field="feedMode"       label="Feed mode"        checked={checked} onToggle={toggleChecked}><SelF value={feedMode} options={FEED_MODES.map((m) => ({ value: m, label: m }))} onChange={setFeedMode} label="Feed mode" /></FieldRow>
            </div>
            <FieldRow field="clockwise" label="Spindle direction" checked={checked} onToggle={toggleChecked}>
              <div className="flex items-center gap-2">
                <BoolToggle value={clockwise} onChange={setClockwise} label="Spindle direction" />
                <span className="text-xs text-slate-400">{clockwise ? 'Clockwise (CW)' : 'Counter-clockwise (CCW)'}</span>
              </div>
            </FieldRow>

            {/* Per-material overrides */}
            <div className="pt-3 border-t border-slate-700/60 space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Per-material overrides</p>
                {sharedMatIds.size > 0 && (
                  <p className="text-xs text-slate-600">Shared by all tools auto-listed</p>
                )}
              </div>

              {allMaterials.length === 0 && (
                <p className="text-xs text-slate-500 italic">No materials in library.</p>
              )}

              {visibleMatIds.map((matId) => {
                const mat      = allMaterials.find((m) => m.id === matId);
                const matLabel = mat?.name ?? matId;
                const catKey   = mat?.category ?? 'other';
                const expanded = expandedMats.has(matId);
                const isShared = sharedMatIds.has(matId);
                const card     = getMatCard(matId);

                return (
                  <div key={matId} className="rounded-lg border border-slate-700 bg-slate-800/40 overflow-hidden">
                    {/* Card header */}
                    <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                      onClick={() => toggleMatExpand(matId)}>
                      <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                      <span className="flex-1 text-xs font-medium text-slate-200 truncate">{matLabel}</span>
                      {mat && (
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${MATERIAL_CATEGORY_COLOURS[catKey]}`}>
                          {MATERIAL_CATEGORY_LABELS[catKey]}
                        </span>
                      )}
                      <button type="button" title="Remove this material from all tools on Apply"
                        onClick={(e) => { e.stopPropagation(); queueMatRemoval(matId); }}
                        className="shrink-0 p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={11} />
                      </button>
                      {!isShared && (
                        <button type="button" title="Cancel — don't change this material"
                          onClick={(e) => { e.stopPropagation(); removeAddedMat(matId); }}
                          className="shrink-0 p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors">
                          <X size={11} />
                        </button>
                      )}
                    </div>

                    {/* Card body — checkbox fields matching the main tab style */}
                    {expanded && (
                      <div className="px-3 pb-3 border-t border-slate-700/60 pt-2 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <MatFieldRow label="Spindle (rpm)"     active={isMatFieldChecked(matId, 'rpm')}            onToggle={() => toggleMatField(matId, 'rpm')}>
                            <NumF value={card.rpm}            onChange={(v) => patchMatCard(matId, { rpm: v })}            min={0} label="Spindle RPM" />
                          </MatFieldRow>
                          <MatFieldRow label="Surface speed"     active={isMatFieldChecked(matId, 'surfaceSpeed')}   onToggle={() => toggleMatField(matId, 'surfaceSpeed')}>
                            <NumF value={card.surfaceSpeed}   onChange={(v) => patchMatCard(matId, { surfaceSpeed: v })}   min={0} label="Surface speed" />
                          </MatFieldRow>
                          <MatFieldRow label="Ramp spindle"      active={isMatFieldChecked(matId, 'rampSpindleRpm')} onToggle={() => toggleMatField(matId, 'rampSpindleRpm')}>
                            <NumF value={card.rampSpindleRpm} onChange={(v) => patchMatCard(matId, { rampSpindleRpm: v })} min={0} label="Ramp spindle RPM" />
                          </MatFieldRow>
                          <MatFieldRow label="Cutting feed"      active={isMatFieldChecked(matId, 'feedRate')}       onToggle={() => toggleMatField(matId, 'feedRate')}>
                            <NumF value={card.feedRate}       onChange={(v) => patchMatCard(matId, { feedRate: v })}       min={0} label="Cutting feed" />
                          </MatFieldRow>
                          <MatFieldRow label="Plunge feed"       active={isMatFieldChecked(matId, 'feedPlunge')}     onToggle={() => toggleMatField(matId, 'feedPlunge')}>
                            <NumF value={card.feedPlunge}     onChange={(v) => patchMatCard(matId, { feedPlunge: v })}     min={0} label="Plunge feed" />
                          </MatFieldRow>
                          <MatFieldRow label="Ramp feed"         active={isMatFieldChecked(matId, 'feedRamp')}       onToggle={() => toggleMatField(matId, 'feedRamp')}>
                            <NumF value={card.feedRamp}       onChange={(v) => patchMatCard(matId, { feedRamp: v })}       min={0} label="Ramp feed" />
                          </MatFieldRow>
                          <MatFieldRow label="Entry feed"        active={isMatFieldChecked(matId, 'feedEntry')}      onToggle={() => toggleMatField(matId, 'feedEntry')}>
                            <NumF value={card.feedEntry}      onChange={(v) => patchMatCard(matId, { feedEntry: v })}      min={0} label="Entry feed" />
                          </MatFieldRow>
                          <MatFieldRow label="Exit feed"         active={isMatFieldChecked(matId, 'feedExit')}       onToggle={() => toggleMatField(matId, 'feedExit')}>
                            <NumF value={card.feedExit}       onChange={(v) => patchMatCard(matId, { feedExit: v })}       min={0} label="Exit feed" />
                          </MatFieldRow>
                          <MatFieldRow label="Retract feed"      active={isMatFieldChecked(matId, 'feedRetract')}    onToggle={() => toggleMatField(matId, 'feedRetract')}>
                            <NumF value={card.feedRetract}    onChange={(v) => patchMatCard(matId, { feedRetract: v })}    min={0} label="Retract feed" />
                          </MatFieldRow>
                          <MatFieldRow label="Feed / tooth"      active={isMatFieldChecked(matId, 'feedPerTooth')}   onToggle={() => toggleMatField(matId, 'feedPerTooth')}>
                            <NumF value={card.feedPerTooth}   onChange={(v) => patchMatCard(matId, { feedPerTooth: v })}   min={0} label="Feed per tooth" />
                          </MatFieldRow>
                          <MatFieldRow label="Depth of cut (ap)" active={isMatFieldChecked(matId, 'depthOfCut')}    onToggle={() => toggleMatField(matId, 'depthOfCut')}>
                            <NumF value={card.depthOfCut}     onChange={(v) => patchMatCard(matId, { depthOfCut: v })}     min={0} label="Depth of cut" />
                          </MatFieldRow>
                          <MatFieldRow label="Stepover (ae)"     active={isMatFieldChecked(matId, 'widthOfCut')}    onToggle={() => toggleMatField(matId, 'widthOfCut')}>
                            <NumF value={card.widthOfCut}     onChange={(v) => patchMatCard(matId, { widthOfCut: v })}     min={0} label="Stepover" />
                          </MatFieldRow>
                          <MatFieldRow label="Coolant"           active={isMatFieldChecked(matId, 'coolant')}       onToggle={() => toggleMatField(matId, 'coolant')}>
                            <SelF value={card.coolant} options={COOLANT_MODES.map((m) => ({ value: m, label: m }))} onChange={(v) => patchMatCard(matId, { coolant: v })} label="Coolant" />
                          </MatFieldRow>
                          <MatFieldRow label="Feed mode"         active={isMatFieldChecked(matId, 'feedMode')}      onToggle={() => toggleMatField(matId, 'feedMode')}>
                            <SelF value={card.feedMode} options={FEED_MODES.map((m) => ({ value: m, label: m }))} onChange={(v) => patchMatCard(matId, { feedMode: v })} label="Feed mode" />
                          </MatFieldRow>
                        </div>
                        <MatFieldRow label="Spindle direction" active={isMatFieldChecked(matId, 'clockwise')} onToggle={() => toggleMatField(matId, 'clockwise')}>
                          <div className="flex items-center gap-2">
                            <BoolToggle value={card.clockwise} onChange={(v) => patchMatCard(matId, { clockwise: v })} label="Spindle direction" />
                            <span className="text-xs text-slate-400">{card.clockwise ? 'CW' : 'CCW'}</span>
                          </div>
                        </MatFieldRow>
                        <MatFieldRow label="Notes" active={isMatFieldChecked(matId, 'notes')} onToggle={() => toggleMatField(matId, 'notes')}>
                          <TextF value={card.notes ?? ''} onChange={(v) => patchMatCard(matId, { notes: v })} placeholder="Optional notes…" />
                        </MatFieldRow>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Queued removals */}
              {matRemovals.size > 0 && (
                <div className="rounded border border-red-500/30 bg-red-500/5 px-3 py-2 space-y-1.5">
                  <p className="text-xs font-medium text-red-400">Will remove from all tools on Apply:</p>
                  <div className="flex flex-wrap gap-1">
                    {[...matRemovals].map((mid) => {
                      const m = allMaterials.find((x) => x.id === mid);
                      return (
                        <span key={mid} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-300">
                          {m?.name ?? mid}
                          <button type="button" title="Undo removal" onClick={() => undoMatRemoval(mid)} className="hover:text-white"><X size={9} /></button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add material */}
              {unassignedMats.length > 0 && (
                <div className="flex gap-2">
                  <select title="Select material to add" value={addMatId}
                    onChange={(e) => setAddMatId(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
                    <option value="">— Add material override —</option>
                    {unassignedMats.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <button type="button" disabled={!addMatId} onClick={() => addMatCard(addMatId)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700 disabled:text-slate-500 transition-colors">
                    <Plus size={11} /> Add
                  </button>
                </div>
              )}
              {unassignedMats.length === 0 && allMaterials.length > 0 && (
                <p className="text-xs text-slate-500 italic">All library materials covered.</p>
              )}
            </div>
          </>)}

          {/* ── NC ───────────────────────────────────────────────────────────── */}
          {activeTab === 'nc' && (
            <div className="grid grid-cols-2 gap-2">
              <FieldRow field="breakControl"     label="Break control"      checked={checked} onToggle={toggleChecked}><BoolToggle value={breakControl}     onChange={setBreakControl}     label="Break control" /></FieldRow>
              <FieldRow field="diameterOffset"   label="Diameter offset"    checked={checked} onToggle={toggleChecked}><BoolToggle value={diameterOffset}   onChange={setDiameterOffset}   label="Diameter offset" /></FieldRow>
              <FieldRow field="lengthOffset"     label="Length offset"      checked={checked} onToggle={toggleChecked}><BoolToggle value={lengthOffset}     onChange={setLengthOffset}     label="Length offset" /></FieldRow>
              <FieldRow field="liveTool"         label="Live tool"          checked={checked} onToggle={toggleChecked}><BoolToggle value={liveTool}         onChange={setLiveTool}         label="Live tool" /></FieldRow>
              <FieldRow field="manualToolChange" label="Manual tool change" checked={checked} onToggle={toggleChecked}><BoolToggle value={manualToolChange} onChange={setManualToolChange} label="Manual tool change" /></FieldRow>
            </div>
          )}

          {/* ── Crib ─────────────────────────────────────────────────────────── */}
          {activeTab === 'crib' && (<>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow field="quantity"     label="Quantity on hand" checked={checked} onToggle={toggleChecked}><NumF value={quantity}     onChange={setQuantity}     min={0} step={1}    label="Quantity on hand" /></FieldRow>
              <FieldRow field="reorderPoint" label="Reorder point"    checked={checked} onToggle={toggleChecked}><NumF value={reorderPoint} onChange={setReorderPoint} min={0} step={1}    label="Reorder point" /></FieldRow>
              <FieldRow field="unitCost"     label="Unit cost"        checked={checked} onToggle={toggleChecked}><NumF value={unitCost}     onChange={setUnitCost}     min={0} step={0.01} label="Unit cost" /></FieldRow>
            </div>
            <FieldRow field="supplier" label="Supplier"      checked={checked} onToggle={toggleChecked}><TextF value={supplier} onChange={setSupplier} placeholder="e.g. MSC Industrial" /></FieldRow>
            <FieldRow field="location" label="Crib location" checked={checked} onToggle={toggleChecked}><TextF value={location} onChange={setLocation} placeholder="e.g. Drawer A3" /></FieldRow>
            <FieldRow field="condition" label="Condition" checked={checked} onToggle={toggleChecked}>
              <SelF
                value={condition as ToolCondition | ''}
                label="Condition"
                options={[
                  { value: '' as ToolCondition | '', label: '— not set —' },
                  ...(Object.entries(TOOL_CONDITION_LABELS) as [ToolCondition, string][]).map(([v, label]) => ({ value: v as ToolCondition | '', label })),
                ]}
                onChange={(v) => setCondition(v as ToolCondition | '')}
              />
            </FieldRow>
          </>)}

          {isDone && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-xs">
              <CheckCircle size={13} />
              Applied to {tools.length} tool{tools.length !== 1 ? 's' : ''}.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          {confirming ? (
            <>
              <span className="text-xs text-slate-400 mr-auto">Apply changes to {tools.length} tool{tools.length !== 1 ? 's' : ''}?</span>
              <button type="button" onClick={() => setConfirming(false)}
                className="px-3 py-1.5 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
                Cancel
              </button>
              <button type="button" onClick={() => { setConfirming(false); void handleApply(); }}
                disabled={isApplying}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                Confirm
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose}
                className="px-3 py-1.5 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
                {isDone ? 'Close' : 'Cancel'}
              </button>
              {!isDone && (
                <button type="button" onClick={() => setConfirming(true)}
                  disabled={isApplying || !hasChanges}
                  className={['px-3 py-1.5 rounded text-xs font-semibold transition-colors',
                    hasChanges && !isApplying ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed',
                  ].join(' ')}
                >
                  {isApplying ? 'Applying…' : `Apply to ${tools.length} tool${tools.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(BulkEditPanel);
