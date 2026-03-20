import { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertCircle, CheckCircle, RotateCcw, Search, Archive, Plus, Minus, Printer, Pencil, ScanLine, Usb } from 'lucide-react';
import jsQR from 'jsqr';
import type { LibraryTool } from '../../types/libraryTool';
import { printLabels, DEFAULT_LABEL_OPTIONS } from '../../lib/printUtils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface QrScannerPanelProps {
  tools:        LibraryTool[];
  onFound:      (tool: LibraryTool) => void;
  onUpdateTool: (id: string, patch: Partial<LibraryTool>) => Promise<void>;
  onClose:      () => void;
}

type ScanMode  = 'find' | 'stock';
type StockDir  = 'in'   | 'out';
type Status    = 'starting' | 'scanning' | 'found' | 'error';

interface StockEntry {
  toolNumber:  number;
  description: string;
  delta:       number;
  newQty:      number;
  time:        number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SCAN_INTERVAL_MS    = 66;   // ~15 fps
const RESCAN_DEBOUNCE     = 1500; // ms before same QR/barcode can be acted on again
// USB HID scanners: typically < 5 ms between chars.
// Bluetooth HID scanners: typically < 50 ms between chars.
// Human typing at 120 WPM: ~100 ms between chars.
// Threshold set at 80 ms — fast enough to exclude human typing while catching Bluetooth lag.
const HID_CHAR_THRESHOLD  = 80;   // ms — chars arriving faster than this = scanner (USB or BT)
const HID_COMMIT_DELAY    = 250;  // ms — process buffer if no Enter after last char
const HID_MIN_LEN         = 4;    // min chars to treat as a scan (filters stray keys)

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Find a tool by UUID or by barcode tool-number format (e.g. "T001", "T42").
 * Returns undefined if no match.
 */
function findToolByCode(tools: LibraryTool[], code: string): LibraryTool | undefined {
  // Try UUID match first
  const byId = tools.find((t) => t.id === code);
  if (byId) return byId;
  // Try T-number format: "T001", "T1", "T042" etc.
  const tnMatch = /^T0*(\d+)$/i.exec(code.trim());
  if (tnMatch) {
    const num = parseInt(tnMatch[1], 10);
    return tools.find((t) => t.toolNumber === num);
  }
  return undefined;
}

/** Map a jsQR video-pixel point to overlay-canvas CSS-pixel space (object-cover aware). */
function toCanvasPt(
  p: { x: number; y: number },
  vw: number, vh: number,
  cw: number, ch: number,
): { x: number; y: number } {
  const videoAspect     = vw / vh;
  const containerAspect = cw / ch;
  let drawX: number, drawY: number, drawW: number, drawH: number;
  if (videoAspect > containerAspect) {
    drawH = ch; drawW = ch * videoAspect;
    drawX = (cw - drawW) / 2; drawY = 0;
  } else {
    drawW = cw; drawH = cw / videoAspect;
    drawX = 0;  drawY = (ch - drawH) / 2;
  }
  return { x: drawX + (p.x / vw) * drawW, y: drawY + (p.y / vh) * drawH };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function QrScannerPanel({
  tools, onFound, onUpdateTool, onClose,
}: QrScannerPanelProps) {

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const decodeRef   = useRef<HTMLCanvasElement>(null);   // hidden, full res
  const overlayRef  = useRef<HTMLCanvasElement>(null);   // visible, CSS res
  const rafRef      = useRef<number | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  // ── Scan-loop live refs (avoid stale closures without restarting camera) ────
  const toolsRef       = useRef(tools);
  const onFoundRef     = useRef(onFound);
  const onUpdateRef    = useRef(onUpdateTool);
  const modeRef        = useRef<ScanMode>('find');
  const stockDirRef    = useRef<StockDir>('in');
  const stockAmountRef = useRef(1);
  const lastScanMs     = useRef(0);
  const lastActedId    = useRef('');   // debounce

  useEffect(() => { toolsRef.current    = tools;         }, [tools]);
  useEffect(() => { onFoundRef.current  = onFound;       }, [onFound]);
  useEffect(() => { onUpdateRef.current = onUpdateTool;  }, [onUpdateTool]);

  // ── HID scanner refs (USB + Bluetooth) ─────────────────────────────────────
  const usbBuf        = useRef('');
  const usbLastCharAt = useRef(0);
  const usbTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [status,       setStatus]       = useState<Status>('starting');
  const [errorMsg,     setErrorMsg]     = useState('');
  const [unknownText,  setUnknownText]  = useState('');
  const [foundTool,    setFoundTool]    = useState<LibraryTool | null>(null);
  const [isPrintingLabel, setIsPrintingLabel] = useState(false);
  const [mode,         setMode]         = useState<ScanMode>('find');
  const [stockDir,     setStockDir]     = useState<StockDir>('in');
  const [stockAmount,  setStockAmount]  = useState(1);
  const [stockLog,     setStockLog]     = useState<StockEntry[]>([]);
  const [cameras,      setCameras]      = useState<MediaDeviceInfo[]>([]);
  const [activeCamId,  setActiveCamId]  = useState('');
  const [manualUuid,   setManualUuid]   = useState('');
  const [manualError,  setManualError]  = useState('');
  const [isHttpWarn,   setIsHttpWarn]   = useState(false);
  const [hidLastScan,  setHidLastScan]  = useState<string>('');

  // Keep mode/dir/amount refs in sync with state
  useEffect(() => { modeRef.current        = mode;        }, [mode]);
  useEffect(() => { stockDirRef.current    = stockDir;    }, [stockDir]);
  useEffect(() => { stockAmountRef.current = stockAmount; }, [stockAmount]);

  // Detect non-HTTPS context (getUserMedia requires secure context)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      location.protocol !== 'https:' &&
      location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1'
    ) setIsHttpWarn(true);
  }, []);

  // ── Overlay drawing ─────────────────────────────────────────────────────────

  function drawOverlay(loc: NonNullable<ReturnType<typeof jsQR>>['location'] | null, colour = '#4ade80') {
    const canvas = overlayRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    canvas.width  = video.clientWidth;
    canvas.height = video.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!loc) return;

    const vw = video.videoWidth, vh = video.videoHeight;
    const cw = canvas.width,    ch = canvas.height;
    const corners = [
      toCanvasPt(loc.topLeftCorner,     vw, vh, cw, ch),
      toCanvasPt(loc.topRightCorner,    vw, vh, cw, ch),
      toCanvasPt(loc.bottomRightCorner, vw, vh, cw, ch),
      toCanvasPt(loc.bottomLeftCorner,  vw, vh, cw, ch),
    ];
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((c) => ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.strokeStyle = colour;
    ctx.lineWidth   = 3;
    ctx.stroke();
    ctx.fillStyle = colour.replace(')', ',0.15)').replace('rgb(', 'rgba(').replace('#', 'rgba(').replace(/^rgba\((.{6})/, (_,h) => `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`);
    // Simpler fill: just use a semi-transparent overlay
    ctx.globalAlpha = 0.15;
    ctx.fillStyle   = colour;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Camera start / restart ──────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus('starting');

    function tick() {
      if (!mounted) return;
      const now    = Date.now();
      const video  = videoRef.current;
      const canvas = decodeRef.current;
      if (!video || !canvas) { rafRef.current = requestAnimationFrame(tick); return; }

      // Throttle to ~15 fps
      if (now - lastScanMs.current < SCAN_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastScanMs.current = now;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',   // handles dark/inverted QR codes too
          });

          if (code?.data) {
            const highlightColour = modeRef.current === 'stock'
              ? (stockDirRef.current === 'in' ? '#4ade80' : '#f87171')
              : '#60a5fa';
            drawOverlay(code.location, highlightColour);
            setUnknownText('');

            // Debounce: don't act on the same QR twice in quick succession
            if (code.data !== lastActedId.current) {
              const tool = findToolByCode(toolsRef.current, code.data);
              if (tool) {
                lastActedId.current = code.data;
                setTimeout(() => { lastActedId.current = ''; }, RESCAN_DEBOUNCE);

                if (modeRef.current === 'find') {
                  setFoundTool(tool);
                  setStatus('found');
                  return; // stop scanning — user picks action from card
                } else {
                  // Stock mode: adjust qty and log it
                  const delta  = stockDirRef.current === 'in' ? stockAmountRef.current : -stockAmountRef.current;
                  const newQty = Math.max(0, (tool.quantity ?? 0) + delta);
                  onUpdateRef.current(tool.id, { quantity: newQty });
                  setStockLog((prev) => [
                    { toolNumber: tool.toolNumber, description: tool.description, delta, newQty, time: Date.now() },
                    ...prev.slice(0, 19),
                  ]);
                }
              } else {
                setUnknownText(code.data.length > 46 ? code.data.slice(0, 46) + '…' : code.data);
              }
            }
          } else {
            drawOverlay(null);
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        const videoConstraints: MediaTrackConstraints = activeCamId
          ? { deviceId: { exact: activeCamId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment',         width: { ideal: 1280 }, height: { ideal: 720 } };

        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Enumerate cameras once permission is granted
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (mounted) setCameras(devices.filter((d) => d.kind === 'videoinput'));

        setStatus('scanning');
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (!mounted) return;
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Could not access camera');
      }
    }

    start();

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [activeCamId]); // restart when user switches camera

  // ── Auto-focus manual input on mount ────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => manualInputRef.current?.focus(), 300);
  }, []);

  // ── USB scanner global keyboard listener ────────────────────────────────────
  // USB HID scanners emulate a keyboard and send characters very rapidly
  // (typically < 10 ms apart). We detect this by timing and buffer the input.
  useEffect(() => {
    function processUsbCode(code: string) {
      const trimmed = code.trim();
      if (trimmed.length < HID_MIN_LEN) return;
      setHidLastScan(trimmed);
      setManualError('');

      const tool = findToolByCode(toolsRef.current, trimmed);
      if (!tool) return;

      if (modeRef.current === 'find') {
        if (trimmed !== lastActedId.current) {
          lastActedId.current = trimmed;
          setTimeout(() => { lastActedId.current = ''; }, RESCAN_DEBOUNCE);
          setFoundTool(tool);
          setStatus('found');
        }
      } else {
        if (trimmed !== lastActedId.current) {
          lastActedId.current = trimmed;
          setTimeout(() => { lastActedId.current = ''; }, RESCAN_DEBOUNCE);
          const delta  = stockDirRef.current === 'in' ? stockAmountRef.current : -stockAmountRef.current;
          const newQty = Math.max(0, (tool.quantity ?? 0) + delta);
          onUpdateRef.current(tool.id, { quantity: newQty });
          setStockLog((prev) => [
            { toolNumber: tool.toolNumber, description: tool.description, delta, newQty, time: Date.now() },
            ...prev.slice(0, 19),
          ]);
        }
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      // If the user is actively typing in an input/textarea, skip
      const target = document.activeElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) return;

      const now = Date.now();

      if (e.key === 'Enter') {
        if (usbTimerRef.current) clearTimeout(usbTimerRef.current);
        if (usbBuf.current.length >= HID_MIN_LEN) {
          processUsbCode(usbBuf.current);
        }
        usbBuf.current = '';
        return;
      }

      if (e.key.length === 1) {
        const gap = now - usbLastCharAt.current;
        // If gap is too large (user is typing slowly), reset buffer
        if (usbBuf.current.length > 0 && gap > HID_CHAR_THRESHOLD * 3) {
          usbBuf.current = '';
        }
        usbBuf.current        += e.key;
        usbLastCharAt.current  = now;

        // Commit after a timeout in case there's no Enter (some scanners omit it)
        if (usbTimerRef.current) clearTimeout(usbTimerRef.current);
        usbTimerRef.current = setTimeout(() => {
          if (usbBuf.current.length >= HID_MIN_LEN) {
            processUsbCode(usbBuf.current);
          }
          usbBuf.current = '';
        }, HID_COMMIT_DELAY);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (usbTimerRef.current) clearTimeout(usbTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manual lookup (UUID or T-number) ────────────────────────────────────────

  function handleManualLookup() {
    setManualError('');
    const code = manualUuid.trim();
    if (!code) return;
    const tool = findToolByCode(tools, code);
    if (!tool) { setManualError('No tool found — enter a UUID or tool number (e.g. T42)'); return; }

    if (mode === 'find') {
      onFound(tool);
    } else {
      const delta  = stockDir === 'in' ? stockAmount : -stockAmount;
      const newQty = Math.max(0, (tool.quantity ?? 0) + delta);
      onUpdateTool(tool.id, { quantity: newQty });
      setStockLog((prev) => [
        { toolNumber: tool.toolNumber, description: tool.description, delta, newQty, time: Date.now() },
        ...prev.slice(0, 19),
      ]);
      setManualUuid('');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isStock = mode === 'stock';

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-h-[90vh] flex flex-col bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          {/* Mode tabs */}
          <div className="flex items-center gap-0.5 bg-slate-700/60 rounded-lg p-0.5">
            {([
              { id: 'find',  icon: <Search  size={11} />, label: 'Find Tool'   },
              { id: 'stock', icon: <Archive size={11} />, label: 'Stock Mode'  },
            ] as { id: ScanMode; icon: React.ReactNode; label: string }[]).map(({ id, icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  mode === id ? 'bg-slate-600 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {icon}{label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} title="Close scanner"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── HTTPS warning ───────────────────────────────────────────────── */}
        {isHttpWarn && (
          <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs shrink-0">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            Camera requires HTTPS — this page is served over HTTP so scanning may be blocked.
          </div>
        )}

        {/* ── Camera viewport ─────────────────────────────────────────────── */}
        <div className="relative bg-black shrink-0 aspect-video">
          {status === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertCircle size={36} className="text-red-400" />
              <p className="text-sm font-medium text-red-300">Camera unavailable</p>
              <p className="text-xs text-slate-400">{errorMsg}</p>
              <p className="text-xs text-slate-500">
                Check browser camera permissions and make sure the page is on HTTPS.
              </p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

              {/* QR highlight overlay canvas */}
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />

              {/* Viewfinder brackets */}
              {status === 'scanning' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-[180px] h-[180px] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                    {(['tl','tr','bl','br'] as const).map((c) => (
                      <div key={c} className={[
                        'absolute w-7 h-7',
                        isStock
                          ? (stockDir === 'in' ? 'border-green-400' : 'border-red-400')
                          : 'border-blue-400',
                        c === 'tl' ? 'top-0 left-0 border-t-2 border-l-2 rounded-tl' : '',
                        c === 'tr' ? 'top-0 right-0 border-t-2 border-r-2 rounded-tr' : '',
                        c === 'bl' ? 'bottom-0 left-0 border-b-2 border-l-2 rounded-bl' : '',
                        c === 'br' ? 'bottom-0 right-0 border-b-2 border-r-2 rounded-br' : '',
                      ].join(' ')} />
                    ))}
                    {/* Stock mode direction badge */}
                    {isStock && (
                      <div className={`absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${stockDir === 'in' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                        {stockDir === 'in' ? <Plus size={10} /> : <Minus size={10} />}
                        {stockDir === 'in' ? 'STOCK IN' : 'STOCK OUT'}
                        {stockAmount > 1 && ` ×${stockAmount}`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Find mode: success overlay */}
              {status === 'found' && foundTool && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-green-900/60">
                  <CheckCircle size={48} className="text-green-400" />
                  <p className="text-sm font-semibold text-green-200 px-4 text-center">
                    T{foundTool.toolNumber} — {foundTool.description}
                  </p>
                </div>
              )}
            </>
          )}
          <canvas ref={decodeRef} className="hidden" />
        </div>

        {/* ── Controls bar ────────────────────────────────────────────────── */}
        <div className="px-4 py-2.5 border-b border-slate-700 shrink-0 flex items-center gap-2.5 flex-wrap">
          {/* Camera picker */}
          {cameras.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Camera size={11} className="text-slate-400 shrink-0" />
              <select
                value={activeCamId}
                onChange={(e) => setActiveCamId(e.target.value)}
                title="Select camera"
                className="bg-slate-700 border border-slate-600 rounded-lg text-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Auto (rear)</option>
                {cameras.map((c, i) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Stock mode controls */}
          {isStock && (
            <>
              {/* In / Out toggle */}
              <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs">
                <button type="button" onClick={() => setStockDir('out')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${stockDir === 'out' ? 'bg-red-600 text-white font-semibold' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  <Minus size={11} /> Out
                </button>
                <button type="button" onClick={() => setStockDir('in')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${stockDir === 'in' ? 'bg-green-600 text-white font-semibold' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  <Plus size={11} /> In
                </button>
              </div>

              {/* Qty per scan */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">Qty</span>
                <input
                  type="number"
                  value={stockAmount}
                  min={1}
                  step={1}
                  title="Quantity per scan"
                  onChange={(e) => setStockAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 px-2 py-1 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-right text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {stockLog.length > 0 && (
                <button type="button" onClick={() => setStockLog([])}
                  className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  <RotateCcw size={10} /> Clear log
                </button>
              )}
            </>
          )}

          {/* Status inline (right of controls when space allows) */}
          {status === 'starting' && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
              Starting…
            </span>
          )}
          {status === 'scanning' && !isStock && (
            <span className="ml-auto text-xs text-slate-500">
              {unknownText
                ? <span className="text-amber-400">No match: <span className="font-mono">{unknownText}</span></span>
                : 'Point camera at a QR or barcode label'}
            </span>
          )}
          {status === 'scanning' && isStock && (
            <span className="ml-auto text-xs text-slate-500">
              {unknownText
                ? <span className="text-amber-400">Code detected — no matching tool</span>
                : 'Scan labels to adjust qty'}
            </span>
          )}
          {status === 'found' && foundTool && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
              <CheckCircle size={11} /> T{foundTool.toolNumber} found
            </span>
          )}
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* USB scanner indicator + manual input */}
          <div className="px-4 py-3 border-b border-slate-700/50 space-y-2.5">
            {/* HID scanner hint (USB + Bluetooth) */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Usb size={11} className="shrink-0 text-slate-600" />
              <span>
                USB / Bluetooth scanner active — scan any barcode or QR label
                {hidLastScan ? (
                  <span className="ml-1 text-green-400 font-mono">· last: {hidLastScan.length > 20 ? hidLastScan.slice(0, 18) + '…' : hidLastScan}</span>
                ) : null}
              </span>
            </div>

            <p className="text-xs font-medium text-slate-500">Manual lookup — paste UUID or tool number (T42)</p>
            <div className="flex gap-2">
              <input
                ref={manualInputRef}
                type="text"
                value={manualUuid}
                onChange={(e) => { setManualUuid(e.target.value); setManualError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleManualLookup(); }}
                placeholder="UUID or T42 / T001"
                title="Tool UUID or tool number"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleManualLookup}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  isStock
                    ? stockDir === 'in'
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {!isStock ? 'Open' : stockDir === 'in' ? '+ In' : '− Out'}
              </button>
            </div>
            {manualError && <p className="mt-1 text-xs text-red-400">{manualError}</p>}
          </div>

          {/* Find mode: action card when tool found */}
          {!isStock && status === 'found' && foundTool && (
            <div className="px-4 py-3 border-b border-slate-700/50">
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-green-200">
                      T{foundTool.toolNumber} — {foundTool.description}
                    </p>
                    <p className="text-xs text-slate-400">{foundTool.type} · {foundTool.geometry.diameter} {foundTool.unit}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { onFound(foundTool); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    <Pencil size={13} /> Open Editor
                  </button>
                  <button
                    type="button"
                    disabled={isPrintingLabel}
                    onClick={() => {
                      setIsPrintingLabel(true);
                      void printLabels([foundTool], DEFAULT_LABEL_OPTIONS).finally(() => setIsPrintingLabel(false));
                    }}
                    className={[
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      !isPrintingLabel ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600' : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed',
                    ].join(' ')}
                  >
                    <Printer size={13} /> {isPrintingLabel ? 'Opening…' : 'Print Label'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStatus('scanning'); setFoundTool(null); lastActedId.current = ''; }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors ml-auto"
                  >
                    <ScanLine size={13} /> Scan Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stock log */}
          {isStock && (
            <div className="px-4 py-3">
              {stockLog.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-2">
                  No adjustments yet — scan a label or paste a UUID above
                </p>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Recent adjustments
                  </p>
                  <div className="space-y-1">
                    {stockLog.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/40 text-xs">
                        <span className="font-mono text-blue-400 shrink-0 w-8">T{entry.toolNumber}</span>
                        <span className="text-slate-300 truncate flex-1">{entry.description}</span>
                        <span className={`font-bold shrink-0 w-8 text-right ${entry.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                        </span>
                        <span className="text-slate-400 shrink-0">→ {entry.newQty}</span>
                        <span className="text-slate-600 shrink-0 w-16 text-right">
                          {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Find mode: error close button */}
          {status === 'error' && (
            <div className="px-4 py-3 flex justify-center">
              <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
                Close
              </button>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
