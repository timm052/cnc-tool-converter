/**
 * Core Tool Data Model
 *
 * This is the internal representation used as the common format
 * when converting between different CAM/CNC software formats.
 * All converters parse their native format into this model and
 * write from this model to their native format.
 */

export type ToolType =
  | 'flat end mill'
  | 'ball end mill'
  | 'bull nose end mill'
  | 'chamfer mill'
  | 'face mill'
  | 'spot drill'
  | 'drill'
  | 'tapered mill'
  | 'boring bar'
  | 'thread mill'
  | 'engraving'
  | 'custom'
  | (string & {});  // allows user-defined custom type IDs

export type ToolUnit = 'mm' | 'inch';
export type CoolantMode = 'air' | 'flood' | 'suction' | 'mist' | 'disabled';
export type FeedMode = 'per-minute' | 'per-revolution';
export type ToolMaterial = 'carbide' | 'hss' | 'ceramics' | 'diamond' | 'other';

/** Physical dimensions and geometry of the tool */
export interface ToolGeometry {
  /** Primary cutting diameter (mm or inch) */
  diameter: number;
  /** Holder/shank diameter */
  shaftDiameter?: number;
  /** Total tool length from holder face to tip */
  overallLength?: number;
  /** Length of the cutting body */
  bodyLength?: number;
  /** Length of the cutting flutes */
  fluteLength?: number;
  /** Shoulder length (non-cutting portion above flutes) */
  shoulderLength?: number;
  /** Number of cutting flutes */
  numberOfFlutes?: number;
  /** Corner radius for bull-nose tools */
  cornerRadius?: number;
  /** Taper half-angle in degrees */
  taperAngle?: number;
  /** Tip diameter (0 for sharp point) */
  tipDiameter?: number;
  /** Thread pitch for thread mills */
  threadPitch?: number;
  /** Thread profile angle in degrees (default 60) */
  threadProfileAngle?: number;
  /** Number of cutting teeth (thread mills, face mills) */
  numberOfTeeth?: number;
  /** Whether the tool has internal coolant channels */
  coolantSupport?: boolean;
}

/** Tool offset values along machine axes */
export interface ToolOffsets {
  x?: number;
  y?: number;
  z?: number;
  a?: number;
  b?: number;
  c?: number;
  u?: number;
  v?: number;
  w?: number;
}

/** Cutting parameters and spindle settings */
export interface CuttingParameters {
  spindleRpm?: number;
  rampSpindleRpm?: number;
  /** Main cutting feed rate */
  feedCutting?: number;
  /** Vertical plunge feed rate */
  feedPlunge?: number;
  /** Ramp approach feed rate */
  feedRamp?: number;
  feedEntry?: number;
  feedExit?: number;
  feedRetract?: number;
  feedMode?: FeedMode;
  coolant?: CoolantMode;
  /** true = clockwise (conventional for milling) */
  clockwise?: boolean;
}

/** CNC controller / NC program properties */
export interface NcProperties {
  breakControl?: boolean;
  diameterOffset?: boolean;
  lengthOffset?: boolean;
  liveTool?: boolean;
  manualToolChange?: boolean;
  turret?: number;
}

/** Named parameter preset (HSMLib-specific, preserved for round-trip fidelity) */
export interface ToolPreset {
  id: string;
  name: string;
  description?: string;
  parameters: Record<string, string>;
}

/**
 * The canonical internal representation of a single CNC tool.
 * Fields are designed to cover the union of all supported formats.
 */
export interface Tool {
  /** Internal ID (UUID) — may come from source file or be generated */
  id: string;
  /** Primary tool number (T number in G-code) */
  toolNumber: number;
  /** Carousel/magazine pocket number (LinuxCNC P field) */
  pocketNumber?: number;
  type: ToolType;
  description: string;
  comment?: string;
  manufacturer?: string;
  /** URL or part number */
  productId?: string;
  unit: ToolUnit;
  geometry: ToolGeometry;
  offsets?: ToolOffsets;
  cutting?: CuttingParameters;
  nc?: NcProperties;
  material?: ToolMaterial;
  /** Named cutting presets (preserved from HSMLib) */
  presets?: ToolPreset[];
  /**
   * Opaque source-format data that doesn't map to the core model.
   * Used to preserve round-trip fidelity for format-specific fields.
   */
  sourceData?: Record<string, unknown>;
}
