import { useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, ChevronDown, FolderOpen, FileText } from 'lucide-react';
import { registry } from '../../converters';
import type { LibraryTool } from '../../types/libraryTool';
import type { Tool } from '../../types/tool';
import FileDropZone from '../FileDropZone';
import BatchFolderDropZone from '../converter/BatchFolderDropZone';
import { useSettings } from '../../contexts/SettingsContext';
import { useLibrary } from '../../contexts/LibraryContext';
import { validateTool, findDuplicates, type DuplicateMatch } from '../../lib/toolValidation';
import { csvToTools } from '../../lib/csvLibrary';
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
  const { tools: libraryTools } = useLibrary();
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

  const isCsv = formatId === 'csv';
  const sourceFormat = isCsv ? CSV_FORMAT : importableFormats.find((f) => f.id === formatId);

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
      machineGroup: settings.libraryImportDefaultMachineGroup || undefined,
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
    }
  }

  function handleClear() {
    setLoadedFiles([]);
    setPreview([]);
    setParseError(null);
    setResult(null);
    setDuplicates([]);
    setSkipIndices(new Set());
  }

  function toggleSkip(idx: number) {
    setSkipIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function handleImport() {
    if (importCount === 0) return;
    setIsImporting(true);
    const allLibTools = isCsv
      ? (preview as LibraryTool[])
      : preview.map(toolToLibraryTool);
    const filtered = allLibTools.filter((_, i) => !skipIndices.has(i));
    const res = await onImport(filtered, overwrite);
    setResult(res);
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
            <p className="text-xs font-medium text-slate-400 mb-2">SOURCE FORMAT</p>
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
            </select>
          </div>

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
                      {skipIndices.size > 0 && ` (${skipIndices.size} skipped)`}
                    </span>
                    <ChevronDown size={11} className="ml-auto shrink-0" />
                  </summary>
                  <div className="px-3 pb-3 space-y-1.5">
                    <p className="text-xs text-slate-500 mb-2">Check a tool to skip it during import.</p>
                    {uniqueDups.map((dup) => {
                      const incoming = preview[dup.incomingIndex];
                      return (
                        <label key={dup.incomingIndex} className="flex items-start gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={skipIndices.has(dup.incomingIndex)}
                            onChange={() => toggleSkip(dup.incomingIndex)}
                            className="mt-0.5 w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-orange-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs text-blue-400">T{incoming.toolNumber}</span>
                              <span className="text-xs text-slate-300 truncate">{incoming.description}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${REASON_COLOURS[dup.reason]}`}>
                                {REASON_LABELS[dup.reason]}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              Matches: {dup.existingDescription}
                            </p>
                          </div>
                        </label>
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
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={importCount === 0 || isImporting}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                importCount > 0 && !isImporting
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              {isImporting ? 'Importing…' : `Add ${importCount > 0 ? importCount : ''} tools to Library`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
