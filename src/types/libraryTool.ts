import type { Tool, CoolantMode, FeedMode } from './tool';

/**
 * Per-material feeds & speeds entry linked to a WorkMaterial by ID.
 * All fields are optional overrides; unset fields inherit the tool's base cutting params.
 */
export interface ToolMaterialEntry {
  materialId: string;
  /** Spindle speed (rpm) */
  rpm?: number;
  /** Ramp spindle speed (rpm) */
  rampSpindleRpm?: number;
  /** Surface speed — Vc (m/min) or SFM (ft/min) */
  surfaceSpeed?: number;
  /** Cutting feed rate (mm/min or ipm) */
  feedRate?: number;
  /** Vertical plunge feed rate */
  feedPlunge?: number;
  /** Ramp approach feed rate */
  feedRamp?: number;
  /** Entry feed rate */
  feedEntry?: number;
  /** Exit feed rate */
  feedExit?: number;
  /** Retract feed rate */
  feedRetract?: number;
  /** Chip load / feed per tooth (mm/tooth or in/tooth) */
  feedPerTooth?: number;
  /** Axial depth of cut */
  depthOfCut?: number;
  /** Radial depth of cut / stepover */
  widthOfCut?: number;
  /** Coolant mode override */
  coolant?: CoolantMode;
  /** Feed mode override */
  feedMode?: FeedMode;
  /** Spindle direction override */
  clockwise?: boolean;
  notes?: string;
}

/**
 * A tool stored in the persistent local library.
 * Extends the canonical Tool model with library-specific metadata.
 */
export interface LibraryTool extends Tool {
  /** Freeform labels, e.g. 'roughing', 'aluminium', 'VF-2' */
  tags: string[];
  /** Whether the tool has been starred / favourited */
  starred: boolean;
  /** Machine groups this tool belongs to, e.g. ['VF-2', 'VF-4'] */
  machineGroups?: string[];
  /** @deprecated Use machineGroups — kept for IndexedDB migration reads only */
  machineGroup?: string;
  /** Unix millisecond timestamp when the tool was first added */
  addedAt: number;
  /** Unix millisecond timestamp of the last edit */
  updatedAt: number;

  // ── Inventory / Crib ──────────────────────────────────────────────────────
  /** Number of units on hand */
  quantity?: number;
  /** Reorder below this quantity; triggers low-stock badge */
  reorderPoint?: number;
  /** Supplier or vendor name */
  supplier?: string;
  /** Unit cost */
  unitCost?: number;
  /** Physical crib location (e.g. "Drawer A3", "Shelf 2") */
  location?: string;

  // ── Assembly ──────────────────────────────────────────────────────────────
  /** ID of the linked ToolHolder from the holder library */
  holderId?: string;
  /** Extension from holder face to tool tip (mm) */
  assemblyStickOut?: number;

  // ── Materials & F&S ───────────────────────────────────────────────────────
  /** Per-material feeds & speeds entries */
  toolMaterials?: ToolMaterialEntry[];

  // ── Custom fields ─────────────────────────────────────────────────────────
  /** User-defined key-value metadata */
  customFields?: Record<string, string>;
}
