/**
 * ToolSetPanel — slide-over for creating and managing named tool sets / kits.
 *
 * A tool set is a named, persistent grouping of tools (e.g. "Fixture drilling kit",
 * "Aluminium roughing set"). Unlike Jobs (which are per-job BOMs), sets represent
 * reusable standard groups kept across all work.
 */
import { useState, useMemo, useCallback } from 'react';
import { X, Layers, Plus, Trash2, Pencil, Check, Download, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import type { ToolSet } from '../../types/toolSet';
import {
  loadSets, saveSets, createSet, updateSet, deleteSet,
} from '../../lib/toolSetStore';
import { triggerDownload } from '../../lib/downloadUtils';

interface ToolSetPanelProps {
  onClose: () => void;
}

export default function ToolSetPanel({ onClose }: ToolSetPanelProps) {
  const { tools } = useLibrary();

  const [sets,     setSets]     = useState<ToolSet[]>(() => loadSets());
  const [editId,   setEditId]   = useState<string | null>(null);   // which set is expanded/editing
  const [newName,  setNewName]  = useState('');
  const [newDesc,  setNewDesc]  = useState('');
  const [creating, setCreating] = useState(false);

  // Inside editor state
  const [editName,    setEditName]    = useState('');
  const [editDesc,    setEditDesc]    = useState('');
  const [toolSearch,  setToolSearch]  = useState('');
  const [editingName, setEditingName] = useState(false);

  const persist = useCallback((next: ToolSet[]) => {
    setSets(next);
    saveSets(next);
  }, []);

  // ── Create ──────────────────────────────────────────────────────────────────
  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const s = createSet(name, newDesc.trim() || undefined);
    persist([...sets, s]);
    setNewName('');
    setNewDesc('');
    setCreating(false);
    openSet(s);
  }

  // ── Open / close ─────────────────────────────────────────────────────────────
  function openSet(s: ToolSet) {
    setEditId(s.id);
    setEditName(s.name);
    setEditDesc(s.description ?? '');
    setToolSearch('');
    setEditingName(false);
  }

  function closeSet() {
    setEditId(null);
  }

  // ── Rename ───────────────────────────────────────────────────────────────────
  function commitRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    persist(updateSet(sets, id, { name, description: editDesc.trim() || undefined }));
    setEditingName(false);
  }

  // ── Toggle tool in set ───────────────────────────────────────────────────────
  function toggleTool(setId: string, toolId: string) {
    const s = sets.find((x) => x.id === setId);
    if (!s) return;
    const next = s.toolIds.includes(toolId)
      ? s.toolIds.filter((id) => id !== toolId)
      : [...s.toolIds, toolId];
    persist(updateSet(sets, setId, { toolIds: next }));
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  function handleDelete(id: string) {
    persist(deleteSet(sets, id));
    if (editId === id) closeSet();
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  function handleExport(s: ToolSet) {
    const setTools = tools.filter((t) => s.toolIds.includes(t.id));
    const rows = ['T#,Type,Description,Diameter,OAL,Z-Offset'];
    for (const t of setTools) {
      rows.push([
        t.toolNumber,
        `"${t.type}"`,
        `"${t.description.replace(/"/g, '""')}"`,
        t.geometry.diameter ?? '',
        t.geometry.overallLength ?? '',
        t.offsets?.z ?? '',
      ].join(','));
    }
    const safe = s.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    triggerDownload(rows.join('\n'), `tool-set-${safe}.csv`, 'text/csv');
  }

  // ── Filtered tools for picker ────────────────────────────────────────────────
  const activeSet = useMemo(() => sets.find((s) => s.id === editId), [sets, editId]);

  const filteredTools = useMemo(() => {
    const q = toolSearch.toLowerCase();
    return tools.filter((t) =>
      !q ||
      t.description.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      String(t.toolNumber).includes(q),
    );
  }, [tools, toolSearch]);

  const inputCls = 'w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-96 bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-100">Tool Sets</h2>
            {sets.length > 0 && (
              <span className="text-xs text-slate-500">{sets.length}</span>
            )}
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Set list ──────────────────────────────────────────────────── */}
          <div className="p-3 space-y-1">
            {sets.length === 0 && !creating && (
              <p className="text-sm text-slate-500 text-center py-8">
                No tool sets yet. Create one to group related tools.
              </p>
            )}

            {sets.map((s) => {
              const isOpen = editId === s.id;
              const setToolObjs = tools.filter((t) => s.toolIds.includes(t.id));

              return (
                <div key={s.id} className={`rounded-xl border transition-colors ${isOpen ? 'bg-slate-700/60 border-slate-600' : 'bg-slate-700/30 border-slate-700/60 hover:border-slate-600'}`}>
                  {/* Row header */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => isOpen ? closeSet() : openSet(s)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      {isOpen ? <ChevronDown size={13} className="text-slate-400 shrink-0" /> : <ChevronRight size={13} className="text-slate-400 shrink-0" />}
                      <span className="text-sm font-medium text-slate-200 truncate">{s.name}</span>
                      <span className="text-xs text-slate-500 shrink-0">{s.toolIds.length} tools</span>
                    </button>
                    <button type="button" onClick={() => handleExport(s)} title="Export as CSV" className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-600 transition-colors">
                      <Download size={13} />
                    </button>
                    <button type="button" onClick={() => handleDelete(s.id)} title="Delete set" className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-600 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Expanded editor */}
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-3 border-t border-slate-600/60 pt-3">
                      {/* Name / description edit */}
                      {editingName ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setEditingName(false); }}
                            placeholder="Set name"
                            className={inputCls}
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Description (optional)"
                            className={inputCls}
                          />
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setEditingName(false)} className="px-3 py-1 rounded text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-600 transition-colors">Cancel</button>
                            <button type="button" onClick={() => commitRename(s.id)} className="px-3 py-1 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1">
                              <Check size={12} /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            {s.description && (
                              <p className="text-xs text-slate-400 truncate">{s.description}</p>
                            )}
                          </div>
                          <button type="button" onClick={() => setEditingName(true)} title="Rename" className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-600 transition-colors shrink-0">
                            <Pencil size={12} />
                          </button>
                        </div>
                      )}

                      {/* Included tools count */}
                      {setToolObjs.length > 0 && (
                        <div className="text-xs text-slate-400">
                          {setToolObjs.slice(0, 5).map((t) => `T${t.toolNumber} ${t.description}`).join(', ')}
                          {setToolObjs.length > 5 && ` +${setToolObjs.length - 5} more`}
                        </div>
                      )}

                      {/* Tool picker */}
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Add / Remove Tools</p>
                        <div className="relative mb-2">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            value={toolSearch}
                            onChange={(e) => setToolSearch(e.target.value)}
                            placeholder="Search tools…"
                            className="w-full pl-7 pr-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-lg border border-slate-700 bg-slate-900/40">
                          {filteredTools.length === 0 ? (
                            <p className="text-xs text-slate-500 p-2">No tools found.</p>
                          ) : filteredTools.map((t) => {
                            const checked = activeSet?.toolIds.includes(t.id) ?? false;
                            return (
                              <label
                                key={t.id}
                                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-700/60 transition-colors ${checked ? 'bg-blue-600/10' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleTool(s.id, t.id)}
                                  className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500 cursor-pointer shrink-0"
                                />
                                <span className="text-xs text-slate-400 font-mono shrink-0 w-8">T{t.toolNumber}</span>
                                <span className="text-xs text-slate-200 truncate">{t.description}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Create form ─────────────────────────────────────────────── */}
            {creating ? (
              <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-3 space-y-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                  placeholder="Set name (e.g. Fixture drilling kit)"
                  className={inputCls}
                  autoFocus
                />
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className={inputCls}
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setCreating(false)} className="px-3 py-1 rounded text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-600 transition-colors">Cancel</button>
                  <button type="button" onClick={handleCreate} disabled={!newName.trim()} className="px-3 py-1 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 flex items-center gap-1">
                    <Check size={12} /> Create
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-600 text-sm text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors"
              >
                <Plus size={14} /> New Tool Set
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
