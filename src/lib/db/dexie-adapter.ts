/**
 * DexieAdapter
 *
 * IDbAdapter implementation backed by IndexedDB via Dexie.
 * Used in all browser / PWA builds (i.e. when window.__TAURI__ is absent).
 */

import { db } from '../../db/library';
import type { IDbAdapter }       from './adapter';
import type { LibraryTool }      from '../../types/libraryTool';
import type { WorkMaterial }     from '../../types/material';
import type { ToolHolder }       from '../../types/holder';
import type { ToolTemplate }     from '../../types/template';
import type { StockTransaction } from '../../types/stockTransaction';
import type { ToolAuditEntry }   from '../../types/auditEntry';
import type { LibrarySnapshot }  from '../../types/snapshot';
import type { Machine }          from '../../types/machine';

export class DexieAdapter implements IDbAdapter {
  // ── Tools ──────────────────────────────────────────────────────────────────

  toolsAdd(tool: LibraryTool) { return db.tools.add(tool).then(() => {}); }
  toolsPut(tool: LibraryTool) { return db.tools.put(tool).then(() => {}); }
  async toolsGet(id: string)  { return db.tools.get(id); }
  toolsGetAll()               { return db.tools.orderBy('addedAt').toArray(); }
  toolsUpdate(id: string, data: Partial<LibraryTool>) {
    return db.tools.update(id, data).then(() => {});
  }
  toolsDelete(id: string) { return db.tools.delete(id); }
  toolsBulkDelete(ids: string[]) { return db.tools.bulkDelete(ids); }
  toolsClear() { return db.tools.clear(); }
  toolsBulkAdd(tools: LibraryTool[]) { return db.tools.bulkAdd(tools).then(() => {}); }

  async toolsAddConditional(
    tools: LibraryTool[],
    existingNumbers: Set<number>,
    overwrite: boolean,
  ): Promise<{ added: number; skipped: number }> {
    let added = 0; let skipped = 0;
    await db.transaction('rw', db.tools, async () => {
      for (const tool of tools) {
        if (existingNumbers.has(tool.toolNumber) && !overwrite) {
          skipped++;
        } else {
          await db.tools.put(tool);
          added++;
        }
      }
    });
    return { added, skipped };
  }

  async toolsBulkPatch(
    updates: { id: string; patch: Partial<LibraryTool> }[],
    now: number,
  ) {
    await db.transaction('rw', db.tools, async () => {
      for (const { id, patch } of updates) {
        await db.tools.update(id, { ...patch, updatedAt: now });
      }
    });
  }

  // ── Materials ──────────────────────────────────────────────────────────────

  materialsGetAll()                                  { return db.materials.orderBy('createdAt').toArray(); }
  materialsAdd(m: WorkMaterial)                      { return db.materials.add(m).then(() => {}); }
  materialsUpdate(id: string, data: Partial<WorkMaterial>) {
    return db.materials.update(id, data).then(() => {});
  }
  materialsDelete(id: string) { return db.materials.delete(id); }
  materialsClear()            { return db.materials.clear(); }
  materialsBulkAdd(ms: WorkMaterial[]) {
    return db.transaction('rw', db.materials, async () => {
      for (const m of ms) await db.materials.add(m);
    });
  }

  // ── Holders ────────────────────────────────────────────────────────────────

  holdersGetAll()                                  { return db.holders.orderBy('createdAt').toArray(); }
  holdersAdd(h: ToolHolder)                        { return db.holders.add(h).then(() => {}); }
  holdersUpdate(id: string, data: Partial<ToolHolder>) {
    return db.holders.update(id, data).then(() => {});
  }
  holdersDelete(id: string) { return db.holders.delete(id); }
  holdersClear()            { return db.holders.clear(); }
  holdersBulkAdd(hs: ToolHolder[]) {
    return db.transaction('rw', db.holders, async () => {
      for (const h of hs) await db.holders.add(h);
    });
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  templatesGetAll()                { return db.templates.orderBy('createdAt').toArray(); }
  templatesPut(t: ToolTemplate)    { return db.templates.put(t).then(() => {}); }
  templatesDelete(id: string)      { return db.templates.delete(id); }

  // ── Transactions ───────────────────────────────────────────────────────────

  transactionsAdd(tx: StockTransaction) { return db.transactions.add(tx).then(() => {}); }
  transactionsGetByToolId(toolId: string) {
    return db.transactions.where('toolId').equals(toolId).sortBy('timestamp');
  }

  // ── Audit log ──────────────────────────────────────────────────────────────

  auditAdd(entry: ToolAuditEntry) { return db.auditLog.add(entry).then(() => {}); }
  auditGetByToolId(toolId: string) {
    return db.auditLog.where('toolId').equals(toolId).reverse().sortBy('timestamp');
  }

  // ── Snapshots ──────────────────────────────────────────────────────────────

  snapshotsAdd(snap: LibrarySnapshot) { return db.snapshots.add(snap).then(() => {}); }
  snapshotsGetAll()                   { return db.snapshots.orderBy('createdAt').reverse().toArray(); }
  async snapshotsGet(id: string)      { return db.snapshots.get(id); }
  snapshotsDelete(id: string)         { return db.snapshots.delete(id); }
  snapshotsBulkDelete(ids: string[])  { return db.snapshots.bulkDelete(ids); }

  // ── Machines ───────────────────────────────────────────────────────────────

  machinesGetAll()                                 { return db.machines.orderBy('createdAt').toArray(); }
  machinesAdd(m: Machine)                          { return db.machines.add(m).then(() => {}); }
  machinesUpdate(id: string, data: Partial<Machine>) {
    return db.machines.update(id, data).then(() => {});
  }
  machinesDelete(id: string) { return db.machines.delete(id); }

  // ── Composite ──────────────────────────────────────────────────────────────

  async replaceLibrary(
    tools: LibraryTool[],
    materials: WorkMaterial[],
    holders: ToolHolder[],
  ) {
    await db.transaction('rw', [db.tools, db.materials, db.holders], async () => {
      await db.tools.clear();
      await db.materials.clear();
      await db.holders.clear();
      if (tools.length)     await db.tools.bulkAdd(tools);
      if (materials.length) await db.materials.bulkAdd(materials);
      if (holders.length)   await db.holders.bulkAdd(holders);
    });
  }
}
