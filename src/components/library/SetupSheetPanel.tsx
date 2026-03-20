import { useState, useMemo } from 'react';
import { X, FileText, AlertCircle } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import { useSettings } from '../../contexts/SettingsContext';
import { loadMachineRecord } from '../../lib/workOffsetSheet';
import { generateSetupSheetPdf } from '../../lib/setupSheetPdf';

interface SetupSheetPanelProps {
  machineGroups: string[];
  onClose:       () => void;
}

export default function SetupSheetPanel({ machineGroups, onClose }: SetupSheetPanelProps) {
  const { tools }    = useLibrary();
  const { settings } = useSettings();

  const [machine,         setMachine]         = useState<string>(machineGroups[0] ?? '');
  const [jobName,         setJobName]         = useState('');
  const [operator,        setOperator]        = useState(settings.operatorName ?? '');
  const [unit,            setUnit]            = useState<'mm' | 'inch'>(settings.defaultUnits === 'imperial' ? 'inch' : 'mm');
  const [includeOffsets,  setIncludeOffsets]  = useState(true);

  const groupTools = useMemo(
    () => tools.filter((t) => !machine || t.machineGroups?.includes(machine)),
    [tools, machine],
  );

  const hasOffsets = useMemo(() => {
    if (!machine) return false;
    const rec = loadMachineRecord(machine);
    return !!rec?.entries?.some((e) => e.name || e.x || e.y || e.z);
  }, [machine]);

  function handleGenerate() {
    generateSetupSheetPdf({
      jobName,
      machine,
      operator,
      tools:          groupTools,
      unit,
      includeOffsets: includeOffsets && hasOffsets,
    });
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'text-xs font-medium text-slate-400 mb-1';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-80 bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-100">Setup Sheet</h2>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Machine group */}
          <div>
            <p className={labelCls}>Machine Group</p>
            <select
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              title="Machine group"
              className={inputCls}
            >
              <option value="">All tools</option>
              {machineGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Job / Part name */}
          <div>
            <p className={labelCls}>Job / Part Name</p>
            <input
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="e.g. Part-001"
              className={inputCls}
            />
          </div>

          {/* Operator */}
          <div>
            <p className={labelCls}>Operator</p>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="Operator name"
              className={inputCls}
            />
          </div>

          {/* Unit */}
          <div>
            <p className={labelCls}>Units</p>
            <div className="flex gap-2">
              {(['mm', 'inch'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={[
                    'flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    unit === u
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600',
                  ].join(' ')}
                >
                  {u === 'mm' ? 'Metric (mm)' : 'Imperial (in)'}
                </button>
              ))}
            </div>
          </div>

          {/* Include work offsets */}
          <div className="flex items-center justify-between py-2 border-t border-slate-700">
            <div>
              <p className="text-sm text-slate-200">Include Work Offsets</p>
              {machine && !hasOffsets && (
                <p className="flex items-center gap-1 text-xs text-amber-400 mt-0.5">
                  <AlertCircle size={11} />
                  No saved offsets for this machine
                </p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={includeOffsets}
              aria-label="Include work offsets"
              title="Include work offsets"
              onClick={() => setIncludeOffsets((v) => !v)}
              className={[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                includeOffsets ? 'bg-blue-600' : 'bg-slate-600',
              ].join(' ')}
            >
              <span className={[
                'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                includeOffsets ? 'translate-x-4' : 'translate-x-0',
              ].join(' ')} />
            </button>
          </div>

          {/* Tool count preview */}
          <div className="rounded-lg bg-slate-700/50 border border-slate-700 px-3 py-2.5">
            <p className="text-xs text-slate-400">
              <span className="text-slate-200 font-semibold">{groupTools.length}</span>{' '}
              {groupTools.length === 1 ? 'tool' : 'tools'} will be included
              {machine ? ` from "${machine}"` : ' (all groups)'}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={groupTools.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Generate PDF
          </button>
        </div>
      </div>
    </>
  );
}
