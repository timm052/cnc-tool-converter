import { useState, useEffect, useCallback } from 'react';
import { X, Camera, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import type { LibrarySnapshot } from '../../types/snapshot';

interface SnapshotPanelProps {
  onClose: () => void;
}

export default function SnapshotPanel({ onClose }: SnapshotPanelProps) {
  const { saveSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot } = useLibrary();
  const [snapshots,   setSnapshots]   = useState<LibrarySnapshot[]>([]);
  const [label,       setLabel]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [restoring,   setRestoring]   = useState(false);

  const reload = useCallback(() => listSnapshots().then(setSnapshots), [listSnapshots]);

  useEffect(() => { reload(); }, [reload]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveSnapshot(label.trim() || undefined);
      setLabel('');
      await reload();
    } finally { setSaving(false); }
  }

  async function handleRestore(id: string) {
    setRestoring(true);
    try {
      await restoreSnapshot(id);
      onClose();
    } finally { setRestoring(false); }
  }

  async function handleDelete(id: string) {
    await deleteSnapshot(id);
    setConfirmId(null);
    await reload();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[440px] max-w-[calc(100vw-3rem)] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-100">Library Snapshots</h2>
            {snapshots.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-400">
                {snapshots.length}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Save new snapshot */}
        <div className="px-5 py-3 border-b border-slate-700 shrink-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Save snapshot</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              placeholder="Label (optional)"
              className="flex-1 px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
            >
              <Camera size={14} />
              {saving ? 'Saving…' : 'Save now'}
            </button>
          </div>
          <p className="text-xs text-slate-500">Stores up to 10 snapshots. Oldest is deleted automatically.</p>
        </div>

        {/* Snapshot list */}
        <div className="flex-1 overflow-auto">
          {snapshots.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
              No snapshots yet — save one above.
            </div>
          ) : (
            <div className="divide-y divide-slate-700/60">
              {snapshots.map((snap) => {
                const date    = new Date(snap.createdAt);
                const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                const isConfirming = confirmId === snap.id;

                return (
                  <div key={snap.id} className="px-5 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{snap.label}</p>
                        <p className="text-xs text-slate-500">{dateStr} {timeStr} · {snap.toolCount} tool{snap.toolCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmId(isConfirming ? null : snap.id)}
                          title="Delete snapshot"
                          className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(`restore-${snap.id}`)}
                          title="Restore this snapshot"
                          disabled={restoring}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw size={12} />
                          Restore
                        </button>
                      </div>
                    </div>

                    {/* Delete confirmation */}
                    {isConfirming && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs">
                        <AlertTriangle size={12} className="text-red-400 shrink-0" />
                        <span className="text-red-300 flex-1">Delete this snapshot?</span>
                        <button type="button" onClick={() => setConfirmId(null)} className="px-2 py-1 rounded text-slate-400 hover:text-slate-200">Cancel</button>
                        <button type="button" onClick={() => handleDelete(snap.id)} className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-500">Delete</button>
                      </div>
                    )}

                    {/* Restore confirmation */}
                    {confirmId === `restore-${snap.id}` && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                        <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                        <span className="text-amber-300 flex-1">This will replace your current library. Continue?</span>
                        <button type="button" onClick={() => setConfirmId(null)} className="px-2 py-1 rounded text-slate-400 hover:text-slate-200">Cancel</button>
                        <button type="button" onClick={() => handleRestore(snap.id)} className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-500">
                          {restoring ? 'Restoring…' : 'Restore'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
