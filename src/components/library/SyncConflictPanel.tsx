import { X, GitMerge, Check } from 'lucide-react';
import type { ConflictRecord, ConflictKind } from '../../lib/remoteSync';

const KIND_LABELS: Record<ConflictKind, string> = {
  tool:    'Tool',
  material:'Material',
  holder:  'Holder',
  toolSet: 'Tool Set',
  job:     'Job',
};

const SKIP_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'sourceData']);

/** Shallow diff of top-level fields that differ between two records. */
function diffFields(local: unknown, remote: unknown): { field: string; local: string; remote: string }[] {
  if (typeof local !== 'object' || local === null || typeof remote !== 'object' || remote === null) return [];
  const a = local as Record<string, unknown>;
  const b = remote as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs: { field: string; local: string; remote: string }[] = [];
  for (const key of keys) {
    if (SKIP_FIELDS.has(key)) continue;
    const av = a[key];
    const bv = b[key];
    if (JSON.stringify(av) === JSON.stringify(bv)) continue;
    diffs.push({
      field:  key,
      local:  av === undefined ? '—' : JSON.stringify(av),
      remote: bv === undefined ? '—' : JSON.stringify(bv),
    });
  }
  return diffs;
}

interface Props {
  conflicts: ConflictRecord[];
  onResolve: (record: ConflictRecord) => void;
  onClose: () => void;
}

export default function SyncConflictPanel({ conflicts, onResolve, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <GitMerge size={16} className="text-amber-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Sync Conflicts ({conflicts.length})
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-slate-500">
            These records were edited both locally and remotely since the last sync.
            The remote version was kept automatically — review below and choose
            "Keep Local" to restore your local edits (they'll win on the next sync).
          </p>

          {conflicts.map((c) => {
            const diffs = diffFields(c.local, c.remote);
            return (
              <div key={`${c.kind}-${c.id}`} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mr-2">
                      {KIND_LABELS[c.kind]}
                    </span>
                    <span className="text-sm font-medium text-slate-200 truncate">{c.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onResolve(c)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/30 transition-colors shrink-0"
                  >
                    <Check size={12} />
                    Keep Local
                  </button>
                </div>
                {diffs.length > 0 && (
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-800">
                      {diffs.map((d) => (
                        <tr key={d.field}>
                          <td className="py-1 pr-2 text-slate-500 align-top whitespace-nowrap">{d.field}</td>
                          <td className="py-1 pr-2 text-slate-400 align-top break-all">{d.local}</td>
                          <td className="py-1 text-emerald-400 align-top break-all">{d.remote}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
