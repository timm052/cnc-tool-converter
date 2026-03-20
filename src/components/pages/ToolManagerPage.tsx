import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Library, Plus, Upload, Download, Search, Star, X,
  ChevronDown, ChevronLeft, ChevronRight, Layers, Tag, RotateCcw, Keyboard, SlidersHorizontal, Columns2, Hash,
  Printer, QrCode, FlaskConical, Wrench, ScanLine, Copy, Package, Clock,
  Calculator, AlertTriangle, FileText, ArrowRightLeft, BookTemplate, Wand2, Code2, Camera, MapPin,
  Cloud, CloudUpload, CloudDownload, CloudOff, CheckCircle2, RefreshCw, Briefcase,
} from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useHolders } from '../../contexts/HolderContext';
import { useMaterials } from '../../contexts/MaterialContext';
import { useMachines } from '../../contexts/MachineContext';
import type { LibraryTool, ToolCondition } from '../../types/libraryTool';
import { TOOL_CONDITION_LABELS } from '../../types/libraryTool';
import LibraryTable from '../library/LibraryTable';
import ToolEditor from '../library/ToolEditor';
import ImportPanel from '../library/ImportPanel';
import ExportPanel from '../library/ExportPanel';
import BulkEditPanel from '../library/BulkEditPanel';
import ToolComparePanel from '../library/ToolComparePanel';
import DuplicateFinderPanel from '../library/DuplicateFinderPanel';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useRemoteSync } from '../../hooks/useRemoteSync';
import LabelPrintPanel from '../library/LabelPrintPanel';
import ToolSheetPanel from '../library/ToolSheetPanel';
import MaterialLibraryPanel from '../library/MaterialLibraryPanel';
import HolderLibraryPanel from '../library/HolderLibraryPanel';
import QrScannerPanel from '../library/QrScannerPanel';
import SpeedsFeedsPanel from '../library/SpeedsFeedsPanel';
import CuttingWizardPanel from '../library/CuttingWizardPanel';
import JobsPanel from '../library/JobsPanel';
import ValidationPanel from '../library/ValidationPanel';
import TemplatePickerPanel from '../library/TemplatePickerPanel';
import LowStockPanel from '../library/LowStockPanel';
import CamSnippetPanel from '../library/CamSnippetPanel';
import SnapshotPanel from '../library/SnapshotPanel';
import WorkOffsetSheetPanel from '../library/WorkOffsetSheetPanel';
import SetupSheetPanel from '../library/SetupSheetPanel';
import ToolSetPanel from '../library/ToolSetPanel';
import SupplierInvoicePanel from '../library/SupplierInvoicePanel';
import { downloadGcodeOffsetSheet } from '../../lib/gcodeOffsetSheet';
import { recordBackup } from '../../lib/backupNudge';
import { loadSets, restoreSets } from '../../lib/toolSetStore';
import { loadJobs, restoreJobs } from '../../lib/jobStore';
import type { ToolSet } from '../../types/toolSet';
import type { Job } from '../../types/job';
import { convertToolUnit } from '../../lib/unitConvert';

// ── Types ─────────────────────────────────────────────────────────────────────

type Panel = 'import' | 'export' | 'edit' | 'bulk-edit' | 'compare' | 'renumber' | 'label-print' | 'sheet-print' | 'materials' | 'holders' | 'duplicates' | 'qr-scan' | 'feeds' | 'validation' | 'copy-group' | 'templates' | 'low-stock' | 'wizard' | 'cam-snippet' | 'snapshots' | 'work-offsets' | 'jobs' | 'setup-sheet' | 'tool-sets' | 'supplier-invoice' | null;

// ── Machine group sidebar ─────────────────────────────────────────────────────

function MachineGroupSidebar({
  groups,
  toolCountByGroup,
  totalCount,
  active,
  onSelect,
  inventoryValue,
  lowStockCount,
  machines,
}: {
  groups:            string[];
  toolCountByGroup:  Record<string, number>;
  totalCount:        number;
  active:            string | null;
  onSelect:          (group: string | null) => void;
  inventoryValue?:   number;
  lowStockCount?:    number;
  machines:          import('../../types/machine').Machine[];
}) {
  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('machine-sidebar-collapsed') === 'true',
  );
  const [width, setWidth] = useState(() => {
    const stored = parseInt(localStorage.getItem('machine-sidebar-width') ?? '176', 10);
    return Math.min(320, Math.max(140, isNaN(stored) ? 176 : stored));
  });
  const isDragging   = useRef(false);
  const dragStartX   = useRef(0);
  const dragStartW   = useRef(0);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const delta = e.clientX - dragStartX.current;
    const next  = Math.min(320, Math.max(140, dragStartW.current + delta));
    setWidth(next);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    setWidth(w => {
      localStorage.setItem('machine-sidebar-width', String(w));
      return w;
    });
  }, [handleDragMove]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = width;
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [width, handleDragMove, handleDragEnd]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('machine-sidebar-collapsed', String(next));
  }

  /* ── Collapsed strip ── */
  if (collapsed) {
    return (
      <aside className="w-9 shrink-0 border-r border-slate-700 flex flex-col items-center pt-2 gap-2">
        <button
          type="button"
          onClick={toggle}
          title="Expand machine groups"
          className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
        {/* Active group indicator dot */}
        <div
          title={active ?? 'All tools'}
          className={`w-2 h-2 rounded-full ${active !== null ? 'bg-blue-400' : 'bg-slate-600'}`}
        />
      </aside>
    );
  }

  /* ── Expanded sidebar ── */
  return (
    <aside className="relative shrink-0 border-r border-slate-700 flex flex-col overflow-y-auto" style={{ width }}>
      <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10" onMouseDown={handleDragStart} />
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Machines
        </p>
        <button
          type="button"
          onClick={toggle}
          title="Collapse machine groups"
          className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
      </div>

      <button
        type="button"
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
          {groups.map((group) => {
            const machineInfo = machines.find((m) => m.name === group);
            return (
              <button
                key={group}
                type="button"
                onClick={() => onSelect(group)}
                className={[
                  'w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors text-left',
                  active === group
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700',
                ].join(' ')}
              >
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{group}</span>
                  {machineInfo && (
                    <span className={`text-xs truncate ${active === group ? 'text-blue-200' : 'text-slate-500'}`}>
                      {machineInfo.type}{machineInfo.controlType ? ` · ${machineInfo.controlType.toUpperCase()}` : ''}
                    </span>
                  )}
                </span>
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full shrink-0 ${active === group ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {toolCountByGroup[group] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Inventory summary — only when cost data exists */}
      {inventoryValue != null && inventoryValue > 0 && (
        <div className="mt-auto p-3 border-t border-slate-700/60 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory</p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Total value</span>
            <span className="font-mono font-semibold text-emerald-400">${inventoryValue.toFixed(2)}</span>
          </div>
          {lowStockCount != null && lowStockCount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Low stock</span>
              <span className="font-semibold text-red-400">{lowStockCount} tool{lowStockCount !== 1 ? 's' : ''}</span>
            </div>
          )}
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
  const [confirming, setConfirming] = useState(false);

  // Smart presets: suggest start/step based on tool type group
  const PRESETS = [
    { label: '1, 2, 3…',  start: 1,   step: 1  },
    { label: '10, 20…',   start: 10,  step: 10 },
    { label: 'Mills@100', start: 100, step: 1  },
    { label: 'Drills@200',start: 200, step: 1  },
    { label: 'Taps@300',  start: 300, step: 1  },
  ];

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

          {/* Quick presets */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1.5">Quick presets</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setStart(p.start); setStep(p.step); }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                    start === p.start && step === p.step
                      ? 'bg-blue-600/30 border-blue-500/60 text-blue-300'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
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
          {confirming ? (
            <>
              <span className="text-sm text-slate-400 mr-auto">Renumber {tools.length} tool{tools.length !== 1 ? 's' : ''}?</span>
              <button type="button" onClick={() => setConfirming(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setConfirming(false); void handleApply(); }}
                disabled={isApplying}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Confirm
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
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
            </>
          )}
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
    replaceLibrary,
  } = useLibrary();
  const nextToolNumber = useMemo(() => Math.max(0, ...tools.map((t) => t.toolNumber)) + 1, [tools]);
  const { settings, updateSettings } = useSettings();
  const { holders, addHolders }     = useHolders();
  const { materials, addMaterials } = useMaterials();
  const { machines }                = useMachines();

  // Merge machine groups from library tools and from the Machines page
  const mergedMachineGroups = useMemo(
    () => [...new Set([...allMachineGroups, ...machines.map((m) => m.name)])].sort(),
    [allMachineGroups, machines],
  );

  const restoreInputRef  = useRef<HTMLInputElement>(null);

  // ── Remote sync ───────────────────────────────────────────────────────────
  const [syncDropdown,   setSyncDropdown]   = useState(false);
  const [syncMergeToast, setSyncMergeToast] = useState<import('../../lib/remoteSync').MergeStats | null>(null);
  const syncDropdownRef = useRef<HTMLDivElement>(null);

  /** onApply: atomically write merged data into IndexedDB */
  const syncApply = useCallback(
    (t: import('../../types/libraryTool').LibraryTool[], m: import('../../types/material').WorkMaterial[], h: import('../../types/holder').ToolHolder[]) =>
      replaceLibrary(t, m, h),
    [replaceLibrary],
  );

  const sync = useRemoteSync(tools, materials, holders);

  // Show merge toast whenever stats arrive
  useEffect(() => {
    if (sync.mergeStats && (sync.mergeStats.addedFromRemote > 0 || sync.mergeStats.updatedFromRemote > 0 || sync.mergeStats.conflicts > 0)) {
      setSyncMergeToast(sync.mergeStats);
      const t = setTimeout(() => setSyncMergeToast(null), 7000);
      return () => clearTimeout(t);
    }
  }, [sync.mergeStats]);

  // Auto-sync: push whenever tools length changes (if configured)
  const prevToolsLenRef = useRef(tools.length);
  useEffect(() => {
    const changed = tools.length !== prevToolsLenRef.current;
    prevToolsLenRef.current = tools.length;
    if (changed && settings.remoteDbUrl && settings.remoteDbAutoSync) {
      sync.push(syncApply).catch(() => { /* status surfaced in UI */ });
    }
  }, [tools.length, settings.remoteDbUrl, settings.remoteDbAutoSync, sync, syncApply]);

  // Close sync dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (syncDropdownRef.current && !syncDropdownRef.current.contains(e.target as Node)) {
        setSyncDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Bulk undo ─────────────────────────────────────────────────────────────
  const [lastBulkUndo, setLastBulkUndo] = useState<{ id: string; patch: Partial<LibraryTool> }[] | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapAndPatchEach = useCallback(async (updates: { id: string; patch: Partial<LibraryTool> }[]) => {
    // Snapshot only the keys that are about to change for each affected tool
    const originals = updates.map(({ id, patch }) => {
      const tool = tools.find((t) => t.id === id);
      if (!tool) return { id, patch: {} as Partial<LibraryTool> };
      const orig: Partial<LibraryTool> = {};
      for (const key of Object.keys(patch) as (keyof LibraryTool)[]) {
        (orig as Record<string, unknown>)[key] = tool[key];
      }
      return { id, patch: orig };
    });
    await patchEach(updates);
    setLastBulkUndo(originals);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setLastBulkUndo(null), 8000);
  }, [tools, patchEach]);

  async function handleBulkUndo() {
    if (!lastBulkUndo) return;
    setLastBulkUndo(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    await patchEach(lastBulkUndo);
  }

  async function handleConvertUnits(toUnit: 'mm' | 'inch') {
    const updates = selectedTools
      .filter((t) => t.unit !== toUnit)
      .map((t) => {
        const converted = convertToolUnit(t, toUnit);
        return { id: t.id, patch: { unit: converted.unit, geometry: converted.geometry, cutting: converted.cutting, updatedAt: converted.updatedAt } as Partial<LibraryTool> };
      });
    if (updates.length === 0) return;
    await snapAndPatchEach(updates);
  }

  // ── Panel / editor state ──────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [editingTool, setEditingTool] = useState<LibraryTool | null>(null);

  // ── Filter / selection / keyboard nav state ───────────────────────────────
  const [searchQuery,     setSearchQuery]     = useState('');
  const [machineFilter,   setMachineFilter]   = useState<string | null>(null);
  const [starredOnly,       setStarredOnly]       = useState(false);
  const [lowStockOnly,      setLowStockOnly]      = useState(false);
  const [filterCheckedOut,  setFilterCheckedOut]  = useState(false);
  const [conditionFilter, setConditionFilter] = useState<ToolCondition | null>(null);
  const [tagFilter,       setTagFilter]       = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [focusedId,       setFocusedId]       = useState<string | null>(null);
  const [showShortcuts,   setShowShortcuts]   = useState(false);
  const [openDropdown,    setOpenDropdown]    = useState<'libraries' | 'maintenance' | 'print' | 'selection' | null>(null);
  const searchInputRef    = useRef<HTMLInputElement>(null);
  const librariesRef      = useRef<HTMLDivElement>(null);
  const maintenanceRef    = useRef<HTMLDivElement>(null);
  const printRef          = useRef<HTMLDivElement>(null);
  const selectionRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openDropdown) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        librariesRef.current?.contains(target) ||
        maintenanceRef.current?.contains(target) ||
        printRef.current?.contains(target) ||
        selectionRef.current?.contains(target)
      ) return;
      setOpenDropdown(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdown]);

  // ── Derived / filtered list ───────────────────────────────────────────────
  const filteredTools = useMemo(() => {
    let list = tools;
    if (machineFilter !== null) list = list.filter((t) => (t.machineGroups ?? []).includes(machineFilter));
    if (starredOnly)            list = list.filter((t) => t.starred);
    if (lowStockOnly)           list = list.filter((t) => t.reorderPoint != null && t.quantity != null && t.quantity <= t.reorderPoint);
    if (filterCheckedOut)       list = list.filter((t) => !!t.checkedOutTo);
    if (conditionFilter !== null) list = list.filter((t) => t.condition === conditionFilter);
    if (tagFilter.length > 0)     list = list.filter((t) => tagFilter.every((tag) => t.tags.includes(tag)));
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
  }, [tools, machineFilter, starredOnly, lowStockOnly, filterCheckedOut, conditionFilter, tagFilter, searchQuery]);

  const toolCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tools) {
      for (const g of t.machineGroups ?? []) {
        counts[g] = (counts[g] ?? 0) + 1;
      }
    }
    return counts;
  }, [tools]);

  const selectedTools = useMemo(
    () => filteredTools.filter((t) => selectedIds.has(t.id)),
    [filteredTools, selectedIds],
  );
  const hasFilters    = starredOnly || lowStockOnly || filterCheckedOut || conditionFilter !== null || tagFilter.length > 0 || searchQuery.trim() !== '' || machineFilter !== null;

  const inventoryValue = useMemo(() => {
    const total = tools.reduce((sum, t) => {
      if (t.unitCost == null || t.quantity == null) return sum;
      return sum + t.unitCost * t.quantity;
    }, 0);
    return total > 0 ? total : null;
  }, [tools]);

  const lowStockCount = useMemo(
    () => tools.filter((t) => t.reorderPoint != null && t.quantity != null && t.quantity <= t.reorderPoint).length,
    [tools],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((all: LibraryTool[]) => {
    setSelectedIds(all.length === 0 ? new Set() : new Set(all.map((t) => t.id)));
  }, []);

  const handleToggleStar = useCallback((id: string, starred: boolean) => {
    updateTool(id, { starred });
  }, [updateTool]);

  const openEdit = useCallback((tool: LibraryTool) => {
    setEditingTool(tool);
    setActivePanel('edit');
  }, []);

  const openNew = useCallback(() => {
    setEditingTool(null);
    setActivePanel('edit');
  }, []);

  const handleSaveTool = useCallback(async (tool: LibraryTool) => {
    const exists = tools.some((t) => t.id === tool.id);
    if (exists) {
      await updateTool(tool.id, tool);
    } else {
      await addTool(tool);
    }
  }, [tools, updateTool, addTool]);

  const handleDuplicate = useCallback(async (copy: LibraryTool) => {
    await addTool(copy);
    setEditingTool(copy);
    setActivePanel('edit');
  }, [addTool]);

  const closePanel = useCallback(() => {
    setActivePanel(null);
    setEditingTool(null);
  }, []);

  const handleBackup = useCallback(() => {
    // v3 backup — includes tools, materials, holders, toolSets, and jobs
    const payload = JSON.stringify({
      version:    3,
      exportedAt: Date.now(),
      tools,
      materials,
      holders,
      toolSets:   loadSets(),
      jobs:       loadJobs(),
    }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `tool-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    recordBackup();
  }, [tools, materials, holders]);

  const handleRestore = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        version?: number;
        tools?: LibraryTool[];
        materials?: import('../../types/material').WorkMaterial[];
        holders?: import('../../types/holder').ToolHolder[];
        toolSets?: ToolSet[];
        jobs?: Job[];
      } | LibraryTool[];

      const incomingTools     = Array.isArray(data) ? data : (data.tools ?? []);
      const incomingMaterials = Array.isArray(data) ? [] : (data.materials ?? []);
      const incomingHolders   = Array.isArray(data) ? [] : (data.holders ?? []);
      const incomingToolSets  = Array.isArray(data) ? [] : (data.toolSets ?? []);
      const incomingJobs      = Array.isArray(data) ? [] : (data.jobs ?? []);

      await addTools(incomingTools, false);
      if (incomingMaterials.length)  await addMaterials(incomingMaterials);
      if (incomingHolders.length)    await addHolders(incomingHolders);
      if (incomingToolSets.length)   restoreSets(incomingToolSets);
      if (incomingJobs.length)       restoreJobs(incomingJobs);
    } catch (err) {
      console.error('Restore failed:', err);
    }
    e.target.value = '';
  }, [addTools, addMaterials, addHolders]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStarredOnly(false);
    setLowStockOnly(false);
    setConditionFilter(null);
    setTagFilter([]);
    setMachineFilter(null);
  }, []);

  const toggleTagFilter = useCallback((tag: string) => {
    setTagFilter((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }, []);

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
  }, [focusedId, filteredTools, openEdit]);

  const toggleFocusedSelect = useCallback(() => {
    if (!focusedId) return;
    handleToggleSelect(focusedId);
  }, [focusedId, handleToggleSelect]);

  const duplicateFocused = useCallback(() => {
    if (!focusedId) return;
    const t = filteredTools.find((x) => x.id === focusedId);
    if (t) handleDuplicate({ ...t, id: crypto.randomUUID(), toolNumber: t.toolNumber + 1000, description: `${t.description} (copy)`, addedAt: Date.now(), updatedAt: Date.now() });
  }, [focusedId, filteredTools, handleDuplicate]);

  useKeyboardShortcuts([
    { key: 'ArrowDown', callback: () => moveFocus(1)  },
    { key: 'ArrowUp',   callback: () => moveFocus(-1) },
    { key: 'j',         callback: () => moveFocus(1)  },
    { key: 'k',         callback: () => moveFocus(-1) },
    { key: 'Enter',     callback: openFocused  },
    { key: 'e',         callback: openFocused  },
    { key: ' ',         callback: toggleFocusedSelect },
    { key: 'd',         ctrl: true, callback: duplicateFocused },
    { key: 'i',         ctrl: true, callback: () => { if (activePanel !== 'edit') setActivePanel('import'); } },
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
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-700 shrink-0 flex-wrap">
        {/* Title */}
        <div className="flex items-center gap-2 mr-2 shrink-0">
          <h1 className="text-lg font-semibold text-slate-100 whitespace-nowrap">Tool Library</h1>
          {tools.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
              {tools.length}
            </span>
          )}
        </div>

        {/* Right-side actions — flex-wrap so they reflow at any width */}
        <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">

          {/* ── Selection dropdown (shown when ≥1 tool selected) ── */}
          {selectedIds.size > 0 && (
            <div className="relative" ref={selectionRef}>
              <button
                type="button"
                onClick={() => setOpenDropdown((o) => o === 'selection' ? null : 'selection')}
                title="Actions for selected tools"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition-colors whitespace-nowrap"
              >
                {selectedIds.size} selected
                <ChevronDown size={13} className={`transition-transform ${openDropdown === 'selection' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'selection' && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 py-1 overflow-hidden">
                  {selectedIds.size === 1 && selectedTools.length === 1 && (
                    <button type="button" onClick={() => { handleDuplicate({ ...selectedTools[0], id: crypto.randomUUID(), toolNumber: selectedTools[0].toolNumber + 1000, description: `${selectedTools[0].description} (copy)`, addedAt: Date.now(), updatedAt: Date.now() }); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                      <Copy size={14} className="text-slate-400 shrink-0" /> Duplicate
                    </button>
                  )}
                  <button type="button" onClick={() => { setActivePanel('copy-group'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <ArrowRightLeft size={14} className="text-slate-400 shrink-0" /> Copy to Group
                  </button>
                  <button type="button" onClick={() => { setActivePanel('feeds'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <Calculator size={14} className="text-slate-400 shrink-0" /> F&amp;S Calculator
                  </button>
                  <div className="border-t border-slate-700 my-1" />
                  <button type="button" onClick={() => { void handleConvertUnits('mm'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <ArrowRightLeft size={14} className="text-slate-400 shrink-0" /> Convert → mm
                  </button>
                  <button type="button" onClick={() => { void handleConvertUnits('inch'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <ArrowRightLeft size={14} className="text-slate-400 shrink-0" /> Convert → in
                  </button>
                  <div className="border-t border-slate-700 my-1" />
                  <button type="button" onClick={() => { setActivePanel('cam-snippet'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <Code2 size={14} className="text-slate-400 shrink-0" /> CAM Snippet
                  </button>
                  {selectedIds.size >= 2 && (
                    <>
                      <div className="border-t border-slate-700 my-1" />
                      <button type="button" onClick={() => { setActivePanel('compare'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                        <Columns2 size={14} className="text-slate-400 shrink-0" /> Compare {selectedIds.size}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Primary selection actions — always visible */}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setActivePanel('bulk-edit')}
              title="Edit selected tools"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors whitespace-nowrap"
            >
              <SlidersHorizontal size={14} />
              Edit {selectedIds.size}
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setActivePanel('export')}
              title="Export selected tools"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors whitespace-nowrap"
            >
              <Download size={14} />
              Export {selectedIds.size}
            </button>
          )}

          {selectedIds.size > 0 && <div className="w-px h-6 bg-slate-600 shrink-0" />}

          {/* ── Always-visible actions ── */}

          {lowStockCount > 0 && (
            <button
              type="button"
              onClick={() => setActivePanel('low-stock')}
              title="View tools at or below reorder point"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-600/80 hover:bg-red-600 text-white border border-red-500/40 transition-colors whitespace-nowrap"
            >
              <AlertTriangle size={14} />
              Low Stock
            </button>
          )}

          <button
            type="button"
            onClick={() => setActivePanel('import')}
            title="Import tools from a file"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors whitespace-nowrap"
          >
            <Upload size={14} />
            Import
          </button>

          {tools.length > 0 && (
            <button
              type="button"
              onClick={handleBackup}
              title="Download all tools as JSON backup"
              className="p-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors"
            >
              <Download size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            title="Restore tools from a JSON backup"
            className="p-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors"
          >
            <RotateCcw size={14} />
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json"
            aria-label="Restore from JSON backup"
            onChange={handleRestore}
            className="hidden"
          />

          {/* ── Libraries dropdown ── */}
          <div className="relative" ref={librariesRef}>
            <button
              type="button"
              onClick={() => setOpenDropdown((o) => o === 'libraries' ? null : 'libraries')}
              title="Reference libraries"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors whitespace-nowrap"
            >
              Libraries
              <ChevronDown size={13} className={`transition-transform ${openDropdown === 'libraries' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'libraries' && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 py-1 overflow-hidden">
                <button type="button" onClick={() => { setActivePanel('materials'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                  <FlaskConical size={14} className="text-slate-400 shrink-0" /> Materials
                </button>
                <button type="button" onClick={() => { setActivePanel('holders'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                  <Wrench size={14} className="text-slate-400 shrink-0" /> Holders
                </button>
                <button type="button" onClick={() => { setActivePanel('templates'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                  <BookTemplate size={14} className="text-slate-400 shrink-0" /> Templates
                </button>
                <div className="my-1 border-t border-slate-700/60" />
                <button type="button" onClick={() => { setActivePanel('jobs'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                  <Briefcase size={14} className="text-slate-400 shrink-0" /> Jobs
                </button>
                <button type="button" onClick={() => { setActivePanel('tool-sets'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                  <Layers size={14} className="text-slate-400 shrink-0" /> Tool Sets
                </button>
              </div>
            )}
          </div>

          {/* ── Maintenance dropdown ── */}
          {tools.length > 0 && (
            <div className="relative" ref={maintenanceRef}>
              <button
                type="button"
                onClick={() => setOpenDropdown((o) => o === 'maintenance' ? null : 'maintenance')}
                title="Library maintenance tools"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors whitespace-nowrap"
              >
                Maintain
                <ChevronDown size={13} className={`transition-transform ${openDropdown === 'maintenance' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'maintenance' && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 py-1 overflow-hidden">
                  <button type="button" onClick={() => { setActivePanel('duplicates'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <Layers size={14} className="text-slate-400 shrink-0" /> Find Duplicates
                  </button>
                  <button type="button" onClick={() => { setActivePanel('renumber'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <Hash size={14} className="text-slate-400 shrink-0" /> Renumber
                  </button>
                  <button type="button" onClick={() => { setActivePanel('validation'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <AlertTriangle size={14} className="text-slate-400 shrink-0" /> Issues
                  </button>
                  <button type="button" onClick={() => { setActivePanel('qr-scan'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <ScanLine size={14} className="text-slate-400 shrink-0" /> Scan QR
                  </button>
                  {tools.length > 0 && materials.length > 0 && (
                    <button type="button" onClick={() => { setActivePanel('wizard'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                      <Wand2 size={14} className="text-slate-400 shrink-0" /> F&amp;S Wizard
                    </button>
                  )}
                  <button type="button" onClick={() => { setActivePanel('snapshots'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <Camera size={14} className="text-slate-400 shrink-0" /> Snapshots
                  </button>
                  <div className="my-1 border-t border-slate-700/60" />
                  <button type="button" onClick={() => { setActivePanel('supplier-invoice'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <Package size={14} className="text-slate-400 shrink-0" /> Supplier Invoice
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Print dropdown ── */}
          {filteredTools.length > 0 && (
            <div className="relative" ref={printRef}>
              <button
                type="button"
                onClick={() => setOpenDropdown((o) => o === 'print' ? null : 'print')}
                title="Print and export output"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors whitespace-nowrap"
              >
                Print
                <ChevronDown size={13} className={`transition-transform ${openDropdown === 'print' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'print' && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 py-1 overflow-hidden">
                  <button type="button" onClick={() => { setActivePanel('setup-sheet'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <FileText size={14} className="text-slate-400 shrink-0" /> Setup Sheet
                  </button>
                  <button type="button" onClick={() => { setActivePanel('sheet-print'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <Printer size={14} className="text-slate-400 shrink-0" /> Tool Sheet
                  </button>
                  <button type="button" onClick={() => { downloadGcodeOffsetSheet(selectedTools.length > 0 ? selectedTools : filteredTools); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <FileText size={14} className="text-slate-400 shrink-0" /> Tool Offsets
                  </button>
                  <button type="button" onClick={() => { setActivePanel('work-offsets'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <MapPin size={14} className="text-slate-400 shrink-0" /> Work Offsets
                  </button>
                  <button type="button" onClick={() => { setActivePanel('label-print'); setOpenDropdown(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left">
                    <QrCode size={14} className="text-slate-400 shrink-0" /> Labels
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowShortcuts((s) => !s)}
            title="Keyboard shortcuts (?)"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors"
          >
            <Keyboard size={14} />
          </button>

          {/* ── Remote sync ── (only shown when a URL is configured) */}
          {settings.remoteDbUrl && (
            <div className="relative" ref={syncDropdownRef}>
              <button
                type="button"
                onClick={() => setSyncDropdown((v) => !v)}
                title="Remote database sync"
                className={[
                  'p-2 rounded-lg border transition-colors',
                  sync.status === 'error'   ? 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25' :
                  sync.status === 'ok'      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25' :
                  sync.status === 'pushing' || sync.status === 'pulling'
                                            ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' :
                                              'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-600',
                ].join(' ')}
              >
                {sync.status === 'pushing' || sync.status === 'pulling'
                  ? <RefreshCw size={14} className="animate-spin" />
                  : sync.status === 'error'
                    ? <CloudOff size={14} />
                    : sync.status === 'ok'
                      ? <CheckCircle2 size={14} />
                      : <Cloud size={14} />
                }
              </button>

              {syncDropdown && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 py-1 overflow-hidden">

                  {/* Username warning */}
                  {!settings.operatorName && (
                    <div className="flex items-start gap-2 px-4 py-2 bg-amber-500/10 border-b border-slate-700">
                      <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300">
                        Set your <strong>Operator name</strong> in Settings so changes are attributed to you.
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {sync.errorMsg && (
                    <div className="px-4 py-2 text-xs text-red-300 bg-red-500/10 border-b border-slate-700">
                      {sync.errorMsg}
                    </div>
                  )}

                  {/* Last sync info */}
                  {(sync.lastSync.pushedAt || sync.lastSync.pulledAt || sync.lastSync.pushedBy) && (
                    <div className="px-4 py-2 space-y-0.5 border-b border-slate-700/60">
                      {sync.lastSync.pushedAt && (
                        <p className="text-xs text-slate-500">
                          Pushed {new Date(sync.lastSync.pushedAt).toLocaleTimeString()}
                          {sync.lastSync.pushedBy ? ` by ${sync.lastSync.pushedBy}` : ''}
                        </p>
                      )}
                      {sync.lastSync.pulledAt && (
                        <p className="text-xs text-slate-500">
                          Pulled {new Date(sync.lastSync.pulledAt).toLocaleTimeString()}
                        </p>
                      )}
                      {sync.lastSync.syncVersion != null && (
                        <p className="text-xs text-slate-600">Version {sync.lastSync.syncVersion}</p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => { sync.push(syncApply); setSyncDropdown(false); }}
                    disabled={sync.status === 'pushing' || sync.status === 'pulling'}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left disabled:opacity-50"
                  >
                    <CloudUpload size={14} className="text-slate-400 shrink-0" />
                    Push to remote
                  </button>
                  <button
                    type="button"
                    onClick={() => { sync.pull(syncApply); setSyncDropdown(false); }}
                    disabled={sync.status === 'pushing' || sync.status === 'pulling'}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left disabled:opacity-50"
                  >
                    <CloudDownload size={14} className="text-slate-400 shrink-0" />
                    Pull from remote
                  </button>
                  <button
                    type="button"
                    onClick={() => { sync.testConn(); setSyncDropdown(false); }}
                    disabled={sync.status === 'pushing' || sync.status === 'pulling'}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left disabled:opacity-50"
                  >
                    <Cloud size={14} className="text-slate-400 shrink-0" />
                    Test connection
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap"
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

          {tools.some((t) => t.checkedOutTo) && (
            <button
              type="button"
              onClick={() => setFilterCheckedOut((f) => !f)}
              title="Show only checked-out tools"
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border',
                filterCheckedOut
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-600 bg-slate-800',
              ].join(' ')}
            >
              <Clock size={13} />
              Checked out
            </button>
          )}

          {/* Condition filter */}
          <div className="relative">
            <select
              value={conditionFilter ?? ''}
              onChange={(e) => setConditionFilter((e.target.value as ToolCondition) || null)}
              title="Filter by condition"
              className={[
                'appearance-none flex items-center gap-1.5 pl-3 pr-7 py-1.5 rounded-lg text-sm transition-colors border cursor-pointer',
                conditionFilter !== null
                  ? 'bg-violet-500/10 text-violet-300 border-violet-500/40'
                  : 'text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-600 bg-slate-800',
              ].join(' ')}
            >
              <option value="">Condition</option>
              {(Object.entries(TOOL_CONDITION_LABELS) as [ToolCondition, string][]).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
          </div>

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

          {/* Display unit toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs ml-auto shrink-0" title="Display unit for geometry columns">
            {(['stored', 'mm', 'inch'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => updateSettings({ tableDisplayUnit: u })}
                className={[
                  'px-2 py-1.5 transition-colors',
                  settings.tableDisplayUnit === u
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700',
                  u !== 'stored' ? 'border-l border-slate-700' : '',
                ].join(' ')}
              >
                {u === 'stored' ? 'as-is' : u}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0">
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
            groups={mergedMachineGroups}
            toolCountByGroup={toolCountByGroup}
            totalCount={tools.length}
            active={machineFilter}
            onSelect={setMachineFilter}
            inventoryValue={inventoryValue ?? undefined}
            lowStockCount={lowStockCount}
            machines={machines}
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
              showMachineCol={machineFilter === null && mergedMachineGroups.length > 0}
              focusedId={focusedId ?? undefined}
              onFocusId={setFocusedId}
              allMaterials={materials}
              displayUnit={settings.tableDisplayUnit !== 'stored' ? settings.tableDisplayUnit : undefined}
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
          allMachineGroups={mergedMachineGroups}
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
          allGroups={mergedMachineGroups}
          allTags={allTags}
          allMaterials={materials}
          onApply={snapAndPatchEach}
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
          onApply={async (updates) => { await snapAndPatchEach(updates); closePanel(); }}
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
      {activePanel === 'cam-snippet' && (() => {
        // Look up control type of first selected tool's first machine group
        const firstGroup = selectedTools[0]?.machineGroups?.[0];
        const camMachine = firstGroup ? machines.find((m) => m.name === firstGroup) : undefined;
        const controlToDialect = (ct: import('../../types/machine').ControlType | undefined): import('../../lib/camSnippet').CamDialect => {
          if (ct === 'haas')    return 'haas';
          if (ct === 'siemens') return 'siemens';
          if (ct === 'linuxcnc') return 'linuxcnc';
          if (ct === 'mach3')   return 'mach3';
          return 'fanuc';
        };
        return (
          <CamSnippetPanel
            tools={selectedTools.length > 0 ? selectedTools : tools}
            defaultDialect={camMachine ? controlToDialect(camMachine.controlType) : undefined}
            onClose={closePanel}
          />
        );
      })()}
      {activePanel === 'snapshots' && (
        <SnapshotPanel onClose={closePanel} />
      )}
      {activePanel === 'work-offsets' && (
        <WorkOffsetSheetPanel machineGroups={mergedMachineGroups} onClose={closePanel} />
      )}
      {activePanel === 'setup-sheet' && (
        <SetupSheetPanel machineGroups={mergedMachineGroups} onClose={closePanel} />
      )}
      {activePanel === 'feeds' && (() => {
        const feedTool = selectedTools.length === 1 ? selectedTools[0] : null;
        const feedGroup = feedTool?.machineGroups?.[0];
        const feedMachine = feedGroup ? machines.find((m) => m.name === feedGroup) : undefined;
        return (
          <SpeedsFeedsPanel
            tool={feedTool}
            allMaterials={materials}
            machine={feedMachine}
            onApply={feedTool ? (patch) => updateTool(feedTool.id, patch) : undefined}
            onClose={closePanel}
          />
        );
      })()}
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
          allGroups={mergedMachineGroups}
          onCopy={async (copies) => {
            for (const c of copies) await addTool(c);
            closePanel();
          }}
          onClose={closePanel}
        />
      )}
      {activePanel === 'templates' && (
        <TemplatePickerPanel
          nextToolNumber={nextToolNumber}
          onStamp={(tool) => { void addTool(tool); openEdit(tool); }}
          onClose={closePanel}
        />
      )}
      {activePanel === 'low-stock' && (
        <LowStockPanel tools={tools} onClose={closePanel} />
      )}
      {activePanel === 'wizard' && (
        <CuttingWizardPanel
          tools={tools}
          allMaterials={materials}
          onApply={(toolId, entry) => {
            const t = tools.find((x) => x.id === toolId);
            if (!t) return;
            const existing = t.toolMaterials ?? [];
            const idx = existing.findIndex((e) => e.materialId === entry.materialId);
            const updated = idx >= 0
              ? existing.map((e, i) => i === idx ? { ...e, ...entry } : e)
              : [...existing, entry];
            updateTool(toolId, { toolMaterials: updated });
          }}
          onClose={closePanel}
        />
      )}
      {activePanel === 'jobs' && (
        <JobsPanel allTools={tools} allMachineGroups={mergedMachineGroups} onClose={closePanel} />
      )}
      {activePanel === 'tool-sets' && (
        <ToolSetPanel onClose={closePanel} />
      )}
      {activePanel === 'supplier-invoice' && (
        <SupplierInvoicePanel onClose={closePanel} />
      )}

      {/* ── Keyboard shortcuts legend ─────────────────────────────────────── */}

      {/* ── Remote sync merge toast ───────────────────────────────────────── */}
      {syncMergeToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl shadow-2xl text-sm text-slate-200">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>
            Merged from remote:{' '}
            {syncMergeToast.addedFromRemote > 0 && <>{syncMergeToast.addedFromRemote} added</>}
            {syncMergeToast.addedFromRemote > 0 && syncMergeToast.updatedFromRemote > 0 && ', '}
            {syncMergeToast.updatedFromRemote > 0 && <>{syncMergeToast.updatedFromRemote} updated</>}
            {syncMergeToast.conflicts > 0 && <span className="text-amber-300 ml-1">({syncMergeToast.conflicts} conflict{syncMergeToast.conflicts !== 1 ? 's' : ''} — remote won)</span>}
          </span>
          <button type="button" onClick={() => setSyncMergeToast(null)} title="Dismiss" className="p-1 rounded text-slate-500 hover:text-slate-200">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Bulk undo toast ───────────────────────────────────────────────── */}
      {lastBulkUndo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl shadow-2xl text-sm text-slate-200 animate-in fade-in slide-in-from-bottom-2">
          <span>Changes applied to {lastBulkUndo.length} tool{lastBulkUndo.length !== 1 ? 's' : ''}.</span>
          <button
            type="button"
            onClick={() => void handleBulkUndo()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <RotateCcw size={12} />
            Undo
          </button>
          <button
            type="button"
            onClick={() => { setLastBulkUndo(null); if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }}
            title="Dismiss"
            className="p-1 rounded text-slate-500 hover:text-slate-200 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {showShortcuts && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowShortcuts(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Keyboard size={14} className="text-slate-400" />
                Keyboard Shortcuts
              </h3>
              <button type="button" onClick={() => setShowShortcuts(false)} title="Close" className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700">
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6 text-xs">
              {/* Navigation */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Navigation</p>
                <div className="space-y-1.5">
                  {([
                    ['j / ↓',    'Move focus down'],
                    ['k / ↑',    'Move focus up'],
                    ['/',        'Focus search'],
                    ['Esc',      'Clear / close panel'],
                  ] as [string, string][]).map(([key, desc]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 font-mono text-slate-300 text-xs whitespace-nowrap">{key}</kbd>
                      <span className="text-slate-400 text-right">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Selection */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Selection</p>
                <div className="space-y-1.5">
                  {([
                    ['Space',   'Toggle selection'],
                    ['Ctrl+A',  'Select all'],
                    ['Ctrl+D',  'Duplicate focused'],
                  ] as [string, string][]).map(([key, desc]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 font-mono text-slate-300 text-xs whitespace-nowrap">{key}</kbd>
                      <span className="text-slate-400 text-right">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Panels */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Panels</p>
                <div className="space-y-1.5">
                  {([
                    ['Enter / e', 'Edit focused tool'],
                    ['Ctrl+I',    'Open import panel'],
                    ['Ctrl+Q',    'Open QR scanner'],
                    ['?',         'Toggle this help'],
                  ] as [string, string][]).map(([key, desc]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 font-mono text-slate-300 text-xs whitespace-nowrap">{key}</kbd>
                      <span className="text-slate-400 text-right">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Editor */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Editor</p>
                <div className="space-y-1.5">
                  {([
                    ['Ctrl+Z',       'Undo'],
                    ['Ctrl+Shift+Z', 'Redo'],
                    ['Ctrl+S',       'Save'],
                    ['Esc',          'Close editor'],
                  ] as [string, string][]).map(([key, desc]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 font-mono text-slate-300 text-xs whitespace-nowrap">{key}</kbd>
                      <span className="text-slate-400 text-right">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
