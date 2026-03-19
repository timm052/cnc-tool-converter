import { useState, useMemo } from 'react';
import { Cpu, Plus, X, Trash2, ChevronDown } from 'lucide-react';
import { useMachines } from '../../contexts/MachineContext';
import { useLibrary } from '../../contexts/LibraryContext';
import type { Machine, MachineType, ControlType, SpindleTaper } from '../../types/machine';
import {
  MACHINE_TYPE_LABELS,
  MACHINE_TYPE_COLOURS,
  CONTROL_TYPE_LABELS,
  SPINDLE_TAPER_LABELS,
} from '../../types/machine';

// ── Helpers ────────────────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500';
const LABEL_CLS = 'block text-xs text-slate-400 mb-1';
const SECTION_HDR = 'text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3';

function SectionHeader({ label }: { label: string }) {
  return <p className={SECTION_HDR}>{label}</p>;
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-6">
      <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center">
        <Cpu size={40} className="text-slate-600" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-1">No machines yet</h2>
        <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
          Add your CNC machines to track specs and link them to your tool library.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
      >
        <Plus size={15} />
        Add your first machine
      </button>
    </div>
  );
}

// ── Machine table row ──────────────────────────────────────────────────────────

function MachineRow({
  machine,
  toolCount,
  onClick,
}: {
  machine:   Machine;
  toolCount: number;
  onClick:   () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className="border-b border-slate-700/60 hover:bg-slate-800/60 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <span className="text-blue-300 font-medium text-sm">{machine.name}</span>
        {machine.manufacturer && (
          <span className="ml-1.5 text-xs text-slate-500">{machine.manufacturer}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${MACHINE_TYPE_COLOURS[machine.type]}`}>
          {MACHINE_TYPE_LABELS[machine.type]}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        {machine.controlType ? CONTROL_TYPE_LABELS[machine.controlType] : <span className="text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        {machine.axes}-axis
      </td>
      <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">
        {machine.maxSpindleRpm != null ? machine.maxSpindleRpm.toLocaleString() : <span className="text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        {machine.atcCapacity != null ? `${machine.atcCapacity} pockets` : <span className="text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        {machine.spindleTaper ? SPINDLE_TAPER_LABELS[machine.spindleTaper] : <span className="text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${toolCount > 0 ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-500'}`}>
          {toolCount}
        </span>
      </td>
    </tr>
  );
}

// ── Machine editor slide-over ──────────────────────────────────────────────────

function blankMachine(): Omit<Machine, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name:        '',
    type:        'mill',
    manufacturer: '',
    model:       '',
    serialNumber: '',
    year:        undefined,
    controlType: undefined,
    axes:        3,
    unit:        'mm',
    travelX:     undefined,
    travelY:     undefined,
    travelZ:     undefined,
    travelA:     undefined,
    travelB:     undefined,
    maxSpindleRpm: undefined,
    spindleTaper:  undefined,
    maxFeedRate:   undefined,
    maxRapidRate:  undefined,
    atcCapacity:   undefined,
    maxToolDiameter: undefined,
    maxToolLength:   undefined,
    coolantFlood:        false,
    coolantMist:         false,
    coolantThruSpindle:  false,
    coolantAir:          false,
    notes:       '',
  };
}

interface EditorProps {
  machine:      Machine | null; // null = new
  otherNames:   string[];
  toolCount:    number;
  assignedTools: { toolNumber: number; description: string }[];
  onSave:       (m: Machine) => Promise<void>;
  onDelete:     (id: string) => Promise<void>;
  onClose:      () => void;
}

function MachineEditor({ machine, otherNames, toolCount, assignedTools, onSave, onDelete, onClose }: EditorProps) {
  const isNew = machine === null;

  const [draft, setDraft] = useState<Omit<Machine, 'id' | 'createdAt' | 'updatedAt'>>(
    isNew ? blankMachine() : {
      name:              machine.name,
      type:              machine.type,
      manufacturer:      machine.manufacturer,
      model:             machine.model,
      serialNumber:      machine.serialNumber,
      year:              machine.year,
      controlType:       machine.controlType,
      axes:              machine.axes,
      unit:              machine.unit,
      travelX:           machine.travelX,
      travelY:           machine.travelY,
      travelZ:           machine.travelZ,
      travelA:           machine.travelA,
      travelB:           machine.travelB,
      maxSpindleRpm:     machine.maxSpindleRpm,
      spindleTaper:      machine.spindleTaper,
      maxFeedRate:       machine.maxFeedRate,
      maxRapidRate:      machine.maxRapidRate,
      atcCapacity:       machine.atcCapacity,
      maxToolDiameter:   machine.maxToolDiameter,
      maxToolLength:     machine.maxToolLength,
      coolantFlood:      machine.coolantFlood,
      coolantMist:       machine.coolantMist,
      coolantThruSpindle: machine.coolantThruSpindle,
      coolantAir:        machine.coolantAir,
      notes:             machine.notes,
    },
  );

  const [isSaving,    setIsSaving]    = useState(false);
  const [isDeleting,  setIsDeleting]  = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);

  const set = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const nameError = draft.name.trim() === ''
    ? 'Name is required'
    : otherNames.includes(draft.name.trim())
      ? 'A machine with this name already exists'
      : null;

  async function handleSave() {
    if (nameError) return;
    setIsSaving(true);
    const now = Date.now();
    const m: Machine = {
      ...draft,
      name:      draft.name.trim(),
      id:        isNew ? crypto.randomUUID() : machine!.id,
      createdAt: isNew ? now : machine!.createdAt,
      updatedAt: now,
    };
    await onSave(m);
    setIsSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!machine) return;
    setIsDeleting(true);
    await onDelete(machine.id);
    setIsDeleting(false);
    onClose();
  }

  const numInput = (
    key: keyof typeof draft,
    label: string,
    opts?: { min?: number; max?: number; step?: number; suffix?: string },
  ) => (
    <div>
      <label className={LABEL_CLS}>
        {label}{opts?.suffix ? <span className="text-slate-500"> ({opts.suffix})</span> : ''}
      </label>
      <input
        type="number"
        title={label}
        value={(draft[key] as number | undefined) ?? ''}
        min={opts?.min}
        max={opts?.max}
        step={opts?.step ?? 1}
        onChange={(e) => set(key, e.target.value === '' ? undefined : (Number(e.target.value) as typeof draft[typeof key]))}
        className={INPUT_CLS}
      />
    </div>
  );

  const unitSuffix = draft.unit === 'mm' ? 'mm' : 'in';
  const feedUnit   = draft.unit === 'mm' ? 'mm/min' : 'ipm';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-[calc(100vw-3rem)] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-100 truncate">
            {isNew ? 'New Machine' : draft.name || 'Edit Machine'}
          </h2>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Identity */}
          <div>
            <SectionHeader label="Identity" />
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLS}>Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={draft.name}
                  placeholder="e.g. VF-2, Lathe 1…"
                  onChange={(e) => set('name', e.target.value)}
                  className={`${INPUT_CLS} ${nameError ? 'border-red-500' : ''}`}
                />
                {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
              </div>

              <div>
                <label className={LABEL_CLS}>Type</label>
                <div className="relative">
                  <select
                    value={draft.type}
                    onChange={(e) => set('type', e.target.value as MachineType)}
                    title="Machine type"
                    className={`${INPUT_CLS} appearance-none cursor-pointer pr-7`}
                  >
                    {(Object.entries(MACHINE_TYPE_LABELS) as [MachineType, string][]).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Manufacturer</label>
                  <input type="text" value={draft.manufacturer ?? ''} placeholder="e.g. Haas, Mazak…" onChange={(e) => set('manufacturer', e.target.value || undefined)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Model</label>
                  <input type="text" value={draft.model ?? ''} placeholder="e.g. VF-2SS" onChange={(e) => set('model', e.target.value || undefined)} className={INPUT_CLS} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Serial #</label>
                  <input type="text" value={draft.serialNumber ?? ''} onChange={(e) => set('serialNumber', e.target.value || undefined)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Year</label>
                  <input
                    type="number"
                    title="Year of manufacture"
                    value={draft.year ?? ''}
                    min={1950}
                    max={new Date().getFullYear() + 1}
                    onChange={(e) => set('year', e.target.value === '' ? undefined : Number(e.target.value))}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              {/* Unit toggle */}
              <div>
                <label className={LABEL_CLS}>Unit</label>
                <div className="flex rounded-lg overflow-hidden border border-slate-600 w-fit">
                  {(['mm', 'inch'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => set('unit', u)}
                      className={[
                        'px-4 py-1.5 text-sm font-medium transition-colors',
                        draft.unit === u
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-400 hover:text-slate-200',
                      ].join(' ')}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Control */}
          <div>
            <SectionHeader label="Control" />
            <div>
              <label className={LABEL_CLS}>Control type</label>
              <div className="relative">
                <select
                  value={draft.controlType ?? ''}
                  onChange={(e) => set('controlType', (e.target.value as ControlType) || undefined)}
                  title="CNC control type"
                  className={`${INPUT_CLS} appearance-none cursor-pointer pr-7`}
                >
                  <option value="">— none —</option>
                  {(Object.entries(CONTROL_TYPE_LABELS) as [ControlType, string][]).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Axes & Travel */}
          <div>
            <SectionHeader label="Axes & Travel" />
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLS}>Axes</label>
                <div className="flex gap-2">
                  {[3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set('axes', n)}
                      className={[
                        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                        draft.axes === n
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600',
                      ].join(' ')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {numInput('travelX', `X travel`, { min: 0, step: 1, suffix: unitSuffix })}
                {numInput('travelY', `Y travel`, { min: 0, step: 1, suffix: unitSuffix })}
                {numInput('travelZ', `Z travel`, { min: 0, step: 1, suffix: unitSuffix })}
              </div>
              {draft.axes >= 4 && (
                <div className="grid grid-cols-2 gap-3">
                  {numInput('travelA', 'A travel', { min: 0, step: 1, suffix: '°' })}
                  {draft.axes >= 5 && numInput('travelB', 'B travel', { min: 0, step: 1, suffix: '°' })}
                </div>
              )}
            </div>
          </div>

          {/* Spindle */}
          <div>
            <SectionHeader label="Spindle" />
            <div className="space-y-3">
              {numInput('maxSpindleRpm', 'Max spindle RPM', { min: 0, step: 100 })}
              <div>
                <label className={LABEL_CLS}>Spindle taper</label>
                <div className="relative">
                  <select
                    value={draft.spindleTaper ?? ''}
                    onChange={(e) => set('spindleTaper', (e.target.value as SpindleTaper) || undefined)}
                    title="Spindle taper"
                    className={`${INPUT_CLS} appearance-none cursor-pointer pr-7`}
                  >
                    <option value="">— none —</option>
                    {(Object.entries(SPINDLE_TAPER_LABELS) as [SpindleTaper, string][]).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Feeds */}
          <div>
            <SectionHeader label="Feeds" />
            <div className="grid grid-cols-2 gap-3">
              {numInput('maxFeedRate', `Max feed rate`, { min: 0, step: 100, suffix: feedUnit })}
              {numInput('maxRapidRate', `Max rapid rate`, { min: 0, step: 100, suffix: feedUnit })}
            </div>
          </div>

          {/* Tooling */}
          <div>
            <SectionHeader label="Tooling" />
            <div className="grid grid-cols-3 gap-3">
              {numInput('atcCapacity', 'ATC capacity', { min: 0, step: 1, suffix: 'pockets' })}
              {numInput('maxToolDiameter', 'Max Ø', { min: 0, step: 0.1, suffix: unitSuffix })}
              {numInput('maxToolLength', 'Max length', { min: 0, step: 1, suffix: unitSuffix })}
            </div>
          </div>

          {/* Coolant */}
          <div>
            <SectionHeader label="Coolant" />
            <div className="grid grid-cols-2 gap-2">
              {([
                ['coolantFlood',       'Flood'],
                ['coolantMist',        'Mist'],
                ['coolantThruSpindle', 'Through-spindle'],
                ['coolantAir',         'Air blast'],
              ] as [keyof typeof draft, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!!(draft[key] as boolean)}
                    onChange={(e) => set(key, e.target.checked as typeof draft[typeof key])}
                    className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <SectionHeader label="Notes" />
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || undefined)}
              rows={3}
              placeholder="Any additional notes…"
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {/* Assigned tools (read-only) */}
          <div>
            <SectionHeader label="Assigned tools" />
            {toolCount === 0 ? (
              <p className="text-xs text-slate-500">No tools assigned to this machine group yet.</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">{toolCount}</span> tool{toolCount !== 1 ? 's' : ''} in group "{draft.name || machine?.name}"
                </p>
                <div className="space-y-1">
                  {assignedTools.slice(0, 5).map((t) => (
                    <div key={t.toolNumber} className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-slate-500">T{t.toolNumber}</span>
                      <span className="truncate">{t.description}</span>
                    </div>
                  ))}
                  {toolCount > 5 && (
                    <p className="text-xs text-slate-600">…and {toolCount - 5} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-between gap-3">
          {/* Delete — left side */}
          {!isNew && (
            <div>
              {confirmDel ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDel(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDel(true)}
                  title="Delete machine"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 transition-colors"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
            </div>
          )}
          {isNew && <div />}

          {/* Cancel / Save — right side */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !!nameError}
              className={[
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                !isSaving && !nameError
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MachinesPage() {
  const { machines, isLoading, addMachine, updateMachine, deleteMachine } = useMachines();
  const { tools } = useLibrary();

  const [editorOpen,    setEditorOpen]    = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

  // Tool count per machine group name
  const toolCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tools) {
      for (const g of t.machineGroups ?? []) {
        counts[g] = (counts[g] ?? 0) + 1;
      }
    }
    return counts;
  }, [tools]);

  // Assigned tools per machine name
  const assignedToolsByGroup = useMemo(() => {
    const map: Record<string, { toolNumber: number; description: string }[]> = {};
    for (const t of tools) {
      for (const g of t.machineGroups ?? []) {
        if (!map[g]) map[g] = [];
        map[g].push({ toolNumber: t.toolNumber, description: t.description });
      }
    }
    return map;
  }, [tools]);

  function openNew() {
    setEditingMachine(null);
    setEditorOpen(true);
  }

  function openEdit(m: Machine) {
    setEditingMachine(m);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingMachine(null);
  }

  async function handleSave(m: Machine) {
    if (machines.some((x) => x.id === m.id)) {
      await updateMachine(m.id, m);
    } else {
      await addMachine(m);
    }
  }

  // Names of all machines except the currently edited one (for duplicate check)
  const otherNames = useMemo(
    () => machines
      .filter((m) => m.id !== editingMachine?.id)
      .map((m) => m.name),
    [machines, editingMachine],
  );

  const editorToolCount = editingMachine
    ? (toolCountByGroup[editingMachine.name] ?? 0)
    : 0;

  const editorAssignedTools = editingMachine
    ? (assignedToolsByGroup[editingMachine.name] ?? [])
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-slate-400">
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        Loading machines…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900">

      {/* Top bar */}
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Cpu size={18} className="text-slate-400" />
          <h1 className="text-lg font-semibold text-slate-100">Machines</h1>
          {machines.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
              {machines.length}
            </span>
          )}
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          <Plus size={14} />
          New Machine
        </button>
      </div>

      {/* Body */}
      {machines.length === 0 ? (
        <EmptyState onAdd={openNew} />
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 z-10">
              <tr>
                {[
                  'Name', 'Type', 'Control', 'Axes', 'Max RPM', 'ATC', 'Taper', 'Tools',
                ].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <MachineRow
                  key={m.id}
                  machine={m}
                  toolCount={toolCountByGroup[m.name] ?? 0}
                  onClick={() => openEdit(m)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over editor */}
      {editorOpen && (
        <MachineEditor
          machine={editingMachine}
          otherNames={otherNames}
          toolCount={editorToolCount}
          assignedTools={editorAssignedTools}
          onSave={handleSave}
          onDelete={deleteMachine}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
