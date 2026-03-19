import { useState, useEffect, useRef } from 'react';
import { X, Printer, QrCode, Barcode } from 'lucide-react';
import type { LibraryTool } from '../../types/libraryTool';
import { getActiveInstance } from '../../lib/toolInstance';
import {
  DEFAULT_LABEL_OPTIONS,
  type LabelOptions,
  buildQrText,
  generateQrDataUrl,
  generateBarcodeDataUrl,
  printLabels,
  countLabels,
} from '../../lib/printUtils';
import FieldToggle from '../ui/FieldToggle';

interface LabelPrintPanelProps {
  tools:   LibraryTool[];
  onClose: () => void;
}

// ── Numeric input ─────────────────────────────────────────────────────────────
// Uses a local string state so the user can freely type intermediate values
// (e.g. "1", "10", "1.5") without the clamped number snapping the field mid-entry.
// Clamping only happens on blur or when the spinner arrows are used.

function NumInput({
  label, value, min, max, step = 1, suffix, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));

  // Keep raw in sync when the parent value changes externally
  useEffect(() => { setRaw(String(value)); }, [value]);

  function commit(str: string) {
    const n = parseFloat(str);
    const clamped = isNaN(n) ? value : Math.min(max, Math.max(min, n));
    onChange(clamped);
    setRaw(String(clamped));
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={raw}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          title={label}
          className="w-20 px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
        />
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Label preview ─────────────────────────────────────────────────────────────
// Scales the label so it always fits inside the panel (max ~350px wide).
// Font sizes track the scale so the preview stays proportional to a real print.

const BASE_PX_PER_MM = 2.8;   // ~96dpi equivalent scale
const PREVIEW_MAX_PX  = 350;  // max preview label width in pixels

function LabelPreview({
  tool, opts, codeDataUrl,
}: { tool: LibraryTool; opts: LabelOptions; codeDataUrl: string }) {
  const useBarcode = opts.showQr && opts.codeType === 'barcode';

  // Scale down if the label is wider than PREVIEW_MAX_PX
  const scale   = Math.min(BASE_PX_PER_MM, PREVIEW_MAX_PX / opts.widthMm);
  const w       = opts.widthMm  * scale;
  const h       = opts.heightMm * scale;
  // Mirror the print sizing: QR capped by both height and width
  const qrMm    = Math.max(4, Math.min(opts.heightMm - 5, opts.widthMm * 0.45 - 3));
  const qrSize  = qrMm * scale;
  const barcodeH = Math.max(6, opts.heightMm * 0.28) * scale;
  const pad     = Math.max(2, 4  * scale / BASE_PX_PER_MM);
  const gap     = Math.max(2, 4  * scale / BASE_PX_PER_MM);

  // Font sizes scale with rendered label HEIGHT (matching print behaviour).
  // Reference: 29mm tall label → ratio 1.0, giving ~8-9px for the tool number line.
  const ratio   = h / (29 * BASE_PX_PER_MM);
  const fTnum   = Math.max(5,  Math.round(8.5 * ratio));
  const fDesc   = Math.max(4,  Math.round(7.5 * ratio));
  const fField  = Math.max(3.5,Math.round(6.5 * ratio));

  const instances   = tool.instances ?? [];
  const active      = getActiveInstance(tool);
  // For per-instance preview, show the first instance; for range, show the range
  const previewInst = opts.instanceMode === 'per-instance' ? (instances[0] ?? active) : active;
  const displayDiam = opts.useActualDiameter && previewInst?.actualDiameter != null
    ? previewInst.actualDiameter
    : tool.geometry.diameter;

  type Line = { text: string; bold?: boolean; mono?: boolean; color?: string };
  const lines: Line[] = [];

  if (opts.instanceMode === 'range' && instances.length > 0) {
    // Range (case) label
    const first     = instances[0].letter;
    const last      = instances[instances.length - 1].letter;
    const rangeText = first === last ? first : `${first}–${last}`;
    const countText = instances.length > 1 ? ` · ${instances.length} pcs` : '';
    if (opts.showTNumber) lines.push({ text: `T${tool.toolNumber}`, bold: true, mono: true });
    lines.push({ text: `${rangeText}${countText}`, bold: true, mono: true, color: '#0d7377' });
    if (opts.showDesc)    lines.push({ text: tool.description, bold: true });
    if (opts.showType)    lines.push({ text: tool.type });
    if (opts.showDiameter) lines.push({ text: `Ø${tool.geometry.diameter} ${tool.unit}`, mono: true });
  } else {
    // One or per-instance label
    const letterSuffix = opts.instanceMode === 'per-instance' && previewInst
      ? `-${previewInst.letter}`
      : opts.showInstanceLetter && active ? `-${active.letter}` : '';
    if (opts.showTNumber)  lines.push({ text: `T${tool.toolNumber}${letterSuffix}`, bold: true, mono: true });
    if (opts.showDesc)     lines.push({ text: tool.description, bold: true });
    if (opts.showType)     lines.push({ text: tool.type });
    if (opts.showDiameter) lines.push({ text: `Ø${displayDiam} ${tool.unit}${opts.useActualDiameter && previewInst?.actualDiameter != null ? ' (actual)' : ''}`, mono: true });
    if (opts.showFlutes && tool.geometry.numberOfFlutes)
                           lines.push({ text: `${tool.geometry.numberOfFlutes} flutes` });
    if (opts.showMachine && (tool.machineGroups?.length ?? 0) > 0)
                           lines.push({ text: tool.machineGroups!.join(', ') });
    if (opts.showTags && tool.tags.length)
                           lines.push({ text: tool.tags.join(' · ') });
    if (opts.instanceMode === 'per-instance' && previewInst?.condition)
                           lines.push({ text: previewInst.condition });
    if (opts.instanceMode === 'per-instance' && previewInst?.comment)
                           lines.push({ text: previewInst.comment });
  }

  const textLines = (
    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {lines.map((l, i) => {
        const fs = i === 0 ? fTnum : i === 1 ? fDesc : fField;
        return (
          <div
            key={i}
            style={{
              fontSize: fs,
              lineHeight: 1.25,
              fontWeight: l.bold ? 700 : 400,
              fontFamily: l.mono ? 'monospace' : 'sans-serif',
              color: l.color ?? (l.bold ? '#111' : '#555'),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {l.text}
          </div>
        );
      })}
    </div>
  );

  if (useBarcode) {
    // Barcode layout: text on top, barcode at bottom
    return (
      <div
        className="border border-slate-400 rounded overflow-hidden flex flex-col bg-white shrink-0"
        style={{ width: w, height: h, padding: `${pad * 0.6}px ${pad}px ${pad * 0.4}px`, gap: pad * 0.3 }}
      >
        {textLines}
        {opts.showQr && codeDataUrl && (
          <img
            src={codeDataUrl}
            alt="Barcode"
            style={{ width: '100%', height: barcodeH, flexShrink: 0, objectFit: 'fill', imageRendering: 'pixelated' }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="border border-slate-400 rounded overflow-hidden flex items-center bg-white shrink-0"
      style={{ width: w, height: h, padding: pad, gap }}
    >
      {opts.showQr && codeDataUrl && (
        <img
          src={codeDataUrl}
          alt="QR"
          style={{ width: qrSize, height: qrSize, flexShrink: 0, imageRendering: 'pixelated' }}
        />
      )}
      {textLines}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function LabelPrintPanel({ tools, onClose }: LabelPrintPanelProps) {
  const [opts, setOpts]             = useState<LabelOptions>(DEFAULT_LABEL_OPTIONS);
  const [isPrinting, setIsPrinting] = useState(false);
  const [previewCode, setPreviewCode] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewTool      = tools[0];
  const hasInstanceTools = tools.some((t) => (t.instances?.length ?? 0) > 0);
  const labelCount       = countLabels(tools, opts.instanceMode);

  // Regenerate preview code image when relevant opts change
  useEffect(() => {
    if (!previewTool || !opts.showQr) { setPreviewCode(''); return; }
    if (opts.codeType === 'barcode') {
      // Synchronous — no debounce needed
      setPreviewCode(generateBarcodeDataUrl(buildQrText(previewTool, opts.qrContent), 80));
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const url = await generateQrDataUrl(buildQrText(previewTool, opts.qrContent), 80);
      setPreviewCode(url);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [opts.showQr, opts.codeType, opts.qrContent, previewTool]);

  function patch(p: Partial<LabelOptions>) {
    setOpts((prev) => ({ ...prev, ...p }));
  }

  async function handlePrint() {
    setIsPrinting(true);
    await printLabels(tools, opts);
    setIsPrinting(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[460px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <QrCode size={16} className="text-slate-400" />
              <h2 className="text-base font-semibold text-slate-100">Print Labels</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{tools.length} tool{tools.length !== 1 ? 's' : ''} selected</p>
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Label size */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Label size</p>
            <div className="grid grid-cols-3 gap-3">
              <NumInput label="Width"   value={opts.widthMm}  min={20} max={200} step={0.5} suffix="mm" onChange={(v) => patch({ widthMm: v })} />
              <NumInput label="Height"  value={opts.heightMm} min={10} max={100} step={0.5} suffix="mm" onChange={(v) => patch({ heightMm: v })} />
              <NumInput label="Columns" value={opts.columns}  min={1}  max={8}   step={1}            onChange={(v) => patch({ columns: v })} />
            </div>
            <div className="mt-3">
              <NumInput label="Gap between labels" value={opts.gapMm} min={0} max={10} step={0.5} suffix="mm" onChange={(v) => patch({ gapMm: v })} />
            </div>
          </div>

          {/* Symbol / code */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Symbol / code</p>
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 space-y-3">
              <FieldToggle label="Include scannable code" checked={opts.showQr} onChange={(v) => patch({ showQr: v })} />
              {opts.showQr && (
                <>
                  {/* QR vs Barcode toggle */}
                  <div className="flex gap-2">
                    {([
                      { type: 'qr',      icon: <QrCode size={13} />,  label: 'QR code'    },
                      { type: 'barcode', icon: <Barcode size={13} />, label: '1D Barcode'  },
                    ] as { type: LabelOptions['codeType']; icon: React.ReactNode; label: string }[]).map(({ type, icon, label }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          // 'full' content is QR-only — switch to 'id' when moving to barcode
                          patch({ codeType: type, ...(type === 'barcode' && opts.qrContent === 'full' ? { qrContent: 'id' } : {}) });
                        }}
                        className={[
                          'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                          opts.codeType === type
                            ? 'border-blue-500/60 bg-blue-600/10 text-blue-300'
                            : 'border-slate-600 bg-slate-700/40 text-slate-400 hover:text-slate-200',
                        ].join(' ')}
                      >
                        {icon}{label}
                      </button>
                    ))}
                  </div>

                  {/* Content dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      {opts.codeType === 'barcode' ? 'Barcode' : 'QR'} content
                    </label>
                    <select
                      value={opts.qrContent}
                      aria-label="Code content"
                      onChange={(e) => patch({ qrContent: e.target.value as LabelOptions['qrContent'] })}
                      className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {opts.codeType === 'qr' && (
                        <option value="full">Full info (T#, description, type, diameter)</option>
                      )}
                      <option value="description">T# + description</option>
                      <option value="toolnumber">Tool number only (T001)</option>
                      <option value="id">Tool ID (UUID — for scanner lookup)</option>
                    </select>
                    {opts.codeType === 'barcode' && opts.qrContent === 'id' && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        UUID barcodes are long — wider labels (&gt;80 mm) work best.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Fields */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Fields to print</p>
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 grid grid-cols-2 gap-2">
              <FieldToggle label="Tool number (T#)"     checked={opts.showTNumber}        onChange={(v) => patch({ showTNumber: v })} />
              <FieldToggle label="Description"          checked={opts.showDesc}           onChange={(v) => patch({ showDesc: v })} />
              <FieldToggle label="Type"                 checked={opts.showType}           onChange={(v) => patch({ showType: v })} />
              <FieldToggle label="Diameter"             checked={opts.showDiameter}       onChange={(v) => patch({ showDiameter: v })} />
              <FieldToggle label="Flute count"          checked={opts.showFlutes}         onChange={(v) => patch({ showFlutes: v })} />
              <FieldToggle label="Machine group"        checked={opts.showMachine}        onChange={(v) => patch({ showMachine: v })} />
              <FieldToggle label="Tags"                 checked={opts.showTags}           onChange={(v) => patch({ showTags: v })} />
              <FieldToggle label="Instance letter (A/B…)" checked={opts.showInstanceLetter} onChange={(v) => patch({ showInstanceLetter: v })} />
              <FieldToggle label="Use actual diameter"  checked={opts.useActualDiameter}  onChange={(v) => patch({ useActualDiameter: v })} />
            </div>
          </div>

          {/* Instance labels — only shown when at least one tool has instances */}
          {hasInstanceTools && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Instance labels</p>
              <div className="space-y-2">
                {([
                  { mode: 'one',          label: 'One per tool',    desc: 'Active instance only — default behaviour' },
                  { mode: 'per-instance', label: 'One per copy',    desc: 'One label per physical copy (A, B, C…)' },
                  { mode: 'range',        label: 'Case / tray label', desc: 'One label per tool showing the full range (A–E)' },
                ] as const).map(({ mode, label, desc }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => patch({ instanceMode: mode })}
                    className={[
                      'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                      opts.instanceMode === mode
                        ? 'border-blue-500/60 bg-blue-600/10'
                        : 'border-slate-700 bg-slate-800/60 hover:border-slate-600',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${opts.instanceMode === mode ? 'text-blue-300' : 'text-slate-200'}`}>{label}</span>
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${opts.instanceMode === mode ? 'border-blue-400' : 'border-slate-600'}`}>
                        {opts.instanceMode === mode && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live preview */}
          {previewTool && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                Preview <span className="font-normal text-slate-500 normal-case">(T{previewTool.toolNumber})</span>
              </p>
              <div className="rounded-lg bg-slate-700/30 border border-slate-700 p-4 flex gap-3 flex-wrap">
                <LabelPreview tool={previewTool} opts={opts} codeDataUrl={previewCode} />
                {tools[1] && (
                  <LabelPreview tool={tools[1]} opts={opts} codeDataUrl={previewCode} />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Actual print size: {opts.widthMm}&thinsp;×&thinsp;{opts.heightMm}&thinsp;mm per label, {opts.columns} column{opts.columns !== 1 ? 's' : ''} per row
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              !isPrinting ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            <Printer size={14} />
            {isPrinting ? 'Opening…' : `Print ${labelCount} label${labelCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  );
}
