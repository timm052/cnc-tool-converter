/**
 * Displays the per-tool audit/change log in the ToolEditor Crib tab.
 * Entries are loaded once on mount (toolId change) and shown newest-first.
 */
import { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import type { ToolAuditEntry } from '../../types/auditEntry';

interface AuditLogHistoryProps {
  toolId: string;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function friendlyField(field: string): string {
  const map: Record<string, string> = {
    description:   'Description',
    type:          'Type',
    toolNumber:    'Tool #',
    material:      'Material',
    quantity:      'Qty',
    reorderPoint:  'Reorder pt',
    unitCost:      'Unit cost',
    supplier:      'Supplier',
    location:      'Location',
    condition:     'Condition',
    useCount:      'Use count',
    regrindThreshold: 'Regrind threshold',
    starred:       'Starred',
    tags:          'Tags',
    machineGroups: 'Machine groups',
    geometry:      'Geometry',
    cutting:       'Cutting data',
    comment:       'Comment',
    manufacturer:  'Manufacturer',
    productId:     'Product ID',
  };
  return map[field] ?? field;
}

export default function AuditLogHistory({ toolId }: AuditLogHistoryProps) {
  const { getAuditLog } = useLibrary();
  const [entries, setEntries] = useState<ToolAuditEntry[]>([]);

  useEffect(() => {
    getAuditLog(toolId).then(setEntries);
  }, [toolId, getAuditLog]);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic">No changes recorded yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return (
          <div key={entry.id} className="border border-slate-700 rounded-lg p-3 text-xs space-y-1.5">
            {/* Entry header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-400">
                <History size={11} className="shrink-0" />
                <span>{dateStr} {timeStr}</span>
                {entry.changedBy && (
                  <span className="text-slate-500">· {entry.changedBy}</span>
                )}
              </div>
              <span className="text-slate-600 shrink-0">
                {entry.fields.length} field{entry.fields.length !== 1 ? 's' : ''}
              </span>
            </div>
            {/* Changed fields */}
            <div className="space-y-1 border-t border-slate-700/60 pt-1.5">
              {entry.fields.map((f) => (
                <div key={f.field} className="grid grid-cols-[auto_1fr] gap-x-2 items-start">
                  <span className="text-slate-500 whitespace-nowrap">{friendlyField(f.field)}</span>
                  <span className="text-slate-300 truncate font-mono" title={`${formatValue(f.oldValue)} → ${formatValue(f.newValue)}`}>
                    <span className="text-red-400 line-through opacity-70">{formatValue(f.oldValue)}</span>
                    {' → '}
                    <span className="text-green-400">{formatValue(f.newValue)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
