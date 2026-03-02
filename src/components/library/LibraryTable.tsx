import { useState } from 'react';
import { ChevronUp, ChevronDown, Star, Pencil } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import { useSettings } from '../../contexts/SettingsContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = 'toolNumber' | 'description' | 'type' | 'diameter' | 'addedAt';
type SortDir = 'asc' | 'desc';

export interface LibraryTableProps {
  tools:          LibraryTool[];
  selectedIds:    Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll:    (all: LibraryTool[]) => void;
  onToggleStar:   (id: string, starred: boolean) => void;
  onEdit:         (tool: LibraryTool) => void;
  /** Highlight the active machine group filter (used to decide whether to show MachineGroup col) */
  showMachineCol?: boolean;
}

// ── Label / colour maps ───────────────────────────────────────────────────────

const TOOL_TYPE_LABELS: Record<string, string> = {
  'flat end mill':       'Flat EM',
  'ball end mill':       'Ball EM',
  'bull nose end mill':  'Bull Nose',
  'chamfer mill':        'Chamfer',
  'face mill':           'Face Mill',
  'spot drill':          'Spot Drill',
  'drill':               'Drill',
  'tapered mill':        'Tapered',
  'boring bar':          'Boring Bar',
  'thread mill':         'Thread',
  'engraving':           'Engrave',
  'custom':              'Custom',
};

const TOOL_TYPE_COLOURS: Record<string, string> = {
  'flat end mill':       'bg-blue-500/20 text-blue-300',
  'ball end mill':       'bg-purple-500/20 text-purple-300',
  'bull nose end mill':  'bg-violet-500/20 text-violet-300',
  'chamfer mill':        'bg-orange-500/20 text-orange-300',
  'face mill':           'bg-cyan-500/20 text-cyan-300',
  'spot drill':          'bg-yellow-500/20 text-yellow-300',
  'drill':               'bg-green-500/20 text-green-300',
  'tapered mill':        'bg-pink-500/20 text-pink-300',
  'boring bar':          'bg-teal-500/20 text-teal-300',
  'thread mill':         'bg-amber-500/20 text-amber-300',
  'engraving':           'bg-rose-500/20 text-rose-300',
  'custom':              'bg-slate-500/20 text-slate-300',
};

// ── Sorting header ────────────────────────────────────────────────────────────

function SortHeader({
  label, sortKey, currentKey, dir, onSort, className = '',
}: {
  label:      string;
  sortKey:    SortKey;
  currentKey: SortKey;
  dir:        SortDir;
  onSort:     (k: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-200 select-none whitespace-nowrap ${className}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
          : <span className="w-3" />}
      </span>
    </th>
  );
}

// ── Tag chips ─────────────────────────────────────────────────────────────────

const TAG_COLOURS = [
  'bg-blue-500/20 text-blue-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300',
  'bg-pink-500/20 text-pink-300',
  'bg-violet-500/20 text-violet-300',
  'bg-cyan-500/20 text-cyan-300',
];

function tagColour(tag: string): string {
  let hash = 0;
  for (const ch of tag) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TAG_COLOURS[Math.abs(hash) % TAG_COLOURS.length];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LibraryTable({
  tools,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onToggleStar,
  onEdit,
  showMachineCol = false,
}: LibraryTableProps) {
  const { settings } = useSettings();
  const decimals = settings.tableDecimalPrecision;
  const compact  = settings.tableRowDensity === 'compact';
  const py       = compact ? 'py-1' : 'py-2';

  const [sortKey, setSortKey] = useState<SortKey>(settings.librarySortKey as SortKey);
  const [sortDir, setSortDir] = useState<SortDir>(settings.librarySortDir);
  const maxTags = settings.libraryMaxTagsShown;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...tools].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'toolNumber':  cmp = a.toolNumber - b.toolNumber; break;
      case 'description': cmp = a.description.localeCompare(b.description); break;
      case 'type':        cmp = a.type.localeCompare(b.type); break;
      case 'diameter':    cmp = a.geometry.diameter - b.geometry.diameter; break;
      case 'addedAt':     cmp = a.addedAt - b.addedAt; break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const allSelected = tools.length > 0 && tools.every((t) => selectedIds.has(t.id));

  if (tools.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        No tools match the current filter.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-slate-800 border-b border-slate-700 z-10">
          <tr>
            {/* Select-all checkbox */}
            <th className="px-3 py-2.5 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => allSelected ? onSelectAll([]) : onSelectAll(tools)}
                className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500 cursor-pointer"
              />
            </th>
            <SortHeader label="T#"          sortKey="toolNumber"  currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Type"        sortKey="type"        currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Description" sortKey="description" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Ø Dia"       sortKey="diameter"    currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            {showMachineCol && (
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                Machine
              </th>
            )}
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tags
            </th>
            {/* Star + edit — fixed right */}
            <th className="px-3 py-2.5 w-16" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((tool, i) => {
            const selected = selectedIds.has(tool.id);
            return (
              <tr
                key={tool.id}
                className={[
                  'border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors group',
                  i % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent',
                  selected ? 'ring-1 ring-inset ring-blue-500/30 bg-blue-500/5' : '',
                ].join(' ')}
              >
                {/* Checkbox */}
                <td className={`px-3 ${py}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSelect(tool.id)}
                    className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500 cursor-pointer"
                  />
                </td>

                {/* T# */}
                <td
                  className={`px-3 ${py} font-mono text-blue-400 font-medium cursor-pointer`}
                  onClick={() => onEdit(tool)}
                >
                  T{tool.toolNumber}
                </td>

                {/* Type badge */}
                <td className={`px-3 ${py}`}>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TOOL_TYPE_COLOURS[tool.type] ?? 'bg-slate-500/20 text-slate-300'}`}>
                    {TOOL_TYPE_LABELS[tool.type] ?? tool.type}
                  </span>
                </td>

                {/* Description */}
                <td
                  className={`px-3 ${py} text-slate-200 max-w-[220px] cursor-pointer`}
                  onClick={() => onEdit(tool)}
                >
                  <span className="block truncate" title={tool.description}>
                    {tool.description}
                  </span>
                  {tool.manufacturer && (
                    <span className="text-xs text-slate-500">{tool.manufacturer}</span>
                  )}
                </td>

                {/* Diameter */}
                <td className={`px-3 ${py} font-mono text-slate-300 whitespace-nowrap`}>
                  {tool.geometry.diameter.toFixed(decimals)} {tool.unit}
                </td>

                {/* Machine group (conditional) */}
                {showMachineCol && (
                  <td className={`px-3 ${py} text-slate-400 text-xs`}>
                    {tool.machineGroup ?? '—'}
                  </td>
                )}

                {/* Tags */}
                <td className={`px-3 ${py} max-w-[180px]`}>
                  <div className="flex flex-wrap gap-1">
                    {tool.tags.slice(0, maxTags).map((tag) => (
                      <span
                        key={tag}
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${tagColour(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                    {tool.tags.length > maxTags && (
                      <span className="px-1.5 py-0.5 rounded text-xs text-slate-500">
                        +{tool.tags.length - maxTags}
                      </span>
                    )}
                  </div>
                </td>

                {/* Star + Edit */}
                <td className={`px-3 ${py} whitespace-nowrap`}>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleStar(tool.id, !tool.starred); }}
                      title={tool.starred ? 'Unstar' : 'Star'}
                      className={`p-1 rounded hover:bg-slate-600 transition-colors ${tool.starred ? 'text-amber-400' : 'text-slate-500 hover:text-amber-300'}`}
                    >
                      <Star size={13} fill={tool.starred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => onEdit(tool)}
                      title="Edit"
                      className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-600 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                  {/* Always-visible star for starred tools (dimmer when not hovered) */}
                  {tool.starred && (
                    <Star
                      size={13}
                      fill="currentColor"
                      className="text-amber-400 group-hover:hidden"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
