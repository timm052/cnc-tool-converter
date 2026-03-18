import { useMemo } from 'react';
import { X, Package, Download, AlertTriangle } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import { triggerDownload } from '../../lib/downloadUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLowStock(t: LibraryTool): boolean {
  return t.reorderPoint != null && t.quantity != null && t.quantity <= t.reorderPoint;
}

function exportPoCsv(tools: LibraryTool[]) {
  const rows: string[] = [
    ['Tool #', 'Description', 'Supplier', 'Qty On Hand', 'Reorder Point', 'Unit Cost', 'Location'].join(','),
  ];
  for (const t of tools) {
    rows.push([
      t.toolNumber,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${(t.supplier ?? '').replace(/"/g, '""')}"`,
      t.quantity ?? '',
      t.reorderPoint ?? '',
      t.unitCost ?? '',
      `"${(t.location ?? '').replace(/"/g, '""')}"`,
    ].join(','));
  }
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(rows.join('\n'), `low-stock-${date}.csv`, 'text/csv');
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  tools: LibraryTool[];
  onClose: () => void;
}

export default function LowStockPanel({ tools, onClose }: Props) {
  const lowTools = useMemo(() => tools.filter(isLowStock), [tools]);

  // Group by supplier (blank supplier → "No Supplier")
  const bySupplier = useMemo(() => {
    const map = new Map<string, LibraryTool[]>();
    for (const t of lowTools) {
      const key = t.supplier?.trim() || 'No Supplier';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [lowTools]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="text-base font-semibold text-slate-100">Low Stock</h2>
            {lowTools.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">{lowTools.length}</span>
            )}
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {lowTools.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <Package size={36} className="text-slate-600" />
              <p className="text-sm text-slate-400">All tools are adequately stocked.</p>
              <p className="text-xs text-slate-500">Set a reorder point on tools in the Crib tab<br />and they will appear here when stock runs low.</p>
            </div>
          )}

          {bySupplier.map(([supplier, supplierTools]) => (
            <div key={supplier}>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">{supplier}</p>
              <div className="space-y-1.5">
                {supplierTools.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5"
                  >
                    <span className="text-xs font-mono text-slate-500 w-8 shrink-0">T{t.toolNumber}</span>
                    <span className="flex-1 text-sm text-slate-200 truncate" title={t.description}>{t.description}</span>
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      <span className="text-red-400 font-semibold">{t.quantity ?? '?'}</span>
                      <span className="text-slate-600">/</span>
                      <span className="text-slate-400">{t.reorderPoint}</span>
                    </div>
                    {t.unitCost != null && (
                      <span className="text-xs text-slate-500 shrink-0">${t.unitCost.toFixed(2)}</span>
                    )}
                    {t.location && (
                      <span className="text-xs text-slate-600 shrink-0">{t.location}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {lowTools.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => exportPoCsv(lowTools)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <Download size={14} /> Export PO CSV ({lowTools.length} tools)
            </button>
          </div>
        )}
      </div>
    </>
  );
}
