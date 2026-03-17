/**
 * ValidationPanel — Validation Issues panel (roadmap 1.5)
 *
 * Scans the entire library for data quality issues and lists them with
 * one-click navigation to the offending tool.
 */

import { useMemo } from 'react';
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';

// ── Issue types ────────────────────────────────────────────────────────────────

type Severity = 'error' | 'warn' | 'info';

interface Issue {
  severity: Severity;
  toolId:   string;
  toolNum:  number;
  toolDesc: string;
  message:  string;
}

function scanLibrary(tools: LibraryTool[]): Issue[] {
  const issues: Issue[] = [];

  // Duplicate tool numbers
  const numCounts = new Map<number, string[]>();
  for (const t of tools) {
    const ids = numCounts.get(t.toolNumber) ?? [];
    ids.push(t.id);
    numCounts.set(t.toolNumber, ids);
  }
  for (const [num, ids] of numCounts) {
    if (ids.length > 1) {
      for (const id of ids) {
        const t = tools.find((x) => x.id === id)!;
        issues.push({
          severity: 'error',
          toolId:   id,
          toolNum:  t.toolNumber,
          toolDesc: t.description || t.type,
          message:  `Duplicate tool number T${num} (${ids.length} tools share this number)`,
        });
      }
    }
  }

  for (const t of tools) {
    const d = t.description?.trim();
    const geo = t.geometry;

    // Missing / empty description
    if (!d) {
      issues.push({ severity: 'warn', toolId: t.id, toolNum: t.toolNumber, toolDesc: t.type, message: 'Missing description' });
    }

    // Diameter = 0 or missing
    if (!geo?.diameter || geo.diameter <= 0) {
      issues.push({ severity: 'error', toolId: t.id, toolNum: t.toolNumber, toolDesc: d || t.type, message: 'Diameter is zero or not set' });
    }

    // Negative geometry
    for (const [field, val] of Object.entries(geo ?? {}) as [string, unknown][]) {
      if (typeof val === 'number' && val < 0) {
        issues.push({ severity: 'error', toolId: t.id, toolNum: t.toolNumber, toolDesc: d || t.type, message: `Negative value for ${field} (${val})` });
      }
    }

    // Missing OAL (just info, not critical)
    if (!geo?.overallLength || geo.overallLength <= 0) {
      issues.push({ severity: 'info', toolId: t.id, toolNum: t.toolNumber, toolDesc: d || t.type, message: 'Overall length not set' });
    }

    // No cutting data
    if (!t.cutting?.spindleRpm && !t.cutting?.feedCutting) {
      issues.push({ severity: 'info', toolId: t.id, toolNum: t.toolNumber, toolDesc: d || t.type, message: 'No cutting data (RPM / feed rate not set)' });
    }

    // Low stock
    if (t.reorderPoint != null && t.quantity != null && t.quantity <= t.reorderPoint) {
      issues.push({ severity: 'warn', toolId: t.id, toolNum: t.toolNumber, toolDesc: d || t.type, message: `Low stock: ${t.quantity} remaining (reorder at ${t.reorderPoint})` });
    }
  }

  // Sort: errors first, then warnings, then info; then by toolNumber
  const ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  return issues.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.toolNum - b.toolNum);
}

// ── Icons / colours ────────────────────────────────────────────────────────────

const SEV_META: Record<Severity, { icon: typeof AlertCircle; cls: string; badge: string }> = {
  error: { icon: AlertCircle,   cls: 'text-red-400',    badge: 'bg-red-500/20 text-red-300'    },
  warn:  { icon: AlertTriangle, cls: 'text-amber-400',  badge: 'bg-amber-500/20 text-amber-300' },
  info:  { icon: Info,          cls: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-300'  },
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  tools:    LibraryTool[];
  onGoTo:   (toolId: string) => void;
  onClose:  () => void;
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function ValidationPanel({ tools, onGoTo, onClose }: Props) {
  const issues = useMemo(() => scanLibrary(tools), [tools]);

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount  = issues.filter((i) => i.severity === 'warn').length;
  const infoCount  = issues.filter((i) => i.severity === 'info').length;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <AlertTriangle size={16} className="text-slate-400" />
              Validation Issues
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tools.length} tools scanned
            </p>
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-700 shrink-0">
          {[
            { label: `${errorCount} error${errorCount !== 1 ? 's' : ''}`, cls: errorCount > 0 ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-slate-700 text-slate-500 border-slate-600' },
            { label: `${warnCount} warning${warnCount !== 1 ? 's' : ''}`, cls: warnCount > 0  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-700 text-slate-500 border-slate-600' },
            { label: `${infoCount} info`,                                  cls: 'bg-slate-700 text-slate-400 border-slate-600' },
          ].map(({ label, cls }) => (
            <span key={label} className={`px-2.5 py-1 rounded-full text-xs border ${cls}`}>{label}</span>
          ))}
          {issues.length === 0 && (
            <span className="text-xs text-emerald-400 ml-1">All clear!</span>
          )}
        </div>

        {/* Issue list */}
        <div className="flex-1 overflow-y-auto">
          {issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500 p-8 text-center">
              <AlertTriangle size={32} className="text-emerald-500/40" />
              <p className="text-sm">No issues found in the library.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/60">
              {issues.map((issue, i) => {
                const { icon: Icon, cls, badge } = SEV_META[issue.severity];
                return (
                  <button
                    key={`${issue.toolId}-${i}`}
                    onClick={() => { onGoTo(issue.toolId); onClose(); }}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-700/40 transition-colors"
                  >
                    <Icon size={14} className={`${cls} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-slate-400">T{issue.toolNum}</span>
                        <span className="text-xs text-slate-300 truncate">{issue.toolDesc}</span>
                        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${badge} shrink-0`}>
                          {issue.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{issue.message}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
