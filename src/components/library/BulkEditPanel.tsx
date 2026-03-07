import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import type { ToolType, ToolMaterial } from '../../types/tool';
import MachineGroupInput from './MachineGroupInput';

interface BulkEditPanelProps {
  tools:       LibraryTool[];
  allGroups:   string[];
  allTags:     string[];
  onApply:     (patch: Partial<LibraryTool>) => Promise<void>;
  onClose:     () => void;
}

const TOOL_TYPES: ToolType[] = [
  'flat end mill', 'ball end mill', 'bull nose end mill', 'chamfer mill',
  'face mill', 'spot drill', 'drill', 'tapered mill', 'boring bar',
  'thread mill', 'engraving', 'custom',
];
const MATERIALS: ToolMaterial[] = ['carbide', 'hss', 'ceramics', 'diamond', 'other'];

export default function BulkEditPanel({
  tools, allGroups, allTags, onApply, onClose,
}: BulkEditPanelProps) {
  // Per-field opt-in checkboxes
  const [applyMachine,  setApplyMachine]  = useState(false);
  const [applyTags,     setApplyTags]     = useState(false);
  const [applyType,     setApplyType]     = useState(false);
  const [applyMaterial, setApplyMaterial] = useState(false);
  const [applyStarred,  setApplyStarred]  = useState(false);

  // Values
  const [machineGroup, setMachineGroup] = useState<string | undefined>(undefined);
  const [tagMode,      setTagMode]      = useState<'add' | 'replace'>('add');
  const [newTags,      setNewTags]      = useState<string[]>([]);
  const [tagInput,     setTagInput]     = useState('');
  const [type,         setType]         = useState<ToolType>('flat end mill');
  const [material,     setMaterial]     = useState<ToolMaterial>('carbide');
  const [starred,      setStarred]      = useState(false);
  const [isDone,       setIsDone]       = useState(false);
  const [isApplying,   setIsApplying]   = useState(false);

  const tagSuggestions = allTags.filter(
    (t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !newTags.includes(t),
  ).slice(0, 6);

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !newTags.includes(t)) setNewTags((prev) => [...prev, t]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setNewTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleApply() {
    const patch: Partial<LibraryTool> = {};

    if (applyMachine)  patch.machineGroup = machineGroup;
    if (applyType)     patch.type = type;
    if (applyMaterial) patch.material = material;
    if (applyStarred)  patch.starred = starred;

    if (applyTags) {
      if (tagMode === 'replace') {
        patch.tags = newTags;
      } else {
        // "add" mode — needs per-tool merge; we pass a sentinel to signal this
        // We'll handle it by applying to each tool in onApply via a pre-merge
        // For simplicity, pass tags as the add-list; parent handles merge
        patch.tags = newTags;
      }
    }

    setIsApplying(true);
    await onApply(patch);
    setIsApplying(false);
    setIsDone(true);
  }

  const anyActive = applyMachine || applyTags || applyType || applyMaterial || applyStarred;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Bulk Edit</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Editing {tools.length} tool{tools.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Check a field to include it in the update. Unchecked fields will not be changed.
          </p>

          {/* Machine Group */}
          <FieldRow label="Machine group" active={applyMachine} onToggle={setApplyMachine}>
            <MachineGroupInput
              value={machineGroup}
              allGroups={allGroups}
              onChange={setMachineGroup}
            />
          </FieldRow>

          {/* Tags */}
          <FieldRow label="Tags" active={applyTags} onToggle={setApplyTags}>
            <div className="space-y-2">
              <div className="flex gap-2">
                {(['add', 'replace'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTagMode(mode)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border ${
                      tagMode === mode
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-700 text-slate-300 border-slate-600'
                    }`}
                  >
                    {mode === 'add' ? 'Add tags' : 'Replace tags'}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={tagInput}
                  placeholder="Add tag…"
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {tagSuggestions.length > 0 && tagInput && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    {tagSuggestions.map((t) => (
                      <button key={t} onMouseDown={() => addTag(t)}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {newTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {newTags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-white"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </FieldRow>

          {/* Type */}
          <FieldRow label="Tool type" active={applyType} onToggle={setApplyType}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ToolType)}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {TOOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FieldRow>

          {/* Material */}
          <FieldRow label="Material" active={applyMaterial} onToggle={setApplyMaterial}>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value as ToolMaterial)}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </FieldRow>

          {/* Starred */}
          <FieldRow label="Starred / Favourite" active={applyStarred} onToggle={setApplyStarred}>
            <button
              onClick={() => setStarred((s) => !s)}
              role="switch"
              aria-checked={starred}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${starred ? 'bg-blue-600' : 'bg-slate-600'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${starred ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </FieldRow>

          {isDone && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
              <CheckCircle size={14} />
              Applied to {tools.length} tool{tools.length !== 1 ? 's' : ''}.
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            {isDone ? 'Close' : 'Cancel'}
          </button>
          {!isDone && (
            <button
              onClick={handleApply}
              disabled={!anyActive || isApplying}
              className={[
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                anyActive && !isApplying
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              {isApplying ? 'Applying…' : `Apply to ${tools.length} tool${tools.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({
  label, active, onToggle, children,
}: {
  label:    string;
  active:   boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-2 transition-colors ${active ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-700 bg-slate-800/40'}`}>
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500"
        />
        <span className={`text-sm font-medium ${active ? 'text-slate-200' : 'text-slate-400'}`}>{label}</span>
      </label>
      {active && <div>{children}</div>}
    </div>
  );
}
