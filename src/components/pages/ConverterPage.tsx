import { useState, useEffect } from 'react';
import { ArrowRight, RefreshCw, AlertCircle, ArrowLeftRight, CheckCircle, AlertTriangle, ChevronDown, Clock, X, Map, FolderOpen, FileText } from 'lucide-react';
import { registry } from '../../converters';
import type { Tool } from '../../types/tool';
import type { ParseResult, WriteResult } from '../../types/converter';
import FileDropZone from '../FileDropZone';
import BatchFolderDropZone from '../converter/BatchFolderDropZone';
import FormatSelector from '../FormatSelector';
import ToolTable from '../ToolTable';
import ConversionOutput from '../ConversionOutput';
import FieldMappingEditor from '../converter/FieldMappingEditor';
import { useSettings, loadLastFormatPair, saveLastFormatPair } from '../../contexts/SettingsContext';
import { useRecentFiles } from '../../hooks/useRecentFiles';
import { loadMapping, applyFieldMapping } from '../../lib/fieldMapping';

interface LoadedFile {
  name:    string;
  size:    number;
  content: string | ArrayBuffer;
}

type Stage = 'idle' | 'loaded' | 'converted';

// Fields lost when converting HSMLib → LinuxCNC
const HSMLIB_TO_LINUXCNC_LOST = [
  'Named cutting presets (speed/feed per machine/material)',
  'NC parameters (break-control, live-tool, turret)',
  'Comments, product IDs, and manufacturer info',
];

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ConverterPage() {
  const { settings } = useSettings();
  const { recentFiles, addRecent, removeRecent, clearRecent } = useRecentFiles();

  // ── Format state (with optional localStorage memory) ─────────────────────
  const [sourceFormatId, setSourceFormatId] = useState<string>(() => {
    if (settings.rememberLastFormatPair) {
      const pair = loadLastFormatPair();
      if (pair) return pair.source;
    }
    return 'hsmlib';
  });
  const [targetFormatId, setTargetFormatId] = useState<string>(() => {
    if (settings.rememberLastFormatPair) {
      const pair = loadLastFormatPair();
      if (pair) return pair.target;
    }
    return 'linuxcnc';
  });

  // Persist format pair whenever it changes
  useEffect(() => {
    if (settings.rememberLastFormatPair) {
      saveLastFormatPair(sourceFormatId, targetFormatId);
    }
  }, [sourceFormatId, targetFormatId, settings.rememberLastFormatPair]);

  // ── Core state ────────────────────────────────────────────────────────────
  const [loadedFiles,      setLoadedFiles]      = useState<LoadedFile[]>([]);
  const [tools,            setTools]            = useState<Tool[]>([]);
  const [parseWarnings,    setParseWarnings]    = useState<string[]>([]);
  const [parseErrors,      setParseErrors]      = useState<string[]>([]);
  const [writeResults,     setWriteResults]     = useState<WriteResult[]>([]);
  const [selectedResult,   setSelectedResult]   = useState(0);
  const [isConverting,     setIsConverting]     = useState(false);
  const [stage,            setStage]            = useState<Stage>('idle');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [batchMode,        setBatchMode]        = useState(false);

  // Ctrl+Enter → Convert
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (tools.length > 0 && !isConverting) {
          void doConvert(tools, targetFormatId, loadedFiles, sourceFormatId, loadedFiles[0]?.name);
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools, isConverting, targetFormatId, loadedFiles, sourceFormatId]);

  const importableFormats = registry.getImportableFormats();
  const exportableFormats = registry.getExportableFormats();
  const sourceFormat      = importableFormats.find((f) => f.id === sourceFormatId);
  const targetFormat      = exportableFormats.find( (f) => f.id === targetFormatId);

  // Writer options derived from settings
  function writerOptions(filename?: string) {
    return {
      filename,
      linuxcncDecimalPlaces:        settings.linuxcncDecimalPlaces,
      linuxcncStartingToolNumber:   settings.linuxcncStartingToolNumber,
      linuxcncPocketAssignment:     settings.linuxcncPocketAssignment,
      linuxcncIncludeHeaderComment: settings.linuxcncIncludeHeaderComment,
      hsmlibMachineVendor:          settings.hsmlibDefaultMachineVendor || undefined,
      hsmlibMachineModel:           settings.hsmlibDefaultMachineModel  || undefined,
    };
  }

  // ── Core convert ─────────────────────────────────────────────────────────
  async function doConvert(
    toolsToConvert: Tool[],
    tgtFmtId:       string,
    files:          LoadedFile[],
    srcFmtId:       string,
    sourceFilename?: string,
  ) {
    const targetConverter = registry.getConverter(tgtFmtId);
    if (!targetConverter || toolsToConvert.length === 0) return;

    const mapping = loadMapping(srcFmtId, tgtFmtId);

    setIsConverting(true);
    try {
      if (settings.mergeBehavior === 'separate' && files.length > 1) {
        // Convert each file independently
        const srcConverter = registry.getConverter(srcFmtId);
        if (!srcConverter) return;

        const results: WriteResult[] = [];
        for (const file of files) {
          const parsed: ParseResult = await srcConverter.parse(file.content, file.name);
          const mapped = applyFieldMapping(parsed.tools, mapping);
          const r = await targetConverter.write(mapped, writerOptions(file.name));
          results.push(r);
        }
        setWriteResults(results);
        setSelectedResult(0);
      } else {
        // Merge: convert all tools together
        const mapped = applyFieldMapping(toolsToConvert, mapping);
        const r = await targetConverter.write(mapped, writerOptions(sourceFilename));
        setWriteResults([r]);
        setSelectedResult(0);
      }
      setStage('converted');
      addRecent({
        name:         files[0]?.name ?? 'unknown',
        sourceFormat: srcFmtId,
        targetFormat: tgtFmtId,
        toolCount:    toolsToConvert.length,
        convertedAt:  Date.now(),
      });
    } catch (err) {
      setParseErrors((prev) => [...prev, `Conversion error: ${err}`]);
    }
    setIsConverting(false);
  }

  // ── Load + parse ──────────────────────────────────────────────────────────
  async function handleFilesLoaded(files: LoadedFile[]) {
    const converter = registry.getConverter(sourceFormatId);
    if (!converter) return;

    setLoadedFiles(files);
    setParseWarnings([]);
    setParseErrors([]);
    setWriteResults([]);

    const allTools:    Tool[]   = [];
    const allWarnings: string[] = [];
    const allErrors:   string[] = [];

    for (const file of files) {
      const result: ParseResult = await converter.parse(file.content, file.name);
      allTools.push(...result.tools);
      allWarnings.push(...result.warnings);
      allErrors.push(...result.errors);
    }

    setTools(allTools);
    setParseWarnings(allWarnings);
    setParseErrors(allErrors);
    setStage('loaded');

    if (allTools.length > 0 && allErrors.length === 0 && settings.autoConvertOnLoad) {
      await doConvert(allTools, targetFormatId, files, sourceFormatId, files[0]?.name);
    }
  }

  function handleConvert() {
    doConvert(tools, targetFormatId, loadedFiles, sourceFormatId, loadedFiles[0]?.name);
  }

  function handleClear() {
    setLoadedFiles([]);
    setTools([]);
    setParseWarnings([]);
    setParseErrors([]);
    setWriteResults([]);
    setStage('idle');
    setShowClearConfirm(false);
  }

  function handleSourceChange(id: string) {
    setSourceFormatId(id);
    handleClear();
  }

  function handleTargetChange(id: string) {
    setTargetFormatId(id);
    setWriteResults([]);
    if (tools.length > 0) {
      doConvert(tools, id, loadedFiles, sourceFormatId, loadedFiles[0]?.name);
    }
  }

  function handleSwap() {
    if (
      importableFormats.some((f) => f.id === targetFormatId) &&
      exportableFormats.some( (f) => f.id === sourceFormatId)
    ) {
      setSourceFormatId(targetFormatId);
      setTargetFormatId(sourceFormatId);
      handleClear();
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const showDataLossWarning =
    settings.warnOnDataLoss &&
    sourceFormatId === 'hsmlib' &&
    targetFormatId === 'linuxcnc';

  const activeResult = writeResults[selectedResult] ?? null;

  function StatusBadge() {
    if (stage === 'idle') return null;
    if (parseErrors.length > 0) return (
      <span className="flex items-center gap-1.5 text-xs text-red-400">
        <AlertCircle size={13} /> {parseErrors.length} error(s)
      </span>
    );
    if (stage === 'converted') {
      const label = writeResults.length > 1
        ? `${writeResults.length} files converted`
        : `${tools.length} tools converted`;
      return (
        <span className="flex items-center gap-1.5 text-xs text-green-400">
          <CheckCircle size={13} /> {label}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-xs text-blue-400">
        <CheckCircle size={13} /> {tools.length} tools loaded
      </span>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 gap-5 overflow-auto">

      {/* Format selector bar */}
      <div className="flex items-start gap-4 shrink-0 flex-wrap">
        <div className="flex-1 min-w-[180px] max-w-xs">
          <FormatSelector
            label="Source Format"
            value={sourceFormatId}
            formats={importableFormats}
            onChange={handleSourceChange}
          />
        </div>

        {/* mt aligns button with the select box (skips the label above) */}
        <button
          onClick={handleSwap}
          title="Swap source and target"
          className="mt-[22px] p-2 rounded-lg bg-slate-700 border border-slate-600 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeftRight size={16} />
        </button>

        <div className="flex-1 min-w-[180px] max-w-xs">
          <FormatSelector
            label="Target Format"
            value={targetFormatId}
            formats={exportableFormats}
            onChange={handleTargetChange}
          />
        </div>

        <button
          onClick={handleConvert}
          disabled={tools.length === 0 || isConverting}
          className={[
            'mt-[22px] flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
            tools.length > 0 && !isConverting
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-900/50'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed',
          ].join(' ')}
        >
          {isConverting
            ? <RefreshCw size={15} className="animate-spin" />
            : <ArrowRight size={15} />}
          Convert
        </button>

        {/* Map fields button — shows active dot when rules exist */}
        {(() => {
          const activeRules = loadMapping(sourceFormatId, targetFormatId).rules.length;
          return (
            <button
              onClick={() => setShowFieldMapping(true)}
              title="Customize field mapping"
              className={[
                'mt-[22px] relative p-2 rounded-lg border transition-colors',
                activeRules > 0
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 hover:bg-blue-500/20'
                  : 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-slate-300 hover:text-white',
              ].join(' ')}
            >
              <Map size={16} />
              {activeRules > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {activeRules}
                </span>
              )}
            </button>
          );
        })()}

        <div className="mt-[22px] flex items-center">
          <StatusBadge />
        </div>
      </div>

      {/* Data loss warning */}
      {showDataLossWarning && (
        <details className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10" open>
          <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none text-xs text-amber-300 hover:text-amber-200">
            <AlertTriangle size={13} className="shrink-0" />
            <span className="font-medium">Some HSMLib fields have no LinuxCNC equivalent and will not appear in the output.</span>
            <ChevronDown size={12} className="ml-auto shrink-0" />
          </summary>
          <ul className="px-3 pb-2.5 space-y-0.5 text-xs text-amber-400/80 list-disc list-inside">
            {HSMLIB_TO_LINUXCNC_LOST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="shrink-0 space-y-1.5">
          {parseErrors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {e}
            </div>
          ))}
        </div>
      )}

      {/* Parse warnings */}
      {parseWarnings.length > 0 && (
        <details className="shrink-0 text-xs text-amber-400 cursor-pointer">
          <summary className="select-none hover:text-amber-300">
            {parseWarnings.length} parse warning(s) — click to expand
          </summary>
          <ul className="mt-2 space-y-1 pl-4 list-disc">
            {parseWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </details>
      )}

      {/* Main content */}
      {stage === 'idle' ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-6">
          <div className="w-full max-w-md">
            <p className="text-center text-slate-400 text-sm mb-3">
              Load{' '}
              <span className="text-slate-200 font-medium">
                {sourceFormat?.name ?? 'source'}
              </span>{' '}
              files to begin.{' '}
              {settings.mergeBehavior === 'merge'
                ? 'Multiple files are merged into a single output.'
                : 'Multiple files are converted separately.'}
            </p>

            {/* File / Folder mode toggle */}
            <div className="flex items-center gap-1 mb-3 p-1 rounded-lg bg-slate-800 border border-slate-700 w-fit mx-auto">
              <button
                onClick={() => setBatchMode(false)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors',
                  !batchMode ? 'bg-slate-600 text-slate-100' : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                <FileText size={12} /> Files
              </button>
              <button
                onClick={() => setBatchMode(true)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors',
                  batchMode ? 'bg-slate-600 text-slate-100' : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                <FolderOpen size={12} /> Folder
              </button>
            </div>

            {batchMode ? (
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

          {/* Recent conversions */}
          {recentFiles.length > 0 && (
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <Clock size={11} />
                  Recent
                </span>
                <button onClick={clearRecent} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  Clear all
                </button>
              </div>
              <div className="rounded-xl border border-slate-700 divide-y divide-slate-700/60 overflow-hidden">
                {recentFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs bg-slate-800/40 hover:bg-slate-700/40 transition-colors">
                    <span className="text-slate-300 truncate flex-1" title={f.name}>{f.name}</span>
                    <span className="text-slate-500 shrink-0">
                      {f.sourceFormat} → {f.targetFormat}
                    </span>
                    <span className="text-slate-600 shrink-0">{f.toolCount}T</span>
                    <span className="text-slate-600 shrink-0">{relativeTime(f.convertedAt)}</span>
                    <button
                      onClick={() => removeRecent(i)}
                      title="Remove from history"
                      className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5 flex-1 min-h-0">

          {/* Parsed tool table */}
          <div className="shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-200">
                Parsed Tools
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
                  {tools.length}
                </span>
                <span className="ml-2 text-xs font-normal text-slate-500">
                  from {loadedFiles.length} file{loadedFiles.length !== 1 ? 's' : ''}
                </span>
              </h2>
              {showClearConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Clear all?</span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Yes, clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Clear &amp; reset
                </button>
              )}
            </div>
            <div
              className="overflow-auto rounded-xl border border-slate-700 max-h-[280px]"
            >
              <ToolTable tools={tools} />
            </div>
          </div>

          {/* Converted output */}
          <div className="flex flex-col flex-1 min-h-[260px]">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="text-sm font-semibold text-slate-200">Converted Output</h2>
              {targetFormat && (
                <span className="text-xs text-slate-500">→ {targetFormat.name}</span>
              )}

              {/* File selector for separate mode */}
              {writeResults.length > 1 && (
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">File:</span>
                  <select
                    value={selectedResult}
                    onChange={(e) => setSelectedResult(Number(e.target.value))}
                    aria-label="Select output file"
                    className="text-xs bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {writeResults.map((r, i) => (
                      <option key={i} value={i}>{r.filename}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex-1">
              <ConversionOutput result={activeResult} isConverting={isConverting} />
            </div>
          </div>

        </div>
      )}

      {/* Field mapping editor slide-over */}
      {showFieldMapping && (
        <FieldMappingEditor
          sourceFormatId={sourceFormatId}
          targetFormatId={targetFormatId}
          onClose={() => setShowFieldMapping(false)}
        />
      )}
    </div>
  );
}
