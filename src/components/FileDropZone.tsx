import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import type { FormatInfo } from '../types/converter';
import { isTauri, openFiles } from '../lib/tauri/fs';

interface LoadedFile {
  name: string;
  size: number;
  content: string | ArrayBuffer;
}

interface FileDropZoneProps {
  format: FormatInfo | undefined;
  onFilesLoaded: (files: LoadedFile[]) => void;
  loadedFileNames?: string[];
  onClear?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readFile(file: File, readAs: 'text' | 'arraybuffer'): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target!.result as string | ArrayBuffer);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    if (readAs === 'arraybuffer') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, 'utf-8');
    }
  });
}

export default function FileDropZone({
  format,
  onFilesLoaded,
  loadedFileNames = [],
  onClear,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedExtensions = format?.fileExtensions ?? [];
  const hasFiles = loadedFileNames.length > 0;

  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (!format) {
      setError('Select a source format first.');
      return;
    }
    setError(null);
    setIsLoading(true);

    const fileArray = Array.from(files);

    // Validate extensions
    const invalid = fileArray.filter(
      (f) => !acceptedExtensions.some((ext) => f.name.toLowerCase().endsWith(ext)),
    );
    if (invalid.length > 0) {
      setError(
        `Unsupported file type(s): ${invalid.map((f) => f.name).join(', ')}. ` +
        `Expected: ${acceptedExtensions.join(', ')}`,
      );
      setIsLoading(false);
      return;
    }

    try {
      const loaded: LoadedFile[] = await Promise.all(
        fileArray.map(async (file) => ({
          name:    file.name,
          size:    file.size,
          content: await readFile(file, format.readAs),
        })),
      );
      onFilesLoaded(loaded);
    } catch (err) {
      setError(`${err}`);
    }

    setIsLoading(false);
  }, [format, acceptedExtensions, onFilesLoaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void processFiles(e.target.files);
    e.target.value = ''; // allow re-selecting the same file
  };

  /** Click handler for the drop zone — uses native dialog in Tauri */
  const handleZoneClick = useCallback(async () => {
    if (!format) return;
    if (isTauri()) {
      setError(null);
      setIsLoading(true);
      try {
        const isBinary = format.readAs === 'arraybuffer';
        const tauriFilters = acceptedExtensions.length
          ? [{ name: format.name ?? 'Tool files', extensions: acceptedExtensions.map((e) => e.replace(/^\./, '')) }]
          : undefined;
        const result = await openFiles({
          multiple: true,
          binary:   isBinary,
          filters:  tauriFilters,
        });
        if (!result) return;
        const loaded: LoadedFile[] = result.map((f) => ({
          name:    f.name,
          size:    typeof f.content === 'string' ? f.content.length : f.content.byteLength,
          content: f.content instanceof Uint8Array ? f.content.buffer as ArrayBuffer : f.content,
        }));
        onFilesLoaded(loaded);
      } catch (err) {
        setError(`${err}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      inputRef.current?.click();
    }
  }, [format, acceptedExtensions, onFilesLoaded]);

  // ── Loaded state ──────────────────────────────────────────────────────────
  if (hasFiles) {
    return (
      <div className="border border-slate-600 rounded-xl p-4 bg-slate-800/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-300">
            Loaded files ({loadedFileNames.length})
          </span>
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            <X size={13} />
            Clear
          </button>
        </div>
        <ul className="space-y-1.5">
          {loadedFileNames.map((name) => (
            <li key={name} className="flex items-center gap-2 text-sm text-slate-300">
              <FileText size={14} className="text-blue-400 shrink-0" />
              <span className="truncate">{name}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={() => void handleZoneClick()}
          className="mt-3 w-full text-xs text-slate-400 hover:text-slate-200 border border-dashed border-slate-600 rounded-lg py-2 transition-colors"
        >
          Add more files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedExtensions.join(',')}
          aria-label="Select files"
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    );
  }

  // ── Drop zone ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => void handleZoneClick()}
        className={[
          'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3',
          'cursor-pointer transition-all select-none min-h-[180px]',
          isDragging
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-slate-600 hover:border-slate-400 hover:bg-slate-700/30 bg-slate-800/30',
          !format ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Reading files…</span>
          </div>
        ) : (
          <>
            <Upload
              size={32}
              className={isDragging ? 'text-blue-400' : 'text-slate-500'}
            />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-300">
                {isDragging ? 'Drop files here' : 'Drop files or click to browse'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {acceptedExtensions.length > 0
                  ? `Accepts: ${acceptedExtensions.join(', ')} · Multiple files supported`
                  : 'Select a source format above'}
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedExtensions.join(',')}
        aria-label="Select files"
        className="hidden"
        onChange={onInputChange}
        disabled={!format}
      />
    </div>
  );
}
