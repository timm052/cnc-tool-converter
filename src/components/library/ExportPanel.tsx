import { useState } from 'react';
import { X, Download, Layers } from 'lucide-react';
import { registry } from '../../converters';
import type { LibraryTool } from '../../types/libraryTool';
import type { WorkMaterial } from '../../types/material';
import { useSettings } from '../../contexts/SettingsContext';
import FormatSelector from '../FormatSelector';
import { toolsToCsv } from '../../lib/csvLibrary';

interface ExportPanelProps {
  selectedTools: LibraryTool[];
  allMaterials:  WorkMaterial[];
  onClose:       () => void;
}

const CSV_FORMAT_ID = 'csv';

function triggerDownload(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPanel({ selectedTools, allMaterials, onClose }: ExportPanelProps) {
  const { settings } = useSettings();
  const exportableFormats = registry.getExportableFormats();

  const [formatId,         setFormatId]         = useState(exportableFormats[0]?.id ?? '');
  const [splitByMaterial,  setSplitByMaterial]  = useState(false);
  const [isExporting,      setIsExporting]      = useState(false);

  const isCsv = formatId === CSV_FORMAT_ID;

  // Tools that have at least one material entry
  const toolsWithMaterials = selectedTools.filter((t) => (t.toolMaterials?.length ?? 0) > 0);
  const canSplit = !isCsv && toolsWithMaterials.length > 0;

  const writerOpts = {
    filename:                     'library-export',
    linuxcncDecimalPlaces:        settings.linuxcncDecimalPlaces,
    linuxcncStartingToolNumber:   settings.linuxcncStartingToolNumber,
    linuxcncPocketAssignment:     settings.linuxcncPocketAssignment,
    linuxcncIncludeHeaderComment: settings.linuxcncIncludeHeaderComment,
    hsmlibMachineVendor:          settings.hsmlibDefaultMachineVendor || undefined,
    hsmlibMachineModel:           settings.hsmlibDefaultMachineModel  || undefined,
  };

  async function handleDownload() {
    setIsExporting(true);
    try {
      if (isCsv) {
        const csv = toolsToCsv(selectedTools);
        triggerDownload(csv, 'text/csv', 'library-export.csv');
        onClose();
        return;
      }

      const converter = registry.getConverter(formatId);
      if (!converter) return;

      if (!splitByMaterial) {
        // Single file export
        const result = await converter.write(selectedTools, writerOpts);
        triggerDownload(result.content, result.mimeType, result.filename);
        onClose();
        return;
      }

      // Split by material — one file per unique materialId across selected tools
      const matMap = new Map<string, LibraryTool[]>();
      for (const tool of selectedTools) {
        for (const entry of tool.toolMaterials ?? []) {
          const list = matMap.get(entry.materialId) ?? [];
          list.push(tool);
          matMap.set(entry.materialId, list);
        }
      }

      // Tools with no materials go into an "unassigned" file if any
      const unassigned = selectedTools.filter((t) => !t.toolMaterials?.length);

      let fileIndex = 0;
      for (const [materialId, tools] of matMap) {
        const mat     = allMaterials.find((m) => m.id === materialId);
        const matName = (mat?.name ?? materialId).replace(/[^a-z0-9_-]/gi, '_');

        // Merge this material's F&S into each tool's cutting params
        const mergedTools: LibraryTool[] = tools.map((tool) => {
          const entry = tool.toolMaterials!.find((e) => e.materialId === materialId)!;
          return {
            ...tool,
            cutting: {
              ...tool.cutting,
              ...(entry.rpm            !== undefined ? { spindleRpm:     entry.rpm            } : {}),
              ...(entry.rampSpindleRpm !== undefined ? { rampSpindleRpm: entry.rampSpindleRpm } : {}),
              ...(entry.feedRate       !== undefined ? { feedCutting:    entry.feedRate        } : {}),
              ...(entry.feedPlunge     !== undefined ? { feedPlunge:     entry.feedPlunge      } : {}),
              ...(entry.feedRamp       !== undefined ? { feedRamp:       entry.feedRamp        } : {}),
              ...(entry.feedEntry      !== undefined ? { feedEntry:      entry.feedEntry       } : {}),
              ...(entry.feedExit       !== undefined ? { feedExit:       entry.feedExit        } : {}),
              ...(entry.feedRetract    !== undefined ? { feedRetract:    entry.feedRetract     } : {}),
              ...(entry.coolant        !== undefined ? { coolant:        entry.coolant         } : {}),
              ...(entry.feedMode       !== undefined ? { feedMode:       entry.feedMode        } : {}),
              ...(entry.clockwise      !== undefined ? { clockwise:      entry.clockwise       } : {}),
            },
          };
        });

        const result = await converter.write(mergedTools, {
          ...writerOpts,
          filename: `export_${matName}`,
        });

        // Stagger downloads slightly so browsers don't block them
        await new Promise<void>((resolve) => setTimeout(() => {
          triggerDownload(result.content, result.mimeType, result.filename);
          resolve();
        }, fileIndex * 300));
        fileIndex++;
      }

      // Export unassigned tools as a separate file
      if (unassigned.length > 0) {
        const result = await converter.write(unassigned, {
          ...writerOpts,
          filename: 'export_unassigned',
        });
        await new Promise<void>((resolve) => setTimeout(() => {
          triggerDownload(result.content, result.mimeType, result.filename);
          resolve();
        }, fileIndex * 300));
      }

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
          <button type="button" title="Close" onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
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
                  {(t.toolMaterials?.length ?? 0) > 0 && (
                    <span className="shrink-0 text-emerald-400">{t.toolMaterials!.length}M</span>
                  )}
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
              title="Target format"
              value={formatId}
              onChange={(e) => { setFormatId(e.target.value); setSplitByMaterial(false); }}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {exportableFormats.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
              <option value={CSV_FORMAT_ID}>CSV (spreadsheet)</option>
            </select>
          </div>

          {/* Split by material */}
          {canSplit && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-slate-400" />
                  <span className="text-sm text-slate-200 font-medium">Split by material</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={splitByMaterial}
                  title="Toggle split by material"
                  onClick={() => setSplitByMaterial((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${splitByMaterial ? 'bg-blue-600' : 'bg-slate-600'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${splitByMaterial ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {splitByMaterial && (
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generates one file per material ({toolsWithMaterials.length} tool{toolsWithMaterials.length !== 1 ? 's' : ''} with materials). Each file has the material's F&S merged into the cutting params.
                </p>
              )}
              {!splitByMaterial && (
                <p className="text-xs text-slate-500">
                  {toolsWithMaterials.length} of {selectedTools.length} tools have per-material F&S data.
                </p>
              )}
            </div>
          )}

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
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            Cancel
          </button>
          <button
            type="button"
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
            {isExporting ? 'Exporting…' : splitByMaterial ? 'Download files' : 'Download'}
          </button>
        </div>
      </div>
    </>
  );
}
