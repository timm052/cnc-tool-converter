import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Star, Pencil, AlertTriangle, Columns2, Plus, Minus } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import type { TableColumnVisibility } from '../../contexts/SettingsContext';
import { useSettings } from '../../contexts/SettingsContext';
import { validateTool } from '../../lib/toolValidation';

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = 'toolNumber' | 'description' | 'type' | 'diameter' | 'addedAt';
type SortDir = 'asc' | 'desc';

export interface LibraryTableProps {
  tools:          LibraryTool[];
  selectedIds:    Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll:    (all: LibraryTool[]) => void;
  onToggleStar:   (id: string, starred: boolean) => void;
  onEdit:         (tool: LibraryTool) => void;
  /** Inline patch — description edits, qty ± and all other cell edits */
  onPatchTool?:   (id: string, patch: Partial<LibraryTool>) => void;
  /** Auto-show machine group column when no machine filter is active */
  showMachineCol?: boolean;
  /** ID of the keyboard-focused tool */
  focusedId?:     string;
  onFocusId?:     (id: string) => void;
}

// ── Tool type colours ─────────────────────────────────────────────────────────

const TYPE_COLOURS: Record<string, string> = {
  'flat end mill':      'bg-blue-500/20 text-blue-300',
  'ball end mill':      'bg-purple-500/20 text-purple-300',
  'bull nose end mill': 'bg-violet-500/20 text-violet-300',
  'chamfer mill':       'bg-orange-500/20 text-orange-300',
  'face mill':          'bg-cyan-500/20 text-cyan-300',
  'spot drill':         'bg-yellow-500/20 text-yellow-300',
  'drill':              'bg-green-500/20 text-green-300',
  'tapered mill':       'bg-pink-500/20 text-pink-300',
  'boring bar':         'bg-teal-500/20 text-teal-300',
  'thread mill':        'bg-amber-500/20 text-amber-300',
  'engraving':          'bg-rose-500/20 text-rose-300',
  'custom':             'bg-slate-500/20 text-slate-300',
};

const TYPE_LABELS: Record<string, string> = {
  'flat end mill':      'Flat EM',
  'ball end mill':      'Ball EM',
  'bull nose end mill': 'Bull Nose',
  'chamfer mill':       'Chamfer',
  'face mill':          'Face Mill',
  'spot drill':         'Spot Drill',
  'drill':              'Drill',
  'tapered mill':       'Tapered',
  'boring bar':         'Boring Bar',
  'thread mill':        'Thread',
  'engraving':          'Engrave',
  'custom':             'Custom',
};

const KNOWN_TYPES = [
  'flat end mill', 'ball end mill', 'bull nose end mill', 'chamfer mill',
  'face mill', 'spot drill', 'drill', 'tapered mill', 'boring bar',
  'thread mill', 'engraving', 'custom',
];
const KNOWN_MATERIALS  = ['carbide', 'hss', 'ceramics', 'diamond', 'other'];
const KNOWN_COOLANTS   = ['flood', 'air', 'mist', 'suction', 'disabled'];

// ── Tag colours ───────────────────────────────────────────────────────────────

const TAG_COLOURS = [
  'bg-blue-500/20 text-blue-300',   'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300', 'bg-pink-500/20 text-pink-300',
  'bg-violet-500/20 text-violet-300','bg-cyan-500/20 text-cyan-300',
];
function tagColour(tag: string): string {
  let hash = 0;
  for (const ch of tag) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TAG_COLOURS[Math.abs(hash) % TAG_COLOURS.length];
}

// ── Column definition ─────────────────────────────────────────────────────────

interface ColDef {
  id:           keyof TableColumnVisibility;
  label:        string;
  group:        'Identity' | 'Geometry' | 'Cutting' | 'Library';
  sortKey?:     SortKey;
  mono?:        boolean;
  /** How to display in read mode */
  render:       (t: LibraryTool, dec: number) => React.ReactNode;
  /** 'none' = cell is not inline-editable */
  editType:     'text' | 'number' | 'select' | 'none';
  editOptions?: string[];
  /** Get the string value to place in the edit input */
  getEditRaw:   (t: LibraryTool) => string;
  /** Convert the edited string back to a patch object */
  getPatch:     (raw: string, t: LibraryTool) => Partial<LibraryTool>;
}

const ALL_COL_DEFS: ColDef[] = [
  // ── Identity ──────────────────────────────────────────────────────────────
  {
    id: 'type', label: 'Type', group: 'Identity', sortKey: 'type',
    render: (t) => (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOURS[t.type] ?? 'bg-slate-500/20 text-slate-300'}`}>
        {TYPE_LABELS[t.type] ?? t.type}
      </span>
    ),
    editType: 'select', editOptions: KNOWN_TYPES,
    getEditRaw: (t) => t.type,
    getPatch: (raw) => ({ type: raw as LibraryTool['type'] }),
  },
  {
    id: 'description', label: 'Description', group: 'Identity', sortKey: 'description',
    render: (t) => (
      <span className="block truncate max-w-[220px]" title={t.description}>{t.description}</span>
    ),
    editType: 'text',
    getEditRaw: (t) => t.description,
    getPatch: (raw) => ({ description: raw }),
  },
  {
    id: 'manufacturer', label: 'Make', group: 'Identity',
    render: (t) => <span className="text-slate-400 text-xs">{t.manufacturer ?? '—'}</span>,
    editType: 'text',
    getEditRaw: (t) => t.manufacturer ?? '',
    getPatch: (raw) => ({ manufacturer: raw || undefined }),
  },

  // ── Geometry ──────────────────────────────────────────────────────────────
  {
    id: 'diameter', label: 'Ø Dia', group: 'Geometry', sortKey: 'diameter', mono: true,
    render: (t, dec) => `${t.geometry.diameter.toFixed(dec)} ${t.unit}`,
    editType: 'number',
    getEditRaw: (t) => String(t.geometry.diameter),
    getPatch: (raw, t) => ({ geometry: { ...t.geometry, diameter: parseFloat(raw) || t.geometry.diameter } }),
  },
  {
    id: 'length', label: 'OAL', group: 'Geometry', mono: true,
    render: (t, dec) => t.geometry.overallLength != null ? `${t.geometry.overallLength.toFixed(dec)}` : '—',
    editType: 'number',
    getEditRaw: (t) => t.geometry.overallLength != null ? String(t.geometry.overallLength) : '',
    getPatch: (raw, t) => ({ geometry: { ...t.geometry, overallLength: raw ? parseFloat(raw) : undefined } }),
  },
  {
    id: 'fluteLength', label: 'Flute L', group: 'Geometry', mono: true,
    render: (t, dec) => t.geometry.fluteLength != null ? `${t.geometry.fluteLength.toFixed(dec)}` : '—',
    editType: 'number',
    getEditRaw: (t) => t.geometry.fluteLength != null ? String(t.geometry.fluteLength) : '',
    getPatch: (raw, t) => ({ geometry: { ...t.geometry, fluteLength: raw ? parseFloat(raw) : undefined } }),
  },
  {
    id: 'shaftDia', label: 'Shaft Ø', group: 'Geometry', mono: true,
    render: (t, dec) => t.geometry.shaftDiameter != null ? `${t.geometry.shaftDiameter.toFixed(dec)}` : '—',
    editType: 'number',
    getEditRaw: (t) => t.geometry.shaftDiameter != null ? String(t.geometry.shaftDiameter) : '',
    getPatch: (raw, t) => ({ geometry: { ...t.geometry, shaftDiameter: raw ? parseFloat(raw) : undefined } }),
  },
  {
    id: 'flutes', label: 'Flutes', group: 'Geometry', mono: true,
    render: (t) => t.geometry.numberOfFlutes ?? '—',
    editType: 'number',
    getEditRaw: (t) => t.geometry.numberOfFlutes != null ? String(t.geometry.numberOfFlutes) : '',
    getPatch: (raw, t) => ({ geometry: { ...t.geometry, numberOfFlutes: raw ? parseInt(raw) : undefined } }),
  },
  {
    id: 'cornerRadius', label: 'Corner R', group: 'Geometry', mono: true,
    render: (t, dec) => t.geometry.cornerRadius != null ? `${t.geometry.cornerRadius.toFixed(dec)}` : '—',
    editType: 'number',
    getEditRaw: (t) => t.geometry.cornerRadius != null ? String(t.geometry.cornerRadius) : '',
    getPatch: (raw, t) => ({ geometry: { ...t.geometry, cornerRadius: raw ? parseFloat(raw) : undefined } }),
  },
  {
    id: 'taperAngle', label: 'Taper', group: 'Geometry', mono: true,
    render: (t) => t.geometry.taperAngle != null ? `${t.geometry.taperAngle}°` : '—',
    editType: 'number',
    getEditRaw: (t) => t.geometry.taperAngle != null ? String(t.geometry.taperAngle) : '',
    getPatch: (raw, t) => ({ geometry: { ...t.geometry, taperAngle: raw ? parseFloat(raw) : undefined } }),
  },

  // ── Cutting ───────────────────────────────────────────────────────────────
  {
    id: 'rpm', label: 'RPM', group: 'Cutting', mono: true,
    render: (t) => t.cutting?.spindleRpm != null ? t.cutting.spindleRpm.toLocaleString() : '—',
    editType: 'number',
    getEditRaw: (t) => t.cutting?.spindleRpm != null ? String(t.cutting.spindleRpm) : '',
    getPatch: (raw, t) => ({ cutting: { ...(t.cutting ?? {}), spindleRpm: raw ? parseInt(raw) : undefined } }),
  },
  {
    id: 'feed', label: 'Feed', group: 'Cutting', mono: true,
    render: (t, dec) => t.cutting?.feedCutting != null ? t.cutting.feedCutting.toFixed(dec) : '—',
    editType: 'number',
    getEditRaw: (t) => t.cutting?.feedCutting != null ? String(t.cutting.feedCutting) : '',
    getPatch: (raw, t) => ({ cutting: { ...(t.cutting ?? {}), feedCutting: raw ? parseFloat(raw) : undefined } }),
  },
  {
    id: 'feedPlunge', label: 'Plunge', group: 'Cutting', mono: true,
    render: (t, dec) => t.cutting?.feedPlunge != null ? t.cutting.feedPlunge.toFixed(dec) : '—',
    editType: 'number',
    getEditRaw: (t) => t.cutting?.feedPlunge != null ? String(t.cutting.feedPlunge) : '',
    getPatch: (raw, t) => ({ cutting: { ...(t.cutting ?? {}), feedPlunge: raw ? parseFloat(raw) : undefined } }),
  },
  {
    id: 'coolant', label: 'Coolant', group: 'Cutting',
    render: (t) => <span className="text-slate-400 text-xs capitalize">{t.cutting?.coolant ?? '—'}</span>,
    editType: 'select', editOptions: KNOWN_COOLANTS,
    getEditRaw: (t) => t.cutting?.coolant ?? '',
    getPatch: (raw, t) => ({ cutting: { ...(t.cutting ?? {}), coolant: (raw || undefined) as import('../../types/tool').CoolantMode | undefined } }),
  },

  // ── Library / Crib ────────────────────────────────────────────────────────
  {
    id: 'material', label: 'Material', group: 'Library',
    render: (t) => <span className="text-slate-400 text-xs">{t.material ?? '—'}</span>,
    editType: 'select', editOptions: KNOWN_MATERIALS,
    getEditRaw: (t) => t.material ?? '',
    getPatch: (raw) => ({ material: raw as LibraryTool['material'] || undefined }),
  },
  {
    id: 'machineGroup', label: 'Machine', group: 'Library',
    render: (t) => <span className="text-slate-400 text-xs">{t.machineGroup ?? '—'}</span>,
    editType: 'text',
    getEditRaw: (t) => t.machineGroup ?? '',
    getPatch: (raw) => ({ machineGroup: raw || undefined }),
  },
  {
    id: 'qty', label: 'Qty', group: 'Library',
    render: (t) => {
      if (t.quantity == null) return <span className="text-slate-600">—</span>;
      const isLow = t.reorderPoint != null && t.quantity <= t.reorderPoint;
      return (
        <span className={isLow ? 'font-semibold text-red-400' : 'text-slate-300'}>
          {t.quantity}
          {isLow && <span className="ml-1 px-1 py-0.5 rounded text-xs bg-red-500/20 text-red-400">low</span>}
        </span>
      );
    },
    editType: 'number',
    getEditRaw: (t) => t.quantity != null ? String(t.quantity) : '',
    getPatch: (raw) => ({ quantity: raw ? Math.max(0, parseInt(raw)) : undefined }),
  },
  {
    id: 'reorderPoint', label: 'Reorder', group: 'Library',
    render: (t) => <span className="text-slate-400 text-xs">{t.reorderPoint ?? '—'}</span>,
    editType: 'number',
    getEditRaw: (t) => t.reorderPoint != null ? String(t.reorderPoint) : '',
    getPatch: (raw) => ({ reorderPoint: raw ? parseInt(raw) : undefined }),
  },
  {
    id: 'supplier', label: 'Supplier', group: 'Library',
    render: (t) => <span className="text-slate-400 text-xs">{t.supplier ?? '—'}</span>,
    editType: 'text',
    getEditRaw: (t) => t.supplier ?? '',
    getPatch: (raw) => ({ supplier: raw || undefined }),
  },
  {
    id: 'unitCost', label: 'Cost', group: 'Library', mono: true,
    render: (t) => t.unitCost != null ? <span className="text-slate-400 text-xs">{t.unitCost.toFixed(2)}</span> : <span className="text-slate-600">—</span>,
    editType: 'number',
    getEditRaw: (t) => t.unitCost != null ? String(t.unitCost) : '',
    getPatch: (raw) => ({ unitCost: raw ? parseFloat(raw) : undefined }),
  },
  {
    id: 'location', label: 'Location', group: 'Library',
    render: (t) => <span className="text-slate-400 text-xs">{t.location ?? '—'}</span>,
    editType: 'text',
    getEditRaw: (t) => t.location ?? '',
    getPatch: (raw) => ({ location: raw || undefined }),
  },
];

// Group columns for the picker dropdown
const COL_GROUPS = ['Identity', 'Geometry', 'Cutting', 'Library'] as const;

// ── Sort header ───────────────────────────────────────────────────────────────

function SortHeader({ label, sortKey, currentKey, dir, onSort }: {
  label: string; sortKey: SortKey; currentKey: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-200 select-none whitespace-nowrap"
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <span className="w-3" />}
      </span>
    </th>
  );
}

// ── Plain (non-sortable) header ───────────────────────────────────────────────

function PlainHeader({ label }: { label: string }) {
  return (
    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
      {label}
    </th>
  );
}

// ── Inline edit cell ──────────────────────────────────────────────────────────

function InlineEditCell({
  col, tool, decimals, isEditing, editRaw,
  onStartEdit, onChangeRaw, onCommit, onCancel,
  onPatchTool,
}: {
  col:          ColDef;
  tool:         LibraryTool;
  decimals:     number;
  isEditing:    boolean;
  editRaw:      string;
  onStartEdit:  () => void;
  onChangeRaw:  (v: string) => void;
  onCommit:     () => void;
  onCancel:     () => void;
  onPatchTool?: (id: string, patch: Partial<LibraryTool>) => void;
}) {
  const canEdit = col.editType !== 'none' && !!onPatchTool;

  // ── Qty column: special ± buttons ──────────────────────────────────────
  if (col.id === 'qty' && onPatchTool) {
    if (isEditing) {
      // fall through to number input below
    } else {
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onPatchTool(tool.id, { quantity: Math.max(0, (tool.quantity ?? 0) - 1) })}
            title="Decrease quantity"
            className="p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Minus size={11} />
          </button>
          <span
            className="min-w-[1.5rem] text-center cursor-text"
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
          >
            {col.render(tool, decimals)}
          </span>
          <button
            type="button"
            onClick={() => onPatchTool(tool.id, { quantity: (tool.quantity ?? 0) + 1 })}
            title="Increase quantity"
            className="p-0.5 rounded text-slate-500 hover:text-green-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Plus size={11} />
          </button>
        </div>
      );
    }
  }

  // ── Edit mode ──────────────────────────────────────────────────────────
  if (isEditing) {
    const inputCls = 'w-full bg-slate-700 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none';
    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
      if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
    };

    if (col.editType === 'select') {
      return (
        <select
          autoFocus
          title={col.label}
          value={editRaw}
          onChange={(e) => onChangeRaw(e.target.value)}
          onBlur={onCommit}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          className={inputCls}
        >
          <option value="">—</option>
          {(col.editOptions ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        autoFocus
        type={col.editType === 'number' ? 'number' : 'text'}
        title={col.label}
        value={editRaw}
        onChange={(e) => onChangeRaw(e.target.value)}
        onBlur={onCommit}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={inputCls}
      />
    );
  }

  // ── Read mode ──────────────────────────────────────────────────────────
  return (
    <span
      className={canEdit ? 'cursor-text' : undefined}
      onClick={(e) => { e.stopPropagation(); if (canEdit) onStartEdit(); }}
    >
      {col.render(tool, decimals)}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LibraryTable({
  tools,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onToggleStar,
  onEdit,
  onPatchTool,
  showMachineCol = false,
  focusedId,
  onFocusId,
}: LibraryTableProps) {
  const { settings, updateSettings } = useSettings();
  const decimals = settings.tableDecimalPrecision;
  const compact  = settings.tableRowDensity === 'compact';
  const py       = compact ? 'py-1' : 'py-2';
  const vis      = settings.tableColumnVisibility;
  const maxTags  = settings.libraryMaxTagsShown;

  // ── Sorting ──────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>(settings.librarySortKey as SortKey);
  const [sortDir, setSortDir] = useState<SortDir>(settings.librarySortDir);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      const next: SortDir = sortDir === 'asc' ? 'desc' : 'asc';
      setSortDir(next);
      updateSettings({ librarySortDir: next });
    } else {
      setSortKey(key);
      setSortDir('asc');
      updateSettings({ librarySortKey: key, librarySortDir: 'asc' });
    }
  }

  // ── Inline editing ───────────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ toolId: string; colId: string } | null>(null);
  const [editRaw,     setEditRaw]     = useState('');

  function startEdit(tool: LibraryTool, col: ColDef) {
    if (!onPatchTool || col.editType === 'none') return;
    setEditingCell({ toolId: tool.id, colId: col.id });
    setEditRaw(col.getEditRaw(tool));
  }

  function commitEdit(tool: LibraryTool, col: ColDef) {
    if (!onPatchTool) return;
    const patch = col.getPatch(editRaw.trim(), tool);
    onPatchTool(tool.id, patch);
    setEditingCell(null);
  }

  function cancelEdit() {
    setEditingCell(null);
  }

  // ── Column picker ────────────────────────────────────────────────────────
  const [colPickerOpen,    setColPickerOpen]    = useState(false);
  const [newCustomColName, setNewCustomColName] = useState('');

  const customFieldCols: string[] = settings.customFieldColumns ?? [];

  // All unique custom field keys discovered across currently loaded tools
  const discoveredCustomKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const t of tools) {
      for (const k of Object.keys(t.customFields ?? {})) keys.add(k);
    }
    // Also include any that are enabled in settings (even if no tool has them yet)
    for (const k of customFieldCols) keys.add(k);
    return [...keys].sort();
  }, [tools, customFieldCols]);

  function toggleCol(key: keyof TableColumnVisibility) {
    updateSettings({ tableColumnVisibility: { ...vis, [key]: !vis[key] } });
  }

  function toggleCustomCol(key: string) {
    const next = customFieldCols.includes(key)
      ? customFieldCols.filter((k) => k !== key)
      : [...customFieldCols, key];
    updateSettings({ customFieldColumns: next });
  }

  function addCustomCol() {
    const name = newCustomColName.trim();
    if (!name || customFieldCols.includes(name)) { setNewCustomColName(''); return; }
    updateSettings({ customFieldColumns: [...customFieldCols, name] });
    setNewCustomColName('');
  }

  // ── Visible columns ──────────────────────────────────────────────────────
  // A column is visible if explicitly enabled in vis, OR if it's machineGroup
  // and the showMachineCol fallback is active (backward compat).
  const visibleCols = ALL_COL_DEFS.filter(
    (c) => vis[c.id] || (c.id === 'machineGroup' && showMachineCol && !vis.machineGroup),
  );

  // ── Sorted rows ──────────────────────────────────────────────────────────
  const sorted = [...tools].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'toolNumber':  cmp = a.toolNumber - b.toolNumber; break;
      case 'description': cmp = a.description.localeCompare(b.description); break;
      case 'type':        cmp = a.type.localeCompare(b.type); break;
      case 'diameter':    cmp = a.geometry.diameter - b.geometry.diameter; break;
      case 'addedAt':     cmp = a.addedAt - b.addedAt; break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const allSelected = tools.length > 0 && tools.every((t) => selectedIds.has(t.id));

  if (tools.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        No tools match the current filter.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <thead className="sticky top-0 bg-slate-800 border-b border-slate-700 z-10">
          <tr>
            {/* Favourite */}
            <th className="px-2 py-2.5 w-8 text-center" aria-label="Favourite">
              <Star size={12} className="text-slate-500 mx-auto" />
            </th>

            {/* Select */}
            <th className="px-2 py-2.5 w-8" aria-label="Select all">
              <input
                type="checkbox" title="Select all"
                checked={allSelected}
                onChange={() => allSelected ? onSelectAll([]) : onSelectAll(tools)}
                className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500 cursor-pointer"
              />
            </th>

            {/* Edit */}
            <th className="px-2 py-2.5 w-8 text-center" aria-label="Edit">
              <Pencil size={12} className="text-slate-500 mx-auto" />
            </th>

            {/* T# — always visible, sortable */}
            <SortHeader label="T#" sortKey="toolNumber" currentKey={sortKey} dir={sortDir} onSort={handleSort} />

            {/* Dynamic columns */}
            {visibleCols.map((col) =>
              col.sortKey
                ? <SortHeader key={col.id} label={col.label} sortKey={col.sortKey} currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                : <PlainHeader key={col.id} label={col.label} />
            )}

            {/* Custom field columns */}
            {customFieldCols.map((key) => (
              <PlainHeader key={`cf:${key}`} label={key} />
            ))}

            {/* Tags — always visible */}
            <PlainHeader label="Tags" />

            {/* Column picker */}
            <th className="px-3 py-2.5 w-8" aria-label="Columns">
              <div className="relative flex justify-end">
                <button
                  type="button"
                  onClick={() => setColPickerOpen((o) => !o)}
                  title="Show/hide columns"
                  className={`p-1 rounded transition-colors ${colPickerOpen ? 'text-blue-400 bg-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`}
                >
                  <Columns2 size={13} />
                </button>
                {colPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setColPickerOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-30 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 w-52 max-h-[80vh] overflow-y-auto">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-2 pb-1.5">Columns</p>
                      {COL_GROUPS.map((group) => {
                        const cols = ALL_COL_DEFS.filter((c) => c.group === group);
                        return (
                          <div key={group} className="mb-1">
                            <p className="text-xs text-slate-600 px-2 py-0.5">{group}</p>
                            {cols.map(({ id, label }) => (
                              <label key={id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-700 text-sm text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={!!vis[id]}
                                  onChange={() => toggleCol(id)}
                                  className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        );
                      })}

                      {/* ── Custom Fields ──────────────────────────────── */}
                      <div className="mt-1 border-t border-slate-700 pt-2">
                        <p className="text-xs text-slate-600 px-2 py-0.5">Custom Fields</p>
                        {discoveredCustomKeys.map((key) => (
                          <label key={key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-700 text-sm text-slate-300">
                            <input
                              type="checkbox"
                              checked={customFieldCols.includes(key)}
                              onChange={() => toggleCustomCol(key)}
                              className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500"
                            />
                            {key}
                          </label>
                        ))}
                        {/* Add new custom field */}
                        <div className="flex items-center gap-1 px-2 pt-1.5">
                          <input
                            type="text"
                            title="New custom field name"
                            placeholder="Field name…"
                            value={newCustomColName}
                            onChange={(e) => setNewCustomColName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addCustomCol(); } }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); addCustomCol(); }}
                            title="Add column"
                            className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </th>
          </tr>
        </thead>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <tbody>
          {sorted.map((tool, i) => {
            const selected  = selectedIds.has(tool.id);
            const focused   = focusedId === tool.id;
            const issues    = settings.validationWarningsEnabled ? validateTool(tool) : [];
            const hasIssues = issues.length > 0;
            const issueTitle = issues.map((w) => `${w.severity === 'error' ? '✖' : '⚠'} ${w.message}`).join('\n');

            return (
              <tr
                key={tool.id}
                onClick={() => onFocusId?.(tool.id)}
                className={[
                  'border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors group cursor-default',
                  i % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent',
                  selected ? 'ring-1 ring-inset ring-blue-500/30 bg-blue-500/5' : '',
                  focused  ? 'outline outline-2 outline-blue-500/60 outline-offset-[-1px]' : '',
                ].join(' ')}
              >
                {/* Favourite */}
                <td className={`px-2 ${py} text-center`} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onToggleStar(tool.id, !tool.starred)}
                    title={tool.starred ? 'Unstar' : 'Star'}
                    className={`p-1 rounded transition-colors ${tool.starred ? 'text-amber-400 hover:bg-slate-600' : 'text-slate-600 hover:text-amber-300 hover:bg-slate-600'}`}
                  >
                    <Star size={13} fill={tool.starred ? 'currentColor' : 'none'} />
                  </button>
                </td>

                {/* Select */}
                <td className={`px-2 ${py}`} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox" title={`Select T${tool.toolNumber}`}
                    checked={selected}
                    onChange={() => onToggleSelect(tool.id)}
                    className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500 cursor-pointer"
                  />
                </td>

                {/* Edit */}
                <td className={`px-2 ${py} text-center`} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onEdit(tool)}
                    title="Open full editor"
                    className="p-1 rounded ring-1 ring-slate-500/60 text-blue-400 hover:text-white hover:bg-blue-600 hover:ring-blue-400 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                </td>

                {/* T# — always visible, inline-editable */}
                <td className={`px-3 ${py} font-mono text-blue-400 font-medium whitespace-nowrap`}>
                  {editingCell?.toolId === tool.id && editingCell.colId === '__toolNumber' ? (
                    <input
                      autoFocus type="number" title="Tool number"
                      value={editRaw}
                      onChange={(e) => setEditRaw(e.target.value)}
                      onBlur={() => {
                        const n = parseInt(editRaw);
                        if (!isNaN(n) && onPatchTool) onPatchTool(tool.id, { toolNumber: n });
                        setEditingCell(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') { e.stopPropagation(); setEditingCell(null); }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-16 bg-slate-700 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-blue-400 font-mono focus:outline-none"
                    />
                  ) : (
                    <span
                      className={onPatchTool ? 'cursor-text' : 'cursor-pointer'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onPatchTool) {
                          setEditingCell({ toolId: tool.id, colId: '__toolNumber' });
                          setEditRaw(String(tool.toolNumber));
                        } else {
                          onEdit(tool);
                        }
                      }}
                    >
                      T{tool.toolNumber}
                    </span>
                  )}
                </td>

                {/* Dynamic columns */}
                {visibleCols.map((col) => {
                  const isEditing = editingCell?.toolId === tool.id && editingCell.colId === col.id;
                  return (
                    <td
                      key={col.id}
                      className={`px-3 ${py} text-xs ${col.mono ? 'font-mono text-slate-300 whitespace-nowrap' : 'text-slate-300'}`}
                      onClick={(col.id === 'qty' || col.editType === 'none') ? (e) => e.stopPropagation() : undefined}
                    >
                      <InlineEditCell
                        col={col}
                        tool={tool}
                        decimals={decimals}
                        isEditing={isEditing}
                        editRaw={editRaw}
                        onStartEdit={() => startEdit(tool, col)}
                        onChangeRaw={setEditRaw}
                        onCommit={() => commitEdit(tool, col)}
                        onCancel={cancelEdit}
                        onPatchTool={onPatchTool}
                      />
                    </td>
                  );
                })}

                {/* Custom field columns */}
                {customFieldCols.map((key) => {
                  const cfColId = `cf:${key}`;
                  const isEditing = editingCell?.toolId === tool.id && editingCell.colId === cfColId;
                  const currentVal = tool.customFields?.[key] ?? '';
                  return (
                    <td
                      key={cfColId}
                      className={`px-3 ${py} text-xs text-slate-300 max-w-[160px]`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          title={key}
                          value={editRaw}
                          onChange={(e) => setEditRaw(e.target.value)}
                          onBlur={() => {
                            if (onPatchTool) onPatchTool(tool.id, { customFields: { ...(tool.customFields ?? {}), [key]: editRaw.trim() } });
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') { e.stopPropagation(); setEditingCell(null); }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-slate-700 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none"
                        />
                      ) : (
                        <span
                          className={`block truncate ${onPatchTool ? 'cursor-text' : ''} ${!currentVal ? 'text-slate-600' : ''}`}
                          title={currentVal || undefined}
                          onClick={() => {
                            if (!onPatchTool) return;
                            setEditingCell({ toolId: tool.id, colId: cfColId });
                            setEditRaw(currentVal);
                          }}
                        >
                          {currentVal || '—'}
                        </span>
                      )}
                    </td>
                  );
                })}

                {/* Tags — always visible */}
                <td className={`px-3 ${py} max-w-[180px]`}>
                  <div className="flex flex-wrap gap-1">
                    {tool.tags.slice(0, maxTags).map((tag) => (
                      <span key={tag} className={`px-1.5 py-0.5 rounded text-xs font-medium ${tagColour(tag)}`}>
                        {tag}
                      </span>
                    ))}
                    {tool.tags.length > maxTags && (
                      <span className="px-1.5 py-0.5 rounded text-xs text-slate-500">
                        +{tool.tags.length - maxTags}
                      </span>
                    )}
                  </div>
                </td>

                {/* Validation warning (last col, col-picker header above) */}
                <td className={`px-2 ${py}`}>
                  {hasIssues && (
                    <span title={issueTitle}>
                      <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
