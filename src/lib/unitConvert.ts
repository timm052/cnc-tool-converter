import type { LibraryTool } from '../types/libraryTool';
import type { ToolGeometry, CuttingParameters } from '../types/tool';

const MM_PER_INCH = 25.4;

function round6(n: number): number {
  return parseFloat(n.toFixed(6));
}

function scaleLength(v: number | undefined, factor: number): number | undefined {
  return v != null ? round6(v * factor) : undefined;
}

function scaleFeed(v: number | undefined, factor: number): number | undefined {
  // Feed rates are mm/min ↔ in/min — same factor as length
  return v != null ? round6(v * factor) : undefined;
}

function convertGeometry(
  geo: ToolGeometry,
  factor: number,
): ToolGeometry {
  return {
    ...geo,
    diameter:         round6(geo.diameter * factor),
    shaftDiameter:    scaleLength(geo.shaftDiameter, factor),
    overallLength:    scaleLength(geo.overallLength, factor),
    bodyLength:       scaleLength(geo.bodyLength, factor),
    fluteLength:      scaleLength(geo.fluteLength, factor),
    shoulderLength:   scaleLength(geo.shoulderLength, factor),
    cornerRadius:     scaleLength(geo.cornerRadius, factor),
    tipDiameter:      scaleLength(geo.tipDiameter, factor),
    shoulderDiameter: scaleLength(geo.shoulderDiameter, factor),
    tipLength:        scaleLength(geo.tipLength, factor),
    tipOffset:        scaleLength(geo.tipOffset, factor),
    profileRadius:    scaleLength(geo.profileRadius, factor),
    nozzleDiameter:   scaleLength(geo.nozzleDiameter, factor),
    // Angles, pitches, counts — unit-independent, left unchanged:
    // taperAngle, threadPitch, threadProfileAngle, pointAngle,
    // numberOfFlutes, numberOfTeeth, coolantSupport
  };
}

function convertCutting(
  cutting: CuttingParameters | undefined,
  factor: number,
): CuttingParameters | undefined {
  if (!cutting) return undefined;
  return {
    ...cutting,
    feedCutting: scaleFeed(cutting.feedCutting, factor),
    feedPlunge:  scaleFeed(cutting.feedPlunge,  factor),
    feedRamp:    scaleFeed(cutting.feedRamp,    factor),
    feedEntry:   scaleFeed(cutting.feedEntry,   factor),
    feedExit:    scaleFeed(cutting.feedExit,    factor),
    feedRetract: scaleFeed(cutting.feedRetract, factor),
    // spindleRpm, rampSpindleRpm, coolant, clockwise, feedMode — unit-independent
  };
}

/**
 * Returns a new LibraryTool with all length/feed values converted to `toUnit`.
 * If the tool is already in `toUnit`, returns the original object unchanged.
 */
export function convertToolUnit(tool: LibraryTool, toUnit: 'mm' | 'inch'): LibraryTool {
  if (tool.unit === toUnit) return tool;
  const factor = toUnit === 'mm' ? MM_PER_INCH : 1 / MM_PER_INCH;
  return {
    ...tool,
    unit:     toUnit,
    geometry: convertGeometry(tool.geometry, factor),
    cutting:  convertCutting(tool.cutting, factor),
    updatedAt: Date.now(),
  };
}
