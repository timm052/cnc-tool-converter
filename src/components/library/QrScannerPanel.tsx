import { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertCircle, CheckCircle } from 'lucide-react';
import jsQR from 'jsqr';
import type { LibraryTool } from '../../types/libraryTool';

interface QrScannerPanelProps {
  tools:   LibraryTool[];
  onFound: (tool: LibraryTool) => void;
  onClose: () => void;
}

type Status = 'starting' | 'scanning' | 'found' | 'error';

export default function QrScannerPanel({ tools, onFound, onClose }: QrScannerPanelProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  // Use refs for tools/onFound so the scan loop never goes stale
  const toolsRef   = useRef(tools);
  const onFoundRef = useRef(onFound);
  useEffect(() => { toolsRef.current   = tools;   }, [tools]);
  useEffect(() => { onFoundRef.current = onFound; }, [onFound]);

  const [status,      setStatus]      = useState<Status>('starting');
  const [errorMsg,    setErrorMsg]    = useState('');
  const [unknownText, setUnknownText] = useState('');
  const [foundTool,   setFoundTool]   = useState<LibraryTool | null>(null);

  useEffect(() => {
    let mounted = true;

    function scan() {
      if (!mounted) return;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code?.data) {
            const tool = toolsRef.current.find((t) => t.id === code.data);
            if (tool) {
              setFoundTool(tool);
              setStatus('found');
              // Brief success flash, then open editor
              setTimeout(() => {
                if (mounted) onFoundRef.current(tool);
              }, 600);
              return; // stop scanning
            }
            setUnknownText(
              code.data.length > 48 ? code.data.slice(0, 48) + '…' : code.data,
            );
          }
        }
      }
      rafRef.current = requestAnimationFrame(scan);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('scanning');
        rafRef.current = requestAnimationFrame(scan);
      } catch (err) {
        if (!mounted) return;
        setStatus('error');
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Could not access camera',
        );
      }
    }

    start();

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []); // intentionally empty — uses refs for live data

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[500px] bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Camera size={15} className="text-slate-400" />
            Scan Tool QR Code
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="Close scanner"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Camera viewport */}
        <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
          {status === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertCircle size={36} className="text-red-400" />
              <p className="text-sm font-medium text-red-300">Camera unavailable</p>
              <p className="text-xs text-slate-400">{errorMsg}</p>
              <p className="text-xs text-slate-500">
                Make sure your browser has permission to access the camera and that no other app is using it.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />

              {/* Dimmed surround + viewfinder cut-out using box-shadow */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className="relative"
                  style={{ width: 200, height: 200, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
                >
                  {/* Corner brackets */}
                  {(['tl','tr','bl','br'] as const).map((corner) => (
                    <div
                      key={corner}
                      className={[
                        'absolute w-8 h-8',
                        corner === 'tl' ? 'top-0 left-0 border-t-2 border-l-2 rounded-tl' : '',
                        corner === 'tr' ? 'top-0 right-0 border-t-2 border-r-2 rounded-tr' : '',
                        corner === 'bl' ? 'bottom-0 left-0 border-b-2 border-l-2 rounded-bl' : '',
                        corner === 'br' ? 'bottom-0 right-0 border-b-2 border-r-2 rounded-br' : '',
                        status === 'found' ? 'border-green-400' : 'border-blue-400',
                      ].join(' ')}
                    />
                  ))}

                  {/* Found flash */}
                  {status === 'found' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded">
                      <CheckCircle size={48} className="text-green-400" />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Hidden canvas for frame analysis */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Status footer */}
        <div className="px-5 py-4 min-h-[72px] flex flex-col items-center justify-center gap-1 text-center">
          {status === 'starting' && (
            <p className="text-sm text-slate-400 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
              Starting camera…
            </p>
          )}

          {status === 'scanning' && (
            <>
              <p className="text-sm text-slate-300">Point camera at a tool QR label</p>
              {unknownText ? (
                <p className="text-xs text-amber-400 mt-1">
                  QR detected — no matching tool:{' '}
                  <span className="font-mono text-amber-300">{unknownText}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">
                  QR codes encode the tool UUID (e.g. from Print Labels)
                </p>
              )}
            </>
          )}

          {status === 'found' && foundTool && (
            <div className="flex items-center gap-2 text-green-300 text-sm font-medium">
              <CheckCircle size={15} />
              Found: T{foundTool.toolNumber} — {foundTool.description}
            </div>
          )}

          {status === 'error' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              Close
            </button>
          )}
        </div>

      </div>
    </>
  );
}
