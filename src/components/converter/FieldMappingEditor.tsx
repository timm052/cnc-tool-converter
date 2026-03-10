import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Map } from 'lucide-react';
import {
  loadMapping, saveMapping, formatPairKey,
  MAPPABLE_FIELDS,
  type FieldMapping, type FieldMappingRule,
} from '../../lib/fieldMapping';

interface FieldMappingEditorProps {
  sourceFormatId: string;
  targetFormatId: string;
  onClose:        () => void;
}

export default function FieldMappingEditor({
  sourceFormatId, targetFormatId, onClose,
}: FieldMappingEditorProps) {
  const pairKey = formatPairKey(sourceFormatId, targetFormatId);
  const [mapping, setMapping] = useState<FieldMapping>(() => loadMapping(sourceFormatId, targetFormatId));
  const [addSrc, setAddSrc] = useState(MAPPABLE_FIELDS[0].path);
  const [addDst, setAddDst] = useState(MAPPABLE_FIELDS[1].path);

  useEffect(() => {
    setMapping(loadMapping(sourceFormatId, targetFormatId));
  }, [sourceFormatId, targetFormatId]);

  function persist(rules: FieldMappingRule[]) {
    const updated: FieldMapping = { formatPairKey: pairKey, rules };
    setMapping(updated);
    saveMapping(updated);
  }

  function addRule() {
    if (mapping.rules.some((r) => r.sourceField === addSrc && r.targetField === addDst)) return;
    persist([...mapping.rules, { sourceField: addSrc, targetField: addDst }]);
  }

  function removeRule(idx: number) {
    persist(mapping.rules.filter((_, i) => i !== idx));
  }

  function fieldLabel(path: string): string {
    return MAPPABLE_FIELDS.find((f) => f.path === path)?.label ?? path;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[440px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Map size={14} className="text-slate-400" />
              Field Mapping
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{sourceFormatId} → {targetFormatId}</p>
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-xs text-slate-500">
            After parsing the source file, copy values from source fields to target fields before writing. Applied on every conversion for this format pair.
          </p>

          {/* Existing rules */}
          {mapping.rules.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No rules yet.</p>
          ) : (
            <div className="rounded-lg border border-slate-700 divide-y divide-slate-700/60 overflow-hidden">
              {mapping.rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-800/60">
                  <span className="text-xs text-slate-300 flex-1 truncate" title={rule.sourceField}>
                    {fieldLabel(rule.sourceField)}
                  </span>
                  <span className="text-xs text-slate-500">→</span>
                  <span className="text-xs text-slate-300 flex-1 truncate" title={rule.targetField}>
                    {fieldLabel(rule.targetField)}
                  </span>
                  <button
                    onClick={() => removeRule(i)}
                    title="Remove this mapping rule"
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add rule */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400">Add rule</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-slate-500 mb-1">From</p>
                <select
                  value={addSrc}
                  onChange={(e) => setAddSrc(e.target.value)}
                  aria-label="Source field for mapping"
                  className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {MAPPABLE_FIELDS.map((f) => (
                    <option key={f.path} value={f.path}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">To</p>
                <select
                  value={addDst}
                  onChange={(e) => setAddDst(e.target.value)}
                  aria-label="Target field for mapping"
                  className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {MAPPABLE_FIELDS.map((f) => (
                    <option key={f.path} value={f.path}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={addRule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <Plus size={12} />
              Add rule
            </button>
          </div>

          {mapping.rules.length > 0 && (
            <button
              onClick={() => persist([])}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Clear all rules
            </button>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-700 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
