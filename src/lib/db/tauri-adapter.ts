/**
 * TauriAdapter
 *
 * IDbAdapter implementation backed by SQLite via @tauri-apps/plugin-sql.
 * Used in the Tauri desktop build (when window.__TAURI__ is present).
 *
 * All records are stored as JSON blobs alongside indexed scalar columns
 * so queries stay simple and forward-compatible with schema changes.
 *
 * Schema is defined in src-tauri/migrations/001_initial.sql.
 */

import Database from '@tauri-apps/plugin-sql';
import type { IDbAdapter }       from './adapter';
import type { LibraryTool }      from '../../types/libraryTool';
import type { WorkMaterial }     from '../../types/material';
import type { ToolHolder }       from '../../types/holder';
import type { ToolTemplate }     from '../../types/template';
import type { StockTransaction } from '../../types/stockTransaction';
import type { ToolAuditEntry }   from '../../types/auditEntry';
import type { LibrarySnapshot }  from '../../types/snapshot';
import type { Machine }          from '../../types/machine';

const DB_PATH = 'sqlite:cnc-tool-converter.db';

// Shared singleton — opened lazily on first use
let _db: Database | null = null;
async function getDb(): Promise<Database> {
  if (!_db) _db = await Database.load(DB_PATH);
  return _db;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a JSON blob row back to type T. */
function parseRow<T>(row: { data: string }): T {
  return JSON.parse(row.data) as T;
}

function parseRows<T>(rows: { data: string }[]): T[] {
  return rows.map((r) => parseRow<T>(r));
}

export class TauriAdapter implements IDbAdapter {
  // ── Tools ──────────────────────────────────────────────────────────────────

  async toolsAdd(tool: LibraryTool) {
    const db = await getDb();
    await db.execute(
      'INSERT INTO tools (id, tool_number, added_at, data) VALUES ($1, $2, $3, $4)',
      [tool.id, tool.toolNumber, tool.addedAt ?? Date.now(), JSON.stringify(tool)],
    );
  }

  async toolsPut(tool: LibraryTool) {
    const db = await getDb();
    await db.execute(
      'INSERT OR REPLACE INTO tools (id, tool_number, added_at, data) VALUES ($1, $2, $3, $4)',
      [tool.id, tool.toolNumber, tool.addedAt ?? Date.now(), JSON.stringify(tool)],
    );
  }

  async toolsGet(id: string): Promise<LibraryTool | undefined> {
    const db = await getDb();
    const rows = await db.select<{ data: string }[]>(
      'SELECT data FROM tools WHERE id = $1',
      [id],
    );
    return rows.length ? parseRow<LibraryTool>(rows[0]) : undefined;
  }

  async toolsGetAll(): Promise<LibraryTool[]> {
    const db = await getDb();
    const rows = await db.select<{ data: string }[]>(
      'SELECT data FROM tools ORDER BY added_at ASC',
    );
    return parseRows<LibraryTool>(rows);
  }

  async toolsUpdate(id: string, data: Partial<LibraryTool>) {
    const existing = await this.toolsGet(id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    const db = await getDb();
    await db.execute(
      'UPDATE tools SET tool_number = $1, data = $2 WHERE id = $3',
      [updated.toolNumber, JSON.stringify(updated), id],
    );
  }

  async toolsDelete(id: string) {
    const db = await getDb();
    await db.execute('DELETE FROM tools WHERE id = $1', [id]);
  }

  async toolsBulkDelete(ids: string[]) {
    if (ids.length === 0) return;
    const db = await getDb();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    await db.execute(`DELETE FROM tools WHERE id IN (${placeholders})`, ids);
  }

  async toolsClear() {
    const db = await getDb();
    await db.execute('DELETE FROM tools');
  }

  async toolsBulkAdd(tools: LibraryTool[]) {
    if (tools.length === 0) return;
    const db = await getDb();
    for (const tool of tools) {
      await db.execute(
        'INSERT OR IGNORE INTO tools (id, tool_number, added_at, data) VALUES ($1, $2, $3, $4)',
        [tool.id, tool.toolNumber, tool.addedAt ?? Date.now(), JSON.stringify(tool)],
      );
    }
  }

  async toolsAddConditional(
    tools: LibraryTool[],
    existingNumbers: Set<number>,
    overwrite: boolean,
  ): Promise<{ added: number; skipped: number }> {
    let added = 0; let skipped = 0;
    const db = await getDb();
    await db.execute('BEGIN');
    try {
      for (const tool of tools) {
        if (existingNumbers.has(tool.toolNumber) && !overwrite) {
          skipped++;
        } else {
          await db.execute(
            'INSERT OR REPLACE INTO tools (id, tool_number, added_at, data) VALUES ($1, $2, $3, $4)',
            [tool.id, tool.toolNumber, tool.addedAt ?? Date.now(), JSON.stringify(tool)],
          );
          added++;
        }
      }
      await db.execute('COMMIT');
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }
    return { added, skipped };
  }

  async toolsBulkPatch(
    updates: { id: string; patch: Partial<LibraryTool> }[],
    now: number,
  ) {
    if (updates.length === 0) return;
    const db = await getDb();
    await db.execute('BEGIN');
    try {
      for (const { id, patch } of updates) {
        const existing = await this.toolsGet(id);
        if (!existing) continue;
        const updated = { ...existing, ...patch, updatedAt: now };
        await db.execute(
          'UPDATE tools SET data = $1 WHERE id = $2',
          [JSON.stringify(updated), id],
        );
      }
      await db.execute('COMMIT');
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }
  }

  // ── Materials ──────────────────────────────────────────────────────────────

  async materialsGetAll(): Promise<WorkMaterial[]> {
    const db = await getDb();
    const rows = await db.select<{ data: string }[]>(
      'SELECT data FROM materials ORDER BY created_at ASC',
    );
    return parseRows<WorkMaterial>(rows);
  }

  async materialsAdd(m: WorkMaterial) {
    const db = await getDb();
    await db.execute(
      'INSERT INTO materials (id, name, created_at, data) VALUES ($1, $2, $3, $4)',
      [m.id, m.name, m.createdAt ?? Date.now(), JSON.stringify(m)],
    );
  }

  async materialsUpdate(id: string, data: Partial<WorkMaterial>) {
    const rows = await (await getDb()).select<{ data: string }[]>(
      'SELECT data FROM materials WHERE id = $1', [id],
    );
    if (!rows.length) return;
    const updated = { ...parseRow<WorkMaterial>(rows[0]), ...data };
    await (await getDb()).execute(
      'UPDATE materials SET name = $1, data = $2 WHERE id = $3',
      [updated.name, JSON.stringify(updated), id],
    );
  }

  async materialsDelete(id: string) {
    await (await getDb()).execute('DELETE FROM materials WHERE id = $1', [id]);
  }

  async materialsClear() {
    await (await getDb()).execute('DELETE FROM materials');
  }

  async materialsBulkAdd(ms: WorkMaterial[]) {
    if (ms.length === 0) return;
    const db = await getDb();
    for (const m of ms) {
      await db.execute(
        'INSERT OR IGNORE INTO materials (id, name, created_at, data) VALUES ($1, $2, $3, $4)',
        [m.id, m.name, m.createdAt ?? Date.now(), JSON.stringify(m)],
      );
    }
  }

  // ── Holders ────────────────────────────────────────────────────────────────

  async holdersGetAll(): Promise<ToolHolder[]> {
    const db = await getDb();
    const rows = await db.select<{ data: string }[]>(
      'SELECT data FROM holders ORDER BY created_at ASC',
    );
    return parseRows<ToolHolder>(rows);
  }

  async holdersAdd(h: ToolHolder) {
    const db = await getDb();
    await db.execute(
      'INSERT INTO holders (id, name, created_at, data) VALUES ($1, $2, $3, $4)',
      [h.id, h.name, h.createdAt ?? Date.now(), JSON.stringify(h)],
    );
  }

  async holdersUpdate(id: string, data: Partial<ToolHolder>) {
    const rows = await (await getDb()).select<{ data: string }[]>(
      'SELECT data FROM holders WHERE id = $1', [id],
    );
    if (!rows.length) return;
    const updated = { ...parseRow<ToolHolder>(rows[0]), ...data };
    await (await getDb()).execute(
      'UPDATE holders SET name = $1, data = $2 WHERE id = $3',
      [updated.name, JSON.stringify(updated), id],
    );
  }

  async holdersDelete(id: string) {
    await (await getDb()).execute('DELETE FROM holders WHERE id = $1', [id]);
  }

  async holdersClear() {
    await (await getDb()).execute('DELETE FROM holders');
  }

  async holdersBulkAdd(hs: ToolHolder[]) {
    if (hs.length === 0) return;
    const db = await getDb();
    for (const h of hs) {
      await db.execute(
        'INSERT OR IGNORE INTO holders (id, name, created_at, data) VALUES ($1, $2, $3, $4)',
        [h.id, h.name, h.createdAt ?? Date.now(), JSON.stringify(h)],
      );
    }
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  async templatesGetAll(): Promise<ToolTemplate[]> {
    const db = await getDb();
    const rows = await db.select<{ data: string }[]>(
      'SELECT data FROM templates ORDER BY created_at ASC',
    );
    return parseRows<ToolTemplate>(rows);
  }

  async templatesPut(t: ToolTemplate) {
    const db = await getDb();
    await db.execute(
      'INSERT OR REPLACE INTO templates (id, name, created_at, data) VALUES ($1, $2, $3, $4)',
      [t.id, t.name, t.createdAt ?? Date.now(), JSON.stringify(t)],
    );
  }

  async templatesDelete(id: string) {
    await (await getDb()).execute('DELETE FROM templates WHERE id = $1', [id]);
  }

  // ── Transactions ───────────────────────────────────────────────────────────

  async transactionsAdd(tx: StockTransaction) {
    const db = await getDb();
    await db.execute(
      'INSERT INTO transactions (id, tool_id, timestamp, delta, quantity_after, reason, note) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [tx.id, tx.toolId, tx.timestamp, tx.delta, tx.quantityAfter, tx.reason, tx.note ?? null],
    );
  }

  async transactionsGetByToolId(toolId: string): Promise<StockTransaction[]> {
    const db = await getDb();
    const rows = await db.select<{
      id: string; tool_id: string; timestamp: number;
      delta: number; quantity_after: number; reason: string;
      note: string | null;
    }[]>(
      'SELECT * FROM transactions WHERE tool_id = $1 ORDER BY timestamp ASC',
      [toolId],
    );
    return rows.map((r) => ({
      id:            r.id,
      toolId:        r.tool_id,
      timestamp:     r.timestamp,
      delta:         r.delta,
      quantityAfter: r.quantity_after,
      reason:        r.reason as StockTransaction['reason'],
      note:          r.note ?? undefined,
    }));
  }

  // ── Audit log ──────────────────────────────────────────────────────────────

  async auditAdd(entry: ToolAuditEntry) {
    const db = await getDb();
    await db.execute(
      'INSERT INTO audit_log (id, tool_id, timestamp, changed_by, fields) VALUES ($1, $2, $3, $4, $5)',
      [entry.id, entry.toolId, entry.timestamp, entry.changedBy ?? null, JSON.stringify(entry.fields)],
    );
  }

  async auditGetByToolId(toolId: string): Promise<ToolAuditEntry[]> {
    const db = await getDb();
    const rows = await db.select<{
      id: string; tool_id: string; timestamp: number;
      changed_by: string | null; fields: string;
    }[]>(
      'SELECT * FROM audit_log WHERE tool_id = $1 ORDER BY timestamp DESC',
      [toolId],
    );
    return rows.map((r) => ({
      id:        r.id,
      toolId:    r.tool_id,
      timestamp: r.timestamp,
      changedBy: r.changed_by ?? undefined,
      fields:    JSON.parse(r.fields) as ToolAuditEntry['fields'],
    }));
  }

  // ── Snapshots ──────────────────────────────────────────────────────────────

  async snapshotsAdd(snap: LibrarySnapshot) {
    const db = await getDb();
    await db.execute(
      'INSERT INTO snapshots (id, created_at, label, tool_count, data) VALUES ($1, $2, $3, $4, $5)',
      [snap.id, snap.createdAt, snap.label ?? null, snap.toolCount, JSON.stringify(snap)],
    );
  }

  async snapshotsGetAll(): Promise<LibrarySnapshot[]> {
    const db = await getDb();
    const rows = await db.select<{ data: string }[]>(
      'SELECT data FROM snapshots ORDER BY created_at DESC',
    );
    return parseRows<LibrarySnapshot>(rows);
  }

  async snapshotsGet(id: string): Promise<LibrarySnapshot | undefined> {
    const db = await getDb();
    const rows = await db.select<{ data: string }[]>(
      'SELECT data FROM snapshots WHERE id = $1', [id],
    );
    return rows.length ? parseRow<LibrarySnapshot>(rows[0]) : undefined;
  }

  async snapshotsDelete(id: string) {
    await (await getDb()).execute('DELETE FROM snapshots WHERE id = $1', [id]);
  }

  async snapshotsBulkDelete(ids: string[]) {
    if (ids.length === 0) return;
    const db = await getDb();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    await db.execute(`DELETE FROM snapshots WHERE id IN (${placeholders})`, ids);
  }

  // ── Machines ───────────────────────────────────────────────────────────────

  async machinesGetAll(): Promise<Machine[]> {
    const db = await getDb();
    const rows = await db.select<{ data: string }[]>(
      'SELECT data FROM machines ORDER BY created_at ASC',
    );
    return parseRows<Machine>(rows);
  }

  async machinesAdd(m: Machine) {
    const db = await getDb();
    await db.execute(
      'INSERT INTO machines (id, name, created_at, data) VALUES ($1, $2, $3, $4)',
      [m.id, m.name, m.createdAt ?? Date.now(), JSON.stringify(m)],
    );
  }

  async machinesUpdate(id: string, data: Partial<Machine>) {
    const rows = await (await getDb()).select<{ data: string }[]>(
      'SELECT data FROM machines WHERE id = $1', [id],
    );
    if (!rows.length) return;
    const updated = { ...parseRow<Machine>(rows[0]), ...data };
    await (await getDb()).execute(
      'UPDATE machines SET name = $1, data = $2 WHERE id = $3',
      [updated.name, JSON.stringify(updated), id],
    );
  }

  async machinesDelete(id: string) {
    await (await getDb()).execute('DELETE FROM machines WHERE id = $1', [id]);
  }

  // ── Composite ──────────────────────────────────────────────────────────────

  async replaceLibrary(
    tools: LibraryTool[],
    materials: WorkMaterial[],
    holders: ToolHolder[],
  ) {
    const db = await getDb();
    await db.execute('BEGIN');
    try {
      await db.execute('DELETE FROM tools');
      await db.execute('DELETE FROM materials');
      await db.execute('DELETE FROM holders');
      for (const t of tools) {
        await db.execute(
          'INSERT INTO tools (id, tool_number, added_at, data) VALUES ($1, $2, $3, $4)',
          [t.id, t.toolNumber, t.addedAt ?? Date.now(), JSON.stringify(t)],
        );
      }
      for (const m of materials) {
        await db.execute(
          'INSERT INTO materials (id, name, created_at, data) VALUES ($1, $2, $3, $4)',
          [m.id, m.name, m.createdAt ?? Date.now(), JSON.stringify(m)],
        );
      }
      for (const h of holders) {
        await db.execute(
          'INSERT INTO holders (id, name, created_at, data) VALUES ($1, $2, $3, $4)',
          [h.id, h.name, h.createdAt ?? Date.now(), JSON.stringify(h)],
        );
      }
      await db.execute('COMMIT');
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }
  }
}
