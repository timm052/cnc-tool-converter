import { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, ChevronDown, FolderOpen, FileText, Clock, GitMerge } from 'lucide-react';
import { registry } from '../../converters';
import type { LibraryTool } from '../../types/libraryTool';
import type { Tool } from '../../types/tool';
import FileDropZone from '../FileDropZone';
import BatchFolderDropZone from '../converter/BatchFolderDropZone';
import { useSettings } from '../../contexts/SettingsContext';
import { useLibrary } from '../../contexts/LibraryContext';
import { validateTool, findDuplicates, type DuplicateMatch } from '../../lib/toolValidation';
import { csvToTools } from '../../lib/csvLibrary';
import { importToolsFromXlsx } from '../../lib/xlsxImport';
import type { FormatInfo } from '../../types/converter';

interface ImportPanelProps {
  onImport: (tools: LibraryTool[], overwrite: boolean) => Promise<{ added: number; skipped: number }>;
  onClose:  () => void;
}

interface LoadedFile {
  name:    string;
  size:    number;
  content: string | ArrayBuffer;
}

const CSV_FORMAT: FormatInfo = {
  id:             'csv',
  name:           'CSV (spreadsheet)',
  description:    'Comma-separated values spreadsheet',
  fileExtensions: ['.csv'],
  mimeTypes:      ['text/csv'],
  canImport:      true,
  canExport:      true,
  readAs:         'text',
};

const XLSX_FORMAT: FormatInfo = {
  id:             'xlsx',
  name:           'Excel (.xlsx)',
  description:    'Microsoft Excel workbook',
  fileExtensions: ['.xlsx'],
  mimeTypes:      ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  canImport:      true,
  canExport:      true,
  readAs:         'arraybuffer',
};

// ── Recent files ──────────────────────────────────────────────────────────────

const RECENT_FILES_KEY = 'cnc-tool-converter:recent-import-files';

interface RecentFile { name: string; formatId: string; lastUsed: number; }

function loadRecentFiles(): RecentFile[] {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    return stored ? (JSON.parse(stored) as RecentFile[]) : [];
  } catch { return []; }
}

function saveRecentFile(name: string, formatId: string): void {
  try {
    const existing = loadRecentFiles().filter((f) => f.name !== name);
    existing.unshift({ name, formatId, lastUsed: Date.now() });
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(existing.slice(0, 5)));
  } catch { /* quota — ignore */ }
}

// ── Duplicate reason labels ───────────────────────────────────────────────────

const REASON_LABELS: Record<DuplicateMatch['reason'], string> = {
  'same-number':         'Same T#',
  'same-diameter-type':  'Same Ø+Type',
  'similar-description': 'Similar name',
};

const REASON_COLOURS: Record<DuplicateMatch['reason'], string> = {
  'same-number':         'bg-orange-500/20 text-orange-300',
  'same-diameter-type':  'bg-blue-500/20 text-blue-300',
  'similar-description': 'bg-slate-500/20 text-slate-400',
};

export default function ImportPanel({ onImport, onClose }: ImportPanelProps) {
  const { settings } = useSettings();
  const { tools: libraryTools, updateTool } = useLibrary();
  const importableFormats = registry.getImportableFormats();

  const [formatId,      setFormatId]      = useState(importableFormats[0]?.id ?? '');
  const [loadedFiles,   setLoadedFiles]   = useState<LoadedFile[]>([]);
  const [preview,       setPreview]       = useState<Tool[]>([]);
  const [parseError,    setParseError]    = useState<string | null>(null);
  const [overwrite,     setOverwrite]     = useState(settings.libraryImportOverwrite);
  const [result,        setResult]        = useState<{ added: number; skipped: number } | null>(null);
  const [isImporting,   setIsImporting]   = useState(false);
  const [showWarnings,  setShowWarnings]  = useState(false);
  const [duplicates,    setDuplicates]    = useState<DuplicateMatch[]>([]);
  const [skipIndices,   setSkipIndices]   = useState<Set<number>>(new Set());
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [folderMode,     setFolderMode]     = useState(false);
  const [recentFiles,    setRecentFiles]    = useState<RecentFile[]>(loadRecentFiles);
  /** incomingIndex → Set of field keys to take from the incoming tool */
  const [mergeSelections, setMergeSelections] = useState<Map<number, Set<string>>>(new Map());
  /** incomingIndex of the duplicate currently expanded for field-merge editing */
  const [expandedMerge,   setExpandedMerge]   = useState<number | null>(null);

  // Keep recent list in sync across re-mounts
  useEffect(() => { setRecentFiles(loadRecentFiles()); }, []);

  const isCsv  = formatId === 'csv';
  const isXlsx = formatId === 'xlsx';
  const sourceFormat = isCsv ? CSV_FORMAT : isXlsx ? XLSX_FORMAT : importableFormats.find((f) => f.id === formatId);

  // Compute validation warnings for the current preview
  const validationWarnings = settings.validationWarningsEnabled
    ? preview.flatMap((t) => {
        const issues = validateTool(t).filter((v) => v.severity === 'warning');
        return issues.map((w) => `T${t.toolNumber} (${t.description}): ${w.message}`);
      })
    : [];

  // Deduplicate matches by incomingIndex (first/highest-priority reason per tool)
  const uniqueDups = duplicates.reduce<DuplicateMatch[]>((acc, dup) => {
    if (!acc.find((d) => d.incomingIndex === dup.incomingIndex)) acc.push(dup);
    return acc;
  }, []);

  const importCount = preview.length - skipIndices.size;

  function toolToLibraryTool(tool: Tool): LibraryTool {
    const now = Date.now();
    return {
      ...tool,
      id:           crypto.randomUUID(),   // always assign a fresh UUID in the library
      machineGroups: settings.libraryImportDefaultMachineGroup ? [settings.libraryImportDefaultMachineGroup] : [],
      tags:         [],
      starred:      false,
      addedAt:      now,
      updatedAt:    now,
    };
  }

  async function handleFilesLoaded(files: LoadedFile[]) {
    setLoadedFiles(files);
    setParseError(null);
    setPreview([]);
    setResult(null);
    setDuplicates([]);
    setSkipIndices(new Set());

    if (isCsv) {
      const allText = files.map((f) => f.content as string).join('\n');
      const { tools, errors } = csvToTools(allText);
      if (errors.length > 0) {
        setParseError(errors.join(' | '));
      } else {
        setPreview(tools);
        setDuplicates(findDuplicates(tools, libraryTools));
        files.forEach((f) => { saveRecentFile(f.name, 'csv'); });
        setRecentFiles(loadRecentFiles());
      }
      return;
    }

    if (isXlsx) {
      const allTools: Tool[] = [];
      const allErrors: string[] = [];
      for (const file of files) {
        const { tools, errors } = importToolsFromXlsx(file.content as ArrayBuffer);
        allTools.push(...tools);
        allErrors.push(...errors);
      }
      if (allErrors.length > 0) {
        setParseError(allErrors.join(' | '));
      } else {
        setPreview(allTools);
        setDuplicates(findDuplicates(allTools, libraryTools));
        files.forEach((f) => { saveRecentFile(f.name, 'xlsx'); });
        setRecentFiles(loadRecentFiles());
      }
      return;
    }

    const converter = registry.getConverter(formatId);
    if (!converter) return;

    const allTools: Tool[] = [];
    const allErrors: string[] = [];

    for (const file of files) {
      const parsed = await converter.parse(file.content, file.name);
      allTools.push(...parsed.tools);
      allErrors.push(...parsed.errors);
    }

    if (allErrors.length > 0) {
      setParseError(allErrors.join(' | '));
    } else {
      setPreview(allTools);
      setDuplicates(findDuplicates(allTools, libraryTools));
      files.forEach((f) => { saveRecentFile(f.name, formatId); });
      setRecentFiles(loadRecentFiles());
    }
  }

  function handleClear() {
    setLoadedFiles([]);
    setPreview([]);
    setParseError(null);
    setResult(null);
    setDuplicates([]);
    setSkipIndices(new Set());
    setMergeSelections(new Map());
    setExpandedMerge(null);
  }

  function toggleSkip(idx: number) {
    setSkipIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  // Build mergeable field list for a duplicate
  const MERGE_FIELDS: { key: string; label: string; getValue: (t: Tool) => unknown }[] = [
    { key: 'description',    label: 'Description',   getValue: (t) => t.description },
    { key: 'manufacturer',   label: 'Make/model',    getValue: (t) => t.manufacturer },
    { key: 'diameter',       label: 'Diameter',      getValue: (t) => t.geometry.diameter },
    { key: 'overallLength',  label: 'OAL',           getValue: (t) => t.geometry.overallLength },
    { key: 'fluteLength',    label: 'Flute length',  getValue: (t) => t.geometry.fluteLength },
    { key: 'numberOfFlutes', label: 'Flutes',        getValue: (t) => t.geometry.numberOfFlutes },
    { key: 'spindleRpm',     label: 'RPM',           getValue: (t) => t.cutting?.spindleRpm },
    { key: 'feedCutting',    label: 'Feed rate',     getValue: (t) => t.cutting?.feedCutting },
    { key: 'feedPlunge',     label: 'Plunge feed',   getValue: (t) => t.cutting?.feedPlunge },
    { key: 'comment',        label: 'Comment',       getValue: (t) => t.comment },
  ];

  function getDiffFields(incoming: Tool, existingId: string): typeof MERGE_FIELDS {
    const existing = libraryTools.find((t) => t.id === existingId);
    if (!existing) return [];
    return MERGE_FIELDS.filter((f) => {
      const iv = f.getValue(incoming);
      const ev = f.getValue(existing);
      return iv !== ev && iv !== undefined && iv !== null && iv !== '';
    });
  }

  function toggleMergeField(idx: number, field: string) {
    setMergeSelections((prev) => {
      const next = new Map(prev);
      const fields = new Set(next.get(idx) ?? []);
      if (fields.has(field)) fields.delete(field); else fields.add(field);
      next.set(idx, fields);
      return next;
    });
    // Selecting a merge field removes the tool from skipIndices
    setSkipIndices((prev) => { const next = new Set(prev); next.delete(idx); return next; });
  }

  async function handleImport() {
    if (importCount === 0 && mergeSelections.size === 0) return;
    setIsImporting(true);

    // 1. Apply field-level merges for duplicate tools
    const mergeIndices = new Set(
      [...mergeSelections.entries()]
        .filter(([, fields]) => fields.size > 0)
        .map(([idx]) => idx),
    );
    for (const [idx, fields] of mergeSelections) {
      if (fields.size === 0) continue;
      const incomingTool = preview[idx];
      const dup = uniqueDups.find((d) => d.incomingIndex === idx);
      if (!dup) continue;
      const patch: Partial<LibraryTool> = {};
      if (fields.has('description'))    patch.description   = incomingTool.description;
      if (fields.has('manufacturer'))   patch.manufacturer  = incomingTool.manufacturer;
      if (fields.has('comment'))        patch.comment       = incomingTool.comment;
      const geom: Partial<typeof incomingTool.geometry> = {};
      if (fields.has('diameter'))       geom.diameter       = incomingTool.geometry.diameter;
      if (fields.has('overallLength'))  geom.overallLength  = incomingTool.geometry.overallLength;
      if (fields.has('fluteLength'))    geom.fluteLength    = incomingTool.geometry.fluteLength;
      if (fields.has('numberOfFlutes')) geom.numberOfFlutes = incomingTool.geometry.numberOfFlutes;
      if (Object.keys(geom).length > 0) {
        const existing = libraryTools.find((t) => t.id === dup.existingId);
        if (existing) patch.geometry = { ...existing.geometry, ...geom };
      }
      const cut: Record<string, unknown> = {};
      if (fields.has('spindleRpm'))  cut.spindleRpm  = incomingTool.cutting?.spindleRpm;
      if (fields.has('feedCutting')) cut.feedCutting = incomingTool.cutting?.feedCutting;
      if (fields.has('feedPlunge'))  cut.feedPlunge  = incomingTool.cutting?.feedPlunge;
      if (Object.keys(cut).length > 0) {
        const existing = libraryTools.find((t) => t.id === dup.existingId);
        patch.cutting = { ...(existing?.cutting ?? {}), ...cut };
      }
      await updateTool(dup.existingId, patch);
    }

    // 2. Import non-skipped, non-merged tools as new
    const allLibTools = isCsv
      ? (preview as LibraryTool[])
      : preview.map(toolToLibraryTool);
    const filtered = allLibTools.filter((_, i) => !skipIndices.has(i) && !mergeIndices.has(i));
    const res = await onImport(filtered, overwrite);
    setResult({ added: res.added + mergeIndices.size, skipped: res.skipped });
    setIsImporting(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-100">Import Tools</h2>
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Source format */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Source format</p>
            <select
              value={formatId}
              onChange={(e) => { setFormatId(e.target.value); handleClear(); }}
              aria-label="Source format"
              className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {importableFormats.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
              <option value="csv">CSV (spreadsheet)</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </div>

          {/* Recent files */}
          {recentFiles.length > 0 && loadedFiles.length === 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Clock size={11} />
                Recent
              </p>
              <div className="rounded-lg border border-slate-700 divide-y divide-slate-700/60 overflow-hidden">
                {recentFiles.map((rf) => (
                  <div key={rf.name} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-800/60">
                    <FileText size={11} className="text-slate-500 shrink-0" />
                    <span className="flex-1 truncate text-slate-400" title={rf.name}>{rf.name}</span>
                    <span className="text-slate-600 shrink-0">{rf.formatId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File drop */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-400">FILES</p>
              <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs">
                <button
                  type="button"
                  onClick={() => { setFolderMode(false); handleClear(); }}
                  className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${!folderMode ? 'bg-slate-600 text-slate-100' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                  <FileText size={11} /> Files
                </button>
                <button
                  type="button"
                  onClick={() => { setFolderMode(true); handleClear(); }}
                  className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${folderMode ? 'bg-slate-600 text-slate-100' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                  <FolderOpen size={11} /> Folder
                </button>
              </div>
            </div>
            {folderMode ? (
              <BatchFolderDropZone
                format={sourceFormat}
                onFilesLoaded={handleFilesLoaded}
                loadedFileNames={loadedFiles.map((f) => f.name)}
                onClear={handleClear}
              />
            ) : (
              <FileDropZone
                format={sourceFormat}
                onFilesLoaded={handleFilesLoaded}
                loadedFileNames={loadedFiles.map((f) => f.name)}
                onClear={handleClear}
              />
            )}
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <CheckCircle size={15} className="text-green-400" />
                <span><strong>{preview.length}</strong> tools parsed</span>
              </div>

              {/* Duplicate detection */}
              {uniqueDups.length > 0 && (
                <details
                  open={showDuplicates}
                  onToggle={(e) => setShowDuplicates((e.target as HTMLDetailsElement).open)}
                  className="rounded-lg border border-orange-500/30 bg-orange-500/5"
                >
                  <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none text-xs text-orange-300 hover:text-orange-200">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span className="font-medium">
                      {uniqueDups.length} potential duplicate{uniqueDups.length !== 1 ? 's' : ''} found
                      {skipIndices.size > 0 && ` · ${skipIndices.size} skipped`}
                      {[...mergeSelections.values()].filter((f) => f.size > 0).length > 0 && ` · ${[...mergeSelections.values()].filter((f) => f.size > 0).length} merging`}
                    </span>
                    <ChevronDown size={11} className="ml-auto shrink-0" />
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    <p className="text-xs text-slate-500">For each match, choose: skip, merge fields, or add as new.</p>
                    {uniqueDups.map((dup) => {
                      const incoming = preview[dup.incomingIndex];
                      const isSkipped  = skipIndices.has(dup.incomingIndex);
                      const isMerging  = expandedMerge === dup.incomingIndex;
                      const mergeFields = mergeSelections.get(dup.incomingIndex) ?? new Set<string>();
                      const diffFields  = getDiffFields(incoming, dup.existingId);
                      return (
                        <div key={dup.incomingIndex} className={`rounded-lg border ${isSkipped ? 'border-slate-700 opacity-60' : isMerging ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-700 bg-slate-800/40'}`}>
                          {/* Tool header row */}
                          <div className="flex items-center gap-2 px-2.5 py-2 flex-wrap">
                            <span className="font-mono text-xs text-blue-400 shrink-0">T{incoming.toolNumber}</span>
                            <span className="text-xs text-slate-300 truncate flex-1">{incoming.description}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${REASON_COLOURS[dup.reason]}`}>
                              {REASON_LABELS[dup.reason]}
                            </span>
                          </div>
                          <p className="px-2.5 pb-1.5 text-xs text-slate-500">Matches: {dup.existingDescription}</p>
                          {/* Action buttons */}
                          <div className="px-2.5 pb-2 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => { toggleSkip(dup.incomingIndex); if (isMerging) setExpandedMerge(null); }}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${isSkipped ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'text-slate-400 hover:bg-slate-700 border border-slate-700'}`}
                            >
                              {isSkipped ? '✓ Skip' : 'Skip'}
                            </button>
                            {diffFields.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedMerge(isMerging ? null : dup.incomingIndex);
                                  if (!isMerging) setSkipIndices((p) => { const n = new Set(p); n.delete(dup.incomingIndex); return n; });
                                }}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${isMerging || mergeFields.size > 0 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-slate-400 hover:bg-slate-700 border border-slate-700'}`}
                              >
                                <GitMerge size={10} />
                                Merge{mergeFields.size > 0 ? ` (${mergeFields.size})` : ''}
                              </button>
                            )}
                            <span className="ml-auto text-xs text-slate-600">or add as new</span>
                          </div>
                          {/* Field-level merge picker */}
                          {isMerging && diffFields.length > 0 && (
                            <div className="px-2.5 pb-2.5 space-y-1 border-t border-slate-700/60 pt-2">
                              <p className="text-xs text-slate-500 mb-1.5">Select fields to copy from incoming tool:</p>
                              {diffFields.map((f) => {
                                const existingTool = libraryTools.find((t) => t.id === dup.existingId);
                                const inVal  = f.getValue(incoming);
                                const exVal  = existingTool ? f.getValue(existingTool) : undefined;
                                return (
                                  <label key={f.key} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                      type="checkbox"
                                      checked={mergeFields.has(f.key)}
                                      onChange={() => toggleMergeField(dup.incomingIndex, f.key)}
                                      className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500"
                                    />
                                    <span className="text-xs text-slate-400 w-20 shrink-0">{f.label}</span>
                                    <span className="text-xs text-slate-500 line-through truncate">{String(exVal ?? '—')}</span>
                                    <span className="text-xs text-blue-300 truncate">→ {String(inVal)}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              {/* Validation warnings */}
              {validationWarnings.length > 0 && (
                <details
                  open={showWarnings}
                  onToggle={(e) => setShowWarnings((e.target as HTMLDetailsElement).open)}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10"
                >
                  <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none text-xs text-amber-300 hover:text-amber-200">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span className="font-medium">{validationWarnings.length} suspicious value{validationWarnings.length !== 1 ? 's' : ''} detected</span>
                    <ChevronDown size={11} className="ml-auto shrink-0" />
                  </summary>
                  <ul className="px-3 pb-2.5 space-y-0.5 text-xs text-amber-400/80 list-disc list-inside">
                    {validationWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </details>
              )}

              {/* Preview list (first 6) */}
              <div className="rounded-lg border border-slate-700 divide-y divide-slate-700/60 overflow-hidden">
                {preview.slice(0, 6).map((t, i) => (
                  <div key={t.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${skipIndices.has(i) ? 'bg-slate-800/30 opacity-50 line-through' : 'bg-slate-800/60'}`}>
                    <span className="font-mono text-blue-400 shrink-0">T{t.toolNumber}</span>
                    <span className="text-slate-300 truncate">{t.description}</span>
                    <span className="ml-auto text-slate-500 shrink-0">{t.geometry.diameter} {t.unit}</span>
                  </div>
                ))}
                {preview.length > 6 && (
                  <div className="px-3 py-2 text-xs text-slate-500 bg-slate-800/60">
                    …and {preview.length - 6} more
                  </div>
                )}
              </div>

              {/* Overwrite option */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500"
                />
                <span className="text-xs text-slate-400">
                  Overwrite existing tools with matching T numbers
                </span>
              </label>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-sm text-green-300 font-medium">
                <CheckCircle size={15} /> Import complete
              </div>
              <p className="text-xs text-slate-400">
                {result.added} tool{result.added !== 1 ? 's' : ''} added
                {result.skipped > 0 ? `, ${result.skipped} skipped (duplicate T numbers)` : ''}.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (() => {
            const mergeCount = [...mergeSelections.values()].filter((f) => f.size > 0).length;
            const totalOps = importCount + mergeCount;
            const canProceed = totalOps > 0 && !isImporting;
            return (
              <button
                type="button"
                onClick={handleImport}
                disabled={!canProceed}
                className={[
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                  canProceed ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed',
                ].join(' ')}
              >
                {isImporting ? 'Importing…' : (
                  <>
                    {importCount > 0 && `Add ${importCount} tool${importCount !== 1 ? 's' : ''}`}
                    {importCount > 0 && mergeCount > 0 && ' + '}
                    {mergeCount > 0 && `merge ${mergeCount}`}
                    {totalOps === 0 && 'Import'}
                  </>
                )}
              </button>
            );
          })()}
        </div>
      </div>
    </>
  );
}
