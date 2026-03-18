import { useState, useEffect, useRef, createContext, useContext, type ChangeEvent } from 'react';
import { X, Trash2, Save, AlertCircle, ZoomIn, ZoomOut, Wand2, Undo2, Redo2, AlertTriangle, Copy, Plus, ChevronDown, BookTemplate, ImagePlus } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import type { ToolTemplate } from '../../types/template';
import type { LibraryTool, ToolMaterialEntry } from '../../types/libraryTool';
import type { ToolType, ToolUnit, CoolantMode, FeedMode, ToolMaterial } from '../../types/tool';
import type { ToolHolder } from '../../types/holder';
import type { WorkMaterial } from '../../types/material';
import { MATERIAL_CATEGORY_COLOURS, MATERIAL_CATEGORY_LABELS } from '../../types/material';
import { useSettings, type Settings } from '../../contexts/SettingsContext';
import { ToolProfileSVG } from './ToolProfileSVG';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { validateTool, getErrors } from '../../lib/toolValidation';
import { getAllToolTypeOptions, getFieldVisibility } from '../../lib/customToolTypes';
import MachineGroupInput from './MachineGroupInput';

const RowLabelCtx = createContext('');

// ── Props ─────────────────────────────────────────────────────────────────────

interface ToolEditorProps {
  tool:             LibraryTool | null;   // null = create new
  allTags:          string[];
  allMachineGroups: string[];
  allHolders?:      ToolHolder[];
  allMaterials?:    WorkMaterial[];
  onSave:           (tool: LibraryTool) => Promise<void>;
  onDelete:         (id: string) => Promise<void>;
  onDuplicate?:     (tool: LibraryTool) => void;
  onClose:          () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COOLANT_MODES: CoolantMode[] = ['disabled', 'flood', 'mist', 'air', 'suction'];
const FEED_MODES:   FeedMode[]     = ['per-minute', 'per-revolution'];
const MATERIALS:    ToolMaterial[] = ['carbide', 'hss', 'ceramics', 'diamond', 'other'];

// ── Description suggestion ────────────────────────────────────────────────────

function suggestDescription(draft: Pick<LibraryTool, 'type' | 'unit' | 'geometry'>): string {
  const { type, unit, geometry: geo } = draft;
  const d  = geo.diameter || 0;
  const nf = geo.numberOfFlutes;

  // Compact number: strip trailing zeros after rounding
  const n = (v: number, dp = 4) => parseFloat(v.toFixed(dp)).toString();

  const parts: string[] = [`${n(d)}${unit}`];

  switch (type) {
    case 'flat end mill':
    case 'ball end mill':
    case 'boring bar':
      if (nf) parts.push(`${nf}-flute`);
      parts.push(type);
      break;

    case 'bull nose end mill':
      if (nf) parts.push(`${nf}-flute`);
      if (geo.cornerRadius) parts.push(`R${n(geo.cornerRadius)}${unit}`);
      parts.push('bull nose end mill');
      break;

    case 'chamfer mill':
      if (nf) parts.push(`${nf}-flute`);
      if (geo.taperAngle !== undefined) parts.push(`${n(geo.taperAngle, 1)}°`);
      parts.push('chamfer mill');
      break;

    case 'drill':
      if (geo.taperAngle !== undefined) parts.push(`${n(geo.taperAngle, 1)}°`);
      parts.push('drill');
      break;

    case 'spot drill':
      if (geo.taperAngle !== undefined) parts.push(`${n(geo.taperAngle, 1)}°`);
      parts.push('spot drill');
      break;

    case 'thread mill':
      if (geo.threadPitch) parts.push(`× ${n(geo.threadPitch)}${unit}`);
      parts.push('thread mill');
      break;

    case 'face mill':
      if (geo.numberOfTeeth) parts.push(`${geo.numberOfTeeth}-insert`);
      parts.push('face mill');
      break;

    case 'engraving':
      if (geo.taperAngle !== undefined) parts.push(`${n(geo.taperAngle, 1)}°`);
      parts.push('engraving');
      break;

    case 'tapered mill':
      if (nf) parts.push(`${nf}-flute`);
      if (geo.taperAngle !== undefined) parts.push(`${n(geo.taperAngle, 1)}°`);
      parts.push('tapered mill');
      break;

    case 'custom':
      if (nf) parts.push(`${nf}-flute`);
      parts.push('custom tool');
      break;

    default:
      parts.push(type);
  }

  return parts.join(' ');
}

// ── Blank tool factory ────────────────────────────────────────────────────────

function makeBlankTool(unit: ToolUnit, settings: Settings): LibraryTool {
  return {
    id:           crypto.randomUUID(),
    toolNumber:   settings.libraryDefaultToolNumber,
    type:         settings.libraryDefaultType as ToolType,
    description:  '',
    unit,
    geometry:     { diameter: unit === 'mm' ? 6 : 0.25 },
    machineGroups: settings.libraryDefaultMachineGroup ? [settings.libraryDefaultMachineGroup] : [],
    tags:         [],
    starred:      false,
    addedAt:      Date.now(),
    updatedAt:    Date.now(),
  };
}

// ── Tool photo ────────────────────────────────────────────────────────────────

/** Resize an image file to ≤maxPx on its longest side, returning a JPEG data URL. */
function resizeImage(file: File, maxPx = 800, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not available')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

/**
 * Photo pane shown in the split preview row.
 *
 * - `value` set   → shows the image (object-contain handles landscape & portrait)
 *                   with "Change" / "Remove" buttons on hover.
 * - `value` unset + `overlayOnly` → renders only a small corner "add photo" button
 *                   overlaid on whatever is behind it (used when SVG is full-width).
 * - `value` unset + no `overlayOnly` → full drop-zone (not currently used but kept).
 */
function PhotoPane({
  value, onChange, overlayOnly = false,
}: {
  value:        string | undefined;
  onChange:     (dataUrl: string | undefined) => void;
  overlayOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string>();

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Must be an image file');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      onChange(await resizeImage(file));
    } catch {
      setError('Could not process image');
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      title="Upload tool photo"
      className="hidden"
      onChange={handleInputChange}
    />
  );

  /* ── Small overlay button (no-photo + overlayOnly) ── */
  if (!value && overlayOnly) {
    return (
      <>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          title="Add photo"
          className="absolute bottom-2 left-2 z-10 p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700/60 transition-colors"
        >
          {loading
            ? <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            : <ImagePlus size={13} />}
        </button>
        {fileInput}
      </>
    );
  }

  /* ── Full photo pane (photo present) ── */
  if (value) {
    return (
      <div className="relative flex items-center justify-center h-full bg-slate-900/60 group">
        {/* object-contain handles both landscape (fills width) and portrait (stays narrow) */}
        <img
          src={value}
          alt="Tool photo"
          className="w-full h-full object-contain"
        />
        {/* Hover overlay: change + remove */}
        <div className="absolute inset-0 flex items-end justify-center gap-1.5 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            title="Change photo"
            className="px-2 py-1 rounded text-xs bg-black/70 text-slate-200 hover:bg-blue-600/90 transition-colors"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            title="Remove photo"
            className="px-2 py-1 rounded text-xs bg-black/70 text-slate-200 hover:bg-red-600/90 transition-colors"
          >
            Remove
          </button>
        </div>
        {error && (
          <p className="absolute bottom-1 left-0 right-0 text-center text-xs text-red-400 bg-black/60 py-0.5">
            {error}
          </p>
        )}
        {fileInput}
      </div>
    );
  }

  /* ── Full drop-zone (no photo, no overlayOnly) ── */
  return (
    <div className="relative flex items-center justify-center h-full bg-slate-900/60">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-1.5 w-full h-full cursor-pointer text-slate-600 hover:text-slate-400 transition-colors"
      >
        {loading
          ? <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          : <><ImagePlus size={20} /><span className="text-xs">Add photo</span></>}
      </div>
      {error && (
        <p className="absolute bottom-1 left-0 right-0 text-center text-xs text-red-400 bg-black/60 py-0.5">
          {error}
        </p>
      )}
      {fileInput}
    </div>
  );
}

// ── UUID display row ──────────────────────────────────────────────────────────

function UuidRow({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">Library UUID</label>
      <div className="flex items-center gap-1">
        <input
          readOnly
          value={id}
          title="Library UUID"
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-400 select-all cursor-text"
        />
        <button
          type="button"
          onClick={handleCopy}
          title="Copy UUID"
          className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors"
        >
          <Copy size={11} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-600">Read-only · used as QR code identifier</p>
    </div>
  );
}

// ── Validation delegated to src/lib/toolValidation.ts ────────────────────────
type Errors = Partial<Record<string, string>>;

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
  const rowLabel = useContext(RowLabelCtx);
  return (
    <>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        step={step}
        aria-label={rowLabel || undefined}
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
  const rowLabel = useContext(RowLabelCtx);
  return (
    <select
      value={value}
      aria-label={rowLabel || undefined}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const rowLabel = useContext(RowLabelCtx);
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      title={rowLabel || undefined}
      aria-checked={value ? 'true' : 'false'}
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
      <RowLabelCtx.Provider value={label}>{children}</RowLabelCtx.Provider>
    </div>
  );
}

function FsNum({
  value, base, onChange,
}: { value: number | undefined; base?: number; onChange: (v: number | undefined) => void }) {
  const rowLabel = useContext(RowLabelCtx);
  return (
    <input
      type="number"
      min={0}
      value={value ?? ''}
      aria-label={rowLabel || undefined}
      placeholder={base !== undefined ? String(base) : '—'}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        onChange(isNaN(n) ? undefined : n);
      }}
      className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
    />
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
            <button onClick={() => remove(tag)} title={`Remove tag '${tag}'`} className="hover:text-white"><X size={10} /></button>
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

type Tab = 'library' | 'geometry' | 'offsets' | 'cutting' | 'nc' | 'crib';
const TABS: { id: Tab; label: string }[] = [
  { id: 'library',  label: 'Library'  },
  { id: 'geometry', label: 'Geometry' },
  { id: 'offsets',  label: 'Offsets'  },
  { id: 'cutting',  label: 'Cutting'  },
  { id: 'nc',       label: 'NC'       },
  { id: 'crib',     label: 'Crib'     },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function ToolEditor({
  tool, allTags, allMachineGroups, allHolders = [], allMaterials = [], onSave, onDelete, onDuplicate, onClose,
}: ToolEditorProps) {
  const { settings } = useSettings();
  const isNew = tool === null;
  const unit  = settings.defaultUnits === 'imperial' ? 'inch' : 'mm';

  const initialSnapshotRef = useRef<string>('');

  // Compute initial value once on mount; tool-change resets via useEffect below
  const [initialDraft] = useState<LibraryTool>(() => {
    const init = tool ? { ...tool } : makeBlankTool(unit, settings);
    initialSnapshotRef.current = JSON.stringify(init);
    return init;
  });

  const {
    state:   draft,
    set:     setDraft,
    undo,
    redo,
    canUndo,
    canRedo,
    reset:   resetDraft,
  } = useUndoRedo<LibraryTool>(initialDraft);

  const { saveTemplate } = useLibrary();
  const [activeTab,      setActiveTab]      = useState<Tab>('library');
  const [isSaving,       setIsSaving]       = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [showSaveTmpl,   setShowSaveTmpl]   = useState(false);
  const [templateName,   setTemplateName]   = useState('');
  const ZOOM_LEVELS = [0.6, 1.0, 1.5, 2.1] as const;
  const [zoomIdx,      setZoomIdx]     = useState(2); // default = 1.5×
  const [expandedMats,      setExpandedMats]      = useState<Set<string>>(new Set());
  const [addMatId,          setAddMatId]          = useState('');
  // Aspect ratio (w/h) of the current photo — used to size the preview row
  const [photoAspectRatio,  setPhotoAspectRatio]  = useState<number | null>(null);

  useEffect(() => {
    if (!draft.imageBase64) { setPhotoAspectRatio(null); return; }
    const img = new Image();
    img.onload = () => setPhotoAspectRatio(img.naturalWidth / img.naturalHeight);
    img.src = draft.imageBase64;
  }, [draft.imageBase64]);

  const allIssues = validateTool(draft);
  const warnings  = allIssues.filter((i) => i.severity === 'warning');
  const errors    = getErrors(allIssues);
  const hasErrors = Object.keys(errors).length > 0;
  const isDirty   = JSON.stringify(draft) !== initialSnapshotRef.current;

  // Reset when the tool prop changes (switching between edits)
  useEffect(() => {
    const init = tool ? { ...tool } : makeBlankTool(unit, settings);
    initialSnapshotRef.current = JSON.stringify(init);
    resetDraft(init);
    setActiveTab('library');
    setShowConfirm(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target  = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const ctrl    = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape') { onClose(); return; }
      if (ctrl && e.key === 's') {
        e.preventDefault();
        if (!hasErrors && !isSaving) void handleSave();
        return;
      }
      // Undo/redo only when not typing in a field
      if (!inInput && ctrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }
      if (!inInput && ctrl && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        if (canRedo) redo();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasErrors, isSaving, canUndo, canRedo, undo, redo]);

  function patchDraft(patch: Partial<LibraryTool>) {
    setDraft({ ...draft, ...patch });
  }
  function patchGeo(patch: Partial<LibraryTool['geometry']>) {
    setDraft({ ...draft, geometry: { ...draft.geometry, ...patch } });
  }
  function patchOffsets(patch: Partial<NonNullable<LibraryTool['offsets']>>) {
    setDraft({ ...draft, offsets: { ...(draft.offsets ?? {}), ...patch } });
  }
  function patchCut(patch: Partial<NonNullable<LibraryTool['cutting']>>) {
    setDraft({ ...draft, cutting: { ...(draft.cutting ?? {}), ...patch } });
  }
  function patchNc(patch: Partial<NonNullable<LibraryTool['nc']>>) {
    setDraft({ ...draft, nc: { ...(draft.nc ?? {}), ...patch } });
  }

  function patchMatEntry(materialId: string, patch: Partial<ToolMaterialEntry>) {
    const entries = draft.toolMaterials ?? [];
    setDraft({ ...draft, toolMaterials: entries.map((e) => e.materialId === materialId ? { ...e, ...patch } : e) });
  }
  function addMatEntry(materialId: string) {
    const entries = draft.toolMaterials ?? [];
    if (entries.some((e) => e.materialId === materialId)) return;
    setDraft({ ...draft, toolMaterials: [...entries, { materialId }] });
  }
  function removeMatEntry(materialId: string) {
    const updated = (draft.toolMaterials ?? []).filter((e) => e.materialId !== materialId);
    setDraft({ ...draft, toolMaterials: updated.length ? updated : undefined });
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

  function handleDuplicate() {
    if (!onDuplicate) return;
    const now = Date.now();
    onDuplicate({
      ...draft,
      id:          crypto.randomUUID(),
      toolNumber:  draft.toolNumber + 1,
      description: draft.description ? draft.description + ' (copy)' : 'Copy',
      addedAt:     now,
      updatedAt:   now,
    });
  }

  const geo      = draft.geometry;
  const cut      = draft.cutting ?? {};
  const nc       = draft.nc ?? {};
  const type     = draft.type;
  const fv       = getFieldVisibility(type, settings.customToolTypes);
  const distUnit = draft.unit === 'mm' ? 'mm' : 'in';
  const feedUnit = `${distUnit}/${(cut.feedMode ?? 'per-minute') === 'per-minute' ? 'min' : 'rev'}`;

  // Whether we're in split-view mode (photo present)
  const inSplitView = !!draft.imageBase64;

  // In split view the SVG pane is ~240 px wide (half the 480 px panel).
  // Double the effective zoom so the tool appears the same size as in full-width mode
  // (vbW = 480/zoom, so doubling zoom halves vbW, compensating for the halved container width).
  const effectiveZoom = inSplitView
    ? ZOOM_LEVELS[zoomIdx] * 2
    : ZOOM_LEVELS[zoomIdx];

  // Preview row height
  // • No photo  → height needed by the SVG at the user's zoom level
  // • Photo set → height to show the photo with minimal letterboxing, but at least
  //               as tall as the SVG's intrinsic height in the 240 px pane.
  //   SVG intrinsic H (autoHeight mode) = paneW × vbH / vbW
  //                                     = 240 × 185 / (480 / effectiveZoom)
  //                                     = 240 × 185 × effectiveZoom / 480
  const PHOTO_PANE_W  = 240;
  const SVG_FULL_H    = Math.round(185 * ZOOM_LEVELS[zoomIdx]);   // no-photo mode
  const SVG_SPLIT_H   = Math.round(PHOTO_PANE_W * 185 * effectiveZoom / 480); // split mode intrinsic H
  const MAX_PREVIEW_H = 340;

  const previewH = inSplitView && photoAspectRatio !== null
    ? Math.max(SVG_SPLIT_H, Math.min(MAX_PREVIEW_H, Math.round(PHOTO_PANE_W / photoAspectRatio)))
    : SVG_FULL_H;

  // Apply the dynamic height imperatively so the JSX style prop lint rule is not triggered.
  const previewRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (previewRowRef.current) previewRowRef.current.style.height = `${previewH}px`;
  }, [previewH]);

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
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Redo2 size={14} />
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <span className="hidden sm:flex items-center gap-1 text-xs text-slate-600">
              <kbd className="px-1 py-0.5 rounded bg-slate-700 border border-slate-600 font-mono text-slate-400">Ctrl S</kbd>
              <span>save</span>
            </span>
            <button
              onClick={onClose}
              title="Close editor"
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

        {/* Preview row: [photo left | SVG right] when photo set; SVG full-width otherwise */}
        <div ref={previewRowRef} className="shrink-0 border-b border-slate-700 flex">

          {/* Photo pane — only rendered when a photo exists */}
          {draft.imageBase64 && (
            <div className="w-1/2 border-r border-slate-700 overflow-hidden">
              <PhotoPane
                value={draft.imageBase64}
                onChange={(v) => patchDraft({ imageBase64: v })}
              />
            </div>
          )}

          {/* SVG pane — full width when no photo, half width when photo present.
               In split view: effectiveZoom compensates for the narrower pane;
               fillContainer makes the SVG stretch to h-full so no blank space shows.
               bg-[#0f172a] matches the SVG's own background so the area outside the
               viewBox mapping is the same colour — no visible seam. */}
          <div className="relative flex-1 overflow-hidden bg-[#0f172a]">
            <ToolProfileSVG
              draft={draft}
              zoom={effectiveZoom}
              fillContainer={inSplitView}
              hideUnitLabel
              allHolders={allHolders}
            />

            {/* Top-left: unit label — HTML overlay, reliably pinned regardless of SVG zoom */}
            <span className="absolute top-2 left-2 z-10 text-xs font-mono text-slate-300 pointer-events-none select-none">
              {draft.unit}
            </span>

            {/* Top-right: zoom controls */}
            <div className="absolute top-2 right-2 flex gap-0.5 z-10">
              <button
                type="button"
                onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
                disabled={zoomIdx === 0}
                title="Zoom out"
                className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
                disabled={zoomIdx === ZOOM_LEVELS.length - 1}
                title="Zoom in"
                className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ZoomIn size={13} />
              </button>
            </div>

            {/* Bottom-left: add photo button (only when no photo) */}
            {!draft.imageBase64 && (
              <PhotoPane
                value={undefined}
                onChange={(v) => patchDraft({ imageBase64: v })}
                overlayOnly
              />
            )}
          </div>
        </div>

        {/* Validation warnings */}
        {settings.validationWarningsEnabled && warnings.length > 0 && (
          <div className="shrink-0 mx-5 mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {warnings.map((w, i) => <p key={i}>{w.message}</p>)}
            </div>
          </div>
        )}

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

              <UuidRow id={draft.id} />

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
                    aria-label="Material"
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
                  options={getAllToolTypeOptions(settings.customToolTypes)}
                  onChange={(v) => patchDraft({ type: v })}
                />
              </Row2>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-400">Description *</label>
                  <button
                    type="button"
                    onClick={() => patchDraft({ description: suggestDescription(draft) })}
                    title="Fill with suggested name"
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors"
                  >
                    <Wand2 size={11} />
                    <span>Suggest</span>
                  </button>
                </div>
                <TextF
                  value={draft.description}
                  onChange={(v) => patchDraft({ description: v })}
                  placeholder={suggestDescription(draft)}
                  error={errors.description}
                />
              </div>

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

              <Row2 label="Machines">
                <MachineGroupInput
                  values={draft.machineGroups ?? []}
                  allGroups={allMachineGroups}
                  onChange={(v) => patchDraft({ machineGroups: v })}
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
              {fv.isJetCutter ? (
                /* ── Jet cutter: only kerf/beam, nozzle, and mount length ── */
                <div className="grid grid-cols-2 gap-3">
                  <Row2 label={`Kerf / beam Ø * (${draft.unit})`}>
                    <NumF
                      value={geo.diameter}
                      min={0}
                      error={errors.diameter}
                      onChange={(v) => patchGeo({ diameter: v ?? 0 })}
                    />
                  </Row2>
                  <Row2 label={`Nozzle / orifice Ø (${draft.unit})`}>
                    <NumF value={geo.nozzleDiameter} onChange={(v) => patchGeo({ nozzleDiameter: v })} min={0} />
                  </Row2>
                  <Row2 label={`Overall length (${draft.unit})`}>
                    <NumF value={geo.overallLength} onChange={(v) => patchGeo({ overallLength: v })} min={0} />
                  </Row2>
                </div>
              ) : (
                /* ── Standard tool geometry ─── */
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Row2 label={`Diameter * (${draft.unit})`}>
                      <NumF
                        value={geo.diameter}
                        min={0}
                        error={errors.diameter}
                        onChange={(v) => patchGeo({ diameter: v ?? 0 })}
                      />
                    </Row2>
                    <Row2 label={`Shaft diameter (${draft.unit})`}>
                      <NumF value={geo.shaftDiameter} onChange={(v) => patchGeo({ shaftDiameter: v })} min={0} />
                    </Row2>
                    <Row2 label={`Overall length (${draft.unit})`}>
                      <NumF value={geo.overallLength} onChange={(v) => patchGeo({ overallLength: v })} min={0} error={errors.overallLength} />
                    </Row2>
                    <Row2 label={`Body length (${draft.unit})`}>
                      <NumF value={geo.bodyLength} onChange={(v) => patchGeo({ bodyLength: v })} min={0} error={errors.bodyLength} />
                    </Row2>
                    <Row2 label={`Flute length (${draft.unit})`}>
                      <NumF value={geo.fluteLength} onChange={(v) => patchGeo({ fluteLength: v })} min={0} />
                    </Row2>
                    <Row2 label={`Shoulder length (${draft.unit})`}>
                      <NumF value={geo.shoulderLength} onChange={(v) => patchGeo({ shoulderLength: v })} min={0} />
                    </Row2>
                    <Row2 label="Number of flutes">
                      <NumF value={geo.numberOfFlutes} onChange={(v) => patchGeo({ numberOfFlutes: v })} min={0} step={1} />
                    </Row2>

                    {/* Conditional fields */}
                    {fv.showsCornerRadius && (
                      <Row2 label={`Corner radius (${draft.unit})`}>
                        <NumF value={geo.cornerRadius} onChange={(v) => patchGeo({ cornerRadius: v })} min={0} />
                      </Row2>
                    )}
                    {fv.showsTaperAngle && (
                      <Row2 label="Taper angle (°)">
                        <NumF value={geo.taperAngle} onChange={(v) => patchGeo({ taperAngle: v })} min={0} />
                      </Row2>
                    )}
                    {fv.showsTipDiameter && (
                      <Row2 label={`Tip diameter (${draft.unit})`}>
                        <NumF value={geo.tipDiameter} onChange={(v) => patchGeo({ tipDiameter: v })} min={0} />
                      </Row2>
                    )}
                    {fv.showsNumTeeth && (
                      <Row2 label="Number of teeth">
                        <NumF value={geo.numberOfTeeth} onChange={(v) => patchGeo({ numberOfTeeth: v })} min={0} step={1} />
                      </Row2>
                    )}
                  </div>

                  {/* Thread mill geometry section */}
                  {fv.showsThreadFields && (
                    <div className="pt-2 border-t border-slate-700/60">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        Thread geometry
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Row2 label={`Thread pitch (${draft.unit})`}>
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

              {/* Assembly — holder + stick-out (not applicable for jet cutters) */}
              {!fv.isJetCutter && <div className="pt-2 border-t border-slate-700/60">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Assembly</p>
                <div className="space-y-3">
                  <Row2 label="Tool holder">
                    <select
                      title="Tool holder"
                      value={draft.holderId ?? ''}
                      onChange={(e) => patchDraft({ holderId: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">— None —</option>
                      {allHolders.map((h) => (
                        <option key={h.id} value={h.id}>{h.name} ({h.type}, GL {h.gaugeLength} mm)</option>
                      ))}
                    </select>
                    {allHolders.length === 0 && (
                      <p className="mt-1 text-xs text-slate-600">No holders in library — add them via the Holders button.</p>
                    )}
                  </Row2>
                  <Row2 label={`Stick-out from holder face (${distUnit})`}>
                    <NumF value={draft.assemblyStickOut} min={0} onChange={(v) => patchDraft({ assemblyStickOut: v })} />
                  </Row2>
                  {(() => {
                    const h = allHolders.find((h) => h.id === draft.holderId);
                    if (!h || draft.assemblyStickOut == null) return null;
                    const totalMm = h.gaugeLength + draft.assemblyStickOut;
                    return (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/40 border border-slate-700">
                        <span className="text-xs text-slate-400">Total assembly length</span>
                        <span className="text-xs font-mono font-semibold text-blue-300">
                          {totalMm.toFixed(2)} mm
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>}
            </>
          )}

          {/* ── Offsets tab ──────────────────────────────────────────────── */}
          {activeTab === 'offsets' && (
            <>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tool offset values along machine axes. Leave blank if not applicable.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(['x', 'y', 'z', 'a', 'b', 'c', 'u', 'v', 'w'] as const).map((axis) => {
                  const isAngular = ['a', 'b', 'c'].includes(axis);
                  return (
                    <Row2 key={axis} label={`${axis.toUpperCase()} offset (${isAngular ? '°' : draft.unit})`}>
                      <NumF
                        value={(draft.offsets ?? {})[axis]}
                        onChange={(v) => patchOffsets({ [axis]: v })}
                      />
                    </Row2>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Cutting / F&S tab ────────────────────────────────────────── */}
          {activeTab === 'cutting' && (() => {
            const assigned    = draft.toolMaterials ?? [];
            const assignedIds = new Set(assigned.map((e) => e.materialId));
            const unassigned  = allMaterials.filter((m) => !assignedIds.has(m.id));
            const speedUnit   = draft.unit === 'mm' ? 'm/min' : 'ft/min';
            const baseRpm     = cut.spindleRpm;
            const baseFeed    = cut.feedCutting;
            const basePlunge  = cut.feedPlunge;

            const computedSurfaceSpeed = cut.spindleRpm !== undefined && geo.diameter
              ? Math.round(Math.PI * geo.diameter * cut.spindleRpm / (draft.unit === 'mm' ? 1000 : 12))
              : undefined;

            function toggleExpand(id: string) {
              setExpandedMats((prev) => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              });
            }

            return (
              <>
                {/* Default cutting parameters */}
                <div className="grid grid-cols-2 gap-3">
                  {!fv.isJetCutter && <>
                    <Row2 label="Spindle (rpm)">
                      <NumF value={cut.spindleRpm} onChange={(v) => patchCut({ spindleRpm: v })} min={0} step={1} />
                    </Row2>
                    <Row2 label={`Surface speed (${speedUnit})`}>
                      <NumF value={computedSurfaceSpeed} min={0} onChange={() => { /* read-only */ }} />
                    </Row2>
                    <Row2 label="Ramp spindle (rpm)">
                      <NumF value={cut.rampSpindleRpm} onChange={(v) => patchCut({ rampSpindleRpm: v })} min={0} step={1} />
                    </Row2>
                  </>}
                  <Row2 label={`Cutting feed (${feedUnit})`}>
                    <NumF value={cut.feedCutting} onChange={(v) => patchCut({ feedCutting: v })} min={0} />
                  </Row2>
                  <Row2 label={`Plunge feed (${feedUnit})`}>
                    <NumF value={cut.feedPlunge} onChange={(v) => patchCut({ feedPlunge: v })} min={0} />
                  </Row2>
                  <Row2 label={`Ramp feed (${feedUnit})`}>
                    <NumF value={cut.feedRamp} onChange={(v) => patchCut({ feedRamp: v })} min={0} />
                  </Row2>
                  <Row2 label={`Entry feed (${feedUnit})`}>
                    <NumF value={cut.feedEntry} onChange={(v) => patchCut({ feedEntry: v })} min={0} />
                  </Row2>
                  <Row2 label={`Exit feed (${feedUnit})`}>
                    <NumF value={cut.feedExit} onChange={(v) => patchCut({ feedExit: v })} min={0} />
                  </Row2>
                  <Row2 label={`Retract feed (${feedUnit})`}>
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
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-slate-300">Clockwise rotation</span>
                  <Toggle value={cut.clockwise ?? true} onChange={(v) => patchCut({ clockwise: v })} />
                </div>

                {/* Per-material F&S overrides */}
                <div className="pt-3 border-t border-slate-700/60">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Per-material overrides</p>

                  {allMaterials.length === 0 && (
                    <p className="text-xs text-slate-500 italic leading-relaxed">
                      No materials in library. Add materials via the Materials button in the toolbar.
                    </p>
                  )}

                  <div className="space-y-2">
                    {assigned.map((entry) => {
                      const mat      = allMaterials.find((m) => m.id === entry.materialId);
                      const matLabel = mat?.name ?? entry.materialId;
                      const catKey   = mat?.category ?? 'other';
                      const expanded = expandedMats.has(entry.materialId);

                      return (
                        <div key={entry.materialId} className="rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                            onClick={() => toggleExpand(entry.materialId)}
                          >
                            <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                            <span className="flex-1 text-sm font-medium text-slate-200 truncate">{matLabel}</span>
                            {mat && (
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${MATERIAL_CATEGORY_COLOURS[catKey]}`}>
                                {MATERIAL_CATEGORY_LABELS[catKey]}
                              </span>
                            )}
                            <button
                              type="button"
                              title="Remove material"
                              onClick={(e) => { e.stopPropagation(); removeMatEntry(entry.materialId); }}
                              className="shrink-0 p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>

                          {expanded && (
                            <div className="px-3 pb-3 border-t border-slate-700/60 pt-3 space-y-3">
                              <p className="text-xs text-slate-500">Blank / default fields inherit the base value shown in grey.</p>
                              <div className="grid grid-cols-2 gap-3">
                                <Row2 label="Spindle (rpm)">
                                  <FsNum value={entry.rpm} base={baseRpm} onChange={(v) => patchMatEntry(entry.materialId, { rpm: v })} />
                                </Row2>
                                <Row2 label={`Surface speed (${speedUnit})`}>
                                  <FsNum value={entry.surfaceSpeed} onChange={(v) => patchMatEntry(entry.materialId, { surfaceSpeed: v })} />
                                </Row2>
                                <Row2 label="Ramp spindle (rpm)">
                                  <FsNum value={entry.rampSpindleRpm} base={cut.rampSpindleRpm} onChange={(v) => patchMatEntry(entry.materialId, { rampSpindleRpm: v })} />
                                </Row2>
                                <Row2 label={`Cutting feed (${feedUnit})`}>
                                  <FsNum value={entry.feedRate} base={baseFeed} onChange={(v) => patchMatEntry(entry.materialId, { feedRate: v })} />
                                </Row2>
                                <Row2 label={`Plunge feed (${feedUnit})`}>
                                  <FsNum value={entry.feedPlunge} base={basePlunge} onChange={(v) => patchMatEntry(entry.materialId, { feedPlunge: v })} />
                                </Row2>
                                <Row2 label={`Ramp feed (${feedUnit})`}>
                                  <FsNum value={entry.feedRamp} base={cut.feedRamp} onChange={(v) => patchMatEntry(entry.materialId, { feedRamp: v })} />
                                </Row2>
                                <Row2 label={`Entry feed (${feedUnit})`}>
                                  <FsNum value={entry.feedEntry} base={cut.feedEntry} onChange={(v) => patchMatEntry(entry.materialId, { feedEntry: v })} />
                                </Row2>
                                <Row2 label={`Exit feed (${feedUnit})`}>
                                  <FsNum value={entry.feedExit} base={cut.feedExit} onChange={(v) => patchMatEntry(entry.materialId, { feedExit: v })} />
                                </Row2>
                                <Row2 label={`Retract feed (${feedUnit})`}>
                                  <FsNum value={entry.feedRetract} base={cut.feedRetract} onChange={(v) => patchMatEntry(entry.materialId, { feedRetract: v })} />
                                </Row2>
                                <Row2 label={`Feed/tooth (${distUnit}/tooth)`}>
                                  <FsNum value={entry.feedPerTooth} onChange={(v) => patchMatEntry(entry.materialId, { feedPerTooth: v })} />
                                </Row2>
                                <Row2 label={`Depth of cut (${distUnit})`}>
                                  <FsNum value={entry.depthOfCut} onChange={(v) => patchMatEntry(entry.materialId, { depthOfCut: v })} />
                                </Row2>
                                <Row2 label={`Width of cut (${distUnit})`}>
                                  <FsNum value={entry.widthOfCut} onChange={(v) => patchMatEntry(entry.materialId, { widthOfCut: v })} />
                                </Row2>
                                <Row2 label="Coolant">
                                  <select
                                    title="Coolant override"
                                    value={entry.coolant ?? ''}
                                    onChange={(e) => patchMatEntry(entry.materialId, { coolant: (e.target.value as CoolantMode) || undefined })}
                                    className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                  >
                                    <option value="">— default —</option>
                                    {COOLANT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                </Row2>
                                <Row2 label="Feed mode">
                                  <select
                                    title="Feed mode override"
                                    value={entry.feedMode ?? ''}
                                    onChange={(e) => patchMatEntry(entry.materialId, { feedMode: (e.target.value as FeedMode) || undefined })}
                                    className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                  >
                                    <option value="">— default —</option>
                                    {FEED_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                </Row2>
                                <Row2 label="Spindle direction">
                                  <select
                                    title="Spindle direction override"
                                    value={entry.clockwise === undefined ? '' : String(entry.clockwise)}
                                    onChange={(e) => patchMatEntry(entry.materialId, { clockwise: e.target.value === '' ? undefined : e.target.value === 'true' })}
                                    className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                  >
                                    <option value="">— default —</option>
                                    <option value="true">CW (clockwise)</option>
                                    <option value="false">CCW (counter-clockwise)</option>
                                  </select>
                                </Row2>
                              </div>
                              <Row2 label="Notes">
                                <input
                                  type="text"
                                  value={entry.notes ?? ''}
                                  onChange={(e) => patchMatEntry(entry.materialId, { notes: e.target.value || undefined })}
                                  placeholder="Optional notes for this material"
                                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </Row2>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {unassigned.length > 0 && (
                    <div className="flex gap-2 pt-3 mt-2 border-t border-slate-700/60">
                      <select
                        title="Select material to add"
                        value={addMatId}
                        onChange={(e) => setAddMatId(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="">— Select material —</option>
                        {unassigned.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!addMatId}
                        onClick={() => {
                          if (!addMatId) return;
                          addMatEntry(addMatId);
                          setExpandedMats((prev) => new Set([...prev, addMatId]));
                          setAddMatId('');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  )}
                  {assigned.length === 0 && allMaterials.length > 0 && unassigned.length === 0 && (
                    <p className="text-xs text-slate-500 italic">All library materials assigned.</p>
                  )}
                </div>
              </>
            );
          })()}

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

          {/* ── Crib tab ──────────────────────────────────────────────────── */}
          {activeTab === 'crib' && (
            <>
              {/* Inventory */}
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory</p>
              <div className="grid grid-cols-2 gap-3">
                <Row2 label="Quantity on hand">
                  <NumF value={draft.quantity} min={0} step={1} onChange={(v) => patchDraft({ quantity: v })} />
                </Row2>
                <Row2 label="Reorder below">
                  <NumF value={draft.reorderPoint} min={0} step={1} onChange={(v) => patchDraft({ reorderPoint: v })} />
                </Row2>
                <Row2 label="Unit cost">
                  <NumF value={draft.unitCost} min={0} onChange={(v) => patchDraft({ unitCost: v })} />
                </Row2>
              </div>
              <Row2 label="Supplier">
                <TextF
                  value={draft.supplier ?? ''}
                  onChange={(v) => patchDraft({ supplier: v || undefined })}
                  placeholder="e.g. Kyocera / McMaster"
                />
              </Row2>
              <Row2 label="Crib location">
                <TextF
                  value={draft.location ?? ''}
                  onChange={(v) => patchDraft({ location: v || undefined })}
                  placeholder="e.g. Drawer A3, Shelf 2"
                />
              </Row2>

              {/* Custom fields */}
              <div className="pt-2 border-t border-slate-700/60">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Custom fields</p>
                  <button
                    type="button"
                    onClick={() => {
                      const existing = draft.customFields ?? {};
                      const key = `Field ${Object.keys(existing).length + 1}`;
                      patchDraft({ customFields: { ...existing, [key]: '' } });
                    }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors"
                  >
                    <Plus size={11} /> Add field
                  </button>
                </div>
                {Object.keys(draft.customFields ?? {}).length === 0 && (
                  <p className="text-xs text-slate-600 italic">No custom fields. Click "Add field" to create one.</p>
                )}
                <div className="space-y-2">
                  {Object.entries(draft.customFields ?? {}).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const updated: Record<string, string> = {};
                          for (const [k, v] of Object.entries(draft.customFields ?? {})) {
                            updated[k === key ? newKey : k] = v;
                          }
                          patchDraft({ customFields: updated });
                        }}
                        placeholder="Field name"
                        className="w-32 shrink-0 px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => patchDraft({ customFields: { ...(draft.customFields ?? {}), [key]: e.target.value } })}
                        placeholder="Value"
                        className="flex-1 px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        title="Remove field"
                        onClick={() => {
                          const updated = { ...(draft.customFields ?? {}) };
                          delete updated[key];
                          patchDraft({ customFields: Object.keys(updated).length ? updated : undefined });
                        }}
                        className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center gap-3">
          {!isNew && !showConfirm && (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          {!isNew && !showConfirm && onDuplicate && (
            <button
              type="button"
              onClick={handleDuplicate}
              title="Duplicate this tool"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-600 transition-colors"
            >
              <Copy size={13} /> Duplicate
            </button>
          )}
          {!showConfirm && !showSaveTmpl && (
            <button
              type="button"
              onClick={() => { setTemplateName(draft.description || ''); setShowSaveTmpl(true); }}
              title="Save as template"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-600 transition-colors"
            >
              <BookTemplate size={13} /> Template
            </button>
          )}
          {showSaveTmpl && (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                placeholder="Template name…"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowSaveTmpl(false);
                  if (e.key === 'Enter' && templateName.trim()) {
                    const { id: _id, toolNumber: _n, addedAt: _a, updatedAt: _u, ...toolData } = draft;
                    const tmpl: ToolTemplate = { id: crypto.randomUUID(), name: templateName.trim(), createdAt: Date.now(), toolData };
                    void saveTemplate(tmpl);
                    setShowSaveTmpl(false);
                  }
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
              />
              <button
                type="button"
                onClick={() => {
                  if (!templateName.trim()) return;
                  const { id: _id, toolNumber: _n, addedAt: _a, updatedAt: _u, ...toolData } = draft;
                  const tmpl: ToolTemplate = { id: crypto.randomUUID(), name: templateName.trim(), createdAt: Date.now(), toolData };
                  void saveTemplate(tmpl);
                  setShowSaveTmpl(false);
                }}
                disabled={!templateName.trim()}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
              <button type="button" onClick={() => setShowSaveTmpl(false)} className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300">
                Cancel
              </button>
            </div>
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
