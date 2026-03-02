import Dexie, { type Table } from 'dexie';
import type { LibraryTool } from '../types/libraryTool';

class LibraryDatabase extends Dexie {
  tools!: Table<LibraryTool>;

  constructor() {
    super('cnc-tool-library');
    this.version(1).stores({
      // Indexed fields (primary key first, then searchable/filterable fields)
      tools: 'id, toolNumber, type, machineGroup, starred, addedAt',
    });
  }
}

export const db = new LibraryDatabase();
