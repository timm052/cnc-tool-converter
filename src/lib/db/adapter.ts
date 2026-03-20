/**
 * IDbAdapter
 *
 * Low-level storage interface used by all React contexts.
 * Two implementations exist:
 *   - DexieAdapter  — browser / PWA build (IndexedDB via Dexie)
 *   - TauriAdapter  — Tauri desktop build (SQLite via tauri-plugin-sql)
 *
 * All contexts call this interface; none import from src/db/library.ts directly.
 */

import type { LibraryTool }      from '../../types/libraryTool';
import type { WorkMaterial }     from '../../types/material';
import type { ToolHolder }       from '../../types/holder';
import type { ToolTemplate }     from '../../types/template';
import type { StockTransaction } from '../../types/stockTransaction';
import type { ToolAuditEntry }   from '../../types/auditEntry';
import type { LibrarySnapshot }  from '../../types/snapshot';
import type { Machine }          from '../../types/machine';

export interface IDbAdapter {
  // ── Tools ──────────────────────────────────────────────────────────────────
  toolsAdd(tool: LibraryTool): Promise<void>;
  toolsPut(tool: LibraryTool): Promise<void>;
  toolsGet(id: string): Promise<LibraryTool | undefined>;
  /** Returns all tools ordered by addedAt ascending. */
  toolsGetAll(): Promise<LibraryTool[]>;
  toolsUpdate(id: string, data: Partial<LibraryTool>): Promise<void>;
  toolsDelete(id: string): Promise<void>;
  toolsBulkDelete(ids: string[]): Promise<void>;
  toolsClear(): Promise<void>;
  toolsBulkAdd(tools: LibraryTool[]): Promise<void>;
  /**
   * Conditionally add or overwrite tools.
   * Skip any whose toolNumber already exists (unless overwrite=true).
   */
  toolsAddConditional(tools: LibraryTool[], existingNumbers: Set<number>, overwrite: boolean): Promise<{ added: number; skipped: number }>;

  // ── Materials ──────────────────────────────────────────────────────────────
  /** Returns all materials ordered by createdAt ascending. */
  materialsGetAll(): Promise<WorkMaterial[]>;
  materialsAdd(m: WorkMaterial): Promise<void>;
  materialsUpdate(id: string, data: Partial<WorkMaterial>): Promise<void>;
  materialsDelete(id: string): Promise<void>;
  materialsClear(): Promise<void>;
  materialsBulkAdd(ms: WorkMaterial[]): Promise<void>;

  // ── Holders ────────────────────────────────────────────────────────────────
  /** Returns all holders ordered by createdAt ascending. */
  holdersGetAll(): Promise<ToolHolder[]>;
  holdersAdd(h: ToolHolder): Promise<void>;
  holdersUpdate(id: string, data: Partial<ToolHolder>): Promise<void>;
  holdersDelete(id: string): Promise<void>;
  holdersClear(): Promise<void>;
  holdersBulkAdd(hs: ToolHolder[]): Promise<void>;

  // ── Templates ──────────────────────────────────────────────────────────────
  /** Returns all templates ordered by createdAt ascending. */
  templatesGetAll(): Promise<ToolTemplate[]>;
  templatesPut(t: ToolTemplate): Promise<void>;
  templatesDelete(id: string): Promise<void>;

  // ── Transactions ───────────────────────────────────────────────────────────
  transactionsAdd(tx: StockTransaction): Promise<void>;
  transactionsGetByToolId(toolId: string): Promise<StockTransaction[]>;

  // ── Audit log ──────────────────────────────────────────────────────────────
  auditAdd(entry: ToolAuditEntry): Promise<void>;
  /** Returns audit entries for a tool, newest first. */
  auditGetByToolId(toolId: string): Promise<ToolAuditEntry[]>;

  // ── Snapshots ──────────────────────────────────────────────────────────────
  snapshotsAdd(snap: LibrarySnapshot): Promise<void>;
  /** Returns all snapshots ordered by createdAt descending. */
  snapshotsGetAll(): Promise<LibrarySnapshot[]>;
  snapshotsGet(id: string): Promise<LibrarySnapshot | undefined>;
  snapshotsDelete(id: string): Promise<void>;
  snapshotsBulkDelete(ids: string[]): Promise<void>;

  // ── Machines ───────────────────────────────────────────────────────────────
  /** Returns all machines ordered by createdAt ascending. */
  machinesGetAll(): Promise<Machine[]>;
  machinesAdd(m: Machine): Promise<void>;
  machinesUpdate(id: string, data: Partial<Machine>): Promise<void>;
  machinesDelete(id: string): Promise<void>;

  // ── Composite / atomic operations ─────────────────────────────────────────
  /**
   * Atomically clear and replace tools + materials + holders.
   * Used by remote sync merge and snapshot restore.
   */
  replaceLibrary(
    tools:     LibraryTool[],
    materials: WorkMaterial[],
    holders:   ToolHolder[],
  ): Promise<void>;

  /**
   * Atomically apply per-tool patches in a single transaction.
   * Does NOT write audit log entries (caller responsible).
   */
  toolsBulkPatch(updates: { id: string; patch: Partial<LibraryTool> }[], now: number): Promise<void>;
}
