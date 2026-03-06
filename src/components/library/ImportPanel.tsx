import { useState } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { registry } from '../../converters';
import type { LibraryTool } from '../../types/libraryTool';
import type { Tool } from '../../types/tool';
import FileDropZone from '../FileDropZone';
import FormatSelector from '../FormatSelector';
import { useSettings } from '../../contexts/SettingsContext';

interface ImportPanelProps {
  onImport: (tools: LibraryTool[], overwrite: boolean) => Promise<{ added: number; skipped: number }>;
  onClose:  () => void;
}

interface LoadedFile {
  name:    string;
  size:    number;
  content: string | ArrayBuffer;
}

export default function ImportPanel({ onImport, onClose }: ImportPanelProps) {
  const { settings } = useSettings();
  const importableFormats = registry.getImportableFormats();

  const [formatId,    setFormatId]    = useState(importableFormats[0]?.id ?? '');
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [preview,     setPreview]     = useState<Tool[]>([]);
  const [parseError,  setParseError]  = useState<string | null>(null);
  const [overwrite,   setOverwrite]   = useState(settings.libraryImportOverwrite);

  function toolToLibraryTool(tool: Tool): LibraryTool {
    const now = Date.now();
    return {
      ...tool,
      machineGroup: settings.libraryImportDefaultMachineGroup || undefined,
      tags:         [],
      starred:      false,
      addedAt:      now,
      updatedAt:    now,
    };
  }
  const [result,      setResult]      = useState<{ added: number; skipped: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const sourceFormat = importableFormats.find((f) => f.id === formatId);

  async function handleFilesLoaded(files: LoadedFile[]) {
    setLoadedFiles(files);
    setParseError(null);
    setPreview([]);
    setResult(null);

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
    }
  }

  function handleClear() {
    setLoadedFiles([]);
    setPreview([]);
    setParseError(null);
    setResult(null);
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setIsImporting(true);
    const libTools = preview.map(toolToLibraryTool);
    const res = await onImport(libTools, overwrite);
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
          <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Source format */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">SOURCE FORMAT</p>
            <FormatSelector
              label=""
              value={formatId}
              formats={importableFormats}
              onChange={(id) => { setFormatId(id); handleClear(); }}
            />
          </div>

          {/* File drop */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">FILES</p>
            <FileDropZone
              format={sourceFormat}
              onFilesLoaded={handleFilesLoaded}
              loadedFileNames={loadedFiles.map((f) => f.name)}
              onClear={handleClear}
            />
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
                <span><strong>{preview.length}</strong> tools ready to import</span>
              </div>

              {/* Preview list (first 6) */}
              <div className="rounded-lg border border-slate-700 divide-y divide-slate-700/60 overflow-hidden">
                {preview.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-xs bg-slate-800/60">
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

              {/* Duplicate handling */}
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
              disabled={preview.length === 0 || isImporting}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                preview.length > 0 && !isImporting
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              {isImporting ? 'Importing…' : `Add ${preview.length > 0 ? preview.length : ''} tools to Library`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
