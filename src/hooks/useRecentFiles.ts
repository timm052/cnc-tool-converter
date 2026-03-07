import { useState, useCallback } from 'react';

const STORAGE_KEY = 'cnc-tool-converter:recent-files';
const MAX_RECENT  = 10;

export interface RecentFile {
  name:         string;
  sourceFormat: string;
  targetFormat: string;
  toolCount:    number;
  convertedAt:  number;
}

function loadRecent(): RecentFile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as RecentFile[];
  } catch {
    // ignore
  }
  return [];
}

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(loadRecent);

  const addRecent = useCallback((entry: RecentFile) => {
    setRecentFiles((prev) => {
      const deduped = prev.filter(
        (f) => !(f.name === entry.name && f.sourceFormat === entry.sourceFormat && f.targetFormat === entry.targetFormat),
      );
      const next = [entry, ...deduped].slice(0, MAX_RECENT);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  const removeRecent = useCallback((index: number) => {
    setRecentFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentFiles([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { recentFiles, addRecent, removeRecent, clearRecent };
}
