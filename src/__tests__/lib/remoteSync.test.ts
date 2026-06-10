import { describe, it, expect, beforeEach } from 'vitest';
import type { LibraryTool } from '../../types/libraryTool';
import type { WorkMaterial } from '../../types/material';
import type { SyncPayload } from '../../lib/remoteSync';
import { mergePayloads } from '../../lib/remoteSync';

function makeTool(overrides: Partial<LibraryTool> = {}): LibraryTool {
  return {
    id:          'tool-1',
    toolNumber:  1,
    type:        'flat end mill',
    description: 'Test Tool',
    unit:        'mm',
    geometry:    { diameter: 10 },
    tags:        [],
    starred:     false,
    addedAt:     0,
    updatedAt:   0,
    ...overrides,
  };
}

function makeMaterial(overrides: Partial<WorkMaterial> = {}): WorkMaterial {
  return {
    id:        'material-1',
    name:      'Test Material',
    category:  'aluminum',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makePayload(overrides: Partial<SyncPayload> = {}): SyncPayload {
  return {
    version:     2,
    syncVersion: 1,
    exportedAt:  new Date().toISOString(),
    tools:       [],
    materials:   [],
    holders:     [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('mergePayloads', () => {
  it('adds remote-only tools without a conflict', () => {
    const remoteTool = makeTool({ id: 'tool-2', updatedAt: 100 });
    const result = mergePayloads(
      { tools: [], materials: [], holders: [] },
      makePayload({ tools: [remoteTool] }),
      0,
    );
    expect(result.tools).toEqual([remoteTool]);
    expect(result.stats.addedFromRemote).toBe(1);
    expect(result.stats.conflictRecords).toEqual([]);
  });

  it('keeps local-only tools without a conflict', () => {
    const localTool = makeTool({ id: 'tool-3', updatedAt: 100 });
    const result = mergePayloads(
      { tools: [localTool], materials: [], holders: [] },
      makePayload(),
      0,
    );
    expect(result.tools).toEqual([localTool]);
    expect(result.stats.localOnly).toBe(1);
    expect(result.stats.conflictRecords).toEqual([]);
  });

  it('records a conflict and keeps the remote version when both sides changed since lastPullAt', () => {
    const lastPullAt = 100;
    const localTool  = makeTool({ id: 'tool-4', description: 'Local edit',  updatedAt: 150 });
    const remoteTool = makeTool({ id: 'tool-4', description: 'Remote edit', updatedAt: 200 });

    const result = mergePayloads(
      { tools: [localTool], materials: [], holders: [] },
      makePayload({ tools: [remoteTool] }),
      lastPullAt,
    );

    expect(result.tools).toEqual([remoteTool]); // remote wins
    expect(result.stats.conflicts).toBe(1);
    expect(result.stats.conflictRecords).toEqual([{
      kind:   'tool',
      id:     'tool-4',
      label:  '#1 Remote edit',
      local:  localTool,
      remote: remoteTool,
    }]);
  });

  it('records a conflict for a non-tool kind (material) with the correct kind and label', () => {
    const lastPullAt = 100;
    const localMaterial  = makeMaterial({ id: 'material-4', name: 'Local edit',  updatedAt: 150 });
    const remoteMaterial = makeMaterial({ id: 'material-4', name: 'Remote edit', updatedAt: 200 });

    const result = mergePayloads(
      { tools: [], materials: [localMaterial], holders: [] },
      makePayload({ materials: [remoteMaterial] }),
      lastPullAt,
    );

    expect(result.materials).toEqual([remoteMaterial]); // remote wins
    expect(result.stats.conflicts).toBe(1);
    expect(result.stats.conflictRecords).toEqual([{
      kind:   'material',
      id:     'material-4',
      label:  'Remote edit',
      local:  localMaterial,
      remote: remoteMaterial,
    }]);
  });

  it('does not record a conflict when only the remote side changed since lastPullAt', () => {
    const lastPullAt = 100;
    const localTool  = makeTool({ id: 'tool-5', description: 'Unchanged', updatedAt: 50 });
    const remoteTool = makeTool({ id: 'tool-5', description: 'Remote edit', updatedAt: 200 });

    const result = mergePayloads(
      { tools: [localTool], materials: [], holders: [] },
      makePayload({ tools: [remoteTool] }),
      lastPullAt,
    );

    expect(result.tools).toEqual([remoteTool]);
    expect(result.stats.conflicts).toBe(0);
    expect(result.stats.conflictRecords).toEqual([]);
  });
});
