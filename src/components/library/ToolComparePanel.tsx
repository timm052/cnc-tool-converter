import { X } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import { ToolProfileSVG } from './ToolProfileSVG';
import { useSettings } from '../../contexts/SettingsContext';

interface ToolComparePanelProps {
  tools:   LibraryTool[];
  onClose: () => void;
}

// Fields to show in the compare table, grouped
const FIELD_GROUPS: { group: string; rows: { label: string; get: (t: LibraryTool) => string | number | boolean | undefined }[] }[] = [
  {
    group: 'Identity',
    rows: [
      { label: 'T#',          get: (t) => `T${t.toolNumber}` },
      { label: 'Type',        get: (t) => t.type },
      { label: 'Description', get: (t) => t.description },
      { label: 'Unit',        get: (t) => t.unit },
      { label: 'Material',    get: (t) => t.material ?? '—' },
      { label: 'Manufacturer', get: (t) => t.manufacturer ?? '—' },
      { label: 'Machines',    get: (t) => (t.machineGroups?.join(', ')) || '—' },
    ],
  },
  {
    group: 'Geometry',
    rows: [
      { label: 'Diameter',       get: (t) => t.geometry.diameter },
      { label: 'Overall Length', get: (t) => t.geometry.overallLength ?? '—' },
      { label: 'Flute Length',   get: (t) => t.geometry.fluteLength ?? '—' },
      { label: 'Body Length',    get: (t) => t.geometry.bodyLength ?? '—' },
      { label: 'Shaft Dia',      get: (t) => t.geometry.shaftDiameter ?? '—' },
      { label: '# Flutes',       get: (t) => t.geometry.numberOfFlutes ?? '—' },
      { label: 'Corner Radius',  get: (t) => t.geometry.cornerRadius ?? '—' },
      { label: 'Taper Angle',    get: (t) => t.geometry.taperAngle ?? '—' },
      { label: 'Tip Dia',        get: (t) => t.geometry.tipDiameter ?? '—' },
      { label: 'Shoulder L',     get: (t) => t.geometry.shoulderLength ?? '—' },
      { label: '# Teeth',        get: (t) => t.geometry.numberOfTeeth ?? '—' },
      { label: 'Thread Pitch',   get: (t) => t.geometry.threadPitch ?? '—' },
      { label: 'Thread Angle',   get: (t) => t.geometry.threadProfileAngle ?? '—' },
      { label: 'Coolant Supp.',  get: (t) => t.geometry.coolantSupport ? 'Yes' : 'No' },
    ],
  },
  {
    group: 'Cutting',
    rows: [
      { label: 'Spindle RPM',  get: (t) => t.cutting?.spindleRpm ?? '—' },
      { label: 'Feed (Cut)',   get: (t) => t.cutting?.feedCutting ?? '—' },
      { label: 'Feed (Plunge)',get: (t) => t.cutting?.feedPlunge ?? '—' },
      { label: 'Coolant',      get: (t) => t.cutting?.coolant ?? '—' },
    ],
  },
  {
    group: 'Library',
    rows: [
      { label: 'Tags',         get: (t) => t.tags.join(', ') || '—' },
      { label: 'Starred',      get: (t) => t.starred ? 'Yes' : 'No' },
      { label: 'Pocket #',     get: (t) => t.pocketNumber ?? '—' },
      { label: 'Quantity',     get: (t) => t.quantity ?? '—' },
      { label: 'Reorder At',   get: (t) => t.reorderPoint ?? '—' },
      { label: 'Supplier',     get: (t) => t.supplier ?? '—' },
      { label: 'Unit Cost',    get: (t) => t.unitCost ?? '—' },
      { label: 'Location',     get: (t) => t.location ?? '—' },
      { label: 'Holder',       get: (t) => t.holderId ?? '—' },
      { label: 'Stick-Out',    get: (t) => t.assemblyStickOut ?? '—' },
    ],
  },
];

export default function ToolComparePanel({ tools, onClose }: ToolComparePanelProps) {
  const { settings } = useSettings();
  const dp = settings.tableDecimalPrecision;

  function fmt(v: string | number | boolean | undefined): string {
    if (typeof v === 'number') return v.toFixed(dp);
    return String(v ?? '—');
  }

  function isDiff(row: typeof FIELD_GROUPS[0]['rows'][0]): boolean {
    const vals = tools.map((t) => fmt(row.get(t)));
    return vals.some((v) => v !== vals[0]);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl"
           style={{ width: Math.min(200 + tools.length * 220, window.innerWidth - 60) }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-100">Compare Tools</h2>
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* SVG previews row */}
        <div className="flex border-b border-slate-700 shrink-0 overflow-x-auto">
          <div className="w-36 shrink-0 px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-end pb-4">
            Field
          </div>
          {tools.map((tool) => (
            <div key={tool.id} className="w-[220px] shrink-0 border-l border-slate-700/60 px-3 py-2">
              <p className="text-xs font-mono text-blue-400 font-semibold mb-1">T{tool.toolNumber}</p>
              <p className="text-xs text-slate-200 font-medium truncate mb-2" title={tool.description}>{tool.description}</p>
              <div className="scale-75 origin-top-left h-[110px] w-[260px] overflow-hidden">
                <ToolProfileSVG draft={tool} zoom={0.75} />
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {FIELD_GROUPS.map((group) => (
                <>
                  <tr key={`group-${group.group}`}>
                    <td colSpan={tools.length + 1}
                        className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/80 sticky left-0">
                      {group.group}
                    </td>
                  </tr>
                  {group.rows.map((row) => {
                    const diff = isDiff(row);
                    return (
                      <tr key={row.label}
                          className={`border-b border-slate-700/40 ${diff ? 'bg-amber-500/5' : ''}`}>
                        <td className={`px-3 py-1.5 text-xs font-medium sticky left-0 bg-slate-800 whitespace-nowrap w-36 ${diff ? 'text-amber-400' : 'text-slate-400'}`}>
                          {row.label}
                          {diff && <span className="ml-1 text-amber-500/60">≠</span>}
                        </td>
                        {tools.map((tool) => {
                          const val = fmt(row.get(tool));
                          const ref = fmt(row.get(tools[0]));
                          const isDifferentFromFirst = tool !== tools[0] && val !== ref;
                          return (
                            <td
                              key={tool.id}
                              className={[
                                'px-3 py-1.5 text-xs border-l border-slate-700/40 w-[220px] max-w-[220px] font-mono',
                                isDifferentFromFirst
                                  ? 'text-amber-300 bg-amber-500/5'
                                  : 'text-slate-300',
                              ].join(' ')}
                            >
                              <span className="block truncate" title={val}>{val}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
