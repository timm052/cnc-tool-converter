/**
 * ToolDebugPage — dev-only page for visually checking every tool type SVG.
 *
 * Global sliders at the top control the geometry fields shared across all
 * tool type cards.  Cards are arranged in a responsive grid so you can see
 * the effect of each slider on every shape at once.
 */

import { useState } from 'react';
import { BUILTIN_TYPES } from '../../lib/customToolTypes';
import { ToolProfileSVG } from '../library/ToolProfileSVG';
import type { LibraryTool } from '../../types/libraryTool';
import type { ToolType } from '../../types/tool';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTool(type: ToolType, geo: Record<string, number | boolean | undefined>): LibraryTool {
  return {
    id:           `debug-${type}`,
    toolNumber:   1,
    type,
    description:  type,
    unit:         'mm',
    geometry: {
      diameter:       10,
      shaftDiameter:  10,
      overallLength:  80,
      fluteLength:    30,
      cornerRadius:   0,
      taperAngle:     45,
      tipDiameter:    0,
      threadPitch:    1.5,
      numberOfTeeth:  4,
      numberOfFlutes: 3,
      coolantSupport: false,
      ...geo,
    },
    tags:         [],
    starred:      false,
    machineGroups: [],
    addedAt:      0,
    updatedAt:    0,
  } as LibraryTool;
}

// ── Field control helpers ──────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step = 0.5, onChange }: SliderProps) {
  return (
    <label className="flex flex-col gap-0.5 min-w-[90px]">
      <span className="text-xs text-slate-400 whitespace-nowrap">
        {label}: <strong className="text-slate-200">{value}</strong>
      </span>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-500"
      />
    </label>
  );
}

// ── Default geometry state ─────────────────────────────────────────────────

interface DebugGeo {
  diameter:       number;
  shaftDiameter:  number;
  overallLength:  number;
  fluteLength:    number;
  cornerRadius:   number;
  taperAngle:     number;
  tipDiameter:    number;
  profileRadius:  number;
  threadPitch:    number;
  numberOfTeeth:  number;
  nozzleDiameter: number;
}

const DEFAULT: DebugGeo = {
  diameter:       10,
  shaftDiameter:  10,
  overallLength:  80,
  fluteLength:    30,
  cornerRadius:   0,
  taperAngle:     45,
  tipDiameter:    0,
  profileRadius:  0,
  threadPitch:    1.5,
  numberOfTeeth:  4,
  nozzleDiameter: 0,
};

// ── Main component ─────────────────────────────────────────────────────────

export default function ToolDebugPage() {
  const [geo, setGeo] = useState<DebugGeo>(DEFAULT);

  function set(field: keyof DebugGeo) {
    return (v: number) => setGeo((prev) => ({ ...prev, [field]: v }));
  }

  /** Build geometry object from sliders, applying zeros as undefined where
   *  the tool's logic treats 0 as "not set". */
  function geoFor(type: ToolType): Record<string, number | boolean | undefined> {
    return {
      diameter:       geo.diameter,
      shaftDiameter:  geo.shaftDiameter,
      overallLength:  geo.overallLength,
      fluteLength:    geo.fluteLength,
      cornerRadius:   geo.cornerRadius,
      taperAngle:     geo.taperAngle,
      tipDiameter:    geo.tipDiameter,
      profileRadius:  geo.profileRadius > 0 ? geo.profileRadius : undefined,
      threadPitch:    geo.threadPitch,
      numberOfTeeth:  geo.numberOfTeeth,
      nozzleDiameter: geo.nozzleDiameter > 0 ? geo.nozzleDiameter : undefined,
      // Give jet cutters a visible diameter
      ...((['laser cutter', 'plasma cutter', 'waterjet'] as string[]).includes(type)
        ? { nozzleDiameter: geo.nozzleDiameter > 0 ? geo.nozzleDiameter : 1 }
        : {}),
    };
  }

  return (
    <div className="h-full overflow-auto bg-slate-950 text-slate-100">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 font-mono">DEV</span>
            Tool Preview Debug
          </h1>
          <button
            onClick={() => setGeo(DEFAULT)}
            type="button"
            className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* ── Global sliders ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-4">
          <Slider label="Diameter"     value={geo.diameter}       min={1}   max={50}  step={0.5}  onChange={set('diameter')} />
          <Slider label="Shaft Ø"      value={geo.shaftDiameter}  min={1}   max={50}  step={0.5}  onChange={set('shaftDiameter')} />
          <Slider label="OAL"          value={geo.overallLength}  min={10}  max={200} step={5}    onChange={set('overallLength')} />
          <Slider label="Flute L"      value={geo.fluteLength}    min={2}   max={100} step={1}    onChange={set('fluteLength')} />
          <Slider label="Corner R"     value={geo.cornerRadius}   min={0}   max={10}  step={0.1}  onChange={set('cornerRadius')} />
          <Slider label="Taper °"      value={geo.taperAngle}     min={1}   max={89}  step={1}    onChange={set('taperAngle')} />
          <Slider label="Tip Ø"        value={geo.tipDiameter}    min={0}   max={10}  step={0.1}  onChange={set('tipDiameter')} />
          <Slider label="Profile R"    value={geo.profileRadius}  min={0}   max={50}  step={0.5}  onChange={set('profileRadius')} />
          <Slider label="Pitch"        value={geo.threadPitch}    min={0.1} max={5}   step={0.1}  onChange={set('threadPitch')} />
          <Slider label="Teeth"        value={geo.numberOfTeeth}  min={1}   max={20}  step={1}    onChange={set('numberOfTeeth')} />
          <Slider label="Nozzle Ø"     value={geo.nozzleDiameter} min={0}   max={10}  step={0.1}  onChange={set('nozzleDiameter')} />
        </div>
      </div>

      {/* ── Tool type grid ─────────────────────────────────────────────── */}
      <div className="p-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {BUILTIN_TYPES.map((type) => (
          <div key={type}
               className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-500 transition-colors">
            <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">{type}</span>
            </div>
            <ToolProfileSVG
              draft={makeTool(type, geoFor(type))}
              zoom={2.5}
              autoHeight
            />
          </div>
        ))}
      </div>
    </div>
  );
}
