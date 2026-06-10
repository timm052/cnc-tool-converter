import { useMemo, useState } from 'react';
import { X, Table2, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import {
  MAPPABLE_FIELDS,
  guessMapping,
  buildToolsFromMapping,
  type ParsedSpreadsheet,
} from '../../lib/spreadsheetMapping';
import type { LibraryTool } from '../../types/libraryTool';

interface Props {
  data:    ParsedSpreadsheet;
  onMapped: (tools: LibraryTool[]) => void;
  onClose:  () => void;
}

const STEPS = ['Preview', 'Map columns', 'Review'] as const;

// Group fields for the <optgroup> dropdown, in display order
const GROUPS = ['Identity', 'Geometry', 'Cutting', 'Library'];

export default function ImportMappingWizard({ data, onMapped, onClose }: Props) {
  const { headers, rows } = data;
  const [step, setStep] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string | undefined>>(() => {
    const guess = guessMapping(headers);
    const m: Record<string, string | undefined> = {};
    for (const header of headers) {
      const fieldKey = guess[header];
      if (fieldKey) m[fieldKey] = header;
    }
    return m;
  });

  const fieldsByGroup = useMemo(() => {
    const map = new Map<string, typeof MAPPABLE_FIELDS>();
    for (const f of MAPPABLE_FIELDS) {
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return map;
  }, []);

  // header -> mapped field key (inverse of `mapping`)
  const headerMapping = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [fieldKey, header] of Object.entries(mapping)) {
      if (header) m[header] = fieldKey;
    }
    return m;
  }, [mapping]);

  function setHeaderMapping(header: string, fieldKey: string) {
    setMapping((prev) => {
      const next = { ...prev };
      // Clear any other header currently mapped to this field
      for (const [k, v] of Object.entries(next)) {
        if (v === header) delete next[k];
      }
      if (fieldKey) next[fieldKey] = header;
      return next;
    });
  }

  const previewTools = useMemo(
    () => buildToolsFromMapping(rows, mapping, { unit: 'mm', type: 'flat end mill' }),
    [rows, mapping],
  );

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  function handleImport() {
    onMapped(previewTools);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[640px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Table2 size={16} className="text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">Map Spreadsheet Columns</h2>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-700 shrink-0 flex items-center gap-2 text-xs">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className={[
                'w-5 h-5 rounded-full flex items-center justify-center font-semibold',
                i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-emerald-600/80 text-white' : 'bg-slate-700 text-slate-400',
              ].join(' ')}>
                {i + 1}
              </span>
              <span className={i === step ? 'text-slate-200 font-medium' : 'text-slate-500'}>{label}</span>
              {i < STEPS.length - 1 && <span className="text-slate-600 mx-1">—</span>}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Step 1: raw preview */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Found <strong>{headers.length}</strong> columns and <strong>{rows.length}</strong> rows.
                Here's a preview of the first few rows:
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-slate-900/60">
                      {headers.map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-slate-400 whitespace-nowrap border-b border-slate-700">{h || '—'}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="bg-slate-800/40">
                        {headers.map((h) => (
                          <td key={h} className="px-2 py-1.5 text-slate-300 whitespace-nowrap">{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 2: column mapping */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Match each spreadsheet column to a tool field. Columns left as
                "Ignore" won't be imported.
                <span className="text-slate-500"> ({mappedCount} mapped)</span>
              </p>
              <div className="rounded-lg border border-slate-700 divide-y divide-slate-700/60 overflow-hidden">
                {headers.map((header) => (
                  <div key={header} className="flex items-center gap-3 px-3 py-2 bg-slate-800/40">
                    <span className="text-sm text-slate-300 truncate flex-1" title={header}>{header || '(blank header)'}</span>
                    <ArrowRight size={12} className="text-slate-600 shrink-0" />
                    <select
                      value={headerMapping[header] ?? ''}
                      onChange={(e) => setHeaderMapping(header, e.target.value)}
                      className="px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 shrink-0"
                    >
                      <option value="">Ignore</option>
                      {GROUPS.map((group) => (
                        <optgroup key={group} label={group}>
                          {(fieldsByGroup.get(group) ?? []).map((f) => (
                            <option
                              key={f.key}
                              value={f.key}
                              disabled={mapping[f.key] !== undefined && mapping[f.key] !== header}
                            >
                              {f.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: tool preview */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <CheckCircle size={15} className="text-green-400" />
                <span><strong>{previewTools.length}</strong> tools will be imported</span>
              </div>
              <div className="rounded-lg border border-slate-700 divide-y divide-slate-700/60 overflow-hidden">
                {previewTools.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-xs bg-slate-800/60">
                    <span className="font-mono text-blue-400 shrink-0">T{t.toolNumber}</span>
                    <span className="text-slate-300 truncate flex-1">{t.description}</span>
                    <span className="text-slate-500 shrink-0">{t.geometry.diameter} {t.unit}</span>
                  </div>
                ))}
                {previewTools.length > 5 && (
                  <div className="px-3 py-2 text-xs text-slate-500 bg-slate-800/60">
                    …and {previewTools.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700"
          >
            <ArrowLeft size={14} />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Next
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleImport}
              disabled={previewTools.length === 0}
              className={[
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                previewTools.length > 0 ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              Import {previewTools.length} tool{previewTools.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
