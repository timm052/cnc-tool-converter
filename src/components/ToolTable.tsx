import { useState } from 'react';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';
import type { Tool } from '../types/tool';
import { useSettings } from '../contexts/SettingsContext';

interface ToolTableProps {
  tools:   Tool[];
  title?:  string;
}

type SortKey = 'toolNumber' | 'description' | 'type' | 'diameter';
type SortDir = 'asc' | 'desc';

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

function ColHeader({
  label, sortKey, currentKey, dir, onSort,
}: {
  label:      string;
  sortKey:    SortKey;
  currentKey: SortKey;
  dir:        SortDir;
  onSort:     (key: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-200 select-none whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <span className="w-3" />
        )}
      </span>
    </th>
  );
}

function StaticHeader({ label }: { label: string }) {
  return (
    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
      {label}
    </th>
  );
}

export default function ToolTable({ tools, title }: ToolTableProps) {
  const { settings } = useSettings();
  const vis      = settings.tableColumnVisibility;
  const decimals = settings.tableDecimalPrecision;
  const compact  = settings.tableRowDensity === 'compact';
  const cellPy   = compact ? 'py-1' : 'py-2';

  const [query,   setQuery]   = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('toolNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = tools.filter((t) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      t.description.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      String(t.toolNumber).includes(q) ||
      (t.manufacturer ?? '').toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'toolNumber':  cmp = a.toolNumber - b.toolNumber; break;
      case 'description': cmp = a.description.localeCompare(b.description); break;
      case 'type':        cmp = a.type.localeCompare(b.type); break;
      case 'diameter':    cmp = a.geometry.diameter - b.geometry.diameter; break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // T# is always visible; count toggleable visible cols
  const visibleColCount = 1 + Object.values(vis).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {title && (
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        )}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter tools…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} title="Clear filter" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              <X size={13} />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-500 shrink-0">
          {filtered.length} / {tools.length} tools
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-slate-800 border-b border-slate-700 z-10">
            <tr>
              {/* T# — always visible */}
              <ColHeader label="T#" sortKey="toolNumber" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              {vis.type        && <ColHeader label="Type"        sortKey="type"        currentKey={sortKey} dir={sortDir} onSort={handleSort} />}
              {vis.description && <ColHeader label="Description" sortKey="description" currentKey={sortKey} dir={sortDir} onSort={handleSort} />}
              {vis.diameter    && <ColHeader label="Ø Dia"       sortKey="diameter"    currentKey={sortKey} dir={sortDir} onSort={handleSort} />}
              {vis.length      && <StaticHeader label="Length" />}
              {vis.flutes      && <StaticHeader label="Flutes" />}
              {vis.rpm         && <StaticHeader label="RPM" />}
              {vis.feed        && <StaticHeader label="Feed" />}
              {vis.material    && <StaticHeader label="Material" />}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={visibleColCount} className="px-3 py-12 text-center text-slate-500">
                  {tools.length === 0 ? 'No tools loaded' : 'No tools match the filter'}
                </td>
              </tr>
            ) : (
              sorted.map((tool, i) => (
                <tr
                  key={tool.id}
                  className={[
                    'border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors',
                    i % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent',
                  ].join(' ')}
                >
                  {/* T# — always visible */}
                  <td className={`px-3 ${cellPy} font-mono text-blue-400 font-medium`}>
                    T{tool.toolNumber}
                  </td>

                  {vis.type && (
                    <td className={`px-3 ${cellPy}`}>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TOOL_TYPE_COLOURS[tool.type] ?? 'bg-slate-500/20 text-slate-300'}`}>
                        {TOOL_TYPE_LABELS[tool.type] ?? tool.type}
                      </span>
                    </td>
                  )}

                  {vis.description && (
                    <td className={`px-3 ${cellPy} text-slate-200 max-w-[240px]`}>
                      <span className="block truncate" title={tool.description}>
                        {tool.description}
                      </span>
                      {tool.manufacturer && (
                        <span className="text-xs text-slate-500">{tool.manufacturer}</span>
                      )}
                    </td>
                  )}

                  {vis.diameter && (
                    <td className={`px-3 ${cellPy} font-mono text-slate-300 whitespace-nowrap`}>
                      {tool.geometry.diameter.toFixed(decimals)} {tool.unit}
                    </td>
                  )}

                  {vis.length && (
                    <td className={`px-3 ${cellPy} font-mono text-slate-400 whitespace-nowrap`}>
                      {tool.geometry.overallLength != null
                        ? `${tool.geometry.overallLength.toFixed(decimals)} ${tool.unit}`
                        : '—'}
                    </td>
                  )}

                  {vis.flutes && (
                    <td className={`px-3 ${cellPy} text-slate-400`}>
                      {tool.geometry.numberOfFlutes ?? '—'}
                    </td>
                  )}

                  {vis.rpm && (
                    <td className={`px-3 ${cellPy} font-mono text-slate-400 whitespace-nowrap`}>
                      {tool.cutting?.spindleRpm != null
                        ? tool.cutting.spindleRpm.toLocaleString()
                        : '—'}
                    </td>
                  )}

                  {vis.feed && (
                    <td className={`px-3 ${cellPy} font-mono text-slate-400 whitespace-nowrap`}>
                      {tool.cutting?.feedCutting != null
                        ? tool.cutting.feedCutting.toFixed(decimals)
                        : '—'}
                    </td>
                  )}

                  {vis.material && (
                    <td className={`px-3 ${cellPy} text-slate-400 capitalize`}>
                      {tool.material ?? '—'}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
