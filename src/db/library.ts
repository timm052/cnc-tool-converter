import Dexie, { type Table } from 'dexie';
import type { LibraryTool } from '../types/libraryTool';
import type { WorkMaterial } from '../types/material';
import type { ToolHolder } from '../types/holder';
import type { ToolTemplate } from '../types/template';
import type { StockTransaction } from '../types/stockTransaction';

class LibraryDatabase extends Dexie {
  tools!:        Table<LibraryTool>;
  materials!:    Table<WorkMaterial>;
  holders!:      Table<ToolHolder>;
  templates!:    Table<ToolTemplate>;
  transactions!: Table<StockTransaction>;

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
  }
}

export const db = new LibraryDatabase();
