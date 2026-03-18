import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { db } from '../db/library';
import type { LibraryTool } from '../types/libraryTool';
import type { ToolTemplate } from '../types/template';
import type { StockTransaction, StockReason } from '../types/stockTransaction';

interface LibraryContextValue {
  tools:            LibraryTool[];
  isLoading:        boolean;
  allMachineGroups: string[];
  allTags:          string[];
  addTool:          (tool: LibraryTool) => Promise<void>;
  addTools:         (tools: LibraryTool[], overwrite?: boolean) => Promise<{ added: number; skipped: number }>;
  updateTool:       (id: string, patch: Partial<LibraryTool>) => Promise<void>;
  /** Apply a different patch to each tool — single DB transaction, single re-render. */
  patchEach:        (updates: { id: string; patch: Partial<LibraryTool> }[]) => Promise<void>;
  deleteTool:       (id: string) => Promise<void>;
  deleteTools:      (ids: string[]) => Promise<void>;
  // ── Templates ──────────────────────────────────────────────────────────────
  templates:        ToolTemplate[];
  saveTemplate:     (template: ToolTemplate) => Promise<void>;
  deleteTemplate:   (id: string) => Promise<void>;
  // ── Stock transactions ─────────────────────────────────────────────────────
  logTransaction:   (tx: Omit<StockTransaction, 'id' | 'timestamp'>) => Promise<void>;
  getTransactions:  (toolId: string) => Promise<StockTransaction[]>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

async function loadAll(): Promise<LibraryTool[]> {
  return db.tools.orderBy('addedAt').toArray();
}

async function loadTemplates(): Promise<ToolTemplate[]> {
  return db.templates.orderBy('createdAt').toArray();
}

/** BroadcastChannel name shared across all tabs of this app */
const BC_NAME = 'cnc-tool-library';

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [tools,     setTools]     = useState<LibraryTool[]>([]);
  const [templates, setTemplates] = useState<ToolTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // BroadcastChannel for cross-tab sync
  const channelRef  = useRef<BroadcastChannel | null>(null);
  // Suppress echo of our own broadcasts
  const suppressRef = useRef(false);

  // Initial load
  useEffect(() => {
    Promise.all([loadAll(), loadTemplates()])
      .then(([t, tmpl]) => { setTools(t); setTemplates(tmpl); })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Cross-tab sync via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(BC_NAME);
    channelRef.current = ch;
    ch.onmessage = () => {
      if (suppressRef.current) return;
      // Another tab mutated the library — reload our in-memory state
      loadAll().then(setTools).catch(console.error);
      loadTemplates().then(setTemplates).catch(console.error);
    };
    return () => { ch.close(); channelRef.current = null; };
  }, []);

  function broadcast() {
    suppressRef.current = true;
    channelRef.current?.postMessage({ type: 'changed' });
    setTimeout(() => { suppressRef.current = false; }, 50);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const allMachineGroups = useMemo(() =>
    Array.from(new Set(tools.flatMap((t) => t.machineGroups ?? []).filter(Boolean))).sort(),
  [tools]);

  const allTags = useMemo(() =>
    Array.from(new Set(tools.flatMap((t) => t.tags))).sort(),
  [tools]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addTool = useCallback(async (tool: LibraryTool) => {
    await db.tools.add(tool);
    setTools(await loadAll());
    broadcast();
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
          await db.tools.put(tool);
          added++;
        }
      }
    });

    setTools(await loadAll());
    broadcast();
    return { added, skipped };
  }, [tools]);

  const updateTool = useCallback(async (id: string, patch: Partial<LibraryTool>) => {
    const now = Date.now();
    // Auto-log a stock transaction when quantity changes
    if (patch.quantity !== undefined) {
      const existing = await db.tools.get(id);
      const oldQty = existing?.quantity ?? 0;
      const newQty = patch.quantity;
      if (oldQty !== newQty) {
        const reason: StockReason = existing?.quantity === undefined ? 'initial' : 'adjustment';
        await db.transactions.add({
          id: crypto.randomUUID(),
          toolId: id,
          delta: newQty - oldQty,
          quantityAfter: newQty,
          reason,
          timestamp: now,
        });
      }
    }
    await db.tools.update(id, { ...patch, updatedAt: now });
    setTools(await loadAll());
    broadcast();
  }, []);

  const patchEach = useCallback(async (updates: { id: string; patch: Partial<LibraryTool> }[]) => {
    const now = Date.now();
    await db.transaction('rw', db.tools, async () => {
      for (const { id, patch } of updates) await db.tools.update(id, { ...patch, updatedAt: now });
    });
    setTools(await loadAll());
    broadcast();
  }, []);

  const deleteTool = useCallback(async (id: string) => {
    await db.tools.delete(id);
    setTools((prev) => prev.filter((t) => t.id !== id));
    broadcast();
  }, []);

  const deleteTools = useCallback(async (ids: string[]) => {
    await db.tools.bulkDelete(ids);
    setTools((prev) => prev.filter((t) => !ids.includes(t.id)));
    broadcast();
  }, []);

  // ── Templates ──────────────────────────────────────────────────────────────

  const saveTemplate = useCallback(async (template: ToolTemplate) => {
    await db.templates.put(template);
    setTemplates(await loadTemplates());
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    await db.templates.delete(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Stock transactions ──────────────────────────────────────────────────────

  const logTransaction = useCallback(async (tx: Omit<StockTransaction, 'id' | 'timestamp'>) => {
    await db.transactions.add({ ...tx, id: crypto.randomUUID(), timestamp: Date.now() });
  }, []);

  const getTransactions = useCallback(async (toolId: string): Promise<StockTransaction[]> => {
    return db.transactions.where('toolId').equals(toolId).sortBy('timestamp');
  }, []);

  const value = useMemo(() => ({
    tools, isLoading,
    allMachineGroups, allTags,
    addTool, addTools, updateTool, patchEach, deleteTool, deleteTools,
    templates, saveTemplate, deleteTemplate,
    logTransaction, getTransactions,
  }), [
    tools, isLoading,
    allMachineGroups, allTags,
    addTool, addTools, updateTool, patchEach, deleteTool, deleteTools,
    templates, saveTemplate, deleteTemplate,
    logTransaction, getTransactions,
  ]);

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
