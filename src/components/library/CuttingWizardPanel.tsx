/**
 * CuttingWizardPanel — Step-by-step guided Feeds & Speeds entry (roadmap 2.5)
 *
 * Step 1: Pick tool + material from the library
 * Step 2: Choose tool-material grade, machine type, and DOC/WOC
 * Step 3: Review suggested values and apply to the tool's per-material entry
 */

import { useState, useRef, useEffect } from 'react';
import { X, Wand2, ChevronRight, ChevronLeft, Check, Bookmark, ChevronDown } from 'lucide-react';
import type { LibraryTool, ToolMaterialEntry } from '../../types/libraryTool';
import type { WorkMaterial } from '../../types/material';
import { SURFACE_SPEED_GROUPS, vcToSfm, type ToolMaterial } from '../../lib/surfaceSpeedPresets';
import { useSettings } from '../../contexts/SettingsContext';
import type { FSPreset } from '../../contexts/SettingsContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type MachineType = 'vertical-mill' | 'horizontal-mill' | 'lathe' | 'router';

const MACHINE_LABELS: Record<MachineType, string> = {
  'vertical-mill':   'Vertical mill (VMC)',
  'horizontal-mill': 'Horizontal mill (HMC)',
  'lathe':           'Lathe / turning',
  'router':          'CNC router',
};

/** Rigidity correction factor per machine type */
const MACHINE_FACTOR: Record<MachineType, number> = {
  'vertical-mill':   1.0,
  'horizontal-mill': 1.1,
  'lathe':           1.0,
  'router':          0.7,
};

const TOOL_MAT_OPTIONS: { value: ToolMaterial; label: string }[] = [
  { value: 'carbide', label: 'Solid carbide' },
  { value: 'hss',     label: 'HSS' },
  { value: 'ceramic', label: 'Ceramic' },
  { value: 'cbn',     label: 'CBN' },
  { value: 'diamond', label: 'Diamond (PCD)' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  tools:        LibraryTool[];
  allMaterials: WorkMaterial[];
  onApply:      (toolId: string, entry: ToolMaterialEntry) => void;
  onClose:      () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PI = Math.PI;
function calcRpm(vc: number, dia: number, metric: boolean) {
  if (dia <= 0) return 0;
  return metric ? (vc * 1000) / (PI * dia) : (vc * 12) / (PI * dia);
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function CuttingWizardPanel({ tools, allMaterials, onApply, onClose }: Props) {
  const { settings } = useSettings();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 selections
  const [toolId, setToolId]   = useState(tools[0]?.id ?? '');
  const [matId,  setMatId]    = useState(allMaterials[0]?.id ?? '');

  // Step 2 selections
  const [toolMat,  setToolMat]  = useState<ToolMaterial>('carbide');
  const [machine,  setMachine]  = useState<MachineType>('vertical-mill');
  const [docPct,   setDocPct]   = useState(30);   // axial DOC as % of diameter
  const [stepover, setStepover] = useState(50);   // radial as % of diameter

  // F&S preset override (loaded from saved presets)
  const [loadedPreset, setLoadedPreset] = useState<FSPreset | null>(null);
  const [presetOpen,   setPresetOpen]   = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  // Close preset dropdown on outside click
  useEffect(() => {
    if (!presetOpen) return;
    function handleClick(e: MouseEvent) {
      if (!presetRef.current?.contains(e.target as Node)) setPresetOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [presetOpen]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const tool = tools.find((t) => t.id === toolId);
  const mat  = allMaterials.find((m) => m.id === matId);
  const isMetric = tool?.unit !== 'inch';

  // Find matching preset
  const matName = mat?.name ?? '';
  const group   = SURFACE_SPEED_GROUPS.find((g) =>
    matName.toLowerCase().includes(g.material.toLowerCase()) ||
    g.material.toLowerCase().includes(matName.toLowerCase().split(' ')[0]),
  );
  const preset  = group?.presets.find((p) => p.toolMaterial === toolMat)
               ?? group?.presets[0];

  // Adjust Vc by machine rigidity factor
  const vcMid    = preset ? (preset.vcMin + preset.vcMax) / 2 : 0;
  const vcAdj    = vcMid * (MACHINE_FACTOR[machine] ?? 1);
  const vcFinal  = isMetric ? vcAdj : vcToSfm(vcAdj);

  const dia      = tool?.geometry?.diameter ?? 10;
  const flutes   = tool?.geometry?.numberOfFlutes ?? 2;
  const rpm      = Math.round(calcRpm(vcAdj, dia, isMetric));

  // Chip load from preset factor or fallback
  const clf      = preset?.chipLoadFactor;
  const clBase   = clf
    ? (isMetric ? dia : dia / 25.4) * ((clf.min + clf.max) / 2)
    : (isMetric ? dia * 0.01 : (dia / 25.4) * 0.01);

  // If a user preset is loaded, it overrides the calculated Vc/RPM/chipLoad
  const effectiveVcFinal  = loadedPreset != null ? loadedPreset.vc : vcFinal;
  const effectiveRpm      = loadedPreset != null ? loadedPreset.rpm : rpm;
  const chipLoad          = loadedPreset != null
    ? loadedPreset.chipLoad
    : parseFloat(clBase.toFixed(4));
  const plungePct         = loadedPreset?.plungePct ?? 40;

  const feedRate   = effectiveRpm * chipLoad * flutes;
  const plungeRate = feedRate * (plungePct / 100);

  const docValue  = (dia * docPct) / 100;
  const wocValue  = (dia * stepover) / 100;

  const vcUnit  = isMetric ? 'm/min' : 'SFM';
  const lenUnit = isMetric ? 'mm' : 'in';
  const fedUnit = isMetric ? 'mm/min' : 'in/min';
  const clUnit  = isMetric ? 'mm/fl' : 'in/fl';

  // ── Step 1 ────────────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-5">
        <p className="text-xs text-slate-400">
          Select the tool from your library and the workpiece material you are cutting.
        </p>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Tool</label>
          <select
            value={toolId}
            onChange={(e) => setToolId(e.target.value)}
            title="Select tool"
            className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.description || t.type} {t.geometry?.diameter ? `⌀${t.geometry.diameter}` : ''}
              </option>
            ))}
          </select>
          {tool && (
            <p className="mt-1 text-xs text-slate-500">
              ⌀{tool.geometry?.diameter ?? '?'} {lenUnit} · {tool.geometry?.numberOfFlutes ?? '?'} fl · {tool.type}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Workpiece Material</label>
          {allMaterials.length > 0 ? (
            <select
              value={matId}
              onChange={(e) => setMatId(e.target.value)}
              title="Select material"
              className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {allMaterials.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
              No materials in library. Add materials via the Libraries → Materials panel first.
            </div>
          )}
          {mat?.notes && (
            <p className="mt-1 text-xs text-slate-500 italic">{mat.notes}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────

  function renderStep2() {
    const hasPresets = settings.fsPresets.length > 0;
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-slate-400">
            Specify the cutting tool grade and machine setup. These affect the suggested surface speed.
          </p>
          {/* Load saved preset */}
          {hasPresets && (
            <div className="relative shrink-0" ref={presetRef}>
              <button
                type="button"
                onClick={() => setPresetOpen((o) => !o)}
                title="Load a saved F&S preset"
                className={[
                  'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap',
                  loadedPreset
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'text-slate-400 hover:text-slate-200 border-slate-600 hover:bg-slate-700',
                ].join(' ')}
              >
                <Bookmark size={11} />
                {loadedPreset ? loadedPreset.name : 'Load preset'}
                <ChevronDown size={10} className={presetOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              {presetOpen && (
                <div className="absolute right-0 top-full mt-1 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-10 overflow-hidden">
                  {loadedPreset && (
                    <button
                      type="button"
                      onClick={() => { setLoadedPreset(null); setPresetOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 border-b border-slate-700"
                    >
                      ✕ Clear preset (use calculated values)
                    </button>
                  )}
                  <div className="max-h-52 overflow-y-auto">
                    {settings.fsPresets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setLoadedPreset(p); setPresetOpen(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors"
                      >
                        <div className="text-xs font-medium text-slate-200">{p.name}</div>
                        <div className="text-xs text-slate-500">
                          {p.driver === 'vc'
                            ? `Vc ${p.vc} ${p.unit === 'metric' ? 'm/min' : 'SFM'}`
                            : `${p.rpm.toLocaleString()} RPM`}
                          {' · '}fz {p.chipLoad}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {loadedPreset && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">
            <Bookmark size={11} className="shrink-0" />
            Using preset <span className="font-semibold">{loadedPreset.name}</span> — Vc/RPM and chip load overridden. Tool grade and machine type still apply for DOC guidance.
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Tool Grade</p>
          <div className="grid grid-cols-1 gap-1.5">
            {TOOL_MAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setToolMat(opt.value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                  toolMat === opt.value
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Machine Type</p>
          <div className="grid grid-cols-1 gap-1.5">
            {(Object.keys(MACHINE_LABELS) as MachineType[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMachine(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                  machine === key
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {MACHINE_LABELS[key]}
                {key === 'router' && <span className="ml-2 text-xs text-slate-500">(−30% rigidity)</span>}
                {key === 'horizontal-mill' && <span className="ml-2 text-xs text-slate-500">(+10% rigidity)</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Depths of Cut</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Axial DOC (% dia)</label>
              <input
                type="number" title="Axial depth of cut as % of diameter"
                value={docPct} min={5} max={200} step={5}
                onChange={(e) => setDocPct(parseInt(e.target.value, 10) || 30)}
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Stepover (% dia)</label>
              <input
                type="number" title="Radial depth (stepover) as % of diameter"
                value={stepover} min={5} max={100} step={5}
                onChange={(e) => setStepover(parseInt(e.target.value, 10) || 50)}
                className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3 ────────────────────────────────────────────────────────────────

  function renderStep3() {
    const rows = [
      { label: `Surface speed (Vc)`, value: parseFloat(effectiveVcFinal.toFixed(1)), unit: vcUnit },
      { label: 'Spindle speed',       value: effectiveRpm,                             unit: 'rpm'   },
      { label: 'Chip load',           value: chipLoad,                       unit: clUnit  },
      { label: 'Feed rate',           value: Math.round(feedRate),           unit: fedUnit },
      { label: 'Plunge rate',         value: Math.round(plungeRate),         unit: fedUnit },
      { label: 'Axial DOC',           value: parseFloat(docValue.toFixed(3)), unit: lenUnit },
      { label: 'Stepover',            value: parseFloat(wocValue.toFixed(3)), unit: lenUnit },
    ];

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-700/30 border border-slate-700 px-3 py-2 text-xs text-slate-400">
          <span className="text-slate-200 font-medium">{tool?.description || tool?.type}</span>
          {' '}&rarr;{' '}
          <span className="text-slate-200 font-medium">{mat?.name ?? '—'}</span>
          {' '}·{' '}<span className="text-slate-300">{TOOL_MAT_OPTIONS.find((o) => o.value === toolMat)?.label}</span>
          {' '}·{' '}<span className="text-slate-300">{MACHINE_LABELS[machine]}</span>
          {loadedPreset && (
            <span className="ml-2 inline-flex items-center gap-1 text-blue-400">
              <Bookmark size={10} /> {loadedPreset.name}
            </span>
          )}
        </div>

        {!preset && (
          <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
            No matching preset for this material + tool grade combination. Values are estimated.
          </div>
        )}

        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <p className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-400 bg-slate-900/50 border-b border-slate-700">
            Suggested Values
          </p>
          {rows.map(({ label, value, unit: u }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60 last:border-0">
              <span className="text-sm text-slate-400">{label}</span>
              <span className="text-sm font-semibold text-slate-100 tabular-nums">
                {value} <span className="text-xs font-normal text-slate-500">{u}</span>
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500">
          These are conservative starting values. Always verify with a test cut and adjust based on chip colour, sound, and surface finish.
        </p>
      </div>
    );
  }

  // ── Apply ─────────────────────────────────────────────────────────────────

  function handleApply() {
    if (!tool || !mat) return;
    const entry: ToolMaterialEntry = {
      materialId:   matId,
      rpm:          effectiveRpm,
      surfaceSpeed: parseFloat(effectiveVcFinal.toFixed(1)),
      feedRate:     Math.round(feedRate * 10) / 10,
      feedPlunge:   Math.round(plungeRate * 10) / 10,
      feedPerTooth: chipLoad,
      depthOfCut:   parseFloat(docValue.toFixed(3)),
      widthOfCut:   parseFloat(wocValue.toFixed(3)),
    };
    onApply(toolId, entry);
    onClose();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const canNext = step === 1
    ? (!!toolId && (allMaterials.length === 0 || !!matId))
    : true;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Wand2 size={16} className="text-slate-400" />
            Cutting Data Wizard
          </h2>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-5 py-3 border-b border-slate-700 shrink-0">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className="flex items-center gap-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                s === step
                  ? 'bg-blue-600 text-white'
                  : s < step
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-400'
              }`}>
                {s < step ? <Check size={12} /> : s}
              </div>
              <span className={`ml-1.5 text-xs font-medium transition-colors ${s === step ? 'text-slate-200' : 'text-slate-500'}`}>
                {s === 1 ? 'Tool & Material' : s === 2 ? 'Setup' : 'Review'}
              </span>
              {s < 3 && <div className="mx-3 flex-1 h-px bg-slate-700 w-6" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-between">
          <button
            type="button"
            onClick={() => step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700"
          >
            <ChevronLeft size={14} />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={!canNext}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                canNext
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              disabled={!tool || !mat}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <Check size={14} /> Apply to tool
            </button>
          )}
        </div>
      </div>
    </>
  );
}
