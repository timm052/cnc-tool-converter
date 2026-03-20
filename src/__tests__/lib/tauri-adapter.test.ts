/**
 * Tests for src/lib/db/tauri-adapter.ts
 *
 * @tauri-apps/plugin-sql is mocked with an in-memory implementation so these
 * tests run in Node / jsdom without a real Tauri context.
 *
 * The in-memory DB handles the exact SQL patterns TauriAdapter emits:
 *   INSERT [OR REPLACE | OR IGNORE] INTO <table> (cols) VALUES ($1, ...)
 *   INSERT OR REPLACE INTO <table> (cols) VALUES ($1, ...)
 *   SELECT data FROM <table> [WHERE id = $1] [ORDER BY col ASC|DESC]
 *   SELECT * FROM <table> WHERE tool_id = $1
 *   UPDATE <table> SET col = $1 [, col2 = $2 ...] WHERE id = $N
 *   DELETE FROM <table> WHERE id = $1
 *   DELETE FROM <table> WHERE id IN ($1, $2, ...)
 *   DELETE FROM <table>
 *   BEGIN / COMMIT / ROLLBACK
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── In-memory SQL mock ────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

class InMemoryDb {
  private tables: Map<string, Row[]> = new Map();

  private tbl(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const s = sql.trim();
    const su = s.toUpperCase();

    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(su)) return;

    // INSERT [OR REPLACE | OR IGNORE] INTO table (cols) VALUES (...)
    const ins = s.match(/^INSERT\s+(?:OR\s+(REPLACE|IGNORE)\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (ins) {
      const conflict = ins[1]?.toUpperCase() ?? '';
      const table = ins[2].toLowerCase();
      const cols = ins[3].split(',').map((c) => c.trim().replace(/"/g, ''));
      const obj: Row = {};
      cols.forEach((col, i) => { obj[col] = params[i]; });
      const rows = this.tbl(table);
      if (conflict === 'REPLACE') {
        const idx = rows.findIndex((r) => r.id === obj.id);
        if (idx >= 0) rows.splice(idx, 1);
        rows.push(obj);
      } else if (conflict === 'IGNORE') {
        if (!rows.find((r) => r.id === obj.id)) rows.push(obj);
      } else {
        rows.push(obj);
      }
      return;
    }

    // UPDATE table SET col1 = $1, col2 = $2 WHERE id = $N
    const upd = s.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+id\s*=\s*\$(\d+)/i);
    if (upd) {
      const table = upd[1].toLowerCase();
      const setClause = upd[2];
      const idParamIdx = parseInt(upd[3], 10) - 1;
      const id = params[idParamIdx] as string;
      const row = this.tbl(table).find((r) => r.id === id);
      if (!row) return;
      // Parse "col = $N" pairs
      for (const part of setClause.split(',')) {
        const m = part.trim().match(/^(\w+)\s*=\s*\$(\d+)$/i);
        if (m) row[m[1]] = params[parseInt(m[2], 10) - 1];
      }
      return;
    }

    // DELETE FROM table WHERE id IN ($1, $2, ...)
    const delIn = s.match(/^DELETE\s+FROM\s+(\w+)\s+WHERE\s+id\s+IN\s*\(([^)]+)\)/i);
    if (delIn) {
      const table = delIn[1].toLowerCase();
      const ids = new Set(params as string[]);
      this.tables.set(table, this.tbl(table).filter((r) => !ids.has(r.id as string)));
      return;
    }

    // DELETE FROM table WHERE id = $1
    const delId = s.match(/^DELETE\s+FROM\s+(\w+)\s+WHERE\s+id\s*=\s*\$\d+/i);
    if (delId) {
      const table = delId[1].toLowerCase();
      const id = params[0] as string;
      this.tables.set(table, this.tbl(table).filter((r) => r.id !== id));
      return;
    }

    // DELETE FROM table (clear)
    const delAll = s.match(/^DELETE\s+FROM\s+(\w+)\s*$/i);
    if (delAll) {
      this.tables.set(delAll[1].toLowerCase(), []);
      return;
    }
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T> {
    const tblMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tblMatch) return [] as T;
    const table = tblMatch[1].toLowerCase();
    const rows = this.tbl(table);

    // WHERE id = $1
    if (sql.match(/WHERE\s+id\s*=\s*\$\d+/i)) {
      const id = params[0] as string;
      const found = rows.filter((r) => r.id === id);
      return found.map((r) => ({ data: r.data })) as T;
    }

    // WHERE tool_id = $1 (transactions + audit_log)
    if (sql.match(/WHERE\s+tool_id\s*=\s*\$\d+/i)) {
      const toolId = params[0] as string;
      const found = rows.filter((r) => r.tool_id === toolId);
      // ORDER BY timestamp ASC / DESC
      const orderMatch = sql.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i);
      if (orderMatch) {
        const col = orderMatch[1];
        const desc = orderMatch[2]?.toUpperCase() === 'DESC';
        found.sort((a, b) => {
          const av = a[col] as number;
          const bv = b[col] as number;
          return desc ? bv - av : av - bv;
        });
      }
      return found as T;
    }

    // SELECT data FROM table ORDER BY col ASC|DESC
    const orderMatch = sql.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i);
    const sorted = [...rows];
    if (orderMatch) {
      const col = orderMatch[1];
      const desc = orderMatch[2]?.toUpperCase() === 'DESC';
      sorted.sort((a, b) => {
        const av = a[col] as number;
        const bv = b[col] as number;
        return desc ? bv - av : av - bv;
      });
    }

    if (sql.match(/SELECT\s+data\b/i)) {
      return sorted.map((r) => ({ data: r.data })) as T;
    }
    return sorted as T;
  }
}

// ── Mock @tauri-apps/plugin-sql ───────────────────────────────────────────────
//
// We use a stable proxy object so the adapter's internal _db singleton keeps
// pointing to the same object, while each test swaps _mockDb underneath it.

let _mockDb: InMemoryDb = new InMemoryDb();

const _dbProxy = {
  execute: async (sql: string, params: unknown[] = []) => _mockDb.execute(sql, params),
  select:  async <T>(sql: string, params: unknown[] = []) => _mockDb.select<T>(sql, params),
};

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => _dbProxy) },
}));

// ── Import adapter AFTER mock is in place ────────────────────────────────────

const { TauriAdapter } = await import('../../lib/db/tauri-adapter');

// Replace the in-memory store with a fresh one before each test
beforeEach(() => {
  _mockDb = new InMemoryDb();
});

// ── Helper factories ──────────────────────────────────────────────────────────

function makeTool(overrides?: Partial<import('../../types/libraryTool').LibraryTool>) {
  return {
    id:          crypto.randomUUID(),
    toolNumber:  1,
    type:        'endmill' as const,
    description: 'Test endmill',
    unit:        'mm' as const,
    geometry:    { diameter: 6 },
    tags:        [],
    starred:     false,
    addedAt:     1000,
    updatedAt:   1000,
    ...overrides,
  };
}

function makeMaterial(overrides?: Partial<import('../../types/material').WorkMaterial>): import('../../types/material').WorkMaterial {
  return {
    id:        crypto.randomUUID(),
    name:      'Aluminum 6061',
    category:  'aluminum',
    hardness:  95,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── toolsAdd + toolsGetAll ────────────────────────────────────────────────────

describe('TauriAdapter — tools', () => {
  it('adds a tool and retrieves it via toolsGetAll', async () => {
    const adapter = new TauriAdapter();
    const tool = makeTool({ toolNumber: 5, description: 'Mill 6mm' });
    await adapter.toolsAdd(tool);
    const all = await adapter.toolsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(tool.id);
    expect(all[0].description).toBe('Mill 6mm');
  });

  it('retrieves a specific tool by id via toolsGet', async () => {
    const adapter = new TauriAdapter();
    const tool = makeTool();
    await adapter.toolsAdd(tool);
    const fetched = await adapter.toolsGet(tool.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(tool.id);
  });

  it('returns undefined for an unknown id', async () => {
    const adapter = new TauriAdapter();
    const result = await adapter.toolsGet('does-not-exist');
    expect(result).toBeUndefined();
  });

  it('toolsGetAll returns tools ordered by addedAt ascending', async () => {
    const adapter = new TauriAdapter();
    const t1 = makeTool({ id: 'a', toolNumber: 1, addedAt: 3000 });
    const t2 = makeTool({ id: 'b', toolNumber: 2, addedAt: 1000 });
    const t3 = makeTool({ id: 'c', toolNumber: 3, addedAt: 2000 });
    await adapter.toolsAdd(t1);
    await adapter.toolsAdd(t2);
    await adapter.toolsAdd(t3);
    const all = await adapter.toolsGetAll();
    expect(all.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('updates a tool', async () => {
    const adapter = new TauriAdapter();
    const tool = makeTool({ description: 'Old name' });
    await adapter.toolsAdd(tool);
    await adapter.toolsUpdate(tool.id, { description: 'New name', toolNumber: 99 });
    const updated = await adapter.toolsGet(tool.id);
    expect(updated!.description).toBe('New name');
    expect(updated!.toolNumber).toBe(99);
  });

  it('toolsUpdate is a no-op for unknown id', async () => {
    const adapter = new TauriAdapter();
    await expect(adapter.toolsUpdate('ghost', { description: 'x' })).resolves.toBeUndefined();
  });

  it('deletes a tool', async () => {
    const adapter = new TauriAdapter();
    const tool = makeTool();
    await adapter.toolsAdd(tool);
    await adapter.toolsDelete(tool.id);
    expect(await adapter.toolsGetAll()).toHaveLength(0);
  });

  it('bulk-deletes multiple tools', async () => {
    const adapter = new TauriAdapter();
    const t1 = makeTool({ id: 'x1', toolNumber: 1 });
    const t2 = makeTool({ id: 'x2', toolNumber: 2 });
    const t3 = makeTool({ id: 'x3', toolNumber: 3 });
    await adapter.toolsBulkAdd([t1, t2, t3]);
    await adapter.toolsBulkDelete(['x1', 'x3']);
    const remaining = await adapter.toolsGetAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('x2');
  });

  it('bulk-delete with empty array is a no-op', async () => {
    const adapter = new TauriAdapter();
    await adapter.toolsAdd(makeTool());
    await adapter.toolsBulkDelete([]);
    expect(await adapter.toolsGetAll()).toHaveLength(1);
  });

  it('clears all tools', async () => {
    const adapter = new TauriAdapter();
    await adapter.toolsBulkAdd([makeTool({ toolNumber: 1 }), makeTool({ id: 'y', toolNumber: 2 })]);
    await adapter.toolsClear();
    expect(await adapter.toolsGetAll()).toHaveLength(0);
  });

  it('toolsPut upserts (replace existing)', async () => {
    const adapter = new TauriAdapter();
    const tool = makeTool({ description: 'First' });
    await adapter.toolsAdd(tool);
    await adapter.toolsPut({ ...tool, description: 'Updated' });
    const all = await adapter.toolsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].description).toBe('Updated');
  });
});

// ── toolsAddConditional ───────────────────────────────────────────────────────

describe('TauriAdapter — toolsAddConditional', () => {
  it('adds all when no existing numbers', async () => {
    const adapter = new TauriAdapter();
    const tools = [
      makeTool({ id: 'c1', toolNumber: 1 }),
      makeTool({ id: 'c2', toolNumber: 2 }),
    ];
    const result = await adapter.toolsAddConditional(tools, new Set(), false);
    expect(result).toEqual({ added: 2, skipped: 0 });
    expect(await adapter.toolsGetAll()).toHaveLength(2);
  });

  it('skips tools whose toolNumber already exists (overwrite=false)', async () => {
    const adapter = new TauriAdapter();
    const existing = new Set([1, 3]);
    const tools = [
      makeTool({ id: 'n1', toolNumber: 1 }),
      makeTool({ id: 'n2', toolNumber: 2 }),
      makeTool({ id: 'n3', toolNumber: 3 }),
    ];
    const result = await adapter.toolsAddConditional(tools, existing, false);
    expect(result).toEqual({ added: 1, skipped: 2 });
    const all = await adapter.toolsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].toolNumber).toBe(2);
  });

  it('overwrites when overwrite=true (same id = replace in-place)', async () => {
    // INSERT OR REPLACE deduplicates by primary key (id), so to overwrite an
    // existing tool the incoming record must share the same id — which is
    // exactly what ImportPanel does when the user chooses Merge/Overwrite.
    const adapter = new TauriAdapter();
    const t1 = makeTool({ id: 'tool5', toolNumber: 5, description: 'Original' });
    await adapter.toolsAdd(t1);
    const t2 = makeTool({ id: 'tool5', toolNumber: 5, description: 'Replaced' }); // same id
    const result = await adapter.toolsAddConditional([t2], new Set([5]), true);
    expect(result).toEqual({ added: 1, skipped: 0 });
    const all = await adapter.toolsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].description).toBe('Replaced');
  });
});

// ── toolsBulkPatch ────────────────────────────────────────────────────────────

describe('TauriAdapter — toolsBulkPatch', () => {
  it('patches multiple tools in one call', async () => {
    const adapter = new TauriAdapter();
    const t1 = makeTool({ id: 'p1', toolNumber: 1, description: 'A' });
    const t2 = makeTool({ id: 'p2', toolNumber: 2, description: 'B' });
    await adapter.toolsBulkAdd([t1, t2]);

    await adapter.toolsBulkPatch([
      { id: 'p1', patch: { description: 'A-updated' } },
      { id: 'p2', patch: { description: 'B-updated' } },
    ], 9999);

    const all = await adapter.toolsGetAll();
    const a = all.find((t) => t.id === 'p1')!;
    const b = all.find((t) => t.id === 'p2')!;
    expect(a.description).toBe('A-updated');
    expect(a.updatedAt).toBe(9999);
    expect(b.description).toBe('B-updated');
    expect(b.updatedAt).toBe(9999);
  });

  it('is a no-op for empty updates array', async () => {
    const adapter = new TauriAdapter();
    await expect(adapter.toolsBulkPatch([], Date.now())).resolves.toBeUndefined();
  });

  it('skips unknown ids silently', async () => {
    const adapter = new TauriAdapter();
    await adapter.toolsAdd(makeTool({ id: 'real', toolNumber: 1 }));
    await expect(
      adapter.toolsBulkPatch([{ id: 'ghost', patch: { description: 'x' } }], 0),
    ).resolves.toBeUndefined();
  });
});

// ── replaceLibrary ────────────────────────────────────────────────────────────

describe('TauriAdapter — replaceLibrary', () => {
  it('clears existing data and inserts new records atomically', async () => {
    const adapter = new TauriAdapter();
    // Seed some existing tools
    await adapter.toolsBulkAdd([makeTool({ id: 'old', toolNumber: 99 })]);

    const newTools = [makeTool({ id: 'n1', toolNumber: 1 }), makeTool({ id: 'n2', toolNumber: 2 })];
    const newMaterials = [makeMaterial({ id: 'm1' })];
    await adapter.replaceLibrary(newTools, newMaterials, []);

    const tools = await adapter.toolsGetAll();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.id).sort()).toEqual(['n1', 'n2'].sort());

    const mats = await adapter.materialsGetAll();
    expect(mats).toHaveLength(1);
    expect(mats[0].id).toBe('m1');
  });

  it('replaces with empty arrays (full clear)', async () => {
    const adapter = new TauriAdapter();
    await adapter.toolsBulkAdd([makeTool(), makeTool({ id: 'z', toolNumber: 7 })]);
    await adapter.replaceLibrary([], [], []);
    expect(await adapter.toolsGetAll()).toHaveLength(0);
  });
});

// ── materials ─────────────────────────────────────────────────────────────────

describe('TauriAdapter — materials', () => {
  it('add and retrieve material', async () => {
    const adapter = new TauriAdapter();
    const m = makeMaterial({ name: 'Steel 4140' });
    await adapter.materialsAdd(m);
    const all = await adapter.materialsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Steel 4140');
  });

  it('updates material name', async () => {
    const adapter = new TauriAdapter();
    const m = makeMaterial({ name: 'Aluminium' });
    await adapter.materialsAdd(m);
    await adapter.materialsUpdate(m.id, { name: 'Aluminium 7075' });
    const all = await adapter.materialsGetAll();
    expect(all[0].name).toBe('Aluminium 7075');
  });

  it('deletes a material', async () => {
    const adapter = new TauriAdapter();
    const m = makeMaterial();
    await adapter.materialsAdd(m);
    await adapter.materialsDelete(m.id);
    expect(await adapter.materialsGetAll()).toHaveLength(0);
  });

  it('clears all materials', async () => {
    const adapter = new TauriAdapter();
    await adapter.materialsBulkAdd([makeMaterial({ id: 'a' }), makeMaterial({ id: 'b' })]);
    await adapter.materialsClear();
    expect(await adapter.materialsGetAll()).toHaveLength(0);
  });
});

// ── templates ─────────────────────────────────────────────────────────────────

describe('TauriAdapter — templates', () => {
  function makeTemplate(overrides?: Partial<import('../../types/template').ToolTemplate>): import('../../types/template').ToolTemplate {
    const { id, toolNumber, addedAt, updatedAt, ...toolData } = makeTool();
    return { id: id, name: 'Standard endmill', toolData, createdAt: 1000, ...overrides };
  }

  it('puts and retrieves templates', async () => {
    const adapter = new TauriAdapter();
    await adapter.templatesPut(makeTemplate({ name: 'Standard endmill' }));
    const all = await adapter.templatesGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Standard endmill');
  });

  it('templatesPut replaces existing template', async () => {
    const adapter = new TauriAdapter();
    const tmpl = makeTemplate({ id: 't1', name: 'Old' });
    await adapter.templatesPut(tmpl);
    await adapter.templatesPut({ ...tmpl, name: 'New' });
    const all = await adapter.templatesGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('New');
  });

  it('deletes a template', async () => {
    const adapter = new TauriAdapter();
    await adapter.templatesPut(makeTemplate({ id: 't2', name: 'Del' }));
    await adapter.templatesDelete('t2');
    expect(await adapter.templatesGetAll()).toHaveLength(0);
  });
});

// ── snapshots ─────────────────────────────────────────────────────────────────

describe('TauriAdapter — snapshots', () => {
  function makeSnap(overrides?: Partial<import('../../types/snapshot').LibrarySnapshot>): import('../../types/snapshot').LibrarySnapshot {
    return { id: crypto.randomUUID(), createdAt: 1000, label: 'auto', toolCount: 0, tools: [], materials: [], holders: [], ...overrides };
  }

  it('adds and retrieves snapshot', async () => {
    const adapter = new TauriAdapter();
    const snap = makeSnap({ id: 'snap1', createdAt: 5000, label: 'Before migration', toolCount: 42 });
    await adapter.snapshotsAdd(snap);
    const all = await adapter.snapshotsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].label).toBe('Before migration');
  });

  it('snapshotsGetAll returns newest first', async () => {
    const adapter = new TauriAdapter();
    await adapter.snapshotsAdd(makeSnap({ id: 's1', createdAt: 1000 }));
    await adapter.snapshotsAdd(makeSnap({ id: 's2', createdAt: 3000 }));
    await adapter.snapshotsAdd(makeSnap({ id: 's3', createdAt: 2000 }));
    const all = await adapter.snapshotsGetAll();
    expect(all.map((s) => s.id)).toEqual(['s2', 's3', 's1']);
  });

  it('retrieves a specific snapshot by id', async () => {
    const adapter = new TauriAdapter();
    await adapter.snapshotsAdd(makeSnap({ id: 'snap-x', toolCount: 5 }));
    const snap = await adapter.snapshotsGet('snap-x');
    expect(snap).toBeDefined();
    expect(snap!.id).toBe('snap-x');
  });

  it('returns undefined for unknown snapshot id', async () => {
    const adapter = new TauriAdapter();
    expect(await adapter.snapshotsGet('nope')).toBeUndefined();
  });

  it('deletes a snapshot', async () => {
    const adapter = new TauriAdapter();
    await adapter.snapshotsAdd(makeSnap({ id: 'del-me' }));
    await adapter.snapshotsDelete('del-me');
    expect(await adapter.snapshotsGetAll()).toHaveLength(0);
  });

  it('bulk-deletes snapshots', async () => {
    const adapter = new TauriAdapter();
    await adapter.snapshotsAdd(makeSnap({ id: 'bd1', createdAt: 1 }));
    await adapter.snapshotsAdd(makeSnap({ id: 'bd2', createdAt: 2 }));
    await adapter.snapshotsAdd(makeSnap({ id: 'keep', createdAt: 3 }));
    await adapter.snapshotsBulkDelete(['bd1', 'bd2']);
    const all = await adapter.snapshotsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('keep');
  });
});

// ── JSON round-trip fidelity ──────────────────────────────────────────────────

describe('TauriAdapter — JSON round-trip fidelity', () => {
  it('preserves all tool fields through add → get cycle', async () => {
    const adapter = new TauriAdapter();
    const tool = makeTool({
      description: 'Ball endmill',
      geometry:    { diameter: 4, cornerRadius: 2, numberOfFlutes: 4, overallLength: 50 },
      tags:        ['roughing', 'aluminium'],
      starred:     true,
      machineGroups: ['VMC1'],
    });
    await adapter.toolsAdd(tool);
    const fetched = await adapter.toolsGet(tool.id);
    expect(fetched).toEqual(tool);
  });

  it('preserves material fields through add → getAll cycle', async () => {
    const adapter = new TauriAdapter();
    const mat = makeMaterial({ name: 'Ti-6Al-4V', category: 'titanium', hardness: 340 });
    await adapter.materialsAdd(mat);
    const all = await adapter.materialsGetAll();
    expect(all[0]).toEqual(mat);
  });
});
