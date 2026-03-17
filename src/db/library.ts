import Dexie, { type Table } from 'dexie';
import type { LibraryTool } from '../types/libraryTool';
import type { WorkMaterial } from '../types/material';
import type { ToolHolder } from '../types/holder';

class LibraryDatabase extends Dexie {
  tools!:     Table<LibraryTool>;
  materials!: Table<WorkMaterial>;
  holders!:   Table<ToolHolder>;

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
    // *machineGroups is a multi-value index so queries like .where('machineGroups').equals(x) work.
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
  }
}

export const db = new LibraryDatabase();
