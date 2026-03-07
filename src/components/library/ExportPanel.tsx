import { useState } from 'react';
import { X, Download } from 'lucide-react';
import { registry } from '../../converters';
import type { LibraryTool } from '../../types/libraryTool';
import { useSettings } from '../../contexts/SettingsContext';
import FormatSelector from '../FormatSelector';
import { toolsToCsv } from '../../lib/csvLibrary';

interface ExportPanelProps {
  selectedTools: LibraryTool[];
  onClose:       () => void;
}

const CSV_FORMAT_ID = 'csv';

export default function ExportPanel({ selectedTools, onClose }: ExportPanelProps) {
  const { settings } = useSettings();
  const exportableFormats = registry.getExportableFormats();

  const [formatId,    setFormatId]    = useState(exportableFormats[0]?.id ?? '');
  const [isExporting, setIsExporting] = useState(false);

  const isCsv = formatId === CSV_FORMAT_ID;

  async function handleDownload() {
    setIsExporting(true);
    try {
      if (isCsv) {
        const csv  = toolsToCsv(selectedTools);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'library-export.csv';
        a.click();
        URL.revokeObjectURL(url);
        onClose();
        return;
      }

      const converter = registry.getConverter(formatId);
      if (!converter) return;

      const result = await converter.write(selectedTools, {
        filename:                     'library-export',
        linuxcncDecimalPlaces:        settings.linuxcncDecimalPlaces,
        linuxcncStartingToolNumber:   settings.linuxcncStartingToolNumber,
        linuxcncPocketAssignment:     settings.linuxcncPocketAssignment,
        linuxcncIncludeHeaderComment: settings.linuxcncIncludeHeaderComment,
        hsmlibMachineVendor:          settings.hsmlibDefaultMachineVendor || undefined,
        hsmlibMachineModel:           settings.hsmlibDefaultMachineModel  || undefined,
      });

      const blob = new Blob([result.content], { type: result.mimeType });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);

      onClose();
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[400px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-100">Export Tools</h2>
          <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Selection summary */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3">
            <p className="text-sm text-slate-200 font-medium">
              {selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''} selected
            </p>
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {selectedTools.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-blue-400">T{t.toolNumber}</span>
                  <span className="truncate">{t.description}</span>
                </div>
              ))}
              {selectedTools.length > 10 && (
                <p className="text-xs text-slate-500">…and {selectedTools.length - 10} more</p>
              )}
            </div>
          </div>

          {/* Target format */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">TARGET FORMAT</p>
            <select
              value={formatId}
              onChange={(e) => setFormatId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {exportableFormats.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
              <option value={CSV_FORMAT_ID}>CSV (spreadsheet)</option>
            </select>
          </div>

          {/* Settings note */}
          {!isCsv && (
            <p className="text-xs text-slate-500">
              Format-specific options (decimal places, pocket assignment, etc.) are applied from
              your <span className="text-slate-400">Settings → LinuxCNC Writer</span> preferences.
            </p>
          )}
          {isCsv && (
            <p className="text-xs text-slate-500">
              Exports a flat spreadsheet with tool geometry, cutting parameters, tags, and machine group.
              Can be re-imported via Import → CSV (spreadsheet).
            </p>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              !isExporting
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            <Download size={14} />
            {isExporting ? 'Exporting…' : 'Download'}
          </button>
        </div>
      </div>
    </>
  );
}
