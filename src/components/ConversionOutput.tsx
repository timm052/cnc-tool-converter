import { useState } from 'react';
import { Download, Copy, Check, AlertTriangle, FileText } from 'lucide-react';
import type { WriteResult } from '../types/converter';

interface ConversionOutputProps {
  result: WriteResult | null;
  isConverting?: boolean;
}

export default function ConversionOutput({ result, isConverting }: ConversionOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.content], { type: result.mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Empty / loading state ─────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-slate-500">
        {isConverting ? (
          <>
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Converting…</span>
          </>
        ) : (
          <>
            <FileText size={32} className="text-slate-600" />
            <span className="text-sm">Converted output will appear here</span>
          </>
        )}
      </div>
    );
  }

  const lineCount = result.content.split('\n').length;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-green-400" />
          <span className="text-sm font-medium text-slate-200">{result.filename}</span>
          <span className="text-xs text-slate-500">
            {lineCount} lines · {(new Blob([result.content]).size / 1024).toFixed(1)} KB
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors border border-slate-600"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <Download size={13} />
            Download
          </button>
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="shrink-0 space-y-1.5">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Output text */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-700 bg-slate-900">
        <pre className="p-4 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
          {result.content}
        </pre>
      </div>
    </div>
  );
}
