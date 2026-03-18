import { useState, useEffect } from 'react';
import { History, Plus, Minus, RotateCcw, AlertTriangle, ArrowDown, ChevronDown } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import type { StockTransaction, StockReason } from '../../types/stockTransaction';
import { STOCK_REASON_LABELS } from '../../types/stockTransaction';

const REASON_ICON: Record<StockReason, React.ReactNode> = {
  restock:    <Plus    size={11} />,
  use:        <Minus   size={11} />,
  adjustment: <RotateCcw size={11} />,
  damage:     <AlertTriangle size={11} />,
  return:     <ArrowDown size={11} />,
  initial:    <ChevronDown size={11} />,
};

const REASON_COLOUR: Record<StockReason, string> = {
  restock:    'text-emerald-400 bg-emerald-500/10',
  use:        'text-red-400    bg-red-500/10',
  adjustment: 'text-blue-400   bg-blue-500/10',
  damage:     'text-orange-400 bg-orange-500/10',
  return:     'text-cyan-400   bg-cyan-500/10',
  initial:    'text-slate-400  bg-slate-500/10',
};

interface Props {
  toolId: string;
  /** Called when a manual log entry is saved — parent can refresh qty */
  onLog?: () => void;
}

export default function StockTransactionHistory({ toolId, onLog }: Props) {
  const { getTransactions, logTransaction } = useLibrary();

  const [txns,      setTxns]      = useState<StockTransaction[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [formDelta, setFormDelta] = useState('');
  const [formQtyAfter, setFormQtyAfter] = useState('');
  const [formReason, setFormReason] = useState<StockReason>('restock');
  const [formNote,  setFormNote]  = useState('');

  async function reload() {
    setLoading(true);
    try {
      const rows = await getTransactions(toolId);
      setTxns(rows.reverse()); // newest first
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [toolId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLog() {
    const delta    = parseFloat(formDelta);
    const qtyAfter = parseFloat(formQtyAfter);
    if (isNaN(delta) || isNaN(qtyAfter)) return;
    await logTransaction({ toolId, delta, quantityAfter: qtyAfter, reason: formReason, note: formNote || undefined });
    setFormDelta(''); setFormQtyAfter(''); setFormNote(''); setShowForm(false);
    await reload();
    onLog?.();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <History size={12} /> Stock History
        </p>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-xs text-slate-500 hover:text-blue-400 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Log entry'}
        </button>
      </div>

      {showForm && (
        <div className="p-3 rounded-xl border border-slate-700 bg-slate-800/60 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Delta (±)</label>
              <input
                type="number"
                value={formDelta}
                onChange={(e) => setFormDelta(e.target.value)}
                placeholder="+5 or -1"
                title="Signed quantity change"
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Qty after</label>
              <input
                type="number"
                min={0}
                value={formQtyAfter}
                onChange={(e) => setFormQtyAfter(e.target.value)}
                placeholder="0"
                title="Quantity on hand after this transaction"
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Reason</label>
            <select
              value={formReason}
              onChange={(e) => setFormReason(e.target.value as StockReason)}
              title="Reason"
              className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {(Object.entries(STOCK_REASON_LABELS) as [StockReason, string][]).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Note (optional)</label>
            <input
              type="text"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="e.g. PO #1234"
              title="Note"
              className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLog}
              disabled={!formDelta || !formQtyAfter}
              className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      )}

      {!loading && txns.length === 0 && (
        <p className="text-xs text-slate-600 italic">No transactions recorded yet.</p>
      )}

      {!loading && txns.length > 0 && (
        <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
          {txns.map((tx) => (
            <div key={tx.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs">
              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium shrink-0 ${REASON_COLOUR[tx.reason]}`}>
                {REASON_ICON[tx.reason]}
                {STOCK_REASON_LABELS[tx.reason]}
              </span>
              <span className={`font-mono font-semibold shrink-0 ${tx.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {tx.delta >= 0 ? `+${tx.delta}` : tx.delta}
              </span>
              <span className="text-slate-500 shrink-0">→ {tx.quantityAfter}</span>
              {tx.note && <span className="text-slate-400 truncate" title={tx.note}>{tx.note}</span>}
              <span className="ml-auto text-slate-600 shrink-0">
                {new Date(tx.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
