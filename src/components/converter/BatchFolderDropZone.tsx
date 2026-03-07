import { useState, useRef, useCallback } from 'react';
import { FolderOpen, X, AlertCircle } from 'lucide-react';
import type { FormatInfo } from '../../types/converter';

interface LoadedFile {
  name:    string;
  size:    number;
  content: string | ArrayBuffer;
}

interface BatchFolderDropZoneProps {
  format:           FormatInfo | undefined;
  onFilesLoaded:    (files: LoadedFile[]) => void;
  loadedFileNames?: string[];
  onClear?:         () => void;
}

async function readFile(file: File, readAs: 'text' | 'arraybuffer'): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target!.result as string | ArrayBuffer);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    if (readAs === 'arraybuffer') reader.readAsArrayBuffer(file);
    else reader.readAsText(file, 'utf-8');
  });
}

async function getFilesFromEntry(
  entry: FileSystemEntry,
  exts: string[],
): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((res) => (entry as FileSystemFileEntry).file(res));
    const ext  = '.' + file.name.split('.').pop()!.toLowerCase();
    return exts.includes(ext) ? [file] : [];
  }
  if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const entries   = await new Promise<FileSystemEntry[]>((res) =>
      dirReader.readEntries(res),
    );
    const nested = await Promise.all(entries.map((e) => getFilesFromEntry(e, exts)));
    return nested.flat();
  }
  return [];
}

export default function BatchFolderDropZone({
  format,
  onFilesLoaded,
  loadedFileNames = [],
  onClear,
}: BatchFolderDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const exts = format?.fileExtensions ?? [];
  const hasFiles = loadedFileNames.length > 0;

  const processFiles = useCallback(async (files: File[]) => {
    const matching = files.filter((f) => {
      const ext = '.' + f.name.split('.').pop()!.toLowerCase();
      return exts.includes(ext);
    });
    if (matching.length === 0) {
      setError(`No ${exts.join('/')} files found in folder.`);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const loaded: LoadedFile[] = await Promise.all(
        matching.map(async (file) => ({
          name:    file.name,
          size:    file.size,
          content: await readFile(file, format?.readAs ?? 'text'),
        })),
      );
      onFilesLoaded(loaded);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, [exts, format?.readAs, onFilesLoaded]);

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const items = [...e.dataTransfer.items];
    if (items.length === 0) return;

    const allFiles: File[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        const files = await getFilesFromEntry(entry, exts);
        allFiles.push(...files);
      }
    }
    if (allFiles.length > 0) await processFiles(allFiles);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    if (files.length) processFiles(files);
    e.target.value = '';
  }

  if (hasFiles) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {loadedFileNames.length} file{loadedFileNames.length !== 1 ? 's' : ''} loaded
          </span>
          {onClear && (
            <button onClick={onClear} className="text-xs text-slate-500 hover:text-slate-200 flex items-center gap-1">
              <X size={11} /> Clear
            </button>
          )}
        </div>
        <div className="max-h-28 overflow-y-auto space-y-0.5">
          {loadedFileNames.map((name) => (
            <p key={name} className="text-xs text-slate-300 font-mono truncate">{name}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors',
          isDragging
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-slate-600 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/60',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          // @ts-expect-error — webkitdirectory is not in React types
          webkitdirectory=""
          onChange={handleInputChange}
          className="hidden"
        />
        <FolderOpen size={28} className="text-slate-500" />
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <p className="text-sm text-slate-400">Drop a folder or click to browse</p>
            <p className="text-xs text-slate-500">
              All {exts.join('/')} files will be loaded recursively
            </p>
          </>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}
