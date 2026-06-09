// fake-indexeddb/auto must be the very first import — it patches globalThis.indexedDB
// before LibraryDatabase's Dexie constructor runs at module evaluation time.
// eslint-disable-next-line simple-import-sort/imports
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach } from 'vitest';

import { db }           from '../../db/library';
import { DexieAdapter } from '../../lib/db/dexie-adapter';

import type { LibraryTool }  from '../../types/libraryTool';
import type { WorkMaterial } from '../../types/material';
import type { ToolHolder }   from '../../types/holder';

// ── Clear all tables before each test ─────────────────────────────────────────

beforeEach(async () => {
  await db.tools.clear();
  await db.materials.clear();
  await db.holders.clear();
  await db.templates.clear();
  await db.transactions.clear();
  await db.auditLog.clear();
  await db.snapshots.clear();
  await db.machines.clear();
});

// ── Helper factories ──────────────────────────────────────────────────────────

function makeTool(overrides?: Partial<LibraryTool>): LibraryTool {
  return {
    id:          crypto.randomUUID(),
    toolNumber:  1,
    type:        'flat end mill',
    description: 'Test endmill',
    unit:        'mm',
    geometry:    { diameter: 6 },
    tags:        [],
    starred:     false,
    addedAt:     1000,
    updatedAt:   1000,
    ...overrides,
  };
}

function makeMaterial(overrides?: Partial<WorkMaterial>): WorkMaterial {
  return {
    id:        crypto.randomUUID(),
    name:      'Aluminum 6061',
    category:  'aluminum',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeHolder(overrides?: Partial<ToolHolder>): ToolHolder {
  return {
    id:          crypto.randomUUID(),
    name:        'CAT40 ER32',
    type:        'CAT40',
    gaugeLength: 100,
    createdAt:   1000,
    updatedAt:   1000,
    ...overrides,
  };
}

// ── tools basic CRUD ──────────────────────────────────────────────────────────

describe('DexieAdapter — tools basic CRUD', () => {
  it('adds a tool and retrieves it via toolsGetAll', async () => {
    const adapter = new DexieAdapter();
    const tool = makeTool({ description: 'Mill 6mm', toolNumber: 5 });
    await adapter.toolsAdd(tool);
    const all = await adapter.toolsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(tool.id);
    expect(all[0].description).toBe('Mill 6mm');
  });

  it('toolsGetAll returns tools ordered by addedAt ascending', async () => {
    const adapter = new DexieAdapter();
    const t1 = makeTool({ id: 'a', toolNumber: 1, addedAt: 3000 });
    const t2 = makeTool({ id: 'b', toolNumber: 2, addedAt: 1000 });
    const t3 = makeTool({ id: 'c', toolNumber: 3, addedAt: 2000 });
    await adapter.toolsAdd(t1);
    await adapter.toolsAdd(t2);
    await adapter.toolsAdd(t3);
    const all = await adapter.toolsGetAll();
    expect(all.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('toolsGet returns the tool by id', async () => {
    const adapter = new DexieAdapter();
    const tool = makeTool();
    await adapter.toolsAdd(tool);
    const fetched = await adapter.toolsGet(tool.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(tool.id);
  });

  it('toolsGet returns undefined for an unknown id', async () => {
    const adapter = new DexieAdapter();
    const result = await adapter.toolsGet('does-not-exist');
    expect(result).toBeUndefined();
  });

  it('toolsUpdate changes the specified fields', async () => {
    const adapter = new DexieAdapter();
    const tool = makeTool({ description: 'Old name' });
    await adapter.toolsAdd(tool);
    await adapter.toolsUpdate(tool.id, { description: 'New name', toolNumber: 99 });
    const updated = await adapter.toolsGet(tool.id);
    expect(updated!.description).toBe('New name');
    expect(updated!.toolNumber).toBe(99);
  });

  it('toolsUpdate preserves fields not in the patch', async () => {
    const adapter = new DexieAdapter();
    const tool = makeTool({ description: 'Keep me', starred: true });
    await adapter.toolsAdd(tool);
    await adapter.toolsUpdate(tool.id, { toolNumber: 42 });
    const updated = await adapter.toolsGet(tool.id);
    expect(updated!.description).toBe('Keep me');
    expect(updated!.starred).toBe(true);
    expect(updated!.toolNumber).toBe(42);
  });

  it('toolsDelete removes the tool', async () => {
    const adapter = new DexieAdapter();
    const tool = makeTool();
    await adapter.toolsAdd(tool);
    await adapter.toolsDelete(tool.id);
    expect(await adapter.toolsGetAll()).toHaveLength(0);
  });

  it('toolsClear removes all tools', async () => {
    const adapter = new DexieAdapter();
    await adapter.toolsAdd(makeTool({ id: 'x', toolNumber: 1 }));
    await adapter.toolsAdd(makeTool({ id: 'y', toolNumber: 2 }));
    await adapter.toolsClear();
    expect(await adapter.toolsGetAll()).toHaveLength(0);
  });
});

// ── toolsPut (upsert) ─────────────────────────────────────────────────────────

describe('DexieAdapter — toolsPut', () => {
  it('inserts a tool when id does not exist', async () => {
    const adapter = new DexieAdapter();
    await adapter.toolsPut(makeTool());
    expect(await adapter.toolsGetAll()).toHaveLength(1);
  });

  it('replaces an existing tool when id already exists', async () => {
    const adapter = new DexieAdapter();
    const tool = makeTool({ description: 'First' });
    await adapter.toolsAdd(tool);
    await adapter.toolsPut({ ...tool, description: 'Updated' });
    const all = await adapter.toolsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].description).toBe('Updated');
  });
});

// ── toolsBulkDelete ───────────────────────────────────────────────────────────

describe('DexieAdapter — toolsBulkDelete', () => {
  it('removes the specified tools by id', async () => {
    const adapter = new DexieAdapter();
    await adapter.toolsAdd(makeTool({ id: 'x1', toolNumber: 1 }));
    await adapter.toolsAdd(makeTool({ id: 'x2', toolNumber: 2 }));
    await adapter.toolsAdd(makeTool({ id: 'x3', toolNumber: 3 }));
    await adapter.toolsBulkDelete(['x1', 'x3']);
    const remaining = await adapter.toolsGetAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('x2');
  });

  it('empty array is a no-op', async () => {
    const adapter = new DexieAdapter();
    await adapter.toolsAdd(makeTool());
    await adapter.toolsBulkDelete([]);
    expect(await adapter.toolsGetAll()).toHaveLength(1);
  });
});

// ── toolsBulkPatch ────────────────────────────────────────────────────────────

describe('DexieAdapter — toolsBulkPatch', () => {
  it('patches multiple tools in a single call', async () => {
    const adapter = new DexieAdapter();
    const t1 = makeTool({ id: 'p1', toolNumber: 1, description: 'A' });
    const t2 = makeTool({ id: 'p2', toolNumber: 2, description: 'B' });
    await adapter.toolsAdd(t1);
    await adapter.toolsAdd(t2);

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

  it('patches toolNumber and description, preserves unpatched fields', async () => {
    const adapter = new DexieAdapter();
    const tool = makeTool({ id: 't1', toolNumber: 10, description: 'Original', starred: true });
    await adapter.toolsAdd(tool);

    await adapter.toolsBulkPatch(
      [{ id: 't1', patch: { toolNumber: 99, description: 'Patched' } }],
      5000,
    );

    const updated = await adapter.toolsGet('t1');
    expect(updated!.toolNumber).toBe(99);
    expect(updated!.description).toBe('Patched');
    expect(updated!.starred).toBe(true);
    expect(updated!.updatedAt).toBe(5000);
  });

  it('empty updates array is a no-op', async () => {
    const adapter = new DexieAdapter();
    await adapter.toolsAdd(makeTool({ id: 'z' }));
    await adapter.toolsBulkPatch([], Date.now());
    expect(await adapter.toolsGetAll()).toHaveLength(1);
  });
});

// ── toolsAddConditional ───────────────────────────────────────────────────────

describe('DexieAdapter — toolsAddConditional', () => {
  it('adds all tools when existingNumbers set is empty', async () => {
    const adapter = new DexieAdapter();
    const tools = [
      makeTool({ id: 'c1', toolNumber: 1 }),
      makeTool({ id: 'c2', toolNumber: 2 }),
    ];
    const result = await adapter.toolsAddConditional(tools, new Set(), false);
    expect(result).toEqual({ added: 2, skipped: 0 });
    expect(await adapter.toolsGetAll()).toHaveLength(2);
  });

  it('skips tools whose toolNumber already exists when overwrite=false', async () => {
    const adapter = new DexieAdapter();
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

  it('replaces tool when overwrite=true (same id)', async () => {
    const adapter = new DexieAdapter();
    const t1 = makeTool({ id: 'tool5', toolNumber: 5, description: 'Original' });
    await adapter.toolsAdd(t1);
    const t2 = makeTool({ id: 'tool5', toolNumber: 5, description: 'Replaced' });
    const result = await adapter.toolsAddConditional([t2], new Set([5]), true);
    expect(result).toEqual({ added: 1, skipped: 0 });
    const all = await adapter.toolsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].description).toBe('Replaced');
  });
});

// ── toolsClear isolation ──────────────────────────────────────────────────────

describe('DexieAdapter — toolsClear isolation', () => {
  it('clears tools and leaves materials intact', async () => {
    const adapter = new DexieAdapter();
    await adapter.toolsAdd(makeTool({ id: 'ta', toolNumber: 1 }));
    await adapter.toolsAdd(makeTool({ id: 'tb', toolNumber: 2 }));
    const mat = makeMaterial({ id: 'keep-mat' });
    await adapter.materialsAdd(mat);

    await adapter.toolsClear();

    expect(await adapter.toolsGetAll()).toHaveLength(0);
    const mats = await adapter.materialsGetAll();
    expect(mats).toHaveLength(1);
    expect(mats[0].id).toBe('keep-mat');
  });
});

// ── JSON round-trip fidelity ──────────────────────────────────────────────────

describe('DexieAdapter — JSON round-trip fidelity', () => {
  it('preserves all tool fields through add → get cycle', async () => {
    const adapter = new DexieAdapter();
    const tool = makeTool({
      description:   'Ball endmill',
      geometry:      { diameter: 4, cornerRadius: 2, numberOfFlutes: 4, overallLength: 50 },
      tags:          ['roughing', 'aluminium'],
      starred:       true,
      machineGroups: ['VMC1'],
    });
    await adapter.toolsAdd(tool);
    const fetched = await adapter.toolsGet(tool.id);
    expect(fetched).toEqual(tool);
  });
});

// ── materials ─────────────────────────────────────────────────────────────────

describe('DexieAdapter — materials', () => {
  it('adds and retrieves a material', async () => {
    const adapter = new DexieAdapter();
    const m = makeMaterial({ name: 'Steel 4140' });
    await adapter.materialsAdd(m);
    const all = await adapter.materialsGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Steel 4140');
  });

  it('materialsUpdate changes the target field', async () => {
    const adapter = new DexieAdapter();
    const m = makeMaterial({ name: 'Aluminium' });
    await adapter.materialsAdd(m);
    await adapter.materialsUpdate(m.id, { name: 'Aluminium 7075' });
    const all = await adapter.materialsGetAll();
    expect(all[0].name).toBe('Aluminium 7075');
  });

  it('materialsUpdate preserves unpatched fields', async () => {
    const adapter = new DexieAdapter();
    const m = makeMaterial({ name: 'Ti-6Al-4V', category: 'titanium', hardness: 340 });
    await adapter.materialsAdd(m);
    await adapter.materialsUpdate(m.id, { hardness: 360 });
    const all = await adapter.materialsGetAll();
    expect(all[0].name).toBe('Ti-6Al-4V');
    expect(all[0].category).toBe('titanium');
    expect(all[0].hardness).toBe(360);
  });

  it('materialsDelete removes the material', async () => {
    const adapter = new DexieAdapter();
    const m = makeMaterial();
    await adapter.materialsAdd(m);
    await adapter.materialsDelete(m.id);
    expect(await adapter.materialsGetAll()).toHaveLength(0);
  });

  it('materialsClear removes all materials', async () => {
    const adapter = new DexieAdapter();
    await adapter.materialsAdd(makeMaterial({ id: 'ma1' }));
    await adapter.materialsAdd(makeMaterial({ id: 'ma2' }));
    await adapter.materialsClear();
    expect(await adapter.materialsGetAll()).toHaveLength(0);
  });

  it('preserves all fields through add → getAll cycle', async () => {
    const adapter = new DexieAdapter();
    const mat = makeMaterial({ name: 'Ti-6Al-4V', category: 'titanium', hardness: 340 });
    await adapter.materialsAdd(mat);
    const all = await adapter.materialsGetAll();
    expect(all[0]).toEqual(mat);
  });
});

// ── holders ───────────────────────────────────────────────────────────────────

describe('DexieAdapter — holders', () => {
  it('adds and retrieves a holder', async () => {
    const adapter = new DexieAdapter();
    const h = makeHolder({ name: 'BT40 ER25' });
    await adapter.holdersAdd(h);
    const all = await adapter.holdersGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('BT40 ER25');
  });

  it('holdersDelete removes the holder', async () => {
    const adapter = new DexieAdapter();
    const h = makeHolder();
    await adapter.holdersAdd(h);
    await adapter.holdersDelete(h.id);
    expect(await adapter.holdersGetAll()).toHaveLength(0);
  });

  it('holdersClear removes all holders', async () => {
    const adapter = new DexieAdapter();
    await adapter.holdersAdd(makeHolder({ id: 'h1' }));
    await adapter.holdersAdd(makeHolder({ id: 'h2' }));
    await adapter.holdersClear();
    expect(await adapter.holdersGetAll()).toHaveLength(0);
  });

  it('holdersUpdate changes a field and preserves others', async () => {
    const adapter = new DexieAdapter();
    const h = makeHolder({ name: 'Old holder', gaugeLength: 80 });
    await adapter.holdersAdd(h);
    await adapter.holdersUpdate(h.id, { gaugeLength: 120 });
    const all = await adapter.holdersGetAll();
    expect(all[0].gaugeLength).toBe(120);
    expect(all[0].name).toBe('Old holder');
  });
});

// ── replaceLibrary ────────────────────────────────────────────────────────────

describe('DexieAdapter — replaceLibrary', () => {
  it('clears existing data and inserts new records', async () => {
    const adapter = new DexieAdapter();
    await adapter.toolsAdd(makeTool({ id: 'old', toolNumber: 99 }));
    await adapter.materialsAdd(makeMaterial({ id: 'old-mat' }));

    const newTools = [
      makeTool({ id: 'n1', toolNumber: 1 }),
      makeTool({ id: 'n2', toolNumber: 2 }),
    ];
    const newMaterials = [makeMaterial({ id: 'm1', name: 'New Steel' })];
    await adapter.replaceLibrary(newTools, newMaterials, []);

    const tools = await adapter.toolsGetAll();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.id).sort()).toEqual(['n1', 'n2'].sort());

    const mats = await adapter.materialsGetAll();
    expect(mats).toHaveLength(1);
    expect(mats[0].id).toBe('m1');
  });

  it('replaces with empty arrays performs full clear', async () => {
    const adapter = new DexieAdapter();
    await adapter.toolsAdd(makeTool());
    await adapter.materialsAdd(makeMaterial());
    await adapter.holdersAdd(makeHolder());

    await adapter.replaceLibrary([], [], []);

    expect(await adapter.toolsGetAll()).toHaveLength(0);
    expect(await adapter.materialsGetAll()).toHaveLength(0);
    expect(await adapter.holdersGetAll()).toHaveLength(0);
  });

  it('inserts holders provided in the replacement', async () => {
    const adapter = new DexieAdapter();
    const holders = [makeHolder({ id: 'hx', name: 'New CAT40' })];
    await adapter.replaceLibrary([], [], holders);
    const all = await adapter.holdersGetAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('hx');
  });
});
