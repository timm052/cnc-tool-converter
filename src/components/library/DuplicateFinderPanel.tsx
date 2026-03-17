import { useState, useMemo, useEffect } from 'react';
import { X, Copy, Trash2, ChevronDown, ChevronRight, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import { useSettings } from '../../contexts/SettingsContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type MatchCriteria = 'type+diameter' | 'type+diameter+flutes' | 'diameter';

interface DuplicateGroup {
  key:   string;
  label: string;
  tools: LibraryTool[];
}

interface DuplicateFinderPanelProps {
  tools:    LibraryTool[];
  onDelete: (ids: string[]) => Promise<void>;
  onClose:  () => void;
}

// ── Grouping logic ────────────────────────────────────────────────────────────

function buildGroups(tools: LibraryTool[], criteria: MatchCriteria): DuplicateGroup[] {
  const map = new Map<string, LibraryTool[]>();

  for (const tool of tools) {
    const dia = tool.geometry.diameter.toFixed(3);
    let key: string;
    switch (criteria) {
      case 'type+diameter':
        key = `${tool.type}|${dia}`;
        break;
      case 'type+diameter+flutes':
        key = `${tool.type}|${dia}|${tool.geometry.numberOfFlutes ?? '—'}fl`;
        break;
      case 'diameter':
        key = dia;
        break;
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tool);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, members] of map) {
    if (members.length < 2) continue;
    // Sort by tool number so the lowest T# appears first (treated as "keep")
    const sorted = [...members].sort((a, b) => a.toolNumber - b.toolNumber);
    const dia = sorted[0].geometry.diameter;

    let label: string;
    switch (criteria) {
      case 'type+diameter':
        label = `${sorted[0].type} · Ø${dia}`;
        break;
      case 'type+diameter+flutes':
        label = `${sorted[0].type} · Ø${dia} · ${sorted[0].geometry.numberOfFlutes ?? '?'} fl`;
        break;
      case 'diameter':
        label = `Ø${dia}`;
        break;
    }

    groups.push({ key, label, tools: sorted });
  }

  return groups.sort((a, b) => b.tools.length - a.tools.length);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DuplicateFinderPanel({ tools, onDelete, onClose }: DuplicateFinderPanelProps) {
  const { settings } = useSettings();
  const dp = settings.tableDecimalPrecision;

  const [criteria,    setCriteria]    = useState<MatchCriteria>('type+diameter');
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [markedIds,   setMarkedIds]   = useState<Set<string>>(new Set());
  const [isDeleting,  setIsDeleting]  = useState(false);

  const groups = useMemo(() => buildGroups(tools, criteria), [tools, criteria]);

  // When criteria changes reset marks and expand all groups
  function handleCriteriaChange(next: MatchCriteria) {
    setCriteria(next);
    setMarkedIds(new Set());
    setExpanded(new Set(buildGroups(tools, next).map((g) => g.key)));
  }

  // When criteria changes, auto-expand all groups and auto-mark all non-first tools
  useEffect(() => {
    const newExpanded = new Set(groups.map((g) => g.key));
    setExpanded(newExpanded);
    // Auto-mark all tools except the first in each group (the "keep" candidate)
    const autoMarked = new Set<string>();
    for (const g of groups) {
      g.tools.slice(1).forEach((t) => autoMarked.add(t.id));
    }
    setMarkedIds(autoMarked);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria]);

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleMark(id: string) {
    setMarkedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function markAllDuplicates() {
    const ids = new Set<string>();
    for (const g of groups) g.tools.slice(1).forEach((t) => ids.add(t.id));
    setMarkedIds(ids);
  }

  function clearAllMarks() {
    setMarkedIds(new Set());
  }

  async function handleDelete() {
    if (markedIds.size === 0) return;
    setIsDeleting(true);
    try {
      await onDelete(Array.from(markedIds));
    } finally {
      setIsDeleting(false);
    }
  }

  const totalExtra = groups.reduce((sum, g) => sum + g.tools.length - 1, 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-[calc(100vw-3rem)] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Copy size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-100">Find Duplicates</h2>
            {groups.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {groups.length} group{groups.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Criteria selector */}
        <div className="px-5 py-3 border-b border-slate-700 shrink-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Match by</p>
          <div className="flex gap-2 flex-wrap">
            {([
              ['type+diameter',        'Type + Diameter'],
              ['type+diameter+flutes', 'Type + Diameter + Flutes'],
              ['diameter',             'Diameter only'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => handleCriteriaChange(val)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  criteria === val
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary bar */}
        {groups.length > 0 ? (
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-700 bg-amber-500/5 shrink-0">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle size={13} />
              <span>
                <strong>{totalExtra}</strong> potential duplicate{totalExtra !== 1 ? 's' : ''} across{' '}
                <strong>{groups.length}</strong> group{groups.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAllDuplicates}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Mark all
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={clearAllMarks}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <CheckSquare size={28} className="text-green-400" />
            </div>
            <p className="text-sm font-medium text-slate-200">No duplicates found</p>
            <p className="text-xs text-slate-500">
              All tools have unique {criteria === 'type+diameter' ? 'type + diameter' : criteria === 'diameter' ? 'diameters' : 'type + diameter + flute count'} combinations.
            </p>
          </div>
        )}

        {/* Groups list */}
        {groups.length > 0 && (
          <div className="flex-1 overflow-auto">
            {groups.map((group) => {
              const isOpen = expanded.has(group.key);
              return (
                <div key={group.key} className="border-b border-slate-700/60">
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-700/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {isOpen ? <ChevronDown size={14} className="text-slate-500 shrink-0" /> : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
                      <span className="text-sm font-medium text-slate-200 capitalize">{group.label}</span>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0">
                      {group.tools.length} tools
                    </span>
                  </button>

                  {/* Tool rows */}
                  {isOpen && (
                    <div className="pb-2">
                      {group.tools.map((tool, i) => {
                        const isMarked = markedIds.has(tool.id);
                        const isKeep   = i === 0 && !markedIds.has(tool.id);
                        return (
                          <div
                            key={tool.id}
                            className={[
                              'flex items-start gap-3 px-5 py-2.5 transition-colors',
                              isMarked ? 'bg-red-500/5' : '',
                            ].join(' ')}
                          >
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => toggleMark(tool.id)}
                              className={[
                                'mt-0.5 shrink-0 transition-colors',
                                isMarked ? 'text-red-400 hover:text-red-300' : 'text-slate-500 hover:text-slate-300',
                              ].join(' ')}
                              title={isMarked ? 'Unmark for deletion' : 'Mark for deletion'}
                            >
                              {isMarked ? <CheckSquare size={15} /> : <Square size={15} />}
                            </button>

                            {/* Tool info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-blue-400 font-semibold shrink-0">
                                  T{tool.toolNumber}
                                </span>
                                <span className="text-sm text-slate-200 truncate" title={tool.description}>
                                  {tool.description}
                                </span>
                                {isKeep && (
                                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20 font-medium">
                                    keep
                                  </span>
                                )}
                                {isMarked && (
                                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-medium">
                                    delete
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                                <span>Ø{tool.geometry.diameter.toFixed(dp)}</span>
                                {tool.geometry.numberOfFlutes != null && (
                                  <span>{tool.geometry.numberOfFlutes} fl</span>
                                )}
                                {tool.geometry.overallLength != null && (
                                  <span>L{tool.geometry.overallLength.toFixed(dp)}</span>
                                )}
                                {(tool.machineGroups?.length ?? 0) > 0 && (
                                  <span className="truncate">{tool.machineGroups!.join(', ')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {groups.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {markedIds.size} tool{markedIds.size !== 1 ? 's' : ''} marked for deletion
            </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={markedIds.size === 0 || isDeleting}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                markedIds.size > 0 && !isDeleting
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              <Trash2 size={14} />
              Delete {markedIds.size > 0 ? markedIds.size : ''} tool{markedIds.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
