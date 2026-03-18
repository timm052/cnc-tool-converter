import { useState, useEffect, useCallback } from 'react';
import { X, Download, Plus, Trash2, MapPin } from 'lucide-react';
import {
  DIALECTS, getDialect, defaultEntries,
  renderOffsetSheet, renderOffsetCsv,
  loadStoredEntries, saveStoredEntries,
} from '../../lib/workOffsetSheet';
import type { WcsDialect, WcsEntry } from '../../lib/workOffsetSheet';
import { triggerDownload } from '../../lib/downloadUtils';

interface WorkOffsetSheetPanelProps {
  machineGroups: string[];
  onClose:       () => void;
}

export default function WorkOffsetSheetPanel({ machineGroups, onClose }: WorkOffsetSheetPanelProps) {
  const [dialectId,   setDialectId]   = useState<WcsDialect>('fanuc');
  const [machineName, setMachineName] = useState('');
  const [entries,     setEntries]     = useState<WcsEntry[]>([]);

  const dialect = getDialect(dialectId);

  // Load persisted entries when dialect changes
  useEffect(() => {
    const stored = loadStoredEntries(dialectId);
    setEntries(defaultEntries(dialect, stored));
  }, [dialectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist whenever entries change
  useEffect(() => {
    saveStoredEntries(dialectId, entries);
  }, [dialectId, entries]);

  const updateEntry = useCallback((idx: number, patch: Partial<WcsEntry>) => {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  }, []);

  const addSlot = useCallback(() => {
    // Pick the next slot from the dialect definition that isn't already in entries
    const usedCodes = new Set(entries.map((e) => e.slotCode));
    const next = dialect.slots.find((s) => !usedCodes.has(s.code));
    if (!next) return;
    setEntries((prev) => [...prev, { slotCode: next.code, name: '', x: '', y: '', z: '', a: '', b: '' }]);
  }, [entries, dialect]);

  const removeEntry = useCallback((idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const changeSlotCode = useCallback((idx: number, code: string) => {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, slotCode: code } : e));
  }, []);

  function handleDownload(format: 'txt' | 'csv') {
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'txt') {
      const content = renderOffsetSheet(entries, dialect, machineName);
      triggerDownload(content, 'text/plain', `work-offsets-${date}.txt`);
    } else {
      const content = renderOffsetCsv(entries);
      triggerDownload(content, 'text/csv', `work-offsets-${date}.csv`);
    }
  }

  // All slot codes for this dialect (for the dropdown)
  const usedCodes = new Set(entries.map((e) => e.slotCode));
  const availableSlots = dialect.slots.filter((s) => !usedCodes.has(s.code));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[560px] max-w-[calc(100vw-3rem)] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-100">Work Offset Sheet</h2>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Config strip */}
        <div className="px-5 py-3 border-b border-slate-700 shrink-0 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Control dialect</label>
              <select
                title="Control dialect"
                value={dialectId}
                onChange={(e) => setDialectId(e.target.value as WcsDialect)}
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DIALECTS.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Machine name</label>
              <input
                type="text"
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                placeholder="e.g. VMC-01"
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Enter X/Y/Z offsets for each work coordinate system. Values are saved per dialect. Download as a reference card to hang on the machine.
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
                <th className="w-8" />
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
                    {machineGroups.length > 0 ? (
                      <input
                        list={`mg-list-${idx}`}
                        type="text"
                        value={entry.name}
                        onChange={(e) => updateEntry(idx, { name: e.target.value })}
                        placeholder="Fixture / setup name"
                        className="w-full px-1.5 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                      />
                    ) : (
                      <input
                        type="text"
                        value={entry.name}
                        onChange={(e) => updateEntry(idx, { name: e.target.value })}
                        placeholder="Fixture / setup name"
                        className="w-full px-1.5 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                      />
                    )}
                    {machineGroups.length > 0 && (
                      <datalist id={`mg-list-${idx}`}>
                        {machineGroups.map((g) => <option key={g} value={g} />)}
                      </datalist>
                    )}
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
              onClick={() => handleDownload('csv')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 transition-colors"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              type="button"
              onClick={() => handleDownload('txt')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <Download size={14} />
              Download .txt
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
