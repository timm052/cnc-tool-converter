import { useState } from 'react';
import { X, FileText, AlignLeft } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import {
  DEFAULT_TOOL_OFFSET_OPTIONS,
  type ToolOffsetOptions,
  downloadOffsetTxt,
  generateOffsetPdf,
} from '../../lib/gcodeOffsetSheet';
import FieldToggle from '../ui/FieldToggle';

interface ToolOffsetSheetPanelProps {
  tools:   LibraryTool[];
  onClose: () => void;
}

export default function ToolOffsetSheetPanel({ tools, onClose }: ToolOffsetSheetPanelProps) {
  const [opts, setOpts]     = useState<ToolOffsetOptions>(DEFAULT_TOOL_OFFSET_OPTIONS);
  const [isBusy, setIsBusy] = useState(false);

  function patch(p: Partial<ToolOffsetOptions>) {
    setOpts((prev) => ({ ...prev, ...p }));
  }

  async function handleExport(format: 'pdf' | 'txt') {
    setIsBusy(true);
    try {
      if (format === 'pdf') {
        await generateOffsetPdf(tools, opts);
      } else {
        await downloadOffsetTxt(tools, opts);
      }
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[360px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-slate-400" />
              <h2 className="text-base font-semibold text-slate-100">Tool Offset Sheet</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{tools.length} tool{tools.length !== 1 ? 's' : ''}</p>
          </div>
          <button type="button" title="Close" onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Fields */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Fields to include</p>
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 grid grid-cols-2 gap-y-2.5 gap-x-4">
              <FieldToggle label="Type"            checked={opts.showType}          onChange={(v) => patch({ showType: v })} />
              <FieldToggle label="Diameter"        checked={opts.showDiameter}      onChange={(v) => patch({ showDiameter: v })} />
              <FieldToggle label="Z-Offset"        checked={opts.showZOffset}       onChange={(v) => patch({ showZOffset: v })} />
              <FieldToggle label="Flutes"          checked={opts.showFlutes}        onChange={(v) => patch({ showFlutes: v })} />
              <FieldToggle label="Machine group"   checked={opts.showMachine}       onChange={(v) => patch({ showMachine: v })} />
              <FieldToggle label="Use actual Ø"    checked={opts.useActualDiameter} onChange={(v) => patch({ useActualDiameter: v })} />
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Sort order</p>
            <div className="flex gap-2">
              {(['toolNumber', 'description'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch({ sortBy: s })}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    opts.sortBy === s
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500',
                  ].join(' ')}
                >
                  {s === 'toolNumber' ? 'T# order' : 'Alphabetical'}
                </button>
              ))}
            </div>
          </div>

          {/* Preview count */}
          {tools.length === 0 && (
            <p className="text-xs text-slate-500 italic">No tools selected — nothing to export.</p>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleExport('txt')}
            disabled={isBusy || tools.length === 0}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors',
              !isBusy && tools.length > 0
                ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200'
                : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            <AlignLeft size={14} />
            TXT
          </button>
          <button
            type="button"
            onClick={() => void handleExport('pdf')}
            disabled={isBusy || tools.length === 0}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              !isBusy && tools.length > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            <FileText size={14} />
            {isBusy ? 'Generating…' : 'PDF'}
          </button>
        </div>
      </div>
    </>
  );
}
