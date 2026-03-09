import { useState } from 'react';
import { X, Printer, FileText } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import {
  DEFAULT_SHEET_OPTIONS,
  type SheetOptions,
  generateToolSheetPdf,
} from '../../lib/printUtils';

interface ToolSheetPanelProps {
  tools:   LibraryTool[];
  onClose: () => void;
}

function FieldToggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500"
      />
      <span className="text-xs text-slate-300">{label}</span>
    </label>
  );
}

export default function ToolSheetPanel({ tools, onClose }: ToolSheetPanelProps) {
  const [opts, setOpts] = useState<SheetOptions>(DEFAULT_SHEET_OPTIONS);

  function patch(p: Partial<SheetOptions>) {
    setOpts((prev) => ({ ...prev, ...p }));
  }

  function handlePrint() {
    generateToolSheetPdf(tools, opts);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[380px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <FileText size={14} className="text-slate-400" />
              Print Tool Sheet
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{tools.length} tool{tools.length !== 1 ? 's' : ''}</p>
          </div>
          <button type="button" title="Close" onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Layout */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Layout</p>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Cards per row</label>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patch({ columns: n })}
                    className={[
                      'px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      opts.columns === n
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500',
                    ].join(' ')}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {opts.columns === 1 && 'One large card per row — most detail per tool'}
                {opts.columns === 2 && 'Two cards per row — balanced density (default)'}
                {opts.columns === 3 && 'Three cards per row — most tools per page'}
              </p>
            </div>
          </div>

          {/* Sections */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Sections to include</p>
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 grid grid-cols-2 gap-y-2.5 gap-x-4">
              <FieldToggle label="Geometry"      checked={opts.showGeometry}      onChange={(v) => patch({ showGeometry: v })} />
              <FieldToggle label="Cutting params" checked={opts.showCutting}      onChange={(v) => patch({ showCutting: v })} />
              <FieldToggle label="Material"      checked={opts.showMaterial}      onChange={(v) => patch({ showMaterial: v })} />
              <FieldToggle label="Machine group"  checked={opts.showMachineGroup} onChange={(v) => patch({ showMachineGroup: v })} />
              <FieldToggle label="Tags"           checked={opts.showTags}         onChange={(v) => patch({ showTags: v })} />
              <FieldToggle label="Manufacturer"   checked={opts.showManufacturer} onChange={(v) => patch({ showManufacturer: v })} />
              <FieldToggle label="Comments"       checked={opts.showComment}      onChange={(v) => patch({ showComment: v })} />
              <FieldToggle label="Crib / Inventory" checked={opts.showCrib}       onChange={(v) => patch({ showCrib: v })} />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <Printer size={14} />
            Print {tools.length} tool{tools.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </>
  );
}
