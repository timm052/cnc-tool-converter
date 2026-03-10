import { useState } from 'react';
import { X, Plus, Trash2, Pencil, Check, Wrench } from 'lucide-react';
import { useHolders } from '../../contexts/HolderContext';
import type { ToolHolder, HolderType } from '../../types/holder';
import { HOLDER_TYPES } from '../../types/holder';

// ── Blank factory ─────────────────────────────────────────────────────────────

function blank(): ToolHolder {
  const now = Date.now();
  return { id: crypto.randomUUID(), name: '', type: 'CAT40', gaugeLength: 0, createdAt: now, updatedAt: now };
}

// ── Edit form ─────────────────────────────────────────────────────────────────

function HolderForm({
  value,
  onSave,
  onCancel,
}: {
  value:    ToolHolder;
  onSave:   (h: ToolHolder) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ToolHolder>({ ...value });
  function p(patch: Partial<ToolHolder>) { setDraft((d) => ({ ...d, ...patch })); }

  const numF = (label: string, key: keyof ToolHolder, unit: string) => (
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
          placeholder="e.g. ER32 Collet Chuck"
          autoFocus
          className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Holder type</label>
        <select
          value={draft.type}
          title="Holder type"
          onChange={(e) => p({ type: e.target.value as HolderType })}
          className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          {HOLDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Gauge length * (mm)</label>
          <input
            type="number"
            min={0}
            title="Gauge length (mm)"
            value={draft.gaugeLength || ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              p({ gaugeLength: isNaN(v) ? 0 : v });
            }}
            className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
          />
        </div>
        {numF('Collet max Ø', 'colletDiameterMax', 'mm')}
        {numF('Collet min Ø', 'colletDiameterMin', 'mm')}
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

export default function HolderLibraryPanel({ onClose }: { onClose: () => void }) {
  const { holders, addHolder, updateHolder, deleteHolder } = useHolders();

  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [isAdding,      setIsAdding]      = useState(false);
  const [newDraft,      setNewDraft]      = useState<ToolHolder>(blank);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleAdd(h: ToolHolder) {
    await addHolder(h);
    setIsAdding(false);
    setNewDraft(blank());
  }

  async function handleUpdate(id: string, h: ToolHolder) {
    await updateHolder(id, h);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    await deleteHolder(id);
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
            <Wrench size={16} className="text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">Holder Library</h2>
            {holders.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-400">{holders.length}</span>
            )}
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">

          {holders.length === 0 && !isAdding && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Wrench size={32} className="text-slate-600" />
              <p className="text-sm text-slate-400">No holders yet.</p>
              <p className="text-xs text-slate-500">Add tool holders to track gauge lengths,<br />collet sizes, and link them to your tools.</p>
            </div>
          )}

          {holders.map((h) => (
            <div key={h.id}>
              {editingId === h.id ? (
                <HolderForm
                  value={h}
                  onSave={(updated) => handleUpdate(h.id, updated)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800/40 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200 truncate">{h.name}</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                        {h.type}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                      <span>GL {h.gaugeLength} mm</span>
                      {h.colletDiameterMax !== undefined && (
                        <span>Collet ≤ {h.colletDiameterMax} mm</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {confirmDelete === h.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(h.id)}
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
                          onClick={() => { setEditingId(h.id); setIsAdding(false); }}
                          title="Edit holder"
                          className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(h.id)}
                          title="Delete holder"
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
            <HolderForm
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
            <Plus size={14} /> Add Holder
          </button>
        </div>
      </div>
    </>
  );
}
