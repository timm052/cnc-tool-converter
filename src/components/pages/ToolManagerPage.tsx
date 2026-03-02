import { useState, useMemo } from 'react';
import {
  Library, Plus, Upload, Download, Search, Star, X,
  ChevronDown, Layers, Tag,
} from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import type { LibraryTool } from '../../types/libraryTool';
import LibraryTable from '../library/LibraryTable';
import ToolEditor from '../library/ToolEditor';
import ImportPanel from '../library/ImportPanel';
import ExportPanel from '../library/ExportPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

type Panel = 'import' | 'export' | 'edit' | null;

// ── Machine group sidebar ─────────────────────────────────────────────────────

function MachineGroupSidebar({
  groups,
  toolCountByGroup,
  totalCount,
  active,
  onSelect,
}: {
  groups:            string[];
  toolCountByGroup:  Record<string, number>;
  totalCount:        number;
  active:            string | null;
  onSelect:          (group: string | null) => void;
}) {
  return (
    <aside className="w-44 shrink-0 border-r border-slate-700 flex flex-col overflow-y-auto">
      <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Machines
      </p>

      <button
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
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => onSelect(group)}
              className={[
                'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left',
                active === group
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700',
              ].join(' ')}
            >
              <span className="truncate">{group}</span>
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full shrink-0 ${active === group ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {toolCountByGroup[group] ?? 0}
              </span>
            </button>
          ))}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ToolManagerPage() {
  const {
    tools, isLoading,
    allMachineGroups, allTags,
    addTool, addTools, updateTool, deleteTool,
  } = useLibrary();

  // ── Panel / editor state ──────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [editingTool, setEditingTool] = useState<LibraryTool | null>(null);

  // ── Filter / selection state ──────────────────────────────────────────────
  const [searchQuery,     setSearchQuery]     = useState('');
  const [machineFilter,   setMachineFilter]   = useState<string | null>(null);
  const [starredOnly,     setStarredOnly]     = useState(false);
  const [tagFilter,       setTagFilter]       = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());

  // ── Derived / filtered list ───────────────────────────────────────────────
  const filteredTools = useMemo(() => {
    let list = tools;
    if (machineFilter !== null) list = list.filter((t) => t.machineGroup === machineFilter);
    if (starredOnly)            list = list.filter((t) => t.starred);
    if (tagFilter.length > 0)   list = list.filter((t) => tagFilter.every((tag) => t.tags.includes(tag)));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        String(t.toolNumber).includes(q) ||
        (t.manufacturer ?? '').toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [tools, machineFilter, starredOnly, tagFilter, searchQuery]);

  const toolCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tools) {
      if (t.machineGroup) counts[t.machineGroup] = (counts[t.machineGroup] ?? 0) + 1;
    }
    return counts;
  }, [tools]);

  const selectedTools = filteredTools.filter((t) => selectedIds.has(t.id));
  const hasFilters    = starredOnly || tagFilter.length > 0 || searchQuery.trim() !== '' || machineFilter !== null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelectAll(all: LibraryTool[]) {
    setSelectedIds(all.length === 0 ? new Set() : new Set(all.map((t) => t.id)));
  }

  function handleToggleStar(id: string, starred: boolean) {
    updateTool(id, { starred });
  }

  function openEdit(tool: LibraryTool) {
    setEditingTool(tool);
    setActivePanel('edit');
  }

  function openNew() {
    setEditingTool(null);
    setActivePanel('edit');
  }

  async function handleSaveTool(tool: LibraryTool) {
    const exists = tools.some((t) => t.id === tool.id);
    if (exists) {
      await updateTool(tool.id, tool);
    } else {
      await addTool(tool);
    }
  }

  function closePanel() {
    setActivePanel(null);
    setEditingTool(null);
  }

  function clearFilters() {
    setSearchQuery('');
    setStarredOnly(false);
    setTagFilter([]);
    setMachineFilter(null);
  }

  function toggleTagFilter(tag: string) {
    setTagFilter((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

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
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-100">Tool Library</h1>
          {tools.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
              {tools.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setActivePanel('export')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
            >
              <Download size={14} />
              Export {selectedIds.size} tool{selectedIds.size !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={() => setActivePanel('import')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
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
              type="text"
              placeholder="Search tools…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
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
              <button onClick={() => toggleTagFilter(tag)} className="hover:text-white"><X size={10} /></button>
            </span>
          ))}

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-auto">
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
            groups={allMachineGroups}
            toolCountByGroup={toolCountByGroup}
            totalCount={tools.length}
            active={machineFilter}
            onSelect={setMachineFilter}
          />
          <div className="flex flex-col flex-1 overflow-hidden">
            <LibraryTable
              tools={filteredTools}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onToggleStar={handleToggleStar}
              onEdit={openEdit}
              showMachineCol={machineFilter === null && allMachineGroups.length > 0}
            />
          </div>
        </div>
      )}

      {/* ── Slide-over panels ────────────────────────────────────────────── */}
      {activePanel === 'import' && (
        <ImportPanel onImport={addTools} onClose={closePanel} />
      )}
      {activePanel === 'export' && (
        <ExportPanel selectedTools={selectedTools} onClose={closePanel} />
      )}
      {activePanel === 'edit' && (
        <ToolEditor
          tool={editingTool}
          allTags={allTags}
          allMachineGroups={allMachineGroups}
          onSave={handleSaveTool}
          onDelete={deleteTool}
          onClose={closePanel}
        />
      )}
    </div>
  );
}
