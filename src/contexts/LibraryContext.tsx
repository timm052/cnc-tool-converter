import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db } from '../db/library';
import type { LibraryTool } from '../types/libraryTool';

interface LibraryContextValue {
  tools:            LibraryTool[];
  isLoading:        boolean;
  allMachineGroups: string[];
  allTags:          string[];
  addTool:          (tool: LibraryTool) => Promise<void>;
  addTools:         (tools: LibraryTool[], overwrite?: boolean) => Promise<{ added: number; skipped: number }>;
  updateTool:       (id: string, patch: Partial<LibraryTool>) => Promise<void>;
  updateTools:      (ids: string[], patch: Partial<LibraryTool>) => Promise<void>;
  /** Apply a different patch to each tool — single DB transaction, single re-render. */
  patchEach:        (updates: { id: string; patch: Partial<LibraryTool> }[]) => Promise<void>;
  deleteTool:       (id: string) => Promise<void>;
  deleteTools:      (ids: string[]) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

async function loadAll(): Promise<LibraryTool[]> {
  return db.tools.orderBy('addedAt').toArray();
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [tools,     setTools]     = useState<LibraryTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load
  useEffect(() => {
    loadAll()
      .then(setTools)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────

  const allMachineGroups = Array.from(
    new Set(tools.map((t) => t.machineGroup).filter((g): g is string => Boolean(g))),
  ).sort();

  const allTags = Array.from(
    new Set(tools.flatMap((t) => t.tags)),
  ).sort();

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addTool = useCallback(async (tool: LibraryTool) => {
    await db.tools.add(tool);
    setTools(await loadAll());
  }, []);

  const addTools = useCallback(async (
    incoming: LibraryTool[],
    overwrite = false,
  ): Promise<{ added: number; skipped: number }> => {
    const existingNums = new Set(tools.map((t) => t.toolNumber));
    let added = 0;
    let skipped = 0;

    await db.transaction('rw', db.tools, async () => {
      for (const tool of incoming) {
        if (existingNums.has(tool.toolNumber) && !overwrite) {
          skipped++;
        } else {
          await db.tools.put(tool);   // put = insert or replace
          added++;
        }
      }
    });

    setTools(await loadAll());
    return { added, skipped };
  }, [tools]);

  const updateTool = useCallback(async (id: string, patch: Partial<LibraryTool>) => {
    await db.tools.update(id, { ...patch, updatedAt: Date.now() });
    setTools(await loadAll());
  }, []);

  const updateTools = useCallback(async (ids: string[], patch: Partial<LibraryTool>) => {
    const now = Date.now();
    await db.transaction('rw', db.tools, async () => {
      for (const id of ids) await db.tools.update(id, { ...patch, updatedAt: now });
    });
    setTools(await loadAll());
  }, []);

  const patchEach = useCallback(async (updates: { id: string; patch: Partial<LibraryTool> }[]) => {
    const now = Date.now();
    await db.transaction('rw', db.tools, async () => {
      for (const { id, patch } of updates) await db.tools.update(id, { ...patch, updatedAt: now });
    });
    setTools(await loadAll());
  }, []);

  const deleteTool = useCallback(async (id: string) => {
    await db.tools.delete(id);
    setTools((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const deleteTools = useCallback(async (ids: string[]) => {
    await db.tools.bulkDelete(ids);
    setTools((prev) => prev.filter((t) => !ids.includes(t.id)));
  }, []);

  return (
    <LibraryContext.Provider value={{
      tools, isLoading,
      allMachineGroups, allTags,
      addTool, addTools, updateTool, updateTools, patchEach, deleteTool, deleteTools,
    }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
