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
  }
}

export const db = new LibraryDatabase();
