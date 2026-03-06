import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { X, Trash2, Save, AlertCircle } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import type { ToolType, ToolUnit, CoolantMode, FeedMode, ToolMaterial } from '../../types/tool';
import { useSettings, type Settings } from '../../contexts/SettingsContext';
import { ToolProfileSVG } from './ToolProfileSVG';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ToolEditorProps {
  tool:             LibraryTool | null;   // null = create new
  allTags:          string[];
  allMachineGroups: string[];
  onSave:           (tool: LibraryTool) => Promise<void>;
  onDelete:         (id: string) => Promise<void>;
  onClose:          () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOOL_TYPES: ToolType[] = [
  'flat end mill', 'ball end mill', 'bull nose end mill', 'chamfer mill',
  'face mill', 'spot drill', 'drill', 'tapered mill', 'boring bar',
  'thread mill', 'engraving', 'custom',
];

const COOLANT_MODES: CoolantMode[] = ['disabled', 'flood', 'mist', 'air', 'suction'];
const FEED_MODES:   FeedMode[]     = ['per-minute', 'per-revolution'];
const MATERIALS:    ToolMaterial[] = ['carbide', 'hss', 'ceramics', 'diamond', 'other'];

// Which tool types show each conditional geometry field
const SHOWS_CORNER_RADIUS = new Set<ToolType>(['bull nose end mill', 'custom']);
const SHOWS_TAPER_ANGLE   = new Set<ToolType>(['drill', 'spot drill', 'chamfer mill', 'tapered mill', 'engraving', 'custom']);
const SHOWS_TIP_DIAMETER  = new Set<ToolType>(['drill', 'spot drill', 'chamfer mill', 'tapered mill', 'engraving', 'thread mill', 'custom']);
const SHOWS_THREAD_FIELDS = new Set<ToolType>(['thread mill']);
const SHOWS_NUM_TEETH     = new Set<ToolType>(['thread mill', 'face mill']);

// ── Blank tool factory ────────────────────────────────────────────────────────

function makeBlankTool(unit: ToolUnit, settings: Settings): LibraryTool {
  return {
    id:           crypto.randomUUID(),
    toolNumber:   settings.libraryDefaultToolNumber,
    type:         settings.libraryDefaultType as ToolType,
    description:  '',
    unit,
    geometry:     { diameter: unit === 'mm' ? 6 : 0.25 },
    machineGroup: settings.libraryDefaultMachineGroup || undefined,
    tags:         [],
    starred:      false,
    addedAt:      Date.now(),
    updatedAt:    Date.now(),
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

type Errors = Partial<Record<string, string>>;

function validate(draft: LibraryTool): Errors {
  const e: Errors = {};
  if (!draft.description.trim())
    e.description = 'Description is required.';
  if (!Number.isInteger(draft.toolNumber) || draft.toolNumber < 0)
    e.toolNumber = 'Must be a non-negative integer.';
  if (draft.pocketNumber !== undefined && (!Number.isInteger(draft.pocketNumber) || draft.pocketNumber < 0))
    e.pocketNumber = 'Must be a non-negative integer.';
  if (!draft.geometry.diameter || draft.geometry.diameter <= 0)
    e.diameter = 'Must be greater than 0.';
  return e;
}

// ── Field primitives ──────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-400 mb-1">{children}</label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
      <AlertCircle size={10} className="shrink-0" />
      {msg}
    </p>
  );
}

function TextF({
  value, onChange, placeholder, error,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; error?: string;
}) {
  return (
    <>
      <input
        type="text"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className={[
          'w-full px-2.5 py-1.5 text-sm bg-slate-700 border rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2',
          error ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500',
        ].join(' ')}
      />
      <FieldError msg={error} />
    </>
  );
}

function NumF({
  value, onChange, min, step = 'any', error,
}: {
  value: number | undefined; onChange: (v: number | undefined) => void;
  min?: number; step?: string | number; error?: string;
}) {
  return (
    <>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        step={step}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const n = parseFloat(e.target.value);
          onChange(isNaN(n) ? undefined : n);
        }}
        className={[
          'w-full px-2.5 py-1.5 text-sm bg-slate-700 border rounded-lg text-slate-200 focus:outline-none focus:ring-2 text-right',
          error ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500',
        ].join(' ')}
      />
      <FieldError msg={error} />
    </>
  );
}

function SelF<T extends string>({
  value, options, onChange,
}: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${value ? 'bg-blue-600' : 'bg-slate-600'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Row2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ── Machine group combobox ────────────────────────────────────────────────────

function MachineGroupInput({
  value, allGroups, onChange,
}: {
  value: string | undefined;
  allGroups: string[];
  onChange: (v: string | undefined) => void;
}) {
  const [inputVal, setInputVal] = useState(value ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => { setInputVal(value ?? ''); }, [value]);

  const filtered = allGroups.filter(
    (g) => g.toLowerCase().includes(inputVal.toLowerCase()),
  );

  function commit(val: string) {
    const trimmed = val.trim();
    onChange(trimmed || undefined);
    setInputVal(trimmed);
    setOpen(false);
  }

  const showCreate = inputVal.trim() !== '' &&
    !allGroups.some((g) => g.toLowerCase() === inputVal.trim().toLowerCase());

  return (
    <div className="relative">
      <input
        type="text"
        value={inputVal}
        placeholder="e.g. VF-2"
        onChange={(e) => {
          setInputVal(e.target.value);
          onChange(e.target.value.trim() || undefined);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && (showCreate || filtered.length > 0) && (
        <div className="absolute z-10 top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {showCreate && (
            <button
              onMouseDown={() => commit(inputVal)}
              className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-slate-700 border-b border-slate-700/60"
            >
              Create "{inputVal.trim()}"
            </button>
          )}
          {filtered.map((g) => (
            <button
              key={g}
              onMouseDown={() => commit(g)}
              className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagInput({
  tags, allTags, onChange,
}: {
  tags: string[]; allTags: string[]; onChange: (t: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const suggestions = allTags.filter(
    (t) => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t),
  ).slice(0, 6);

  const add = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput('');
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 bg-slate-700 border border-slate-600 rounded-lg">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">
            {tag}
            <button onClick={() => remove(tag)} className="hover:text-white"><X size={10} /></button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          placeholder={tags.length === 0 ? 'Add tag…' : ''}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); add(input); }
            if (e.key === 'Backspace' && !input && tags.length > 0) remove(tags[tags.length - 1]);
          }}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
        />
      </div>
      {input && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => add(s)}
              className="px-2 py-0.5 text-xs rounded bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'library' | 'geometry' | 'offsets' | 'cutting' | 'nc';
const TABS: { id: Tab; label: string }[] = [
  { id: 'library',  label: 'Library'  },
  { id: 'geometry', label: 'Geometry' },
  { id: 'offsets',  label: 'Offsets'  },
  { id: 'cutting',  label: 'Cutting'  },
  { id: 'nc',       label: 'NC'       },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function ToolEditor({
  tool, allTags, allMachineGroups, onSave, onDelete, onClose,
}: ToolEditorProps) {
  const { settings } = useSettings();
  const isNew = tool === null;
  const unit  = settings.defaultUnits === 'imperial' ? 'inch' : 'mm';

  const initialSnapshotRef = useRef<string>('');

  const [draft,       setDraft]       = useState<LibraryTool>(() => {
    const init = tool ? { ...tool } : makeBlankTool(unit, settings);
    initialSnapshotRef.current = JSON.stringify(init);
    return init;
  });
  const [activeTab,   setActiveTab]   = useState<Tab>('library');
  const [isSaving,    setIsSaving]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const errors    = validate(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const isDirty   = JSON.stringify(draft) !== initialSnapshotRef.current;

  // Reset when the tool prop changes (switching between edits)
  useEffect(() => {
    const init = tool ? { ...tool } : makeBlankTool(unit, settings);
    initialSnapshotRef.current = JSON.stringify(init);
    setDraft(init);
    setActiveTab('library');
    setShowConfirm(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!hasErrors && !isSaving) void handleSave();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasErrors, isSaving, draft]);

  function patchDraft(patch: Partial<LibraryTool>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }
  function patchGeo(patch: Partial<LibraryTool['geometry']>) {
    setDraft((prev) => ({ ...prev, geometry: { ...prev.geometry, ...patch } }));
  }
  function patchOffsets(patch: Partial<NonNullable<LibraryTool['offsets']>>) {
    setDraft((prev) => ({ ...prev, offsets: { ...(prev.offsets ?? {}), ...patch } }));
  }
  function patchCut(patch: Partial<NonNullable<LibraryTool['cutting']>>) {
    setDraft((prev) => ({ ...prev, cutting: { ...(prev.cutting ?? {}), ...patch } }));
  }
  function patchNc(patch: Partial<NonNullable<LibraryTool['nc']>>) {
    setDraft((prev) => ({ ...prev, nc: { ...(prev.nc ?? {}), ...patch } }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave({ ...draft, updatedAt: Date.now() });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!tool) return;
    await onDelete(tool.id);
    onClose();
  }

  const geo  = draft.geometry;
  const cut  = draft.cutting ?? {};
  const nc   = draft.nc ?? {};
  const type = draft.type;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-100">
              {isNew ? 'New Tool' : 'Edit Tool'}
            </h2>
            {isDirty && (
              <span
                className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                title="Unsaved changes"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1 text-xs text-slate-600">
              <kbd className="px-1 py-0.5 rounded bg-slate-700 border border-slate-600 font-mono text-slate-400">Ctrl S</kbd>
              <span>save</span>
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 shrink-0">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex-1 px-3 py-2.5 text-xs font-medium transition-colors',
                activeTab === id
                  ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                  : 'text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* SVG profile */}
        <div className="shrink-0 border-b border-slate-700">
          <ToolProfileSVG draft={draft} />
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── Library tab ──────────────────────────────────────────────── */}
          {activeTab === 'library' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Row2 label="Tool number (T#)">
                  <NumF
                    value={draft.toolNumber}
                    min={0}
                    step={1}
                    error={errors.toolNumber}
                    onChange={(v) => patchDraft({ toolNumber: v ?? 0 })}
                  />
                </Row2>
                <Row2 label="Pocket number (P#)">
                  <NumF
                    value={draft.pocketNumber}
                    min={0}
                    step={1}
                    error={errors.pocketNumber}
                    onChange={(v) => patchDraft({ pocketNumber: v })}
                  />
                </Row2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Row2 label="Unit">
                  <SelF
                    value={draft.unit}
                    options={[{ value: 'mm', label: 'mm' }, { value: 'inch', label: 'inch' }]}
                    onChange={(v) => patchDraft({ unit: v })}
                  />
                </Row2>
                <Row2 label="Material">
                  <select
                    value={draft.material ?? ''}
                    onChange={(e) =>
                      patchDraft({ material: (e.target.value as ToolMaterial) || undefined })
                    }
                    className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">— None —</option>
                    {MATERIALS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </Row2>
              </div>

              <Row2 label="Tool type">
                <SelF
                  value={draft.type}
                  options={TOOL_TYPES.map((t) => ({ value: t, label: t }))}
                  onChange={(v) => patchDraft({ type: v })}
                />
              </Row2>

              <Row2 label="Description *">
                <TextF
                  value={draft.description}
                  onChange={(v) => patchDraft({ description: v })}
                  placeholder="e.g. 6mm 2-flute flat end mill"
                  error={errors.description}
                />
              </Row2>

              <Row2 label="Manufacturer">
                <TextF
                  value={draft.manufacturer ?? ''}
                  onChange={(v) => patchDraft({ manufacturer: v || undefined })}
                  placeholder="e.g. Kyocera"
                />
              </Row2>

              <Row2 label="Product ID / Part #">
                <TextF
                  value={draft.productId ?? ''}
                  onChange={(v) => patchDraft({ productId: v || undefined })}
                />
              </Row2>

              <Row2 label="Comment">
                <TextF
                  value={draft.comment ?? ''}
                  onChange={(v) => patchDraft({ comment: v || undefined })}
                />
              </Row2>

              <Row2 label="Machine group">
                <MachineGroupInput
                  value={draft.machineGroup}
                  allGroups={allMachineGroups}
                  onChange={(v) => patchDraft({ machineGroup: v })}
                />
              </Row2>

              <Row2 label="Tags">
                <TagInput tags={draft.tags} allTags={allTags} onChange={(t) => patchDraft({ tags: t })} />
              </Row2>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Starred / Favourite</span>
                <Toggle value={draft.starred} onChange={(v) => patchDraft({ starred: v })} />
              </div>
            </>
          )}

          {/* ── Geometry tab ─────────────────────────────────────────────── */}
          {activeTab === 'geometry' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Row2 label="Diameter *">
                  <NumF
                    value={geo.diameter}
                    min={0}
                    error={errors.diameter}
                    onChange={(v) => patchGeo({ diameter: v ?? 0 })}
                  />
                </Row2>
                <Row2 label="Shaft diameter">
                  <NumF value={geo.shaftDiameter} onChange={(v) => patchGeo({ shaftDiameter: v })} min={0} />
                </Row2>
                <Row2 label="Overall length">
                  <NumF value={geo.overallLength} onChange={(v) => patchGeo({ overallLength: v })} min={0} />
                </Row2>
                <Row2 label="Body length">
                  <NumF value={geo.bodyLength} onChange={(v) => patchGeo({ bodyLength: v })} min={0} />
                </Row2>
                <Row2 label="Flute length">
                  <NumF value={geo.fluteLength} onChange={(v) => patchGeo({ fluteLength: v })} min={0} />
                </Row2>
                <Row2 label="Shoulder length">
                  <NumF value={geo.shoulderLength} onChange={(v) => patchGeo({ shoulderLength: v })} min={0} />
                </Row2>
                <Row2 label="Number of flutes">
                  <NumF value={geo.numberOfFlutes} onChange={(v) => patchGeo({ numberOfFlutes: v })} min={0} step={1} />
                </Row2>

                {/* Conditional fields */}
                {SHOWS_CORNER_RADIUS.has(type) && (
                  <Row2 label="Corner radius">
                    <NumF value={geo.cornerRadius} onChange={(v) => patchGeo({ cornerRadius: v })} min={0} />
                  </Row2>
                )}
                {SHOWS_TAPER_ANGLE.has(type) && (
                  <Row2 label="Taper angle (°)">
                    <NumF value={geo.taperAngle} onChange={(v) => patchGeo({ taperAngle: v })} min={0} />
                  </Row2>
                )}
                {SHOWS_TIP_DIAMETER.has(type) && (
                  <Row2 label="Tip diameter">
                    <NumF value={geo.tipDiameter} onChange={(v) => patchGeo({ tipDiameter: v })} min={0} />
                  </Row2>
                )}
                {SHOWS_NUM_TEETH.has(type) && (
                  <Row2 label="Number of teeth">
                    <NumF value={geo.numberOfTeeth} onChange={(v) => patchGeo({ numberOfTeeth: v })} min={0} step={1} />
                  </Row2>
                )}
              </div>

              {/* Thread mill geometry section */}
              {SHOWS_THREAD_FIELDS.has(type) && (
                <div className="pt-2 border-t border-slate-700/60">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    Thread geometry
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Row2 label="Thread pitch">
                      <NumF value={geo.threadPitch} onChange={(v) => patchGeo({ threadPitch: v })} min={0} />
                    </Row2>
                    <Row2 label="Profile angle (°)">
                      <NumF value={geo.threadProfileAngle} onChange={(v) => patchGeo({ threadProfileAngle: v })} min={0} />
                    </Row2>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-slate-300">Internal coolant channels</span>
                <Toggle value={geo.coolantSupport ?? false} onChange={(v) => patchGeo({ coolantSupport: v })} />
              </div>
            </>
          )}

          {/* ── Offsets tab ──────────────────────────────────────────────── */}
          {activeTab === 'offsets' && (
            <>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tool offset values along machine axes. Leave blank if not applicable.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(['x', 'y', 'z', 'a', 'b', 'c', 'u', 'v', 'w'] as const).map((axis) => (
                  <Row2 key={axis} label={`${axis.toUpperCase()} offset`}>
                    <NumF
                      value={(draft.offsets ?? {})[axis]}
                      onChange={(v) => patchOffsets({ [axis]: v })}
                    />
                  </Row2>
                ))}
              </div>
            </>
          )}

          {/* ── Cutting tab ───────────────────────────────────────────────── */}
          {activeTab === 'cutting' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Row2 label="Spindle RPM">
                  <NumF value={cut.spindleRpm} onChange={(v) => patchCut({ spindleRpm: v })} min={0} step={1} />
                </Row2>
                <Row2 label="Ramp spindle RPM">
                  <NumF value={cut.rampSpindleRpm} onChange={(v) => patchCut({ rampSpindleRpm: v })} min={0} step={1} />
                </Row2>
                <Row2 label="Cutting feed">
                  <NumF value={cut.feedCutting} onChange={(v) => patchCut({ feedCutting: v })} min={0} />
                </Row2>
                <Row2 label="Plunge feed">
                  <NumF value={cut.feedPlunge} onChange={(v) => patchCut({ feedPlunge: v })} min={0} />
                </Row2>
                <Row2 label="Ramp feed">
                  <NumF value={cut.feedRamp} onChange={(v) => patchCut({ feedRamp: v })} min={0} />
                </Row2>
                <Row2 label="Entry feed">
                  <NumF value={cut.feedEntry} onChange={(v) => patchCut({ feedEntry: v })} min={0} />
                </Row2>
                <Row2 label="Exit feed">
                  <NumF value={cut.feedExit} onChange={(v) => patchCut({ feedExit: v })} min={0} />
                </Row2>
                <Row2 label="Retract feed">
                  <NumF value={cut.feedRetract} onChange={(v) => patchCut({ feedRetract: v })} min={0} />
                </Row2>
              </div>

              <Row2 label="Coolant mode">
                <SelF
                  value={cut.coolant ?? 'disabled'}
                  options={COOLANT_MODES.map((m) => ({ value: m, label: m }))}
                  onChange={(v) => patchCut({ coolant: v })}
                />
              </Row2>
              <Row2 label="Feed mode">
                <SelF
                  value={cut.feedMode ?? 'per-minute'}
                  options={FEED_MODES.map((m) => ({ value: m, label: m }))}
                  onChange={(v) => patchCut({ feedMode: v })}
                />
              </Row2>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-slate-300">Clockwise rotation</span>
                <Toggle value={cut.clockwise ?? true} onChange={(v) => patchCut({ clockwise: v })} />
              </div>
            </>
          )}

          {/* ── NC tab ───────────────────────────────────────────────────── */}
          {activeTab === 'nc' && (
            <div className="space-y-3">
              {([
                ['Break control',      'breakControl'],
                ['Diameter offset',    'diameterOffset'],
                ['Length offset',      'lengthOffset'],
                ['Live tool',          'liveTool'],
                ['Manual tool change', 'manualToolChange'],
              ] as [string, keyof NonNullable<LibraryTool['nc']>][]).map(([label, key]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{label}</span>
                  <Toggle
                    value={Boolean(nc[key])}
                    onChange={(v) => patchNc({ [key]: v })}
                  />
                </div>
              ))}
              <Row2 label="Turret">
                <NumF value={nc.turret} onChange={(v) => patchNc({ turret: v })} min={0} step={1} />
              </Row2>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center gap-3">
          {!isNew && !showConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          {showConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Delete this tool?</span>
              <button onClick={handleDelete} className="px-2.5 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white">Yes, delete</button>
              <button onClick={() => setShowConfirm(false)} className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300">Cancel</button>
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={isSaving || hasErrors}
            title={hasErrors ? Object.values(errors).filter(Boolean).join(' · ') : undefined}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              isSaving || hasErrors
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white',
            ].join(' ')}
          >
            <Save size={14} />
            {isSaving ? 'Saving…' : isNew ? 'Add to Library' : 'Save'}
          </button>
        </div>

      </div>
    </>
  );
}
