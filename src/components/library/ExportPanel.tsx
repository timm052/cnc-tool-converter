import { useState } from 'react';
import { X, Download, Layers, Server } from 'lucide-react';
import { registry } from '../../converters';
import type { LibraryTool } from '../../types/libraryTool';
import type { WorkMaterial } from '../../types/material';
import { useSettings } from '../../contexts/SettingsContext';
import { triggerDownload, triggerBinaryDownload } from '../../lib/downloadUtils';
import { isTauri } from '../../lib/tauri/fs';
import { exportToolsToXlsx } from '../../lib/xlsxExport';
import { resolveToolForExport } from '../../lib/toolInstance';
import FieldToggle from '../ui/FieldToggle';

interface ExportPanelProps {
  selectedTools: LibraryTool[];
  allMaterials:  WorkMaterial[];
  onClose:       () => void;
}

type SplitMode = 'none' | 'material' | 'machine';

/** Formats where splitting doesn't add value (CSV/XLSX already contains all fields) */
const NO_SPLIT_FORMATS = new Set(['csv', 'mach3', 'xlsx']);

export default function ExportPanel({ selectedTools, allMaterials, onClose }: ExportPanelProps) {
  const { settings } = useSettings();
  const exportableFormats = registry.getExportableFormats();

  const [formatId,          setFormatId]          = useState(exportableFormats[0]?.id ?? 'xlsx');
  const [splitMode,         setSplitMode]         = useState<SplitMode>('none');
  const [isExporting,       setIsExporting]       = useState(false);
  const [useActualDiameter, setUseActualDiameter] = useState(false);

  // Tools resolved with active-instance data (offsets + optional actual diameter)
  const resolvedTools = selectedTools.map((t) => resolveToolForExport(t, useActualDiameter));

  const noSplit = NO_SPLIT_FORMATS.has(formatId);

  // Tools that have at least one material entry
  const toolsWithMaterials = selectedTools.filter((t) => (t.toolMaterials?.length ?? 0) > 0);
  // Unique machine groups across selected tools
  const allGroups = Array.from(new Set(selectedTools.flatMap((t) => t.machineGroups ?? []))).sort();

  const canSplitMaterial = !noSplit && toolsWithMaterials.length > 0;
  const canSplitMachine  = !noSplit && allGroups.length > 0;

  const writerOpts = {
    filename:                     'library-export',
    linuxcncDecimalPlaces:        settings.linuxcncDecimalPlaces,
    linuxcncStartingToolNumber:   settings.linuxcncStartingToolNumber,
    linuxcncPocketAssignment:     settings.linuxcncPocketAssignment,
    linuxcncIncludeHeaderComment: settings.linuxcncIncludeHeaderComment,
    hsmlibMachineVendor:          settings.hsmlibDefaultMachineVendor || undefined,
    hsmlibMachineModel:           settings.hsmlibDefaultMachineModel  || undefined,
  };

  // Helper: stagger multiple file downloads so browsers don't block them.
  // In Tauri each save shows a native dialog, so no stagger is needed.
  async function staggeredDownload(items: { content: string | Uint8Array; mimeType: string; filename: string }[]) {
    for (let i = 0; i < items.length; i++) {
      const c = items[i].content;
      if (isTauri()) {
        await triggerDownload(typeof c === 'string' ? c : new TextDecoder().decode(c), items[i].mimeType, items[i].filename);
      } else {
        await new Promise<void>((resolve) => setTimeout(async () => {
          await triggerDownload(typeof c === 'string' ? c : new TextDecoder().decode(c), items[i].mimeType, items[i].filename);
          resolve();
        }, i * 300));
      }
    }
  }

  async function handleDownload() {
    setIsExporting(true);
    try {
      // ── Excel (.xlsx) ────────────────────────────────────────────────────────
      if (formatId === 'xlsx') {
        const date = new Date().toISOString().slice(0, 10);
        const bytes = exportToolsToXlsx(selectedTools);
        await triggerBinaryDownload(bytes.buffer as ArrayBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `tool-library-${date}.xlsx`);
        onClose();
        return;
      }

      const converter = registry.getConverter(formatId);
      if (!converter) return;

      // ── Single file ──────────────────────────────────────────────────────────
      if (splitMode === 'none') {
        const result = await converter.write(resolvedTools, writerOpts);
        await triggerDownload(result.content, result.mimeType, result.filename);
        onClose();
        return;
      }

      // ── Split by material ────────────────────────────────────────────────────
      if (splitMode === 'material') {
        const matMap = new Map<string, LibraryTool[]>();
        for (const tool of resolvedTools) {
          for (const entry of tool.toolMaterials ?? []) {
            const list = matMap.get(entry.materialId) ?? [];
            list.push(tool);
            matMap.set(entry.materialId, list);
          }
        }
        const unassigned = resolvedTools.filter((t) => !t.toolMaterials?.length);
        const files: { content: string | Uint8Array; mimeType: string; filename: string }[] = [];

        for (const [materialId, tools] of matMap) {
          const mat      = allMaterials.find((m) => m.id === materialId);
          const matName  = (mat?.name ?? materialId).replace(/[^a-z0-9_-]/gi, '_');
          const merged   = tools.map((tool) => {
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
          const result = await converter.write(merged, { ...writerOpts, filename: `export_${matName}` });
          files.push(result);
        }
        if (unassigned.length > 0) {
          const result = await converter.write(unassigned, { ...writerOpts, filename: 'export_unassigned' });
          files.push(result);
        }
        await staggeredDownload(files);
        onClose();
        return;
      }

      // ── Split by machine group ───────────────────────────────────────────────
      if (splitMode === 'machine') {
        const files: { content: string | Uint8Array; mimeType: string; filename: string }[] = [];

        for (const group of allGroups) {
          const groupTools = resolvedTools.filter((t) => (t.machineGroups ?? []).includes(group));
          if (groupTools.length === 0) continue;
          const safeName = group.replace(/[^a-z0-9_-]/gi, '_');
          // For formats that expect a single machine group, pin it to the current group
          const pinned: LibraryTool[] = groupTools.map((t) => ({
            ...t,
            machineGroups: [group],
          }));
          const result = await converter.write(pinned, { ...writerOpts, filename: `export_${safeName}` });
          files.push(result);
        }
        // Tools belonging to no group
        const ungrouped = resolvedTools.filter((t) => !(t.machineGroups ?? []).length);
        if (ungrouped.length > 0) {
          const result = await converter.write(ungrouped, { ...writerOpts, filename: 'export_ungrouped' });
          files.push(result);
        }
        await staggeredDownload(files);
        onClose();
        return;
      }
    } finally {
      setIsExporting(false);
    }
  }

  function SplitToggle({ mode, label, description, disabled, icon: Icon }: {
    mode: SplitMode; label: string; description: string; disabled?: boolean; icon: typeof Layers;
  }) {
    const active = splitMode === mode;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setSplitMode(active ? 'none' : mode)}
        className={[
          'w-full text-left rounded-lg border px-4 py-3 transition-colors',
          disabled ? 'opacity-40 cursor-not-allowed border-slate-700 bg-slate-800/40' :
          active   ? 'border-blue-500/60 bg-blue-600/10' : 'border-slate-700 bg-slate-800/60 hover:border-slate-600',
        ].join(' ')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={14} className={active ? 'text-blue-400' : 'text-slate-400'} />
            <span className={`text-sm font-medium ${active ? 'text-blue-300' : 'text-slate-200'}`}>{label}</span>
          </div>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-blue-400' : 'border-slate-600'}`}>
            {active && <div className="w-2 h-2 rounded-full bg-blue-400" />}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
      </button>
    );
  }

  const downloadLabel = splitMode !== 'none' ? 'Download files' : 'Download';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
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
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {selectedTools.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-blue-400">T{t.toolNumber}</span>
                  <span className="truncate">{t.description}</span>
                  {(t.machineGroups?.length ?? 0) > 0 && (
                    <span className="shrink-0 text-blue-300">{t.machineGroups!.join(', ')}</span>
                  )}
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
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Target format</p>
            <select
              title="Target format"
              value={formatId}
              onChange={(e) => { setFormatId(e.target.value); setSplitMode('none'); }}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="xlsx">Excel (.xlsx)</option>
              {exportableFormats.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Split options — hidden for formats that don't benefit from splitting */}
          {!noSplit && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Split output</p>
              <div className="space-y-2">
                <SplitToggle
                  mode="machine"
                  label="Split by machine group"
                  icon={Server}
                  disabled={!canSplitMachine}
                  description={
                    canSplitMachine
                      ? `One file per machine group (${allGroups.length} groups). Tools belonging to multiple groups appear in each relevant file.`
                      : 'No tools have machine groups assigned.'
                  }
                />
                <SplitToggle
                  mode="material"
                  label="Split by material"
                  icon={Layers}
                  disabled={!canSplitMaterial}
                  description={
                    canSplitMaterial
                      ? `One file per material (${toolsWithMaterials.length} tool${toolsWithMaterials.length !== 1 ? 's' : ''} with material F&S). Each file merges the material's cutting params into the tool.`
                      : 'No tools have per-material F&S data.'
                  }
                />
              </div>
            </div>
          )}

          {/* Active instance */}
          {!noSplit && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Active instance</p>
              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                <FieldToggle
                  label="Use actual diameter"
                  checked={useActualDiameter}
                  onChange={setUseActualDiameter}
                />
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Replaces the nominal diameter with the active instance's measured actual diameter, where set.
                  Active-instance offsets are always applied.
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          {formatId === 'xlsx' && (
            <p className="text-xs text-slate-500">
              Exports a spreadsheet with all tool fields including geometry, cutting parameters, tags, and machine groups. Open in Excel or Google Sheets.
            </p>
          )}
          {formatId === 'csv' && (
            <p className="text-xs text-slate-500">
              Exports a flat spreadsheet with tool geometry, cutting parameters, tags, and machine groups.
            </p>
          )}
          {formatId === 'linuxcnc' && (
            <p className="text-xs text-slate-500">
              Format-specific options are applied from{' '}
              <span className="text-slate-400">Settings → LinuxCNC Writer</span>.
            </p>
          )}
          {(formatId === 'haas' || formatId === 'fanuc') && (
            <p className="text-xs text-slate-500">
              Exports tool length and diameter offsets. Length offset sourced from Z-offset field; geometry
              is not carried by these formats.
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
              !isExporting ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            <Download size={14} />
            {isExporting ? 'Exporting…' : downloadLabel}
          </button>
        </div>
      </div>
    </>
  );
}
