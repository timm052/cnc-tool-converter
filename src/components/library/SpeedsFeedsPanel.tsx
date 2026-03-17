/**
 * SpeedsFeedsPanel — Inline Speeds & Feeds Calculator (roadmap 1.2)
 *
 * Bidirectional Vc ↔ RPM calculator.  Computes feed rate and plunge from
 * chip load + flutes.  Optionally pre-fills from a library tool and can
 * write calculated values back with one click.
 */

import { useState, useEffect } from 'react';
import { X, Calculator, ArrowLeftRight, ChevronDown } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import type { WorkMaterial } from '../../types/material';

// ── Constants ──────────────────────────────────────────────────────────────────

const PI = Math.PI;

function calcRpm(vc: number, diameter: number, metric: boolean): number {
  if (diameter <= 0) return 0;
  return metric
    ? (vc * 1000) / (PI * diameter)       // Vc m/min → RPM
    : (vc * 12)   / (PI * diameter);       // SFM ft/min → RPM
}

function calcVc(rpm: number, diameter: number, metric: boolean): number {
  if (diameter <= 0) return 0;
  return metric
    ? (rpm * PI * diameter) / 1000         // RPM → m/min
    : (rpm * PI * diameter) / 12;          // RPM → SFM
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  tool?:        LibraryTool | null;
  allMaterials: WorkMaterial[];
  onApply?:     (patch: Partial<LibraryTool>) => void;
  onClose:      () => void;
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function SpeedsFeedsPanel({ tool, allMaterials, onApply, onClose }: Props) {
  const isMetric = tool?.unit !== 'inch';

  // Inputs
  const [diameter, setDiameter] = useState(tool?.geometry?.diameter ?? 10);
  const [flutes,   setFlutes]   = useState(tool?.geometry?.numberOfFlutes ?? 2);
  const [vc,       setVc]       = useState(0);
  const [rpm,      setRpm]      = useState(tool?.cutting?.spindleRpm ?? 0);
  const [chipLoad, setChipLoad] = useState(0.05);
  const [plungePct, setPlungePct] = useState(50);

  // Material reference (optional)
  const [matId, setMatId] = useState('');

  // Which field was last edited: 'vc' or 'rpm'
  const [driver, setDriver] = useState<'vc' | 'rpm'>('rpm');

  // ── Derived calculations ──────────────────────────────────────────────────

  const displayRpm   = driver === 'vc' ? calcRpm(vc, diameter, isMetric) : rpm;
  const displayVc    = driver === 'rpm' ? calcVc(rpm, diameter, isMetric) : vc;
  const feedRate     = displayRpm * chipLoad * flutes;
  const plungeRate   = feedRate * (plungePct / 100);

  // Fill Vc bounds from material if selected
  const mat = allMaterials.find((m) => m.id === matId);
  const vcMin = isMetric ? mat?.vcMin : mat?.sfmMin;
  const vcMax = isMetric ? mat?.vcMax : mat?.sfmMax;

  // When tool changes, refresh diameter / flutes / rpm
  useEffect(() => {
    setDiameter(tool?.geometry?.diameter ?? 10);
    setFlutes(tool?.geometry?.numberOfFlutes ?? 2);
    setRpm(tool?.cutting?.spindleRpm ?? 0);
    setDriver('rpm');
  }, [tool?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────

  function handleVcChange(v: number) {
    setVc(v);
    setDriver('vc');
  }

  function handleRpmChange(v: number) {
    setRpm(v);
    setDriver('rpm');
  }

  function handleApply() {
    if (!onApply) return;
    onApply({
      cutting: {
        ...(tool?.cutting ?? {}),
        spindleRpm:  Math.round(displayRpm),
        feedCutting: Math.round(feedRate * 10) / 10,
        feedPlunge:  Math.round(plungeRate * 10) / 10,
      },
    });
    onClose();
  }

  const vcUnit  = isMetric ? 'm/min' : 'SFM';
  const fedUnit = isMetric ? 'mm/min' : 'in/min';
  const clUnit  = isMetric ? 'mm/fl' : 'in/fl';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[380px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Calculator size={16} className="text-slate-400" />
            Speeds &amp; Feeds
          </h2>
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Tool reference */}
          {tool && (
            <div className="rounded-lg bg-slate-700/50 border border-slate-700 px-3 py-2 text-xs text-slate-400">
              Using: <span className="text-slate-200 font-medium">{tool.description || tool.type}</span>
            </div>
          )}

          {/* Tool geometry inputs */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Tool Geometry</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Diameter ({isMetric ? 'mm' : 'in'})
                </label>
                <input
                  type="number"
                  value={diameter}
                  min={0.001}
                  step={0.1}
                  onChange={(e) => setDiameter(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Flutes</label>
                <input
                  type="number"
                  value={flutes}
                  min={1}
                  step={1}
                  onChange={(e) => setFlutes(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Material reference (optional) */}
          {allMaterials.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Material Reference (optional)</p>
              <div className="relative">
                <select
                  value={matId}
                  onChange={(e) => setMatId(e.target.value)}
                  title="Material reference"
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                >
                  <option value="">— None —</option>
                  {allMaterials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              {mat && (vcMin != null || vcMax != null) && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Recommended Vc: {vcMin ?? '?'}–{vcMax ?? '?'} {vcUnit}
                </p>
              )}
            </div>
          )}

          {/* Vc ↔ RPM */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Surface Speed ↔ RPM
            </p>
            <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Vc ({vcUnit})</label>
                <input
                  type="number"
                  value={driver === 'vc' ? vc : parseFloat(displayVc.toFixed(1))}
                  min={0}
                  step={1}
                  onChange={(e) => handleVcChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <ArrowLeftRight size={14} className="text-slate-500 mt-4" />
              <div>
                <label className="block text-xs text-slate-400 mb-1">RPM</label>
                <input
                  type="number"
                  value={driver === 'rpm' ? rpm : Math.round(displayRpm)}
                  min={0}
                  step={100}
                  onChange={(e) => handleRpmChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Feed calculation */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Feed Rate</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Chip load ({clUnit})
                </label>
                <input
                  type="number"
                  value={chipLoad}
                  min={0.001}
                  step={0.001}
                  onChange={(e) => setChipLoad(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Plunge %</label>
                <input
                  type="number"
                  value={plungePct}
                  min={1}
                  max={100}
                  step={5}
                  onChange={(e) => setPlungePct(parseInt(e.target.value, 10) || 50)}
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <p className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-400 bg-slate-900/50 border-b border-slate-700">
              Calculated Results
            </p>
            {[
              { label: 'RPM',        value: Math.round(displayRpm), unit: 'rpm'    },
              { label: 'Surface speed', value: parseFloat(displayVc.toFixed(1)),   unit: vcUnit  },
              { label: 'Feed rate',  value: Math.round(feedRate),   unit: fedUnit  },
              { label: 'Plunge rate', value: Math.round(plungeRate), unit: fedUnit },
            ].map(({ label, value, unit: u }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60 last:border-0">
                <span className="text-sm text-slate-400">{label}</span>
                <span className="text-sm font-semibold text-slate-100">
                  {value} <span className="text-xs font-normal text-slate-500">{u}</span>
                </span>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            Close
          </button>
          {onApply && (
            <button
              onClick={handleApply}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Apply to tool
            </button>
          )}
        </div>
      </div>
    </>
  );
}
