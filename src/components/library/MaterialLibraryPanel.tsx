import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Pencil, Check, FlaskConical, Search } from 'lucide-react';
import { useMaterials } from '../../contexts/MaterialContext';
import type { WorkMaterial, MaterialCategory } from '../../types/material';
import {
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_CATEGORY_COLOURS,
} from '../../types/material';

// ── Blank factory ─────────────────────────────────────────────────────────────

function blank(): WorkMaterial {
  const now = Date.now();
  return {
    id: crypto.randomUUID(), name: '', category: 'other',
    createdAt: now, updatedAt: now,
  };
}

// ── Edit form ─────────────────────────────────────────────────────────────────

function MaterialForm({
  value,
  onSave,
  onCancel,
}: {
  value:    WorkMaterial;
  onSave:   (m: WorkMaterial) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<WorkMaterial>({ ...value });

  function p(patch: Partial<WorkMaterial>) { setDraft((d) => ({ ...d, ...patch })); }

  const numF = (
    label: string,
    key: keyof WorkMaterial,
    unit: string,
  ) => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label} ({unit})</label>
      <input
        type="number"
        min={0}
        title={`${label} (${unit})`}
        value={(draft[key] as number | undefined) ?? ''}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          p({ [key]: isNaN(v) ? undefined : v });
        }}
        className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
      />
    </div>
  );

  return (
    <div className="space-y-3 p-4 bg-slate-800/60 rounded-xl border border-slate-700">
      {/* Name */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Name *</label>
        <input
          type="text"
          value={draft.name}
          title="Name"
          onChange={(e) => p({ name: e.target.value })}
          placeholder="e.g. 6061-T6 Aluminum"
          autoFocus
          className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Category</label>
        <select
          value={draft.category}
          title="Category"
          onChange={(e) => p({ category: e.target.value as MaterialCategory })}
          className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          {MATERIAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{MATERIAL_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Hardness + Machinability */}
      <div className="grid grid-cols-2 gap-3">
        {numF('Hardness', 'hardness', 'HRC')}
        {numF('Machinability', 'machinability', '0–100')}
      </div>

      {/* Surface speed */}
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider pt-1">Surface speed</p>
      <div className="grid grid-cols-2 gap-3">
        {numF('SFM min', 'sfmMin', 'ft/min')}
        {numF('SFM max', 'sfmMax', 'ft/min')}
        {numF('Vc min',  'vcMin',  'm/min')}
        {numF('Vc max',  'vcMax',  'm/min')}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Notes</label>
        <textarea
          value={draft.notes ?? ''}
          title="Notes"
          onChange={(e) => p({ notes: e.target.value || undefined })}
          rows={2}
          className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => { if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim() }); }}
          disabled={!draft.name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
        >
          <Check size={12} /> Save
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function MaterialLibraryPanel({ onClose }: { onClose: () => void }) {
  const { materials, isLoading, addMaterial, updateMaterial, deleteMaterial } = useMaterials();

  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [isAdding,      setIsAdding]      = useState(false);
  const [newDraft,      setNewDraft]      = useState<WorkMaterial>(blank);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search,        setSearch]        = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.notes?.toLowerCase().includes(q)
    );
  }, [materials, search]);

  async function handleAdd(m: WorkMaterial) {
    await addMaterial(m);
    setIsAdding(false);
    setNewDraft(blank());
  }

  async function handleUpdate(id: string, m: WorkMaterial) {
    await updateMaterial(id, m);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    await deleteMaterial(id);
    setConfirmDelete(null);
  }

  function startAdd() {
    setIsAdding(true);
    setEditingId(null);
    setNewDraft(blank());
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">Material Library</h2>
            {materials.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-400">{materials.length}</span>
            )}
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        {materials.length > 0 && (
          <div className="px-4 py-2 border-b border-slate-700 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search materials…"
                aria-label="Search materials"
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">

          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <span className="text-sm text-slate-500">Loading…</span>
            </div>
          )}

          {!isLoading && materials.length === 0 && !isAdding && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <FlaskConical size={32} className="text-slate-600" />
              <p className="text-sm text-slate-400">No materials yet.</p>
              <p className="text-xs text-slate-500">Add workpiece materials to track surface speeds,<br />hardness, and machinability for your jobs.</p>
            </div>
          )}

          {!isLoading && filtered.length === 0 && materials.length > 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No materials match "{search}"</p>
          )}

          {filtered.map((m) => (
            <div key={m.id}>
              {editingId === m.id ? (
                <MaterialForm
                  value={m}
                  onSave={(updated) => handleUpdate(m.id, updated)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800/40 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200 truncate">{m.name}</span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${MATERIAL_CATEGORY_COLOURS[m.category]}`}>
                        {MATERIAL_CATEGORY_LABELS[m.category]}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                      {m.hardness    !== undefined && <span>{m.hardness} HRC</span>}
                      {m.machinability !== undefined && <span>Machin. {m.machinability}</span>}
                      {(m.sfmMin !== undefined || m.sfmMax !== undefined) && (
                        <span>SFM {m.sfmMin ?? '?'}–{m.sfmMax ?? '?'}</span>
                      )}
                      {(m.vcMin !== undefined || m.vcMax !== undefined) && (
                        <span>Vc {m.vcMin ?? '?'}–{m.vcMax ?? '?'} m/min</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {confirmDelete === m.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-500 text-white"
                        >Delete</button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                        >Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(m.id); setIsAdding(false); }}
                          title="Edit material"
                          className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(m.id)}
                          title="Delete material"
                          className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isAdding && (
            <MaterialForm
              value={newDraft}
              onSave={handleAdd}
              onCancel={() => setIsAdding(false)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 shrink-0">
          <button
            onClick={startAdd}
            disabled={isAdding}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
          >
            <Plus size={14} /> Add Material
          </button>
        </div>
      </div>
    </>
  );
}
