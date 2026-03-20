import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Download, FileText, Plus, Trash2, MapPin } from 'lucide-react';
import {
  DIALECTS, getDialect, defaultEntries,
  renderOffsetPdf, renderOffsetCsv,
  loadMachineRecord, saveMachineRecord,
  DEFAULT_MACHINE_KEY,
} from '../../lib/workOffsetSheet';
import type { WcsDialect, WcsEntry } from '../../lib/workOffsetSheet';
import { triggerDownload } from '../../lib/downloadUtils';

interface WorkOffsetSheetPanelProps {
  machineGroups: string[];
  onClose:       () => void;
}

export default function WorkOffsetSheetPanel({ machineGroups, onClose }: WorkOffsetSheetPanelProps) {
  const [machineKey, setMachineKey] = useState<string>(
    machineGroups[0] ?? DEFAULT_MACHINE_KEY,
  );
  const [dialectId, setDialectId] = useState<WcsDialect>('fanuc');
  const [entries,   setEntries]   = useState<WcsEntry[]>([]);
  const [isBusy,    setIsBusy]    = useState(false);
  // True only after a user action (not after the initial load from localStorage).
  // Prevents the save effect from overwriting localStorage with empty state before
  // the load effect can populate entries (a React StrictMode double-fire issue).
  const userModifiedRef = useRef(false);

  const dialect = getDialect(dialectId);

  // Load this machine's record whenever the selected machine changes
  useEffect(() => {
    userModifiedRef.current = false; // reset: next save will be skipped until user edits
    const rec = loadMachineRecord(machineKey);
    const loadedDialect: WcsDialect = rec?.dialect ?? 'fanuc';
    setDialectId(loadedDialect);
    setEntries(defaultEntries(getDialect(loadedDialect), rec?.entries));
  }, [machineKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist whenever entries or dialect change — but only after a user-initiated change
  useEffect(() => {
    if (!userModifiedRef.current) return;
    saveMachineRecord(machineKey, { dialect: dialectId, entries });
  }, [machineKey, dialectId, entries]);

  // When the user manually changes the dialect, reset entries to defaults for new dialect
  const handleDialectChange = useCallback((id: WcsDialect) => {
    userModifiedRef.current = true;
    setDialectId(id);
    setEntries(defaultEntries(getDialect(id)));
  }, []);

  const updateEntry = useCallback((idx: number, patch: Partial<WcsEntry>) => {
    userModifiedRef.current = true;
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  }, []);

  const addSlot = useCallback(() => {
    const usedCodes = new Set(entries.map((e) => e.slotCode));
    const next = dialect.slots.find((s) => !usedCodes.has(s.code));
    if (!next) return;
    userModifiedRef.current = true;
    setEntries((prev) => [...prev, { slotCode: next.code, name: '', x: '', y: '', z: '', a: '', b: '' }]);
  }, [entries, dialect]);

  const removeEntry = useCallback((idx: number) => {
    userModifiedRef.current = true;
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const changeSlotCode = useCallback((idx: number, code: string) => {
    userModifiedRef.current = true;
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, slotCode: code } : e));
  }, []);

  async function handleDownload(format: 'pdf' | 'csv') {
    setIsBusy(true);
    try {
      const displayName = machineKey === DEFAULT_MACHINE_KEY ? '' : machineKey;
      const date = new Date().toISOString().slice(0, 10);
      if (format === 'pdf') {
        await renderOffsetPdf(entries, dialect, displayName);
      } else {
        await triggerDownload(renderOffsetCsv(entries), 'text/csv', `work-offsets-${date}.csv`);
      }
    } finally {
      setIsBusy(false);
    }
  }

  const usedCodes     = new Set(entries.map((e) => e.slotCode));
  const availableSlots = dialect.slots.filter((s) => !usedCodes.has(s.code));
  const displayMachine = machineKey === DEFAULT_MACHINE_KEY ? 'Default' : machineKey;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[560px] max-w-[calc(100vw-3rem)] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-100">Work Offset Sheet</h2>
            <span className="ml-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
              {displayMachine}
            </span>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Config strip */}
        <div className="px-5 py-3 border-b border-slate-700 shrink-0 space-y-3">
          <div className="flex gap-3">
            {/* Machine selector */}
            <div className="flex-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Machine</label>
              <select
                title="Machine"
                value={machineKey}
                onChange={(e) => setMachineKey(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {machineGroups.length === 0 && (
                  <option value={DEFAULT_MACHINE_KEY}>Default</option>
                )}
                {machineGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
                {machineGroups.length > 0 && (
                  <option value={DEFAULT_MACHINE_KEY}>Default (no group)</option>
                )}
              </select>
            </div>
            {/* Dialect selector */}
            <div className="flex-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Control dialect</label>
              <select
                title="Control dialect"
                value={dialectId}
                onChange={(e) => handleDialectChange(e.target.value as WcsDialect)}
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DIALECTS.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Offsets are saved per machine. Switch machines to manage separate offset sets. Download as a PDF card to hang near the machine.
          </p>
        </div>

        {/* Entries table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-900 z-10">
              <tr className="text-xs font-medium uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2 text-left w-32">Offset</th>
                <th className="px-3 py-2 text-left">Label / Fixture</th>
                <th className="px-2 py-2 text-right w-24">X</th>
                <th className="px-2 py-2 text-right w-24">Y</th>
                <th className="px-2 py-2 text-right w-24">Z</th>
                <th className="px-2 py-2 text-right w-16">A</th>
                <th className="px-2 py-2 text-right w-16">B</th>
                <th className="w-8" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {entries.map((entry, idx) => (
                <tr key={`${entry.slotCode}-${idx}`} className="group hover:bg-slate-700/30">
                  {/* Offset code selector */}
                  <td className="px-3 py-1.5">
                    <select
                      title="Offset code"
                      value={entry.slotCode}
                      onChange={(e) => changeSlotCode(idx, e.target.value)}
                      className="w-full px-1.5 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-blue-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value={entry.slotCode}>{entry.slotCode}</option>
                      {availableSlots.map((s) => (
                        <option key={s.code} value={s.code}>{s.code}</option>
                      ))}
                    </select>
                  </td>
                  {/* Name / machine group */}
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(e) => updateEntry(idx, { name: e.target.value })}
                      placeholder="Fixture / setup name"
                      className="w-full px-1.5 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                    />
                  </td>
                  {/* X Y Z A B */}
                  {(['x', 'y', 'z', 'a', 'b'] as const).map((axis) => (
                    <td key={axis} className="px-2 py-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={entry[axis]}
                        onChange={(e) => updateEntry(idx, { [axis]: e.target.value })}
                        placeholder="0.000"
                        className="w-full px-1.5 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-right text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
                      />
                    </td>
                  ))}
                  {/* Remove */}
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeEntry(idx)}
                      title="Remove row"
                      className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {entries.length === 0 && (
            <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
              No offset slots — click Add slot below.
            </div>
          )}
        </div>

        {/* Add slot / footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 space-y-3">
          {availableSlots.length > 0 && (
            <button
              type="button"
              onClick={addSlot}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Plus size={13} />
              Add slot ({availableSlots[0].code}{availableSlots.length > 1 ? ` … ${availableSlots[availableSlots.length - 1].code}` : ''})
            </button>
          )}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDownload('csv')}
              disabled={isBusy}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors',
                !isBusy ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200' : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              <Download size={14} />
              CSV
            </button>
            <button
              type="button"
              onClick={() => void handleDownload('pdf')}
              disabled={isBusy}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                !isBusy ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              <FileText size={14} />
              {isBusy ? 'Generating…' : 'PDF Card'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
