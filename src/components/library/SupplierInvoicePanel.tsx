/**
 * SupplierInvoicePanel — import a supplier delivery note / packing slip CSV
 * to update stock quantities in the tool library.
 *
 * Supported column names (case-insensitive, spaces/underscores interchangeable):
 *   - Identifier: product id / product_id / part number / part no / sku / item code / tool#
 *   - Qty / quantity / received / qty received
 *   - Unit cost / price / unit price (optional)
 *   - Description (optional, for matching feedback)
 *
 * Matching strategy (in priority order):
 *   1. Exact productId match
 *   2. Tool number match (if column looks like T# integers)
 *   3. Description fuzzy match (≥80% token overlap)
 */
import { useState, useMemo, useCallback } from 'react';
import { X, Package, Upload, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import type { LibraryTool } from '../../types/libraryTool';

interface ParsedRow {
  rawId:   string;
  rawDesc: string;
  qty:     number;
  cost?:   number;
}

interface MatchResult {
  row:        ParsedRow;
  tool:       LibraryTool | null;
  matchHow:   'productId' | 'toolNumber' | 'description' | null;
  apply:      boolean;
  addQty:     number;
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function normKey(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, '');
}

function findCol(headers: string[], ...names: string[]): number {
  const norms = names.map(normKey);
  return headers.findIndex((h) => norms.includes(normKey(h)));
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/));
  const tb = new Set(b.toLowerCase().split(/\s+/));
  let common = 0;
  ta.forEach((t) => { if (tb.has(t)) common++; });
  return common / Math.max(ta.size, tb.size, 1);
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SupplierInvoicePanelProps {
  onClose: () => void;
}

export default function SupplierInvoicePanel({ onClose }: SupplierInvoicePanelProps) {
  const { tools, updateTool } = useLibrary();

  const [rows,    setRows]    = useState<MatchResult[]>([]);
  const [parsed,  setParsed]  = useState(false);
  const [error,   setError]   = useState('');
  const [applied, setApplied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const parseFile = useCallback((text: string) => {
    setError('');
    setApplied(false);
    try {
      const rawRows = parseCsv(text);
      if (rawRows.length < 2) { setError('File has no data rows.'); return; }

      const headers = rawRows[0];
      const idCol   = findCol(headers, 'product id', 'product_id', 'productid', 'part number', 'part no', 'partno', 'sku', 'item code', 'itemcode', 'tool#', 'tool number', 'toolno', 'tool no');
      const qtyCol  = findCol(headers, 'qty', 'quantity', 'received', 'qty received', 'qtyreceived');
      const costCol = findCol(headers, 'unit cost', 'unitcost', 'price', 'unit price', 'unitprice');
      const descCol = findCol(headers, 'description', 'desc', 'name', 'product name');

      if (idCol < 0 && descCol < 0) {
        setError('Could not find an identifier column. Expected "Product ID", "Part Number", "SKU", "Tool#", or "Description".');
        return;
      }
      if (qtyCol < 0) {
        setError('Could not find a quantity column. Expected "Qty", "Quantity", "Received", or "Qty Received".');
        return;
      }

      const parsed: ParsedRow[] = rawRows.slice(1).map((r) => ({
        rawId:   idCol >= 0 ? (r[idCol] ?? '') : '',
        rawDesc: descCol >= 0 ? (r[descCol] ?? '') : '',
        qty:     Math.max(0, parseInt(r[qtyCol] ?? '0') || 0),
        cost:    costCol >= 0 ? parseFloat(r[costCol] ?? '') || undefined : undefined,
      })).filter((r) => r.qty > 0 || r.rawId);

      // Match each row to a library tool
      const results: MatchResult[] = parsed.map((row) => {
        let tool: LibraryTool | null = null;
        let matchHow: MatchResult['matchHow'] = null;

        // 1. productId exact
        if (row.rawId) {
          const m = tools.find((t) => t.productId && t.productId.toLowerCase() === row.rawId.toLowerCase());
          if (m) { tool = m; matchHow = 'productId'; }
        }
        // 2. toolNumber
        if (!tool && row.rawId) {
          const num = parseInt(row.rawId.replace(/^T/i, ''));
          if (!isNaN(num)) {
            const m = tools.find((t) => t.toolNumber === num);
            if (m) { tool = m; matchHow = 'toolNumber'; }
          }
        }
        // 3. description similarity ≥ 0.8
        if (!tool && row.rawDesc) {
          let bestScore = 0.79, bestTool: LibraryTool | null = null;
          for (const t of tools) {
            const score = tokenSimilarity(row.rawDesc, t.description);
            if (score > bestScore) { bestScore = score; bestTool = t; }
          }
          if (bestTool) { tool = bestTool; matchHow = 'description'; }
        }

        return { row, tool, matchHow, apply: !!tool && row.qty > 0, addQty: row.qty };
      });

      setRows(results);
      setParsed(true);
    } catch {
      setError('Failed to parse the file. Please check it is a valid CSV.');
    }
  }, [tools]);

  function handleFileChange(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => parseFile(e.target?.result as string ?? '');
    reader.readAsText(file);
  }

  function toggleApply(idx: number) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, apply: !r.apply } : r));
  }

  function setQty(idx: number, val: number) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, addQty: Math.max(0, val) } : r));
  }

  const toApply = useMemo(() => rows.filter((r) => r.apply && r.tool && r.addQty > 0), [rows]);

  async function handleApply() {
    for (const r of toApply) {
      const current = r.tool!.quantity ?? 0;
      const patch: Partial<LibraryTool> = { quantity: current + r.addQty };
      if (r.row.cost !== undefined) patch.unitCost = r.row.cost;
      // updateTool writes a StockTransaction + audit log entry per tool
      await updateTool(r.tool!.id, patch);
    }
    setApplied(true);
  }

  const inputCls = 'px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-100">Supplier Invoice Import</h2>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {!parsed ? (
            <>
              <p className="text-sm text-slate-400">
                Drop a supplier delivery note or packing slip CSV to auto-update stock quantities.
                Columns matched: <span className="text-slate-300">Product ID / Part No / SKU</span>, <span className="text-slate-300">Qty Received</span>, and optionally <span className="text-slate-300">Unit Cost</span>.
              </p>

              {/* Drop zone */}
              <label
                className={[
                  'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors',
                  dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500',
                ].join(' ')}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f); }}
              >
                <Upload size={24} className="text-slate-500" />
                <span className="text-sm text-slate-400">Drop CSV here or click to browse</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  title="Select supplier invoice CSV"
                  className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
                />
              </label>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg p-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Format hint */}
              <details className="text-xs text-slate-500">
                <summary className="flex items-center gap-1 cursor-pointer hover:text-slate-400 transition-colors">
                  <ChevronDown size={11} /> Expected CSV format
                </summary>
                <pre className="mt-2 p-2 bg-slate-900/60 rounded text-slate-400 overflow-x-auto">
{`Product ID,Description,Qty Received,Unit Cost
R216.34-10-030-AC10,10mm Flat End Mill,5,42.50
5973478,6mm Ball Nose,3,28.00`}
                </pre>
              </details>
            </>
          ) : applied ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check size={24} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-slate-200">Stock updated</p>
              <p className="text-xs text-slate-400">{toApply.length} {toApply.length === 1 ? 'tool' : 'tools'} updated successfully.</p>
              <button type="button" onClick={() => { setParsed(false); setApplied(false); setRows([]); }} className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
                Import Another
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-emerald-400">{rows.filter((r) => r.tool).length}</span> of {rows.length} rows matched
                  {rows.filter((r) => !r.tool).length > 0 && (
                    <span className="text-amber-400 ml-2">· {rows.filter((r) => !r.tool).length} unmatched</span>
                  )}
                </p>
                <button type="button" onClick={() => { setParsed(false); setRows([]); }} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Re-upload</button>
              </div>

              <div className="space-y-1.5">
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className={[
                      'rounded-lg border px-3 py-2.5 transition-colors',
                      !r.tool ? 'border-slate-700 bg-slate-700/20 opacity-60' :
                      r.apply ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700 bg-slate-700/20',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-2">
                      {r.tool && (
                        <input
                          type="checkbox"
                          checked={r.apply}
                          onChange={() => toggleApply(i)}
                          title="Apply this update"
                          aria-label={`Apply update for ${r.tool?.description ?? 'tool'}`}
                          className="mt-0.5 w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500 cursor-pointer shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        {r.tool ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-400">T{r.tool.toolNumber}</span>
                              <span className="text-sm text-slate-200 truncate">{r.tool.description}</span>
                              <span className="text-xs text-slate-500 shrink-0 capitalize">{r.matchHow}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-xs text-slate-400">
                                Current stock: <span className="text-slate-200">{r.tool.quantity ?? 0}</span>
                              </span>
                              <span className="text-xs text-slate-500">+</span>
                              <input
                                type="number"
                                min={0}
                                value={r.addQty}
                                onChange={(e) => setQty(i, parseInt(e.target.value) || 0)}
                                className={`${inputCls} w-16 text-center`}
                                title="Quantity to add"
                              />
                              <span className="text-xs text-slate-400">
                                = <span className="text-emerald-400 font-semibold">{(r.tool.quantity ?? 0) + r.addQty}</span>
                              </span>
                              {r.row.cost !== undefined && (
                                <span className="text-xs text-slate-500 ml-auto">@ ${r.row.cost.toFixed(2)}</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div>
                            <span className="text-sm text-slate-500">{r.row.rawId || r.row.rawDesc || '(empty)'}</span>
                            <span className="ml-2 text-xs text-amber-500">No match found</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {parsed && !applied && (
          <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-between">
            <span className="text-xs text-slate-500">{toApply.length} tool{toApply.length !== 1 ? 's' : ''} will be updated</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">Cancel</button>
              <button
                type="button"
                onClick={handleApply}
                disabled={toApply.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check size={14} /> Update Stock
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
