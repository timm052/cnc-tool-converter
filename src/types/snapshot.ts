/**
 * Full-library snapshot stored in IndexedDB.
 * Captures tools + materials + holders at a point in time.
 */
import type { LibraryTool } from './libraryTool';
import type { WorkMaterial } from './material';
import type { ToolHolder } from './holder';

export interface LibrarySnapshot {
  id:          string;
  createdAt:   number;
  label:       string;   // auto-generated or user-provided
  toolCount:   number;
  tools:       LibraryTool[];
  materials:   WorkMaterial[];
  holders:     ToolHolder[];
}

/** Max number of auto-snapshots kept before the oldest is deleted */
export const MAX_AUTO_SNAPSHOTS = 10;
