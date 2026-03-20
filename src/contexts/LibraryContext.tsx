import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { getAdapter } from '../lib/db';
import type { IDbAdapter }       from '../lib/db';
import type { LibraryTool }      from '../types/libraryTool';
import type { ToolTemplate }     from '../types/template';
import type { StockTransaction, StockReason } from '../types/stockTransaction';
import type { AuditField }       from '../types/auditEntry';
import type { LibrarySnapshot }  from '../types/snapshot';
import { MAX_AUTO_SNAPSHOTS }    from '../types/snapshot';

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

/** BroadcastChannel name shared across all tabs of this app */
const BC_NAME = 'cnc-tool-library';

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [tools,     setTools]     = useState<LibraryTool[]>([]);
  const [templates, setTemplates] = useState<ToolTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Adapter ref — populated on first load
  const adapterRef = useRef<IDbAdapter | null>(null);

  // BroadcastChannel for cross-tab sync (browser only)
  const channelRef  = useRef<BroadcastChannel | null>(null);
  const suppressRef = useRef(false);

  // Initial load
  useEffect(() => {
    getAdapter().then(async (adapter) => {
      adapterRef.current = adapter;
      const [t, tmpl] = await Promise.all([
        adapter.toolsGetAll(),
        adapter.templatesGetAll(),
      ]);
      setTools(t);
      setTemplates(tmpl);
    }).catch(console.error).finally(() => setIsLoading(false));
  }, []);

  // Cross-tab sync via BroadcastChannel (not used in Tauri builds)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(BC_NAME);
    channelRef.current = ch;
    ch.onmessage = () => {
      if (suppressRef.current) return;
      const adapter = adapterRef.current;
      if (!adapter) return;
      adapter.toolsGetAll().then(setTools).catch(console.error);
      adapter.templatesGetAll().then(setTemplates).catch(console.error);
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
    const adapter = adapterRef.current!;
    await adapter.toolsAdd(tool);
    setTools(await adapter.toolsGetAll());
    broadcast();
  }, []);

  const addTools = useCallback(async (
    incoming: LibraryTool[],
    overwrite = false,
  ): Promise<{ added: number; skipped: number }> => {
    const adapter = adapterRef.current!;
    const existingNums = new Set(tools.map((t) => t.toolNumber));
    const result = await adapter.toolsAddConditional(incoming, existingNums, overwrite);
    setTools(await adapter.toolsGetAll());
    broadcast();
    return result;
  }, [tools]);

  const updateTool = useCallback(async (id: string, patch: Partial<LibraryTool>) => {
    const adapter  = adapterRef.current!;
    const now      = Date.now();
    const existing = await adapter.toolsGet(id);

    // Auto-log a stock transaction when quantity changes
    if (patch.quantity !== undefined && existing) {
      const oldQty = existing.quantity ?? 0;
      const newQty = patch.quantity;
      if (oldQty !== newQty) {
        const reason: StockReason = existing.quantity === undefined ? 'initial' : 'adjustment';
        await adapter.transactionsAdd({
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
        await adapter.auditAdd({
          id:        crypto.randomUUID(),
          toolId:    id,
          timestamp: now,
          changedBy: operator || undefined,
          fields:    changedFields,
        });
      }
    }

    await adapter.toolsUpdate(id, { ...patch, updatedAt: now });
    setTools(await adapter.toolsGetAll());
    broadcast();
  }, []);

  const patchEach = useCallback(async (updates: { id: string; patch: Partial<LibraryTool> }[]) => {
    const adapter = adapterRef.current!;
    const now = Date.now();
    await adapter.toolsBulkPatch(updates, now);
    setTools(await adapter.toolsGetAll());
    broadcast();
  }, []);

  const deleteTool = useCallback(async (id: string) => {
    const adapter = adapterRef.current!;
    await adapter.toolsDelete(id);
    setTools((prev) => prev.filter((t) => t.id !== id));
    broadcast();
  }, []);

  const deleteTools = useCallback(async (ids: string[]) => {
    const adapter = adapterRef.current!;
    await adapter.toolsBulkDelete(ids);
    setTools((prev) => prev.filter((t) => !ids.includes(t.id)));
    broadcast();
  }, []);

  // ── Templates ──────────────────────────────────────────────────────────────

  const saveTemplate = useCallback(async (template: ToolTemplate) => {
    const adapter = adapterRef.current!;
    await adapter.templatesPut(template);
    setTemplates(await adapter.templatesGetAll());
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    const adapter = adapterRef.current!;
    await adapter.templatesDelete(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Stock transactions ──────────────────────────────────────────────────────

  const logTransaction = useCallback(async (tx: Omit<StockTransaction, 'id' | 'timestamp'>) => {
    const adapter = adapterRef.current!;
    await adapter.transactionsAdd({ ...tx, id: crypto.randomUUID(), timestamp: Date.now() });
  }, []);

  const getTransactions = useCallback(async (toolId: string): Promise<StockTransaction[]> => {
    const adapter = adapterRef.current!;
    return adapter.transactionsGetByToolId(toolId);
  }, []);

  const getAuditLog = useCallback(async (toolId: string) => {
    const adapter = adapterRef.current!;
    return adapter.auditGetByToolId(toolId);
  }, []);

  // ── Snapshots ──────────────────────────────────────────────────────────────

  const saveSnapshot = useCallback(async (label?: string) => {
    const adapter = adapterRef.current!;
    const [currentTools, currentMaterials, currentHolders] = await Promise.all([
      adapter.toolsGetAll(),
      adapter.materialsGetAll(),
      adapter.holdersGetAll(),
    ]);
    const now    = Date.now();
    const dateStr = new Date(now).toLocaleString();
    await adapter.snapshotsAdd({
      id:        crypto.randomUUID(),
      createdAt: now,
      label:     label ?? `Snapshot — ${dateStr}`,
      toolCount: currentTools.length,
      tools:     currentTools,
      materials: currentMaterials,
      holders:   currentHolders,
    });
    // Trim oldest auto-snapshots beyond the max
    const all = await adapter.snapshotsGetAll(); // newest-first
    if (all.length > MAX_AUTO_SNAPSHOTS) {
      const toDelete = all.slice(MAX_AUTO_SNAPSHOTS).map((s) => s.id);
      await adapter.snapshotsBulkDelete(toDelete);
    }
  }, []);

  const listSnapshots = useCallback(async (): Promise<LibrarySnapshot[]> => {
    const adapter = adapterRef.current!;
    return adapter.snapshotsGetAll();
  }, []);

  const restoreSnapshot = useCallback(async (id: string) => {
    const adapter = adapterRef.current!;
    const snap = await adapter.snapshotsGet(id);
    if (!snap) return;
    await adapter.replaceLibrary(snap.tools, snap.materials, snap.holders);
    setTools(await adapter.toolsGetAll());
    broadcast();
  }, []);

  const deleteSnapshot = useCallback(async (id: string) => {
    const adapter = adapterRef.current!;
    await adapter.snapshotsDelete(id);
  }, []);

  const replaceLibrary = useCallback(async (
    newTools:     import('../types/libraryTool').LibraryTool[],
    newMaterials: import('../types/material').WorkMaterial[],
    newHolders:   import('../types/holder').ToolHolder[],
  ) => {
    const adapter = adapterRef.current!;
    await adapter.replaceLibrary(newTools, newMaterials, newHolders);
    setTools(await adapter.toolsGetAll());
    broadcast();
  }, []);

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
