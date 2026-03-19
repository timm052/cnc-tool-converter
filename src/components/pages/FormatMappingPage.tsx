/**
 * FormatMappingPage — dev tool for inspecting how each supported file format
 * maps to the internal Tool data structure.
 *
 * For each format it shows:
 *   • Format metadata (extensions, import/export capabilities, read mode)
 *   • Field coverage table — which Tool fields the parser populates, with
 *     coverage %, and a sample of actual values seen across all parsed tools
 *   • Tool inspector — full JSON tree for any individual parsed tool
 */

import { useState, useCallback } from 'react';
import {
  Upload, ChevronRight, AlertTriangle, XCircle,
  CheckCircle2, Info,
} from 'lucide-react';
import { registry } from '../../converters';
import type { ParseResult } from '../../types/converter';
import type { Tool } from '../../types/tool';

// ── Field map ─────────────────────────────────────────────────────────────────
// Every leaf path in the Tool interface that a parser might populate.

interface FieldDef {
  path:     string;
  label:    string;
  group:    string;
  get:      (t: Tool) => unknown;
}

const FIELDS: FieldDef[] = [
  // Identity
  { path: 'toolNumber',   label: 'T#',           group: 'Identity', get: t => t.toolNumber },
  { path: 'pocketNumber', label: 'Pocket#',       group: 'Identity', get: t => t.pocketNumber },
  { path: 'type',         label: 'Type',          group: 'Identity', get: t => t.type },
  { path: 'description',  label: 'Description',   group: 'Identity', get: t => t.description },
  { path: 'comment',      label: 'Comment',       group: 'Identity', get: t => t.comment },
  { path: 'manufacturer', label: 'Manufacturer',  group: 'Identity', get: t => t.manufacturer },
  { path: 'productId',    label: 'Product ID',    group: 'Identity', get: t => t.productId },
  { path: 'productLink',  label: 'Product Link',  group: 'Identity', get: t => t.productLink },
  { path: 'unit',         label: 'Unit',          group: 'Identity', get: t => t.unit },
  { path: 'material',     label: 'Material',      group: 'Identity', get: t => t.material },
  // Geometry
  { path: 'geometry.diameter',        label: 'Diameter',      group: 'Geometry', get: t => t.geometry.diameter },
  { path: 'geometry.shaftDiameter',   label: 'Shaft Ø',       group: 'Geometry', get: t => t.geometry.shaftDiameter },
  { path: 'geometry.overallLength',   label: 'OAL',           group: 'Geometry', get: t => t.geometry.overallLength },
  { path: 'geometry.bodyLength',      label: 'Body Length',   group: 'Geometry', get: t => t.geometry.bodyLength },
  { path: 'geometry.fluteLength',     label: 'Flute Length',  group: 'Geometry', get: t => t.geometry.fluteLength },
  { path: 'geometry.shoulderLength',  label: 'Shoulder Len',  group: 'Geometry', get: t => t.geometry.shoulderLength },
  { path: 'geometry.numberOfFlutes',  label: 'Flutes',        group: 'Geometry', get: t => t.geometry.numberOfFlutes },
  { path: 'geometry.cornerRadius',    label: 'Corner R',      group: 'Geometry', get: t => t.geometry.cornerRadius },
  { path: 'geometry.taperAngle',      label: 'Taper °',       group: 'Geometry', get: t => t.geometry.taperAngle },
  { path: 'geometry.tipDiameter',     label: 'Tip Ø',         group: 'Geometry', get: t => t.geometry.tipDiameter },
  { path: 'geometry.threadPitch',     label: 'Thread Pitch',  group: 'Geometry', get: t => t.geometry.threadPitch },
  { path: 'geometry.threadProfileAngle', label: 'Thread °',  group: 'Geometry', get: t => t.geometry.threadProfileAngle },
  { path: 'geometry.numberOfTeeth',   label: 'Teeth',         group: 'Geometry', get: t => t.geometry.numberOfTeeth },
  { path: 'geometry.coolantSupport',  label: 'Coolant Sup',   group: 'Geometry', get: t => t.geometry.coolantSupport },
  { path: 'geometry.pointAngle',      label: 'Point °',       group: 'Geometry', get: t => t.geometry.pointAngle },
  { path: 'geometry.shoulderDiameter',label: 'Shoulder Ø',    group: 'Geometry', get: t => t.geometry.shoulderDiameter },
  { path: 'geometry.tipLength',       label: 'Tip Length',    group: 'Geometry', get: t => t.geometry.tipLength },
  { path: 'geometry.profileRadius',   label: 'Profile R',     group: 'Geometry', get: t => t.geometry.profileRadius },
  // Offsets
  { path: 'offsets.x', label: 'Offset X', group: 'Offsets', get: t => t.offsets?.x },
  { path: 'offsets.y', label: 'Offset Y', group: 'Offsets', get: t => t.offsets?.y },
  { path: 'offsets.z', label: 'Offset Z', group: 'Offsets', get: t => t.offsets?.z },
  { path: 'offsets.a', label: 'Offset A', group: 'Offsets', get: t => t.offsets?.a },
  { path: 'offsets.b', label: 'Offset B', group: 'Offsets', get: t => t.offsets?.b },
  // Cutting
  { path: 'cutting.spindleRpm',     label: 'RPM',            group: 'Cutting', get: t => t.cutting?.spindleRpm },
  { path: 'cutting.feedCutting',    label: 'Feed Cut',       group: 'Cutting', get: t => t.cutting?.feedCutting },
  { path: 'cutting.feedPlunge',     label: 'Feed Plunge',    group: 'Cutting', get: t => t.cutting?.feedPlunge },
  { path: 'cutting.feedRamp',       label: 'Feed Ramp',      group: 'Cutting', get: t => t.cutting?.feedRamp },
  { path: 'cutting.feedMode',       label: 'Feed Mode',      group: 'Cutting', get: t => t.cutting?.feedMode },
  { path: 'cutting.coolant',        label: 'Coolant',        group: 'Cutting', get: t => t.cutting?.coolant },
  { path: 'cutting.clockwise',      label: 'Clockwise',      group: 'Cutting', get: t => t.cutting?.clockwise },
  // NC properties
  { path: 'nc.breakControl',    label: 'Break Ctrl',   group: 'NC', get: t => t.nc?.breakControl },
  { path: 'nc.diameterOffset',  label: 'Dia Offset',   group: 'NC', get: t => t.nc?.diameterOffset },
  { path: 'nc.lengthOffset',    label: 'Len Offset',   group: 'NC', get: t => t.nc?.lengthOffset },
  { path: 'nc.liveTool',        label: 'Live Tool',    group: 'NC', get: t => t.nc?.liveTool },
  { path: 'nc.turret',          label: 'Turret',       group: 'NC', get: t => t.nc?.turret },
  // Extra
  { path: 'presets',    label: 'Presets',     group: 'Extra', get: t => t.presets?.length ? t.presets.length : undefined },
  { path: 'sourceData', label: 'Source Data', group: 'Extra', get: t => t.sourceData && Object.keys(t.sourceData).length > 0 ? Object.keys(t.sourceData).length : undefined },
];

// Samples now live on each converter's `.sample` field.
// FormatMappingPage reads them via the registry — no changes needed here
// when a new converter is added.

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if a value is considered "populated" by the parser. */
function isSet(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

/** Render an unknown value as a short string for the sample values column. */
function shortVal(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean')   return v ? 'true' : 'false';
  if (typeof v === 'number')    return String(v);
  if (typeof v === 'string')    return v.length > 24 ? v.slice(0, 22) + '…' : v;
  if (typeof v === 'object')    return `{${Object.keys(v as object).length} keys}`;
  return String(v);
}

interface FieldCoverage {
  def:      FieldDef;
  filled:   number;
  total:    number;
  samples:  string[];
}

function computeCoverage(tools: Tool[]): FieldCoverage[] {
  return FIELDS.map((def) => {
    const values = tools.map((t) => def.get(t));
    const filled = values.filter(isSet).length;
    const samples = Array.from(
      new Set(values.filter(isSet).map(shortVal).filter(Boolean))
    ).slice(0, 4);
    return { def, filled, total: tools.length, samples };
  });
}

// ── JSON tree renderer ────────────────────────────────────────────────────────

function JsonNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (value === undefined || value === null) {
    return <span className="text-slate-600 text-xs">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-purple-400 text-xs">{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-green-400 text-xs">{value}</span>;
  }
  if (typeof value === 'string') {
    return <span className="text-amber-300 text-xs">"{value}"</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-500 text-xs">[]</span>;
    return (
      <span>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="text-slate-400 text-xs hover:text-slate-200"
        >
          {collapsed ? `▶ [${value.length}]` : '▼ ['}
        </button>
        {!collapsed && (
          <div className="ml-4 border-l border-slate-700/60 pl-2 space-y-0.5">
            {value.map((item, i) => (
              <div key={i} className="flex gap-1.5 text-xs">
                <span className="text-slate-600 shrink-0">{i}:</span>
                <JsonNode value={item} depth={depth + 1} />
              </div>
            ))}
            <span className="text-slate-400 text-xs">]</span>
          </div>
        )}
      </span>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return <span className="text-slate-500 text-xs">{'{}'}</span>;
    return (
      <span>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="text-slate-400 text-xs hover:text-slate-200"
        >
          {collapsed ? `▶ {${entries.length}}` : '▼ {'}
        </button>
        {!collapsed && (
          <div className="ml-4 border-l border-slate-700/60 pl-2 space-y-0.5">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-1.5 items-start text-xs">
                <span className="text-sky-300 shrink-0 font-mono">{k}:</span>
                <JsonNode value={v} depth={depth + 1} />
              </div>
            ))}
            <span className="text-slate-400 text-xs">{'}'}</span>
          </div>
        )}
      </span>
    );
  }
  return <span className="text-slate-300 text-xs">{String(value)}</span>;
}

// ── Coverage table ────────────────────────────────────────────────────────────

const GROUP_COLOURS: Record<string, string> = {
  Identity: 'text-blue-400',
  Geometry: 'text-emerald-400',
  Offsets:  'text-violet-400',
  Cutting:  'text-orange-400',
  NC:       'text-rose-400',
  Extra:    'text-slate-400',
};

function CoverageTable({ coverage }: { coverage: FieldCoverage[] }) {
  // Only show rows with at least partial coverage, but always show all fields
  const groups = Array.from(new Set(FIELDS.map(f => f.group)));

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-800/80 border-b border-slate-700">
            <th className="px-3 py-2 text-left font-medium text-slate-400 w-20">Group</th>
            <th className="px-3 py-2 text-left font-medium text-slate-400 w-32">Field</th>
            <th className="px-3 py-2 text-left font-medium text-slate-400 w-24">Coverage</th>
            <th className="px-3 py-2 text-left font-medium text-slate-400">Sample values</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/40">
          {groups.map((group) => {
            const rows = coverage.filter(c => c.def.group === group);
            const hasAny = rows.some(c => c.filled > 0);
            return rows.map((c, i) => {
              const pct = c.total > 0 ? Math.round((c.filled / c.total) * 100) : 0;
              const textColor = pct === 100
                ? 'text-emerald-400'
                : pct > 0
                  ? 'text-amber-400'
                  : 'text-slate-600';
              const rowOpacity = !hasAny ? 'opacity-40' : '';
              return (
                <tr key={c.def.path} className={`bg-slate-800/30 hover:bg-slate-800/60 ${rowOpacity}`}>
                  {i === 0 && (
                    <td
                      rowSpan={rows.length}
                      className={`px-3 py-2 font-medium align-top border-r border-slate-700/40 ${GROUP_COLOURS[group] ?? 'text-slate-400'}`}
                    >
                      {group}
                    </td>
                  )}
                  <td className="px-3 py-2 font-mono text-slate-300">{c.def.label}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <meter
                        value={pct}
                        min={0}
                        max={100}
                        title={`${pct}%`}
                        className="w-16 h-1.5 accent-current"
                      />
                      <span className={`tabular-nums ${textColor}`}>
                        {c.total > 0 ? `${pct}%` : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-500 font-mono truncate max-w-0 w-full">
                    {c.samples.map((s, si) => (
                      <span key={si}>
                        <span className="text-slate-400">{s}</span>
                        {si < c.samples.length - 1 && <span className="text-slate-600 mx-1">·</span>}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FormatMappingPage() {
  const formats = registry.getAllFormats();
  const [activeId,      setActiveId]      = useState(formats[0]?.id ?? '');
  const [parseResult,   setParseResult]   = useState<ParseResult | null>(null);
  const [parsing,       setParsing]       = useState(false);
  const [selectedTool,  setSelectedTool]  = useState(0);
  const [rawContent,    setRawContent]    = useState('');
  const [rawDirty,      setRawDirty]      = useState(false);  // user edited the raw pane
  const [dragOver,      setDragOver]      = useState(false);

  const fmt       = formats.find(f => f.id === activeId);
  const hasSample = !!registry.getConverter(activeId)?.sample;

  async function runParse(content: string | ArrayBuffer, filename: string) {
    const conv = registry.getConverter(activeId);
    if (!conv) return;
    setParsing(true);
    setParseResult(null);
    try {
      const result = await conv.parse(content, filename);
      setParseResult(result);
      setSelectedTool(0);
    } catch (err) {
      setParseResult({
        tools: [],
        warnings: [],
        errors: [String(err)],
      });
    } finally {
      setParsing(false);
    }
  }

  async function loadSample() {
    const sample = registry.getConverter(activeId)?.sample;
    if (!sample) return;
    setRawContent(sample);
    setRawDirty(false);
    await runParse(sample, `sample.${fmt?.fileExtensions[0]?.replace('.', '') ?? 'txt'}`);
  }

  async function parseRaw() {
    await runParse(rawContent, `sample.${fmt?.fileExtensions[0]?.replace('.', '') ?? 'txt'}`);
    setRawDirty(false);
  }

  function selectFormat(id: string) {
    setActiveId(id);
    setParseResult(null);
    setRawContent('');
    setRawDirty(false);
    setSelectedTool(0);
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !fmt) return;
    const content = fmt.readAs === 'arraybuffer'
      ? await file.arrayBuffer()
      : await file.text();
    if (typeof content === 'string') setRawContent(content);
    await runParse(content, file.name);
  }, [activeId, fmt]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fmt) return;
    const content = fmt.readAs === 'arraybuffer'
      ? await file.arrayBuffer()
      : await file.text();
    if (typeof content === 'string') setRawContent(content);
    await runParse(content, file.name);
    e.target.value = '';
  }, [activeId, fmt]);

  const coverage = parseResult ? computeCoverage(parseResult.tools) : null;
  const populatedCount = coverage?.filter(c => c.filled > 0).length ?? 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Page header */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-700">
        <h1 className="text-base font-semibold text-slate-100">Format → Model Mapping</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Parse a file or sample to see how each format maps to the internal <code className="font-mono text-slate-400">Tool</code> structure.
        </p>
      </div>

      {/* Format tab bar */}
      <div className="shrink-0 flex gap-0.5 px-4 pt-3 pb-0 border-b border-slate-700 overflow-x-auto">
        {formats.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => selectFormat(f.id)}
            className={[
              'px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors',
              activeId === f.id
                ? 'border-blue-500 text-blue-400 bg-slate-800'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
            ].join(' ')}
          >
            {f.id}
            {!registry.getConverter(f.id)?.sample && (
              <span className="ml-1 text-slate-600">⬆</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: source input + coverage */}
        <div className="w-80 shrink-0 flex flex-col border-r border-slate-700 overflow-y-auto">

          {/* Format metadata */}
          {fmt && (
            <div className="p-4 border-b border-slate-700 space-y-2">
              <p className="text-sm font-medium text-slate-200">{fmt.name}</p>
              <p className="text-xs text-slate-500">{fmt.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {fmt.fileExtensions.map(ext => (
                  <span key={ext} className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-slate-300 font-mono">{ext}</span>
                ))}
                {fmt.canImport && (
                  <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-800/40">import</span>
                )}
                {fmt.canExport && (
                  <span className="px-1.5 py-0.5 rounded text-xs bg-blue-900/40 text-blue-400 border border-blue-800/40">export</span>
                )}
                <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700/60 text-slate-400">read: {fmt.readAs}</span>
              </div>
            </div>
          )}

          {/* Sample / drop area */}
          <div className="p-4 border-b border-slate-700 space-y-3">
            {hasSample && (
              <button
                type="button"
                onClick={loadSample}
                disabled={parsing}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-colors"
              >
                {parsing ? 'Parsing…' : 'Load & parse sample'}
              </button>
            )}

            {/* Drop zone for binary/XML formats OR always visible for paste */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={[
                'relative rounded-lg border-2 border-dashed transition-colors text-center py-4 px-3',
                dragOver
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 hover:border-slate-600',
              ].join(' ')}
            >
              <Upload size={14} className="mx-auto mb-1 text-slate-500" />
              <p className="text-xs text-slate-500">Drop a file here</p>
              <input
                type="file"
                title="Select a file to parse"
                accept={fmt?.fileExtensions.join(',')}
                onChange={handleFileInput}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>

            {/* Raw text pane (text formats only) */}
            {fmt?.readAs === 'text' && rawContent && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500">Raw content</p>
                <textarea
                  value={rawContent}
                  aria-label="Raw source content"
                  onChange={(e) => { setRawContent(e.target.value); setRawDirty(true); }}
                  rows={6}
                  spellCheck={false}
                  className="w-full text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                />
                {rawDirty && (
                  <button
                    type="button"
                    onClick={parseRaw}
                    className="w-full px-2 py-1.5 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  >
                    Re-parse
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Warnings & errors */}
          {parseResult && (parseResult.warnings.length > 0 || parseResult.errors.length > 0) && (
            <div className="p-4 border-b border-slate-700 space-y-1.5">
              {parseResult.errors.map((e, i) => (
                <div key={i} className="flex gap-2 text-xs text-red-400">
                  <XCircle size={12} className="shrink-0 mt-0.5" />
                  <span>{e}</span>
                </div>
              ))}
              {parseResult.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-xs text-amber-400">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Parse stats */}
          {parseResult && (
            <div className="px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2 text-xs">
                {parseResult.errors.length === 0
                  ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                  : <XCircle      size={12} className="text-red-400 shrink-0" />
                }
                <span className="text-slate-300">
                  <span className="font-medium">{parseResult.tools.length}</span> tools parsed
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">
                  <span className="font-medium text-slate-300">{populatedCount}</span>/{FIELDS.length} fields covered
                </span>
              </div>
            </div>
          )}

          {/* No-parse placeholder */}
          {!parseResult && !parsing && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <Info size={20} className="text-slate-600" />
              <p className="text-xs text-slate-500">
                {hasSample
                  ? 'Click "Load & parse sample" to see field coverage.'
                  : 'Drop a file to begin.'}
              </p>
            </div>
          )}
        </div>

        {/* Right: coverage table + tool inspector */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {coverage && coverage.length > 0 ? (
            <>
              {/* Coverage table (scrollable) */}
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">
                  Field Coverage — {parseResult!.tools.length} tool{parseResult!.tools.length !== 1 ? 's' : ''}
                </p>
                <CoverageTable coverage={coverage} />
              </div>

              {/* Tool inspector */}
              {parseResult!.tools.length > 0 && (
                <div className="shrink-0 border-t border-slate-700 flex flex-col max-h-[42%]">
                  {/* Tool picker */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700 overflow-x-auto shrink-0">
                    <span className="text-xs text-slate-500 shrink-0">Tool:</span>
                    {parseResult!.tools.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedTool(i)}
                        className={[
                          'shrink-0 px-2 py-0.5 rounded text-xs transition-colors font-mono',
                          selectedTool === i
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                        ].join(' ')}
                      >
                        T{t.toolNumber}
                      </button>
                    ))}
                  </div>
                  {/* JSON tree */}
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-900/50 font-mono">
                    <JsonNode value={parseResult!.tools[selectedTool]} depth={0} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                <ChevronRight size={20} className="text-slate-500" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">No parse result yet</p>
                <p className="text-xs text-slate-600 mt-1">
                  Select a format and load a sample or drop a file to see the field mapping.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
