import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Library, Plus, Upload, Download, Search, Star, X,
  ChevronDown, Layers, Tag, RotateCcw, Keyboard, SlidersHorizontal, Columns2, Hash,
  Printer, QrCode, FlaskConical, Wrench, ScanLine, Copy, Package,
  Calculator, AlertTriangle, FileText, ArrowRightLeft,
} from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import { useHolders } from '../../contexts/HolderContext';
import { useMaterials } from '../../contexts/MaterialContext';
import type { LibraryTool } from '../../types/libraryTool';
import LibraryTable from '../library/LibraryTable';
import ToolEditor from '../library/ToolEditor';
import ImportPanel from '../library/ImportPanel';
import ExportPanel from '../library/ExportPanel';
import BulkEditPanel from '../library/BulkEditPanel';
import ToolComparePanel from '../library/ToolComparePanel';
import DuplicateFinderPanel from '../library/DuplicateFinderPanel';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import LabelPrintPanel from '../library/LabelPrintPanel';
import ToolSheetPanel from '../library/ToolSheetPanel';
import MaterialLibraryPanel from '../library/MaterialLibraryPanel';
import HolderLibraryPanel from '../library/HolderLibraryPanel';
import QrScannerPanel from '../library/QrScannerPanel';
import SpeedsFeedsPanel from '../library/SpeedsFeedsPanel';
import ValidationPanel from '../library/ValidationPanel';
import { downloadGcodeOffsetSheet } from '../../lib/gcodeOffsetSheet';
import { recordBackup } from '../../lib/backupNudge';

// ── Types ─────────────────────────────────────────────────────────────────────

type Panel = 'import' | 'export' | 'edit' | 'bulk-edit' | 'compare' | 'renumber' | 'label-print' | 'sheet-print' | 'materials' | 'holders' | 'duplicates' | 'qr-scan' | 'feeds' | 'validation' | 'copy-group' | null;

// ── Machine group sidebar ─────────────────────────────────────────────────────

function MachineGroupSidebar({
  groups,
  toolCountByGroup,
  totalCount,
  active,
  onSelect,
}: {
  groups:            string[];
  toolCountByGroup:  Record<string, number>;
  totalCount:        number;
  active:            string | null;
  onSelect:          (group: string | null) => void;
}) {
  return (
    <aside className="w-44 shrink-0 border-r border-slate-700 flex flex-col overflow-y-auto">
      <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Machines
      </p>

      <button
        onClick={() => onSelect(null)}
        className={[
          'flex items-center justify-between px-3 py-2 text-sm transition-colors text-left',
          active === null
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:bg-slate-700',
        ].join(' ')}
      >
        <span>All tools</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${active === null ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
          {totalCount}
        </span>
      </button>

      {groups.length > 0 && (
        <div className="mt-1 border-t border-slate-700/60">
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => onSelect(group)}
              className={[
                'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left',
                active === group
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700',
              ].join(' ')}
            >
              <span className="truncate">{group}</span>
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full shrink-0 ${active === group ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {toolCountByGroup[group] ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-6">
      <div className="relative">
        <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center">
          <Library size={40} className="text-slate-600" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
          <Layers size={14} className="text-blue-400" />
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-1">Your library is empty</h2>
        <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
          Import tools from an HSMLib or LinuxCNC file to start building your persistent tool library.
        </p>
      </div>
      <button
        onClick={onImport}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
      >
        <Upload size={15} />
        Import your first tools
      </button>
    </div>
  );
}

// ── Renumber modal ────────────────────────────────────────────────────────────

function RenumberModal({
  tools,
  onApply,
  onClose,
}: {
  tools:    LibraryTool[];
  onApply:  (updates: { id: string; patch: Partial<LibraryTool> }[]) => Promise<void>;
  onClose:  () => void;
}) {
  const sorted = [...tools].sort((a, b) => a.toolNumber - b.toolNumber);
  const [start,      setStart]      = useState(1);
  const [step,       setStep]       = useState(1);
  const [isApplying, setIsApplying] = useState(false);

  const preview = sorted.map((t, i) => ({ tool: t, newNumber: start + i * step }));
  const hasConflict = new Set(preview.map((p) => p.newNumber)).size !== preview.length;

  async function handleApply() {
    setIsApplying(true);
    await onApply(preview.map(({ tool, newNumber }) => ({ id: tool.id, patch: { toolNumber: newNumber } })));
    setIsApplying(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[440px] bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Hash size={14} className="text-slate-400" />
              Renumber Tools
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Resequence {tools.length} tool{tools.length !== 1 ? 's' : ''} sorted by current T#
            </p>
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Start number</label>
              <input
                type="number"
                value={start}
                min={0}
                step={1}
                title="Start number"
                onChange={(e) => setStart(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Step</label>
              <input
                type="number"
                value={step}
                min={1}
                step={1}
                title="Step size"
                onChange={(e) => setStep(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>
          </div>

          {hasConflict && (
            <p className="text-xs text-amber-400">Warning: duplicate T numbers will result — increase the step.</p>
          )}

          {/* Preview table */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Preview</p>
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <div className="max-h-52 overflow-y-auto divide-y divide-slate-700/60">
                {preview.map(({ tool, newNumber }) => (
                  <div key={tool.id} className="flex items-center gap-3 px-3 py-1.5 bg-slate-800/60 text-xs">
                    <span className="font-mono text-slate-500 w-10 shrink-0">T{tool.toolNumber}</span>
                    <span className="text-slate-500">→</span>
                    <span className={`font-mono w-10 shrink-0 font-semibold ${newNumber === tool.toolNumber ? 'text-slate-500' : 'text-blue-400'}`}>
                      T{newNumber}
                    </span>
                    <span className="text-slate-400 truncate">{tool.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying || hasConflict}
            className={[
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              !isApplying && !hasConflict
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            {isApplying ? 'Applying…' : `Apply to ${tools.length} tool${tools.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Copy-to-Group modal ────────────────────────────────────────────────────────

function CopyToGroupModal({
  tools,
  allGroups,
  onCopy,
  onClose,
}: {
  tools:     LibraryTool[];
  allGroups: string[];
  onCopy:    (tools: LibraryTool[]) => Promise<void>;
  onClose:   () => void;
}) {
  const [targetGroup, setTargetGroup] = useState(allGroups[0] ?? '');
  const [customGroup, setCustomGroup] = useState('');
  const [useCustom,   setUseCustom]   = useState(false);
  const [isCopying,   setIsCopying]   = useState(false);

  const finalGroup = useCustom ? customGroup.trim() : targetGroup;

  async function handleCopy() {
    if (!finalGroup) return;
    setIsCopying(true);
    const maxNum = Math.max(0, ...tools.map((t) => t.toolNumber));
    const copies = tools.map((t, i) => ({
      ...t,
      id:           crypto.randomUUID(),
      machineGroups: [...new Set([...(t.machineGroups ?? []), finalGroup])],
      toolNumber:   maxNum + i + 1,
      description:  t.description,
      addedAt:      Date.now(),
      updatedAt:    Date.now(),
    }));
    await onCopy(copies);
    setIsCopying(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[400px] bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <ArrowRightLeft size={14} className="text-slate-400" />
            Copy to Machine Group
          </h2>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400">
            Copy {tools.length} selected tool{tools.length !== 1 ? 's' : ''} to a machine group.
            New tool numbers will be assigned automatically.
          </p>

          {!useCustom && allGroups.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Target group</label>
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                title="Target machine group"
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {allGroups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">New group name</label>
              <input
                type="text"
                value={customGroup}
                placeholder="e.g. VF-4, Lathe 2…"
                onChange={(e) => setCustomGroup(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setUseCustom((v) => !v)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {useCustom ? '← Use existing group' : '+ New group'}
          </button>
        </div>

        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={isCopying || !finalGroup}
            className={[
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              !isCopying && finalGroup
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            {isCopying ? 'Copying…' : `Copy ${tools.length} tool${tools.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ToolManagerPage() {
  const {
    tools, isLoading,
    allMachineGroups, allTags,
    addTool, addTools, updateTool, patchEach, deleteTool, deleteTools,
  } = useLibrary();
  const { holders }   = useHolders();
  const { materials } = useMaterials();

  const restoreInputRef  = useRef<HTMLInputElement>(null);

  // ── Panel / editor state ──────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [editingTool, setEditingTool] = useState<LibraryTool | null>(null);

  // ── Filter / selection / keyboard nav state ───────────────────────────────
  const [searchQuery,     setSearchQuery]     = useState('');
  const [machineFilter,   setMachineFilter]   = useState<string | null>(null);
  const [starredOnly,     setStarredOnly]     = useState(false);
  const [lowStockOnly,    setLowStockOnly]    = useState(false);
  const [tagFilter,       setTagFilter]       = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [focusedId,       setFocusedId]       = useState<string | null>(null);
  const [showShortcuts,   setShowShortcuts]   = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Derived / filtered list ───────────────────────────────────────────────
  const filteredTools = useMemo(() => {
    let list = tools;
    if (machineFilter !== null) list = list.filter((t) => (t.machineGroups ?? []).includes(machineFilter));
    if (starredOnly)            list = list.filter((t) => t.starred);
    if (lowStockOnly)           list = list.filter((t) => t.reorderPoint != null && t.quantity != null && t.quantity <= t.reorderPoint);
    if (tagFilter.length > 0)   list = list.filter((t) => tagFilter.every((tag) => t.tags.includes(tag)));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        String(t.toolNumber).includes(q) ||
        (t.manufacturer ?? '').toLowerCase().includes(q) ||
        (t.productId   ?? '').toLowerCase().includes(q) ||
        (t.supplier    ?? '').toLowerCase().includes(q) ||
        (t.location    ?? '').toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [tools, machineFilter, starredOnly, lowStockOnly, tagFilter, searchQuery]);

  const toolCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tools) {
      for (const g of t.machineGroups ?? []) {
        counts[g] = (counts[g] ?? 0) + 1;
      }
    }
    return counts;
  }, [tools]);

  const selectedTools = filteredTools.filter((t) => selectedIds.has(t.id));
  const hasFilters    = starredOnly || lowStockOnly || tagFilter.length > 0 || searchQuery.trim() !== '' || machineFilter !== null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelectAll(all: LibraryTool[]) {
    setSelectedIds(all.length === 0 ? new Set() : new Set(all.map((t) => t.id)));
  }

  function handleToggleStar(id: string, starred: boolean) {
    updateTool(id, { starred });
  }

  function openEdit(tool: LibraryTool) {
    setEditingTool(tool);
    setActivePanel('edit');
  }

  function openNew() {
    setEditingTool(null);
    setActivePanel('edit');
  }

  async function handleSaveTool(tool: LibraryTool) {
    const exists = tools.some((t) => t.id === tool.id);
    if (exists) {
      await updateTool(tool.id, tool);
    } else {
      await addTool(tool);
    }
  }

  async function handleDuplicate(copy: LibraryTool) {
    await addTool(copy);
    openEdit(copy);
  }

  function closePanel() {
    setActivePanel(null);
    setEditingTool(null);
  }

  function handleBackup() {
    const payload = JSON.stringify({ version: 1, exportedAt: Date.now(), tools }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tool-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    recordBackup();
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { tools?: LibraryTool[] } | LibraryTool[];
      const incoming: LibraryTool[] = Array.isArray(data) ? data : (data.tools ?? []);
      await addTools(incoming, false);
    } catch (err) {
      console.error('Restore failed:', err);
    }
    e.target.value = '';
  }

  function clearFilters() {
    setSearchQuery('');
    setStarredOnly(false);
    setLowStockOnly(false);
    setTagFilter([]);
    setMachineFilter(null);
  }

  function toggleTagFilter(tag: string) {
    setTagFilter((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const moveFocus = useCallback((dir: 1 | -1) => {
    if (filteredTools.length === 0) return;
    setFocusedId((prev) => {
      const idx = prev ? filteredTools.findIndex((t) => t.id === prev) : -1;
      const next = Math.max(0, Math.min(filteredTools.length - 1, idx + dir));
      return filteredTools[next].id;
    });
  }, [filteredTools]);

  const openFocused = useCallback(() => {
    if (!focusedId) return;
    const t = filteredTools.find((t) => t.id === focusedId);
    if (t) openEdit(t);
  }, [focusedId, filteredTools]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFocusedSelect = useCallback(() => {
    if (!focusedId) return;
    handleToggleSelect(focusedId);
  }, [focusedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const duplicateFocused = useCallback(() => {
    if (!focusedId) return;
    const t = filteredTools.find((x) => x.id === focusedId);
    if (t) handleDuplicate({ ...t, id: crypto.randomUUID(), toolNumber: t.toolNumber + 1000, description: `${t.description} (copy)`, addedAt: Date.now(), updatedAt: Date.now() });
  }, [focusedId, filteredTools]); // eslint-disable-line react-hooks/exhaustive-deps

  useKeyboardShortcuts([
    { key: 'ArrowDown', callback: () => moveFocus(1)  },
    { key: 'ArrowUp',   callback: () => moveFocus(-1) },
    { key: 'j',         callback: () => moveFocus(1)  },
    { key: 'k',         callback: () => moveFocus(-1) },
    { key: 'Enter',     callback: openFocused  },
    { key: 'e',         callback: openFocused  },
    { key: ' ',         callback: toggleFocusedSelect },
    { key: 'd',         ctrl: true, callback: duplicateFocused },
    { key: '/',         callback: () => { searchInputRef.current?.focus(); searchInputRef.current?.select(); } },
    { key: '?',         callback: () => setShowShortcuts((s) => !s) },
    { key: 'q',         ctrl: true, callback: () => { if (tools.length > 0) setActivePanel('qr-scan'); } },
    { key: 'Escape',    callback: () => {
      if (activePanel !== null) { closePanel(); return; }
      if (searchQuery)          { setSearchQuery(''); return; }
      setSelectedIds(new Set());
      setFocusedId(null);
    }},
  ], activePanel !== 'edit'); // disable nav shortcuts when editor is open (it has its own)

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-slate-400">
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        Loading library…
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-100">Tool Library</h1>
          {tools.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
              {tools.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size === 1 && selectedTools.length === 1 && (
            <button
              onClick={() => handleDuplicate({ ...selectedTools[0], id: crypto.randomUUID(), toolNumber: selectedTools[0].toolNumber + 1000, description: `${selectedTools[0].description} (copy)`, addedAt: Date.now(), updatedAt: Date.now() })}
              title="Duplicate selected tool (Ctrl+D)"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <Copy size={14} />
              Duplicate
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setActivePanel('copy-group')}
              title="Copy selected tools to a machine group"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <ArrowRightLeft size={14} />
              Copy to Group
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setActivePanel('feeds')}
              title="Speeds & Feeds calculator"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <Calculator size={14} />
              F&amp;S
            </button>
          )}
          {selectedIds.size >= 2 && (
            <button
              onClick={() => setActivePanel('compare')}
              title="Compare selected tools"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <Columns2 size={14} />
              Compare {selectedIds.size}
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setActivePanel('bulk-edit')}
              title="Bulk edit selected tools"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <SlidersHorizontal size={14} />
              Edit {selectedIds.size}
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setActivePanel('export')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <Download size={14} />
              Export {selectedIds.size} tool{selectedIds.size !== 1 ? 's' : ''}
            </button>
          )}
          {tools.length > 0 && (
            <button
              onClick={handleBackup}
              title="Download all tools as JSON backup"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <Download size={14} />
              Backup
            </button>
          )}
          <button
            onClick={() => restoreInputRef.current?.click()}
            title="Restore tools from a JSON backup"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
          >
            <RotateCcw size={14} />
            Restore
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json"
            aria-label="Restore from JSON backup"
            onChange={handleRestore}
            className="hidden"
          />
          <button
            onClick={() => setActivePanel('materials')}
            title="Material library"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
          >
            <FlaskConical size={14} />
            Materials
          </button>
          <button
            onClick={() => setActivePanel('holders')}
            title="Holder library"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
          >
            <Wrench size={14} />
            Holders
          </button>
          <button
            onClick={() => setActivePanel('import')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
          >
            <Upload size={14} />
            Import
          </button>
          {tools.length > 0 && (
            <button
              onClick={() => setActivePanel('duplicates')}
              title="Find duplicate tools"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <Wrench size={14} className="rotate-0" />
              Duplicates
            </button>
          )}
          {tools.length > 0 && (
            <button
              onClick={() => setActivePanel('renumber')}
              title="Renumber tools"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <Hash size={14} />
              Renumber
            </button>
          )}
          {filteredTools.length > 0 && (
            <button
              onClick={() => setActivePanel('sheet-print')}
              title="Print tool data sheet"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <Printer size={14} />
              Print Sheet
            </button>
          )}
          {tools.length > 0 && (
            <button
              onClick={() => downloadGcodeOffsetSheet(selectedTools.length > 0 ? selectedTools : filteredTools)}
              title="Download G-code tool offset reference sheet (.txt)"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <FileText size={14} />
              Offset Sheet
            </button>
          )}
          {tools.length > 0 && (
            <button
              onClick={() => setActivePanel('validation')}
              title="Scan library for data quality issues"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <AlertTriangle size={14} />
              Issues
            </button>
          )}
          {tools.length > 0 && (
            <button
              onClick={() => setActivePanel('qr-scan')}
              title="Scan a tool QR code to open it"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <ScanLine size={14} />
              Scan QR
            </button>
          )}
          {filteredTools.length > 0 && (
            <button
              onClick={() => setActivePanel('label-print')}
              title="Print labels with QR codes"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <QrCode size={14} />
              Print Labels
            </button>
          )}
          <button
            onClick={() => setShowShortcuts((s) => !s)}
            title="Keyboard shortcuts (?)"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
          >
            <Keyboard size={14} />
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <Plus size={14} />
            New Tool
          </button>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      {tools.length > 0 && (
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-700 shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tools…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} title="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={() => setStarredOnly((s) => !s)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border',
              starredOnly
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-600 bg-slate-800',
            ].join(' ')}
          >
            <Star size={13} fill={starredOnly ? 'currentColor' : 'none'} />
            Starred
          </button>

          <button
            onClick={() => setLowStockOnly((s) => !s)}
            title="Show only tools below reorder point"
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border',
              lowStockOnly
                ? 'bg-red-500/10 text-red-400 border-red-500/40'
                : 'text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-600 bg-slate-800',
            ].join(' ')}
          >
            <Package size={13} />
            Low Stock
          </button>

          {allTags.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setTagDropdownOpen((o) => !o)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border',
                  tagFilter.length > 0
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/40'
                    : 'text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-600 bg-slate-800',
                ].join(' ')}
              >
                <Tag size={13} />
                Tags {tagFilter.length > 0 ? `(${tagFilter.length})` : ''}
                <ChevronDown size={12} />
              </button>
              {tagDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setTagDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 z-30 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 min-w-[180px] max-h-60 overflow-y-auto">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTagFilter(tag)}
                        className={[
                          'w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
                          tagFilter.includes(tag)
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-700',
                        ].join(' ')}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tagFilter.map((tag) => (
            <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300">
              {tag}
              <button onClick={() => toggleTagFilter(tag)} title={`Remove '${tag}' filter`} className="hover:text-white"><X size={10} /></button>
            </span>
          ))}

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-auto">
              Clear filters
            </button>
          )}

          {filteredTools.length !== tools.length && (
            <span className="text-xs text-slate-500 shrink-0">
              {filteredTools.length} / {tools.length} tools
            </span>
          )}
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {tools.length === 0 ? (
        <EmptyState onImport={() => setActivePanel('import')} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <MachineGroupSidebar
            groups={allMachineGroups}
            toolCountByGroup={toolCountByGroup}
            totalCount={tools.length}
            active={machineFilter}
            onSelect={setMachineFilter}
          />
          <div className="flex flex-col flex-1 overflow-hidden">
            <LibraryTable
              tools={filteredTools}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onToggleStar={handleToggleStar}
              onEdit={openEdit}
              onPatchTool={updateTool}
              showMachineCol={machineFilter === null && allMachineGroups.length > 0}
              focusedId={focusedId ?? undefined}
              onFocusId={setFocusedId}
            />
          </div>
        </div>
      )}

      {/* ── Slide-over panels ────────────────────────────────────────────── */}
      {activePanel === 'import' && (
        <ImportPanel onImport={addTools} onClose={closePanel} />
      )}
      {activePanel === 'export' && (
        <ExportPanel selectedTools={selectedTools} allMaterials={materials} onClose={closePanel} />
      )}
      {activePanel === 'edit' && (
        <ToolEditor
          tool={editingTool}
          allTags={allTags}
          allMachineGroups={allMachineGroups}
          allHolders={holders}
          allMaterials={materials}
          onSave={handleSaveTool}
          onDelete={deleteTool}
          onDuplicate={handleDuplicate}
          onClose={closePanel}
        />
      )}
      {activePanel === 'bulk-edit' && (
        <BulkEditPanel
          tools={filteredTools.filter((t) => selectedIds.has(t.id))}
          allGroups={allMachineGroups}
          allTags={allTags}
          allMaterials={materials}
          onApply={async (updates) => { await patchEach(updates); }}
          onClose={closePanel}
        />
      )}
      {activePanel === 'compare' && (
        <ToolComparePanel
          tools={filteredTools.filter((t) => selectedIds.has(t.id)).slice(0, 4)}
          onClose={closePanel}
        />
      )}
      {activePanel === 'renumber' && (
        <RenumberModal
          tools={filteredTools}
          onApply={async (updates) => { await patchEach(updates); closePanel(); }}
          onClose={closePanel}
        />
      )}
      {activePanel === 'label-print' && (
        <LabelPrintPanel
          tools={selectedTools.length > 0 ? selectedTools : filteredTools}
          onClose={closePanel}
        />
      )}
      {activePanel === 'sheet-print' && (
        <ToolSheetPanel
          tools={selectedTools.length > 0 ? selectedTools : filteredTools}
          onClose={closePanel}
        />
      )}
      {activePanel === 'materials' && (
        <MaterialLibraryPanel onClose={closePanel} />
      )}
      {activePanel === 'holders' && (
        <HolderLibraryPanel onClose={closePanel} />
      )}
      {activePanel === 'duplicates' && (
        <DuplicateFinderPanel
          tools={tools}
          onDelete={async (ids) => { await deleteTools(ids); }}
          onClose={closePanel}
        />
      )}
      {activePanel === 'qr-scan' && (
        <QrScannerPanel
          tools={tools}
          onFound={(tool) => { closePanel(); openEdit(tool); }}
          onUpdateTool={updateTool}
          onClose={closePanel}
        />
      )}
      {activePanel === 'feeds' && (
        <SpeedsFeedsPanel
          tool={selectedTools.length === 1 ? selectedTools[0] : null}
          allMaterials={materials}
          onApply={selectedTools.length === 1 ? (patch) => updateTool(selectedTools[0].id, patch) : undefined}
          onClose={closePanel}
        />
      )}
      {activePanel === 'validation' && (
        <ValidationPanel
          tools={tools}
          onGoTo={(id) => {
            const t = tools.find((x) => x.id === id);
            if (t) openEdit(t);
          }}
          onClose={closePanel}
        />
      )}
      {activePanel === 'copy-group' && (
        <CopyToGroupModal
          tools={selectedTools}
          allGroups={allMachineGroups}
          onCopy={async (copies) => {
            for (const c of copies) await addTool(c);
            closePanel();
          }}
          onClose={closePanel}
        />
      )}

      {/* ── Keyboard shortcuts legend ─────────────────────────────────────── */}
      {showShortcuts && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowShortcuts(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Keyboard size={14} className="text-slate-400" />
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)} title="Close" className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                ['j / ↓',         'Move focus down'],
                ['k / ↑',         'Move focus up'],
                ['Enter / e',     'Edit focused tool'],
                ['Space',         'Toggle selection'],
                ['/',             'Focus search'],
                ['Esc',           'Clear search / close panel'],
                ['Ctrl+D',        'Duplicate focused tool'],
                ['Ctrl+Q',        'Open QR scanner'],
                ['Ctrl+Enter',    'Convert (Converter page)'],
                ['Ctrl+Z',        'Undo (Tool Editor)'],
                ['Ctrl+Shift+Z',  'Redo (Tool Editor)'],
                ['Ctrl+S',        'Save (Tool Editor)'],
                ['?',             'Toggle this help'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 font-mono text-slate-300 text-xs whitespace-nowrap">
                    {key}
                  </kbd>
                  <span className="text-slate-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
