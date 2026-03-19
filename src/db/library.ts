import Dexie, { type Table } from 'dexie';
import type { LibraryTool } from '../types/libraryTool';
import type { WorkMaterial } from '../types/material';
import type { ToolHolder } from '../types/holder';
import type { ToolTemplate } from '../types/template';
import type { StockTransaction } from '../types/stockTransaction';
import type { ToolAuditEntry } from '../types/auditEntry';
import type { LibrarySnapshot } from '../types/snapshot';
import type { Machine } from '../types/machine';

class LibraryDatabase extends Dexie {
  tools!:        Table<LibraryTool>;
  materials!:    Table<WorkMaterial>;
  holders!:      Table<ToolHolder>;
  templates!:    Table<ToolTemplate>;
  transactions!: Table<StockTransaction>;
  auditLog!:     Table<ToolAuditEntry>;
  snapshots!:    Table<LibrarySnapshot>;
  machines!:     Table<Machine>;

  constructor() {
    super('cnc-tool-library');
    this.version(1).stores({
      tools: 'id, toolNumber, type, machineGroup, starred, addedAt',
    });
    this.version(2).stores({
      tools:     'id, toolNumber, type, machineGroup, starred, addedAt',
      materials: 'id, name, category, createdAt',
      holders:   'id, name, type, createdAt',
    });
    // v3 — migrate machineGroup (string) → machineGroups (string[])
    this.version(3).stores({
      tools:     'id, toolNumber, type, *machineGroups, starred, addedAt',
      materials: 'id, name, category, createdAt',
      holders:   'id, name, type, createdAt',
    }).upgrade((tx) =>
      tx.table('tools').toCollection().modify((tool: LibraryTool & { machineGroup?: string }) => {
        if (!tool.machineGroups) {
          tool.machineGroups = tool.machineGroup ? [tool.machineGroup] : [];
        }
        delete tool.machineGroup;
      }),
    );
    // v4 — add templates table
    this.version(4).stores({
      tools:     'id, toolNumber, type, *machineGroups, starred, addedAt',
      materials: 'id, name, category, createdAt',
      holders:   'id, name, type, createdAt',
      templates: 'id, name, createdAt',
    });
    // v5 — add stock transaction log
    this.version(5).stores({
      tools:        'id, toolNumber, type, *machineGroups, starred, addedAt',
      materials:    'id, name, category, createdAt',
      holders:      'id, name, type, createdAt',
      templates:    'id, name, createdAt',
      transactions: 'id, toolId, timestamp',
    });
    // v6 — add per-tool audit / change log
    this.version(6).stores({
      tools:        'id, toolNumber, type, *machineGroups, starred, addedAt',
      materials:    'id, name, category, createdAt',
      holders:      'id, name, type, createdAt',
      templates:    'id, name, createdAt',
      transactions: 'id, toolId, timestamp',
      auditLog:     'id, toolId, timestamp',
    });
    // v7 — add full-library snapshots
    this.version(7).stores({
      tools:        'id, toolNumber, type, *machineGroups, starred, addedAt',
      materials:    'id, name, category, createdAt',
      holders:      'id, name, type, createdAt',
      templates:    'id, name, createdAt',
      transactions: 'id, toolId, timestamp',
      auditLog:     'id, toolId, timestamp',
      snapshots:    'id, createdAt',
    });
    // v8 — add machines table
    this.version(8).stores({
      tools:        'id, toolNumber, type, *machineGroups, starred, addedAt',
      materials:    'id, name, category, createdAt',
      holders:      'id, name, type, createdAt',
      templates:    'id, name, createdAt',
      transactions: 'id, toolId, timestamp',
      auditLog:     'id, toolId, timestamp',
      snapshots:    'id, createdAt',
      machines:     'id, name, type, createdAt',
    });
  }
}

export const db = new LibraryDatabase();
