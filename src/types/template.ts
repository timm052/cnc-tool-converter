import type { LibraryTool } from './libraryTool';

/**
 * A named tool template stored in IndexedDB.
 * Stamping out a new tool from a template copies all geometry, cutting params,
 * and library metadata — except id, toolNumber, addedAt, and updatedAt.
 */
export interface ToolTemplate {
  /** UUID primary key */
  id: string;
  /** Display name shown in the template picker */
  name: string;
  /** Optional short description */
  description?: string;
  /** Unix ms timestamp */
  createdAt: number;
  /** The full tool data to copy when stamping */
  toolData: Omit<LibraryTool, 'id' | 'toolNumber' | 'addedAt' | 'updatedAt'>;
}
