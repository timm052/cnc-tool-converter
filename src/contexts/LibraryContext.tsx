import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { db } from '../db/library';
import type { LibraryTool } from '../types/libraryTool';
import type { ToolTemplate } from '../types/template';
import type { StockTransaction, StockReason } from '../types/stockTransaction';
import type { AuditField } from '../types/auditEntry';
import type { LibrarySnapshot } from '../types/snapshot';
import { MAX_AUTO_SNAPSHOTS } from '../types/snapshot';

// Fields excluded from audit logging (internal / always-changing)
const AUDIT_EXCLUDE = new Set(['updatedAt', 'addedAt', 'sourceData']);

function getOperatorName(): string {
  try {
    const raw = localStorage.getItem('cnc-tool-converter:settings');
    if (!raw) return '';
    return (JSON.parse(raw) as { operatorName?: string }).operatorName ?? '';
  } catch { return ''; }
}

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
  // ── Audit log ──────────────────────────────────────────────────────────────
  getAuditLog:      (toolId: string) => Promise<import('../types/auditEntry').ToolAuditEntry[]>;
  // ── Snapshots ──────────────────────────────────────────────────────────────
  saveSnapshot:     (label?: string) => Promise<void>;
  listSnapshots:    () => Promise<LibrarySnapshot[]>;
  restoreSnapshot:  (id: string) => Promise<void>;
  deleteSnapshot:   (id: string) => Promise<void>;
  getTransactions:  (toolId: string) => Promise<StockTransaction[]>;
  // ── Remote sync helpers ────────────────────────────────────────────────────
  /** Atomically replace the entire library (tools + materials + holders) with the provided arrays. Used by remote merge/restore. */
  replaceLibrary:   (tools: LibraryTool[], materials: import('../types/material').WorkMaterial[], holders: import('../types/holder').ToolHolder[]) => Promise<void>;
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
    const now      = Date.now();
    const existing = await db.tools.get(id);

    // Auto-log a stock transaction when quantity changes
    if (patch.quantity !== undefined && existing) {
      const oldQty = existing.quantity ?? 0;
      const newQty = patch.quantity;
      if (oldQty !== newQty) {
        const reason: StockReason = existing.quantity === undefined ? 'initial' : 'adjustment';
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

    // Audit log — record every field that actually changed
    if (existing) {
      const changedFields: AuditField[] = [];
      for (const key of Object.keys(patch) as (keyof LibraryTool)[]) {
        if (AUDIT_EXCLUDE.has(key)) continue;
        const oldVal = existing[key];
        const newVal = patch[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changedFields.push({ field: key, oldValue: oldVal, newValue: newVal });
        }
      }
      if (changedFields.length > 0) {
        const operator = getOperatorName();
        await db.auditLog.add({
          id:        crypto.randomUUID(),
          toolId:    id,
          timestamp: now,
          changedBy: operator || undefined,
          fields:    changedFields,
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

  const getAuditLog = useCallback(async (toolId: string) => {
    return db.auditLog.where('toolId').equals(toolId).reverse().sortBy('timestamp');
  }, []);

  // ── Snapshots ──────────────────────────────────────────────────────────────

  const saveSnapshot = useCallback(async (label?: string) => {
    const [currentTools, currentMaterials, currentHolders] = await Promise.all([
      db.tools.toArray(),
      db.materials.toArray(),
      db.holders.toArray(),
    ]);
    const now    = Date.now();
    const dateStr = new Date(now).toLocaleString();
    await db.snapshots.add({
      id:        crypto.randomUUID(),
      createdAt: now,
      label:     label ?? `Snapshot — ${dateStr}`,
      toolCount: currentTools.length,
      tools:     currentTools,
      materials: currentMaterials,
      holders:   currentHolders,
    });
    // Trim oldest auto-snapshots beyond the max
    const all = await db.snapshots.orderBy('createdAt').toArray();
    if (all.length > MAX_AUTO_SNAPSHOTS) {
      const toDelete = all.slice(0, all.length - MAX_AUTO_SNAPSHOTS).map((s) => s.id);
      await db.snapshots.bulkDelete(toDelete);
    }
  }, []);

  const listSnapshots = useCallback(async (): Promise<LibrarySnapshot[]> => {
    return db.snapshots.orderBy('createdAt').reverse().toArray();
  }, []);

  const restoreSnapshot = useCallback(async (id: string) => {
    const snap = await db.snapshots.get(id);
    if (!snap) return;
    // Replace all tools, materials, holders with snapshot contents
    await db.transaction('rw', [db.tools, db.materials, db.holders], async () => {
      await db.tools.clear();
      await db.materials.clear();
      await db.holders.clear();
      if (snap.tools.length)     await db.tools.bulkAdd(snap.tools);
      if (snap.materials.length) await db.materials.bulkAdd(snap.materials);
      if (snap.holders.length)   await db.holders.bulkAdd(snap.holders);
    });
    setTools(await loadAll());
    broadcast();
  }, [broadcast]);

  const deleteSnapshot = useCallback(async (id: string) => {
    await db.snapshots.delete(id);
  }, []);

  const replaceLibrary = useCallback(async (
    newTools:     import('../types/libraryTool').LibraryTool[],
    newMaterials: import('../types/material').WorkMaterial[],
    newHolders:   import('../types/holder').ToolHolder[],
  ) => {
    await db.transaction('rw', [db.tools, db.materials, db.holders], async () => {
      await db.tools.clear();
      await db.materials.clear();
      await db.holders.clear();
      if (newTools.length)     await db.tools.bulkAdd(newTools);
      if (newMaterials.length) await db.materials.bulkAdd(newMaterials);
      if (newHolders.length)   await db.holders.bulkAdd(newHolders);
    });
    setTools(await loadAll());
    broadcast();
  }, [broadcast]);

  const value = useMemo(() => ({
    tools, isLoading,
    allMachineGroups, allTags,
    addTool, addTools, updateTool, patchEach, deleteTool, deleteTools,
    templates, saveTemplate, deleteTemplate,
    logTransaction, getTransactions,
    getAuditLog,
    saveSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot,
    replaceLibrary,
  }), [
    tools, isLoading,
    allMachineGroups, allTags,
    addTool, addTools, updateTool, patchEach, deleteTool, deleteTools,
    templates, saveTemplate, deleteTemplate,
    logTransaction, getTransactions,
    getAuditLog,
    saveSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot,
    replaceLibrary,
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
