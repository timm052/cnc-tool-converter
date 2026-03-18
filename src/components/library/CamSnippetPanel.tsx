import { useState, useMemo } from 'react';
import { X, Code2, Copy, Check, Download } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import { useSettings } from '../../contexts/SettingsContext';
import { CAM_DIALECTS, generateSnippet, type CamDialect } from '../../lib/camSnippet';

interface CamSnippetPanelProps {
  tools:   LibraryTool[];
  onClose: () => void;
}

export default function CamSnippetPanel({ tools, onClose }: CamSnippetPanelProps) {
  const { settings } = useSettings();
  const [dialect,  setDialect]  = useState<CamDialect>('fanuc');
  const [copied,   setCopied]   = useState(false);

  const snippet = useMemo(
    () => generateSnippet(tools, { dialect, decimals: settings.tableDecimalPrecision }),
    [tools, dialect, settings.tableDecimalPrecision],
  );

  const dialectInfo = CAM_DIALECTS.find((d) => d.id === dialect)!;

  function handleCopy() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([snippet], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cam-snippet${dialectInfo.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[560px] max-w-[calc(100vw-3rem)] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-100">CAM Snippet</h2>
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-400">
              {tools.length} tool{tools.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Dialect selector */}
        <div className="px-5 py-3 border-b border-slate-700 shrink-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Control / Post-processor</p>
          <div className="flex gap-2 flex-wrap">
            {CAM_DIALECTS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDialect(d.id)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  dialect === d.id
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600',
                ].join(' ')}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 font-mono">{dialectInfo.example}</p>
        </div>

        {/* Snippet preview */}
        <div className="flex-1 overflow-auto p-5">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900 rounded-xl border border-slate-700 p-4 select-all">
            {snippet}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600 transition-colors"
          >
            <Download size={14} />
            Download {dialectInfo.ext}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              copied
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white',
            ].join(' ')}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </>
  );
}
