import type { Tool } from './tool';

/**
 * A tool stored in the persistent local library.
 * Extends the canonical Tool model with library-specific metadata.
 */
export interface LibraryTool extends Tool {
  /** Freeform labels, e.g. 'roughing', 'aluminium', 'VF-2' */
  tags: string[];
  /** Whether the tool has been starred / favourited */
  starred: boolean;
  /** Named machine group this tool belongs to, e.g. 'VF-2', 'Lathe' */
  machineGroup?: string;
  /** Unix millisecond timestamp when the tool was first added */
  addedAt: number;
  /** Unix millisecond timestamp of the last edit */
  updatedAt: number;
}
