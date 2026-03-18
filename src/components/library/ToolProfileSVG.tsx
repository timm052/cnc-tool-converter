/**
 * ToolProfileSVG — Live 2D side-profile preview for the ToolEditor slide-over.
 *
 * SVG layout (480 × 170):
 *   │ Left annot 90px │ Profile 300px (cx=240) │ Right annot 90px │
 *   Shank top: y=12   Tip: y=128   Annotation zone: y=130–168
 *
 * Tool is drawn tip-down (machinist convention), symmetrically about cx=240.
 */

import { useId } from 'react';
import type { LibraryTool } from '../../types/libraryTool';
import type { ToolType, ToolGeometry } from '../../types/tool';
import type { ToolHolder } from '../../types/holder';
import type { CustomToolTypeDefinition } from '../../lib/customToolTypes';
import { getProfileShape, getTypeLabel } from '../../lib/customToolTypes';
import { useSettings } from '../../contexts/SettingsContext';

// ── Resolved geometry ─────────────────────────────────────────────────────────

interface ResolvedGeometry {
  diameter:        number;
  shaftDiameter:   number;
  overallLength:   number;
  fluteLength:     number;
  bodyLength?:     number;   // undefined = not set
  shoulderLength?: number;   // undefined = not set
  cornerRadius:    number;
  taperAngle:      number;   // half-angle from axis, degrees
  tipDiameter:     number;
  profileRadius?:  number;   // circle-segment arc radius; undefined = use cornerRadius
  nozzleDiameter?: number;   // orifice/kerf diameter for jet cutters
  threadPitch:     number;
  numberOfTeeth:   number;
  numberOfFlutes?: number;   // undefined = not set → no hatch marks
  coolantSupport:  boolean;
}

function defaultTaperAngle(type: ToolType): number {
  switch (type) {
    case 'drill':
    case 'center drill':  return 59;   // 118° included → 59° half-angle
    case 'spot drill':    return 45;
    case 'chamfer mill':  return 45;
    case 'counter sink':  return 45;   // 90° included countersink
    case 'tapered mill':
    case 'dovetail mill': return 5;
    case 'engraving':     return 15;
    case 'tap right hand':
    case 'tap left hand': return 30;
    default:              return 30;
  }
}

function resolveGeometry(type: ToolType, geo: ToolGeometry): ResolvedGeometry {
  const d  = geo.diameter || 6;
  // Probe and lollipop mill have a narrow neck/stylus by default
  const sd = type === 'probe'
    ? (geo.shaftDiameter ?? d * 0.25)
    : type === 'lollipop mill'
      ? (geo.shaftDiameter ?? d * 0.4)
      : (geo.shaftDiameter ?? d);
  const ol = type === 'face mill'
    ? (geo.overallLength ?? d * 0.8)
    : (geo.overallLength ?? d * 5);
  const fl = geo.fluteLength ?? ol * 0.4;
  const cr = Math.min(geo.cornerRadius ?? 0, d / 2 - 0.001);
  // Use pointAngle (SIG, included angle) / 2 as the taper half-angle when TA is
  // absent or set to an implausible value (≥ 80° from axis = nearly flat).
  let rawTA = geo.taperAngle;
  if ((rawTA === undefined || rawTA >= 80) && geo.pointAngle !== undefined) {
    rawTA = geo.pointAngle / 2;
  }
  const ta = Math.max(1, Math.min(89, rawTA ?? defaultTaperAngle(type)));
  const td = geo.tipDiameter ?? 0;
  const tp = geo.threadPitch ?? d * 0.15;
  const nt = geo.numberOfTeeth ?? Math.min(20, Math.max(1, Math.floor(fl / tp)));

  return {
    diameter:        d,
    shaftDiameter:   sd,
    overallLength:   ol,
    fluteLength:     fl,
    bodyLength:      geo.bodyLength,      // pass through; undefined = not set
    shoulderLength:  geo.shoulderLength,  // pass through; undefined = not set
    cornerRadius:    cr,
    taperAngle:      ta,
    tipDiameter:     td,
    profileRadius:   geo.profileRadius,   // pass through; undefined = use cornerRadius
    nozzleDiameter:  geo.nozzleDiameter,  // pass through; undefined = use default
    threadPitch:     tp,
    numberOfTeeth:   nt,
    numberOfFlutes:  geo.numberOfFlutes,  // pass through; undefined = no marks
    coolantSupport:  geo.coolantSupport ?? false,
  };
}

// ── Layout constants ──────────────────────────────────────────────────────────

const AVAIL_H = 116;   // tipY(128) − shankTopY(12)
const AVAIL_W = 300;   // profile zone width
const CX      = 240;   // profile centre x
const TIP_Y   = 128;   // SVG y of tool tip

// ── Scale ─────────────────────────────────────────────────────────────────────

function computeScale(geo: ResolvedGeometry, assemblyTotalH?: number, maxRadiusMm?: number): number {
  const totalH = assemblyTotalH != null ? Math.max(geo.overallLength, assemblyTotalH) : geo.overallLength;
  const maxR   = Math.max(geo.diameter / 2, geo.shaftDiameter / 2, maxRadiusMm ?? 0);
  const s = Math.min(
    AVAIL_H / totalH,
    (AVAIL_W / 2) / maxR,
  );
  return Math.max(0.5, Math.min(s, 30));
}

// ── Holder silhouette builder ──────────────────────────────────────────────────

function buildHolderPath(
  entryY:     number,   // SVG y of collet face (bottom of holder body)
  holderTopY: number,   // SVG y of spindle face (top of holder body)
  shankRpx:   number,   // half-width of tool shank in px
  barrelRpx:  number,   // half-width of holder barrel in px
): string {
  const h = entryY - holderTopY;           // total holder height in px (positive)
  const colletFrac  = 0.22;                // narrow collet section at bottom
  const taperFrac   = 0.13;                // taper out to barrel
  const barrelFrac  = 0.45;               // main barrel body
  // top spindle taper is the remainder

  const y0 = r1(entryY);
  const y1 = r1(entryY    - h * colletFrac);
  const y2 = r1(y1        - h * taperFrac);
  const y3 = r1(y2        - h * barrelFrac);
  const y4 = r1(holderTopY);

  const sR = r1(shankRpx);
  const bR = r1(barrelRpx);
  const tR = r1(shankRpx * 0.65);   // narrow spindle end

  return [
    `M${r1(CX - sR)},${y0}`,   // bottom-left  (collet face)
    `L${r1(CX + sR)},${y0}`,   // bottom-right
    `L${r1(CX + sR)},${y1}`,   // up right (collet section)
    `L${r1(CX + bR)},${y2}`,   // taper right to barrel
    `L${r1(CX + bR)},${y3}`,   // up right (barrel)
    `L${r1(CX + tR)},${y4}`,   // taper right to spindle top
    `L${r1(CX - tR)},${y4}`,   // spindle top-left
    `L${r1(CX - bR)},${y3}`,   // down left (barrel)
    `L${r1(CX - bR)},${y2}`,   // end of barrel left
    `L${r1(CX - sR)},${y1}`,   // taper left back to collet
    'Z',
  ].join(' ');
}

// ── Coordinate transform ──────────────────────────────────────────────────────

function r1(n: number): number { return Math.round(n * 10) / 10; }

function tx(toolX: number, scale: number): number { return r1(CX + toolX * scale); }
function ty(toolY: number, scale: number): number { return r1(TIP_Y - toolY * scale); }

function L(toolX: number, toolY: number, s: number): string {
  return `L${tx(toolX, s)},${ty(toolY, s)}`;
}

// ── Profile path builder ──────────────────────────────────────────────────────

function buildProfilePath(
  type: ToolType,
  geo: ResolvedGeometry,
  s: number,
  customTypes: CustomToolTypeDefinition[],
): string {
  const { diameter, shaftDiameter, overallLength, fluteLength,
          cornerRadius, taperAngle, tipDiameter } = geo;

  const fR = diameter / 2;
  const sR = shaftDiameter / 2;
  const FL = fluteLength;
  const OL = overallLength;

  // ── Special-case tools that don't fit the shared preamble/close model ──────

  if (type === 'dovetail mill') {
    // Dovetail: cutting section is an inverted cone — WIDER at the tip than the neck.
    // taperAngle = half-angle of the dovetail face from horizontal.
    const halfAngle = taperAngle * Math.PI / 180;
    const rawNeckR  = fR - FL * Math.tan(halfAngle);
    // neckR = radius at top of cutting section (clamp to [0.5, fR-0.5])
    const neckR     = Math.max(0.5, Math.min(rawNeckR, fR - 0.5));
    // The shank may be wider than the neck — taper it down
    const shankR    = Math.max(sR, neckR);
    const transH    = Math.abs(shankR - neckR) / Math.tan(30 * Math.PI / 180);
    const transY    = Math.min(OL, FL + Math.max(transH, 1 / s));
    const tipR      = tipDiameter / 2;
    return [
      `M${tx(-shankR, s)},${ty(OL, s)}`,
      `L${tx(shankR, s)},${ty(OL, s)}`,
      `L${tx(shankR, s)},${ty(transY, s)}`,
      ...(shankR > neckR ? [`L${tx(neckR, s)},${ty(FL, s)}`] : []),
      `L${tx(fR, s)},${TIP_Y}`,
      ...(tipR > 0 ? [`L${tx(tipR, s)},${TIP_Y}`, `L${tx(-tipR, s)},${TIP_Y}`] : []),
      `L${tx(-fR, s)},${TIP_Y}`,
      ...(shankR > neckR ? [`L${tx(-neckR, s)},${ty(FL, s)}`] : []),
      `L${tx(-shankR, s)},${ty(transY, s)}`,
      'Z',
    ].join(' ');
  }

  if (type === 'slot mill') {
    // T-slot cutter: cylindrical shank, then a wide flat disc at the bottom.
    // diameter = disc outer diameter; shaftDiameter = neck diameter; fluteLength = disc height.
    if (fR <= sR) {
      // Degenerate: disc not wider than neck — render as flat end mill
      // (falls through to shared preamble below)
    } else {
      const discH = Math.max(FL, 2 / s);   // disc height, at least 2 px visible
      const shankToDiscY = Math.min(OL, discH + 1 / s);  // small gap so disc is distinct
      return [
        `M${tx(-sR, s)},${ty(OL, s)}`,
        `L${tx(sR, s)},${ty(OL, s)}`,
        `L${tx(sR, s)},${ty(discH, s)}`,    // down narrow neck to disc top
        `L${tx(fR, s)},${ty(discH, s)}`,    // step out to disc outer radius
        `L${tx(fR, s)},${TIP_Y}`,           // disc right side
        `L${tx(-fR, s)},${TIP_Y}`,          // flat disc bottom
        `L${tx(-fR, s)},${ty(discH, s)}`,   // disc left side
        `L${tx(-sR, s)},${ty(discH, s)}`,   // step back to neck
        'Z',
      ].join(' ');
    }
  }

  if (type === 'face mill') {
    // Face mill: wide flat cutter much larger than the shank.
    // Render as: shank → 45° taper outward to body → flat bottom.
    const bodyH  = Math.max(FL, 4 / s);       // face mill body height
    const taperH = Math.abs(fR - sR) / Math.tan(45 * Math.PI / 180);
    const transY = Math.min(OL, bodyH + taperH);
    return [
      `M${tx(-sR, s)},${ty(OL, s)}`,
      `L${tx(sR, s)},${ty(OL, s)}`,
      `L${tx(sR, s)},${ty(transY, s)}`,
      `L${tx(fR, s)},${ty(bodyH, s)}`,       // 45° taper to full face mill radius
      `L${tx(fR, s)},${TIP_Y}`,              // flat face right edge
      `L${tx(-fR, s)},${TIP_Y}`,             // flat bottom
      `L${tx(-fR, s)},${ty(bodyH, s)}`,
      `L${tx(-sR, s)},${ty(transY, s)}`,
      'Z',
    ].join(' ');
  }

  if (type === 'circle segment barrel') {
    // Barrel: convex sides that bulge outward at mid-height, flat bottom.
    // Uses a quadratic bezier per side so that the midpoint equals fR exactly.
    const sagitta = (geo.profileRadius && geo.profileRadius > fR)
      ? geo.profileRadius - Math.sqrt(geo.profileRadius ** 2 - fR ** 2)
      : fR * 0.22;                                    // default 22% bulge
    const neckR  = Math.max(fR - sagitta, fR * 0.65); // radius at top/bottom of cutting section
    const ctrlX  = 2 * fR - neckR;                   // bezier control → midpoint = fR
    const eqY    = FL / 2;
    const taperH = Math.abs(sR - neckR) / Math.tan(30 * Math.PI / 180);
    const transY = Math.min(OL, FL + Math.max(taperH, 1 / s));
    return [
      `M${tx(-sR, s)},${ty(OL, s)}`,
      `L${tx(sR, s)},${ty(OL, s)}`,
      `L${tx(sR, s)},${ty(transY, s)}`,
      ...(sR !== neckR ? [`L${tx(neckR, s)},${ty(FL, s)}`] : []),
      `Q${tx(ctrlX, s)},${ty(eqY, s)} ${tx(neckR, s)},${TIP_Y}`,  // right convex arc
      `L${tx(-neckR, s)},${TIP_Y}`,                                // flat bottom
      `Q${tx(-ctrlX, s)},${ty(eqY, s)} ${tx(-neckR, s)},${ty(FL, s)}`, // left convex arc
      ...(sR !== neckR ? [`L${tx(-sR, s)},${ty(transY, s)}`] : []),
      'Z',
    ].join(' ');
  }

  if (type === 'circle segment oval') {
    // Oval/bullet: cylindrical sides tapering near the tip, then a rounded oval cap.
    // tipR = radius of the hemispherical cap at the bottom.
    const tipR   = (geo.profileRadius && geo.profileRadius > 0 && geo.profileRadius < fR)
      ? geo.profileRadius
      : fR * 0.38;
    const tipRPx = r1(tipR * s);
    const shTaperH = Math.abs(sR - fR) / Math.tan(30 * Math.PI / 180);
    const transY   = Math.min(OL, FL + Math.max(shTaperH, 1 / s));
    return [
      `M${tx(-sR, s)},${ty(OL, s)}`,
      `L${tx(sR, s)},${ty(OL, s)}`,
      `L${tx(sR, s)},${ty(transY, s)}`,
      ...(sR !== fR ? [`L${tx(fR, s)},${ty(FL, s)}`] : []),
      // Taper sides from fR down to tipR (cap radius), then draw the hemisphere.
      // Arc goes from (tipR, tipR) to (0, 0) — chord = tipR√2, radius = tipR → always valid.
      `L${tx(tipR, s)},${ty(tipR, s)}`,                            // taper right to cap start
      `A${tipRPx},${tipRPx} 0 0 1 ${tx(0, s)},${TIP_Y}`,          // right half of cap
      `A${tipRPx},${tipRPx} 0 0 1 ${tx(-tipR, s)},${ty(tipR, s)}`,// left half of cap
      `L${tx(-fR, s)},${ty(FL, s)}`,                               // taper left back up
      ...(sR !== fR ? [`L${tx(-sR, s)},${ty(transY, s)}`] : []),
      'Z',
    ].join(' ');
  }

  // taperBottomTS: where the 45° taper meets the flute/shoulder diameter.
  // shoulderLength is measured from the tip (= fluteLength + non-fluted relief).
  const taperBottomTS = (geo.shoulderLength !== undefined && geo.shoulderLength >= FL)
    ? geo.shoulderLength
    : FL;

  // The taper is 30° from horizontal: height = radiusDiff / tan(30°)
  // shoulderTopTS: where the shank diameter begins above the taper.
  const taperHeight   = Math.abs(sR - fR) / Math.tan(30 * Math.PI / 180);
  const shoulderTopTS = Math.min(OL, taperBottomTS + taperHeight);

  // Shared preamble: top-left shank → top-right shank → down right shank → taper → shoulder
  const preamble = [
    `M${tx(-sR, s)},${ty(OL, s)}`,               // top-left shank
    `L${tx(sR, s)},${ty(OL, s)}`,                // top-right shank
    `L${tx(sR, s)},${ty(shoulderTopTS, s)}`,     // down right shank to taper start
    // Diagonal taper to flute radius at taperBottomTS
    ...(sR !== fR ? [`L${tx(fR, s)},${ty(taperBottomTS, s)}`] : []),
    // Straight shoulder zone at flute diameter (only when it's separate from the taper)
    ...(taperBottomTS > FL ? [`L${tx(fR, s)},${ty(FL, s)}`] : []),
  ].join(' ');

  // Shared close: left flute top → shoulder zone → taper → Z closes to top-left
  const close = [
    `L${tx(-fR, s)},${ty(FL, s)}`,               // left flute top
    ...(taperBottomTS > FL ? [`L${tx(-fR, s)},${ty(taperBottomTS, s)}`] : []),
    ...(sR !== fR ? [`L${tx(-sR, s)},${ty(shoulderTopTS, s)}`] : []),
    'Z',
  ].join(' ');

  let tip = '';

  switch (type) {

    case 'flat end mill':
    case 'boring bar':
    case 'form mill':
    case 'holder':
    case 'custom':
      tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`;
      break;

    case 'ball end mill':
    case 'lollipop mill':  // hemispherical tip (RE = D/2)
    case 'probe': {        // spherical probe ball
      const rPx = r1(fR * s);
      tip = [
        `L${tx(fR, s)},${ty(fR, s)}`,
        `A${rPx},${rPx} 0 0 1 ${tx(0, s)},${TIP_Y}`,
        `A${rPx},${rPx} 0 0 1 ${tx(-fR, s)},${ty(fR, s)}`,
      ].join(' ');
      break;
    }

    case 'bull nose end mill': {
      const crPx = r1(Math.min(cornerRadius, fR) * s);
      if (crPx < 1) {
        tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`;
      } else {
        tip = [
          `L${tx(fR, s)},${ty(cornerRadius, s)}`,
          `A${crPx},${crPx} 0 0 1 ${tx(fR - cornerRadius, s)},${TIP_Y}`,
          `L${tx(-(fR - cornerRadius), s)},${TIP_Y}`,
          `A${crPx},${crPx} 0 0 1 ${tx(-fR, s)},${ty(cornerRadius, s)}`,
        ].join(' ');
      }
      break;
    }

    case 'circle segment barrel':
    case 'circle segment oval':
      // Both handled by early returns above — fallback flat just in case
      tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`;
      break;

    case 'circle segment lens': {
      // Lens: parallel sides, gently curved convex tip — a large-radius arc (flatter than ball nose).
      // Default lens radius = fR * 3.5 (produces a visible but gentle arc).
      const lensR   = (geo.profileRadius && geo.profileRadius >= fR)
        ? geo.profileRadius
        : fR * 3.5;
      const sagitta = lensR - Math.sqrt(lensR * lensR - fR * fR);
      const lensRPx = r1(lensR * s);
      if (sagitta * s < 0.5) {
        tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`;
      } else {
        tip = [
          `L${tx(fR, s)},${ty(sagitta, s)}`,
          `A${lensRPx},${lensRPx} 0 0 1 ${tx(0, s)},${TIP_Y}`,
          `A${lensRPx},${lensRPx} 0 0 1 ${tx(-fR, s)},${ty(sagitta, s)}`,
        ].join(' ');
      }
      break;
    }

    case 'drill':
    case 'spot drill': {
      const tipR      = tipDiameter / 2;
      const rawConeH  = (fR - tipR) / Math.tan((taperAngle * Math.PI) / 180);
      // Enforce a minimum of 12 SVG pixels so the cone is always distinguishable
      // at any zoom level. This is a schematic view, not an engineering drawing.
      const coneH     = Math.max(rawConeH, 12 / s);
      tip = [
        `L${tx(fR, s)},${ty(coneH, s)}`,
        `L${tx(tipR, s)},${TIP_Y}`,
        ...(tipR > 0 ? [`L${tx(-tipR, s)},${TIP_Y}`] : []),
        `L${tx(-fR, s)},${ty(coneH, s)}`,
      ].join(' ');
      break;
    }

    case 'center drill': {
      // Two-stage: body → 60° countersink chamfer → pilot cylinder → 118° pilot tip
      const pilotR = (geo.tipDiameter ?? 0) > 0
        ? Math.min(geo.tipDiameter / 2, fR * 0.4)
        : fR * 0.22;
      const rawPilotConeH = pilotR / Math.tan(59 * Math.PI / 180);
      const pilotConeH    = Math.max(rawPilotConeH, 4 / s);
      const pilotCylH     = Math.max(FL * 0.28, 2 / s);
      const chamferEndY   = pilotCylH + pilotConeH;   // tool Y where chamfer ends
      tip = [
        // right side: preamble left us at (fR, FL)
        L(pilotR, chamferEndY, s),      // chamfer → pilot start
        L(pilotR, pilotConeH, s),       // pilot cylinder
        `L${tx(0, s)},${TIP_Y}`,        // pilot tip point (pointed)
        // left side
        L(-pilotR, pilotConeH, s),
        L(-pilotR, chamferEndY, s),
        L(-fR, FL, s),                  // back to left shoulder
      ].join(' ');
      break;
    }

    case 'counter bore': {
      // Flat face with pilot pin extending below
      const pilotR = (geo.tipDiameter ?? 0) > 0
        ? Math.min(geo.tipDiameter / 2, fR * 0.6)
        : fR * 0.3;
      const pilotH = Math.max(FL * 0.35, 5 / s);
      tip = [
        L(fR, pilotH, s),       // right face step down from shoulder to flat face
        L(pilotR, pilotH, s),   // step inward to pilot
        L(pilotR, 0, s),        // pilot right side to bottom
        L(-pilotR, 0, s),       // pilot flat tip
        L(-pilotR, pilotH, s),  // pilot left side back up
        L(-fR, pilotH, s),      // step back out to main diameter
        // close will add L(-fR, FL)
      ].join(' ');
      break;
    }

    case 'reamer': {
      // Flat tip with small 45° lead chamfer on outer edge
      const chamferW = fR * 0.1;
      const chamferH = chamferW;   // 45° → equal height and width
      tip = [
        L(fR, chamferH, s),
        L(fR - chamferW, 0, s),
        L(-(fR - chamferW), 0, s),
        L(-fR, chamferH, s),
      ].join(' ');
      break;
    }

    case 'chamfer mill':
    case 'engraving':
    case 'counter sink': {
      const tipR = tipDiameter / 2;
      tip = [
        `L${tx(tipR, s)},${TIP_Y}`,
        ...(tipR > 0 ? [`L${tx(-tipR, s)},${TIP_Y}`] : []),
        `L${tx(-fR, s)},${ty(FL, s)}`,  // back to left shoulder (dup in close, harmless)
      ].join(' ');
      break;
    }

    case 'tapered mill': {
      // tapered_ball: cornerRadius ≈ fR → full hemisphere at tip
      // tapered_bull_nose: cornerRadius > 0 and < fR → corner radius
      // tapered flat: cornerRadius = 0 → straight tip
      const cr = cornerRadius;
      const crPx = r1(Math.min(cr, fR) * s);
      if (crPx >= r1(fR * s) - 0.5) {
        // Ball tip (tapered_ball) — hemisphere of radius = fR at tip
        const rPx = r1(fR * s);
        tip = [
          `L${tx(fR, s)},${ty(fR, s)}`,
          `A${rPx},${rPx} 0 0 1 ${tx(0, s)},${TIP_Y}`,
          `A${rPx},${rPx} 0 0 1 ${tx(-fR, s)},${ty(fR, s)}`,
        ].join(' ');
      } else if (crPx >= 1) {
        // Bull-nose tip (tapered_bull_nose) — corner radius at the cutting edge
        const clampCR = Math.min(cr, fR);
        tip = [
          `L${tx(fR, s)},${ty(clampCR, s)}`,
          `A${crPx},${crPx} 0 0 1 ${tx(fR - clampCR, s)},${TIP_Y}`,
          `L${tx(-(fR - clampCR), s)},${TIP_Y}`,
          `A${crPx},${crPx} 0 0 1 ${tx(-fR, s)},${ty(clampCR, s)}`,
        ].join(' ');
      } else {
        // Flat tip (tapered flat)
        const tipR = tipDiameter / 2;
        tip = [
          `L${tx(tipR, s)},${TIP_Y}`,
          ...(tipR > 0 ? [`L${tx(-tipR, s)},${TIP_Y}`] : []),
          `L${tx(-fR, s)},${ty(FL, s)}`,
        ].join(' ');
      }
      break;
    }

    case 'thread mill': {
      const pitch  = geo.threadPitch;
      const nTeeth = geo.numberOfTeeth;
      const notchD = fR * 0.2;

      const teeth: { crestY: number; rootY: number }[] = [];
      for (let i = 0; i < nTeeth; i++) {
        const crestY = (i + 1) * pitch;
        const rootY  = i * pitch + pitch * 0.5;
        if (crestY > FL) break;
        teeth.push({ crestY, rootY });
      }

      const rightPts = teeth.slice().reverse().flatMap(({ crestY, rootY }) => [
        `L${tx(fR, s)},${ty(crestY, s)}`,
        `L${tx(fR - notchD, s)},${ty(rootY, s)}`,
      ]);
      const leftPts = teeth.flatMap(({ crestY, rootY }) => [
        `L${tx(-(fR - notchD), s)},${ty(rootY, s)}`,
        `L${tx(-fR, s)},${ty(crestY, s)}`,
      ]);

      tip = [
        ...rightPts,
        `L${tx(fR, s)},${TIP_Y}`,
        `L${tx(-fR, s)},${TIP_Y}`,
        ...leftPts,
      ].join(' ');
      break;
    }

    case 'tap right hand':
    case 'tap left hand': {
      // Like thread mill but with a lead chamfer on the bottom nChamfer teeth
      const pitch    = geo.threadPitch;
      const nFull    = Math.min(30, Math.max(1, Math.floor(FL / pitch)));
      const nChamfer = Math.min(3, nFull);   // first 3 teeth taper from small → full OD
      const notchD   = fR * 0.15;

      const teeth: { crestY: number; rootY: number; outerR: number }[] = [];
      for (let i = 0; i < nFull; i++) {
        const crestY = (i + 1) * pitch;
        const rootY  = i * pitch + pitch * 0.5;
        if (crestY > FL) break;
        // i=0 is lowest (first cutting) tooth; it has the smallest chamfered radius
        const outerR = i < nChamfer
          ? fR * (i + 1) / (nChamfer + 1)
          : fR;
        teeth.push({ crestY, rootY, outerR });
      }

      if (teeth.length === 0) {
        tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`;
        break;
      }

      // rightPts: reversed → highest tooth first (near FL), lowest tooth last (near tip)
      const rightPts = teeth.slice().reverse().flatMap(({ crestY, rootY, outerR }) => [
        `L${tx(outerR, s)},${ty(crestY, s)}`,
        `L${tx(Math.max(outerR - notchD, 0.1), s)},${ty(rootY, s)}`,
      ]);
      const leftPts = teeth.flatMap(({ crestY, rootY, outerR }) => [
        `L${tx(-Math.max(outerR - notchD, 0.1), s)},${ty(rootY, s)}`,
        `L${tx(-outerR, s)},${ty(crestY, s)}`,
      ]);

      // Bottom: flat tip at the smallest (first) tooth's outer radius
      const tipR = teeth[0].outerR;
      tip = [
        ...rightPts,
        `L${tx(tipR, s)},${TIP_Y}`,
        `L${tx(-tipR, s)},${TIP_Y}`,
        ...leftPts,
      ].join(' ');
      break;
    }

    case 'laser cutter': {
      // Fine orifice; two-step convergence from flange to nozzle body to orifice exit
      const orificeR = geo.nozzleDiameter !== undefined
        ? Math.min(geo.nozzleDiameter / 2, fR * 0.15)
        : fR * 0.06;
      const bodyR  = fR * 0.32;
      const body1Y = FL * 0.45;   // step in to nozzle body
      const body2Y = FL * 0.10;   // converge toward orifice
      tip = [
        L(fR * 0.65, FL * 0.2, s),   // outer convergence
        L(bodyR, body1Y, s),           // step in to nozzle body
        L(bodyR, body2Y, s),           // nozzle body
        L(orificeR, 0, s),             // fine orifice exit
        L(-orificeR, 0, s),
        L(-bodyR, body2Y, s),
        L(-bodyR, body1Y, s),
        L(-fR * 0.65, FL * 0.2, s),
        L(-fR, FL, s),
      ].join(' ');
      break;
    }

    case 'plasma cutter': {
      // Wider orifice; simple single-step convergence
      const orificeR = geo.nozzleDiameter !== undefined
        ? Math.min(geo.nozzleDiameter / 2, fR * 0.4)
        : fR * 0.2;
      tip = [
        L(fR * 0.6, FL * 0.2, s),
        L(orificeR, 0, s),
        L(-orificeR, 0, s),
        L(-fR * 0.6, FL * 0.2, s),
        L(-fR, FL, s),
      ].join(' ');
      break;
    }

    case 'waterjet': {
      // Converging nozzle with a straight mixing-tube section before the orifice
      const orificeR  = geo.nozzleDiameter !== undefined
        ? Math.min(geo.nozzleDiameter / 2, fR * 0.25)
        : fR * 0.12;
      const tubeR     = orificeR * 2.2;   // mixing tube wider than orifice
      const tubeTopY  = FL * 0.42;        // where outer body narrows to tube
      const tubeBotY  = FL * 0.08;        // tube exits to orifice
      tip = [
        L(fR * 0.6, FL * 0.2, s),         // outer convergence
        L(tubeR, tubeTopY, s),             // step in to mixing tube
        L(tubeR, tubeBotY, s),             // straight mixing tube
        L(orificeR, 0, s),                 // orifice exit
        L(-orificeR, 0, s),
        L(-tubeR, tubeBotY, s),
        L(-tubeR, tubeTopY, s),
        L(-fR * 0.6, FL * 0.2, s),
        L(-fR, FL, s),
      ].join(' ');
      break;
    }

    default: {
      // For user-defined custom type IDs, delegate to getProfileShape
      const shape = getProfileShape(type, customTypes);
      switch (shape) {
        case 'ball': {
          const rPx = r1(fR * s);
          tip = [
            `L${tx(fR, s)},${ty(fR, s)}`,
            `A${rPx},${rPx} 0 0 1 ${tx(0, s)},${TIP_Y}`,
            `A${rPx},${rPx} 0 0 1 ${tx(-fR, s)},${ty(fR, s)}`,
          ].join(' ');
          break;
        }
        case 'bull nose': {
          const crPx2 = r1(Math.min(cornerRadius, fR) * s);
          if (crPx2 < 1) {
            tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`;
          } else {
            tip = [
              `L${tx(fR, s)},${ty(cornerRadius, s)}`,
              `A${crPx2},${crPx2} 0 0 1 ${tx(fR - cornerRadius, s)},${TIP_Y}`,
              `L${tx(-(fR - cornerRadius), s)},${TIP_Y}`,
              `A${crPx2},${crPx2} 0 0 1 ${tx(-fR, s)},${ty(cornerRadius, s)}`,
            ].join(' ');
          }
          break;
        }
        case 'tapered ball': {
          const crPx2 = r1(Math.min(cornerRadius, fR) * s);
          if (crPx2 >= r1(fR * s) - 0.5) {
            const rPx2 = r1(fR * s);
            tip = [
              `L${tx(fR, s)},${ty(fR, s)}`,
              `A${rPx2},${rPx2} 0 0 1 ${tx(0, s)},${TIP_Y}`,
              `A${rPx2},${rPx2} 0 0 1 ${tx(-fR, s)},${ty(fR, s)}`,
            ].join(' ');
          } else {
            // No corner radius set → treat as plain ball
            const rPx2 = r1(fR * s);
            tip = [
              `L${tx(fR, s)},${ty(fR, s)}`,
              `A${rPx2},${rPx2} 0 0 1 ${tx(0, s)},${TIP_Y}`,
              `A${rPx2},${rPx2} 0 0 1 ${tx(-fR, s)},${ty(fR, s)}`,
            ].join(' ');
          }
          break;
        }
        case 'tapered bull nose': {
          const clampCR2 = Math.min(cornerRadius, fR);
          const crPx2 = r1(clampCR2 * s);
          if (crPx2 >= 1) {
            tip = [
              `L${tx(fR, s)},${ty(clampCR2, s)}`,
              `A${crPx2},${crPx2} 0 0 1 ${tx(fR - clampCR2, s)},${TIP_Y}`,
              `L${tx(-(fR - clampCR2), s)},${TIP_Y}`,
              `A${crPx2},${crPx2} 0 0 1 ${tx(-fR, s)},${ty(clampCR2, s)}`,
            ].join(' ');
          } else {
            tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`;
          }
          break;
        }
        case 'drill': {
          const tipR2 = tipDiameter / 2;
          const coneH2 = Math.max((fR - tipR2) / Math.tan((taperAngle * Math.PI) / 180), 12 / s);
          tip = [
            `L${tx(fR, s)},${ty(coneH2, s)}`,
            `L${tx(tipR2, s)},${TIP_Y}`,
            ...(tipR2 > 0 ? [`L${tx(-tipR2, s)},${TIP_Y}`] : []),
            `L${tx(-fR, s)},${ty(coneH2, s)}`,
          ].join(' ');
          break;
        }
        case 'tapered': {
          const tipR2 = tipDiameter / 2;
          tip = [
            `L${tx(tipR2, s)},${TIP_Y}`,
            ...(tipR2 > 0 ? [`L${tx(-tipR2, s)},${TIP_Y}`] : []),
            `L${tx(-fR, s)},${ty(FL, s)}`,
          ].join(' ');
          break;
        }
        case 'center drill': {
          const pilotR2 = tipDiameter > 0 ? Math.min(tipDiameter / 2, fR * 0.4) : fR * 0.22;
          const pcH2 = Math.max(pilotR2 / Math.tan(59 * Math.PI / 180), 4 / s);
          const pylH2 = Math.max(FL * 0.28, 2 / s);
          const chamY2 = pylH2 + pcH2;
          tip = [
            L(pilotR2, chamY2, s), L(pilotR2, pcH2, s),
            `L${tx(0, s)},${TIP_Y}`,
            L(-pilotR2, pcH2, s), L(-pilotR2, chamY2, s), L(-fR, FL, s),
          ].join(' ');
          break;
        }
        case 'counter bore': {
          const pilotR2 = tipDiameter > 0 ? Math.min(tipDiameter / 2, fR * 0.6) : fR * 0.3;
          const pH2 = Math.max(FL * 0.35, 5 / s);
          tip = [
            L(fR, pH2, s), L(pilotR2, pH2, s), L(pilotR2, 0, s),
            L(-pilotR2, 0, s), L(-pilotR2, pH2, s), L(-fR, pH2, s),
          ].join(' ');
          break;
        }
        case 'reamer': {
          const cw2 = fR * 0.1;
          tip = [
            L(fR, cw2, s), L(fR - cw2, 0, s),
            L(-(fR - cw2), 0, s), L(-fR, cw2, s),
          ].join(' ');
          break;
        }
        case 'tap': {
          const pitch2 = geo.threadPitch;
          const nFull2 = Math.min(30, Math.max(1, Math.floor(FL / pitch2)));
          const nCh2 = Math.min(3, nFull2);
          const nd2 = fR * 0.15;
          const teeth2: { crestY: number; rootY: number; outerR: number }[] = [];
          for (let i = 0; i < nFull2; i++) {
            const crestY = (i + 1) * pitch2;
            if (crestY > FL) break;
            teeth2.push({
              crestY,
              rootY: i * pitch2 + pitch2 * 0.5,
              outerR: i < nCh2 ? fR * (i + 1) / (nCh2 + 1) : fR,
            });
          }
          if (teeth2.length === 0) { tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`; break; }
          const tipR2 = teeth2[0].outerR;
          tip = [
            ...teeth2.slice().reverse().flatMap(({ crestY, rootY, outerR }) => [
              `L${tx(outerR, s)},${ty(crestY, s)}`,
              `L${tx(Math.max(outerR - nd2, 0.1), s)},${ty(rootY, s)}`,
            ]),
            `L${tx(tipR2, s)},${TIP_Y}`, `L${tx(-tipR2, s)},${TIP_Y}`,
            ...teeth2.flatMap(({ crestY, rootY, outerR }) => [
              `L${tx(-Math.max(outerR - nd2, 0.1), s)},${ty(rootY, s)}`,
              `L${tx(-outerR, s)},${ty(crestY, s)}`,
            ]),
          ].join(' ');
          break;
        }
        case 'thread mill': {
          const pitch2 = geo.threadPitch;
          const nTeeth2 = geo.numberOfTeeth;
          const nd2 = fR * 0.2;
          const teeth2: { crestY: number; rootY: number }[] = [];
          for (let i = 0; i < nTeeth2; i++) {
            const crestY = (i + 1) * pitch2;
            if (crestY > FL) break;
            teeth2.push({ crestY, rootY: i * pitch2 + pitch2 * 0.5 });
          }
          tip = [
            ...teeth2.slice().reverse().flatMap(({ crestY, rootY }) => [
              `L${tx(fR, s)},${ty(crestY, s)}`,
              `L${tx(fR - nd2, s)},${ty(rootY, s)}`,
            ]),
            `L${tx(fR, s)},${TIP_Y}`, `L${tx(-fR, s)},${TIP_Y}`,
            ...teeth2.flatMap(({ crestY, rootY }) => [
              `L${tx(-(fR - nd2), s)},${ty(rootY, s)}`,
              `L${tx(-fR, s)},${ty(crestY, s)}`,
            ]),
          ].join(' ');
          break;
        }
        default:
          tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`;
      }
    }
  }

  return `${preamble} ${tip} ${close}`;
}

// ── Flute helical curves (one sinusoidal path per flute) ──────────────────────

interface FluteLinesProps {
  numberOfFlutes: number;
  fRpx:     number;   // flute zone half-width in px
  flzTop:   number;   // SVG y of flute-zone top
  flzBot:   number;   // SVG y of flute-zone bottom (= TIP_Y)
}

function FluteLines({ numberOfFlutes, fRpx, flzTop, flzBot }: FluteLinesProps) {
  const fzH = flzBot - flzTop;
  if (fzH < 8 || numberOfFlutes < 1) return null;

  // Number of helix cycles visible in the flute zone (more = tighter helix)
  const cycles = Math.max(1, Math.min(3, fzH / 40));

  /**
   * Split one helix into a front (cos ≥ 0) and back (cos < 0) SVG path.
   * Front flutes are on the near side of the cylinder (visible).
   * Back flutes are occluded by the tool body (shown faintly).
   */
  function buildHelixSegments(phaseOffset: number): { front: string; back: string } {
    const steps = 120;
    const frontSegs: string[] = [];
    const backSegs:  string[] = [];
    let curPts:   string[]      = [];
    let curFront: boolean | null = null;

    for (let i = 0; i <= steps; i++) {
      const t     = i / steps;
      const angle = 2 * Math.PI * cycles * t + phaseOffset;
      const isFront = Math.cos(angle) >= 0;
      const x = r1(CX + fRpx * Math.sin(angle));
      const y = r1(flzTop + t * fzH);

      if (curFront === null) {
        curPts   = [`M${x},${y}`];
        curFront = isFront;
      } else if (isFront !== curFront) {
        // Visibility flipped — close segment at the crossover point then start new
        curPts.push(`L${x},${y}`);
        (curFront ? frontSegs : backSegs).push(curPts.join(' '));
        curPts   = [`M${x},${y}`];
        curFront = isFront;
      } else {
        curPts.push(`L${x},${y}`);
      }
    }
    if (curPts.length > 1) (curFront! ? frontSegs : backSegs).push(curPts.join(' '));

    return { front: frontSegs.join(' '), back: backSegs.join(' ') };
  }

  return (
    <>
      {Array.from({ length: numberOfFlutes }, (_, i) => {
        const phase = (2 * Math.PI * i) / numberOfFlutes;
        const { front, back } = buildHelixSegments(phase);
        return (
          <g key={i}>
            {/* Back side — occluded by tool body, very faint dashed */}
            {back && (
              <path d={back}  fill="none" stroke="#f59e0b"
                strokeWidth="0.7" strokeOpacity="0.12"
                strokeDasharray="2,3" strokeLinecap="round" />
            )}
            {/* Front side — visible, solid */}
            {front && (
              <path d={front} fill="none" stroke="#fbbf24"
                strokeWidth="1.1" strokeOpacity="0.58" strokeLinecap="round" />
            )}
          </g>
        );
      })}
    </>
  );
}

// ── Static illustrations for non-geometric cutting tools ──────────────────────

function StaticCutterSVG({
  type,
  zoom,
  unit,
  nozzleDiameter,
  autoHeight = false,
}: {
  type: 'laser cutter' | 'plasma cutter' | 'waterjet';
  zoom: number;
  unit: string;
  nozzleDiameter?: number;
  autoHeight?: boolean;
}) {
  const vbH = 185;
  const svgH = Math.round(vbH * zoom);
  const vbW = r1(480 / zoom);
  const vbX = r1(CX - vbW / 2);
  const viewBoxAttr = `${vbX} 0 ${vbW} ${vbH}`;

  const ndLabel = nozzleDiameter != null ? `  ·  Ø${nozzleDiameter} ${unit}` : '';
  const label = type === 'laser cutter' ? 'Laser Cutter'
    : type === 'plasma cutter' ? 'Plasma Cutter'
    : 'Waterjet';

  return (
    <svg viewBox={viewBoxAttr} width="100%" height={autoHeight ? undefined : svgH} className="block"
         aria-label={`${label} tool profile`}>
      <rect x={vbX} y={0} width={vbW} height={185} fill="#0f172a" />
      <text x={vbX + 4} y={10} fontSize={10} fill="#475569"
            fontFamily="ui-monospace, monospace" textAnchor="start" dominantBaseline="hanging">
        {unit}
      </text>
      <line x1={CX} y1={10} x2={CX} y2={130}
            stroke="#1e293b" strokeWidth={0.8} strokeDasharray="3,3" />

      {/* ── Plasma cutter ─────────────────────────────────────────────── */}
      {type === 'plasma cutter' && (
        <g>
          {/* Ribbed body */}
          <rect x={212} y={15} width={56} height={33} rx={2}
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} />
          <line x1={212} y1={24} x2={268} y2={24} stroke="#7bafc8" strokeWidth={1} strokeOpacity={0.55} />
          <line x1={212} y1={31} x2={268} y2={31} stroke="#7bafc8" strokeWidth={1} strokeOpacity={0.55} />
          <line x1={212} y1={38} x2={268} y2={38} stroke="#7bafc8" strokeWidth={1} strokeOpacity={0.55} />
          {/* Body → nozzle housing taper */}
          <path d="M212,48 L224,67 L256,67 L268,48 Z"
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} strokeLinejoin="round" />
          {/* Electrode nozzle housing */}
          <rect x={224} y={67} width={32} height={20} rx={1}
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} />
          {/* Nozzle housing → tip taper */}
          <path d="M224,87 L233,101 L247,101 L256,87 Z"
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} strokeLinejoin="round" />
          {/* Diamond pointed tip */}
          <path d="M233,101 L240,119 L247,101 Z"
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} strokeLinejoin="round" />
          {/* Arc sparks */}
          <line x1={234} y1={123} x2={226} y2={133} stroke="#f59e0b" strokeWidth={1.5} strokeOpacity={0.85} />
          <line x1={240} y1={122} x2={240} y2={133} stroke="#f59e0b" strokeWidth={1.5} strokeOpacity={0.85} />
          <line x1={246} y1={123} x2={254} y2={133} stroke="#f59e0b" strokeWidth={1.5} strokeOpacity={0.85} />
        </g>
      )}

      {/* ── Laser cutter ──────────────────────────────────────────────── */}
      {type === 'laser cutter' && (
        <g>
          {/* Head body */}
          <rect x={210} y={15} width={60} height={34} rx={3}
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} />
          {/* Lens — outer ring */}
          <circle cx={CX} cy={32} r={12} fill="#0f172a" stroke="#60a5fa" strokeWidth={1.5} />
          {/* Lens — inner focus spot */}
          <circle cx={CX} cy={32} r={6} fill="#1e3a5f" stroke="#93c5fd" strokeWidth={1} fillOpacity={0.8} />
          {/* Lens cross-hairs */}
          <line x1={228} y1={32} x2={252} y2={32} stroke="#60a5fa" strokeWidth={0.6} strokeOpacity={0.4} />
          <line x1={CX}  y1={20} x2={CX}  y2={44} stroke="#60a5fa" strokeWidth={0.6} strokeOpacity={0.4} />
          {/* Convergent nozzle cone */}
          <path d="M210,49 L231,76 L249,76 L270,49 Z"
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} strokeLinejoin="round" />
          {/* Nozzle tip cylinder */}
          <rect x={235} y={76} width={10} height={14} rx={1}
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} />
          {/* Laser beam — red dashed */}
          <line x1={CX} y1={90} x2={CX} y2={122}
                stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3,2" strokeOpacity={0.9} />
          {/* Spark rays */}
          <line x1={CX - 1} y1={120} x2={CX - 13} y2={133} stroke="#fbbf24" strokeWidth={1.5} strokeOpacity={0.9} />
          <line x1={CX + 1} y1={120} x2={CX + 13} y2={133} stroke="#fbbf24" strokeWidth={1.5} strokeOpacity={0.9} />
          <line x1={CX}     y1={121} x2={CX - 8}  y2={133} stroke="#fbbf24" strokeWidth={1}   strokeOpacity={0.5} />
          <line x1={CX}     y1={121} x2={CX + 8}  y2={133} stroke="#fbbf24" strokeWidth={1}   strokeOpacity={0.5} />
          <line x1={CX}     y1={123} x2={CX}       y2={134} stroke="#fbbf24" strokeWidth={1}   strokeOpacity={0.4} />
        </g>
      )}

      {/* ── Waterjet ──────────────────────────────────────────────────── */}
      {type === 'waterjet' && (
        <g>
          {/* Main head body */}
          <rect x={218} y={15} width={44} height={27} rx={3}
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} />
          {/* Side water-supply inlet (left) */}
          <rect x={193} y={21} width={25} height={10} rx={2}
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.2} />
          {/* Water drop symbol (right) */}
          <path d={`M${CX + 26},12 C${CX + 24},16 ${CX + 21},19 ${CX + 21},22 A5,5 0 0 0 ${CX + 31},22 C${CX + 31},19 ${CX + 28},16 ${CX + 26},12 Z`}
                fill="#38bdf8" fillOpacity={0.65} stroke="#38bdf8" strokeWidth={0.8} />
          {/* Body → mixing chamber taper */}
          <path d="M218,42 L229,58 L251,58 L262,42 Z"
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} strokeLinejoin="round" />
          {/* Mixing tube — long narrow characteristic section */}
          <rect x={233} y={58} width={14} height={40} rx={1}
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.5} />
          {/* Orifice taper */}
          <path d="M233,98 L237,108 L243,108 L247,98 Z"
                fill="#1c2e3e" stroke="#7bafc8" strokeWidth={1.2} strokeLinejoin="round" />
          {/* Water jet stream */}
          <line x1={CX}     y1={108} x2={CX}     y2={130} stroke="#38bdf8" strokeWidth={2.5} strokeOpacity={0.85} />
          <line x1={CX - 1} y1={108} x2={CX - 1} y2={130} stroke="#7dd3fc" strokeWidth={0.8} strokeOpacity={0.3} />
          <line x1={CX + 1} y1={108} x2={CX + 1} y2={130} stroke="#7dd3fc" strokeWidth={0.8} strokeOpacity={0.3} />
        </g>
      )}

      {/* Label */}
      <text x={CX} y={178} fontSize={11} fontWeight={600} fill="#64748b"
            fontFamily="ui-sans-serif, sans-serif" textAnchor="middle">
        {label}{ndLabel}
      </text>
    </svg>
  );
}

// ── Dimension annotation helpers ──────────────────────────────────────────────

function Arrowhead({ x, y, dir }: { x: number; y: number; dir: 'up' | 'down' | 'left' | 'right' }) {
  let pts = '';
  switch (dir) {
    case 'up':    pts = `${x},${y} ${x-4},${y+9} ${x+4},${y+9}`; break;
    case 'down':  pts = `${x},${y} ${x-4},${y-9} ${x+4},${y-9}`; break;
    case 'left':  pts = `${x},${y} ${x+9},${y-4} ${x+9},${y+4}`; break;
    case 'right': pts = `${x},${y} ${x-9},${y-4} ${x-9},${y+4}`; break;
  }
  return <polygon points={pts} fill="#94a3b8" />;
}

function VertDimLine({
  x, y1, y2, label, extLeft,
}: {
  x: number; y1: number; y2: number; label: string; extLeft: number;
}) {
  if (Math.abs(y2 - y1) < 18) return null;
  const midY = r1((y1 + y2) / 2);

  return (
    <g>
      <line x1={extLeft} y1={y1} x2={x - 3} y2={y1} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3,2" />
      <line x1={extLeft} y1={y2} x2={x - 3} y2={y2} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3,2" />
      <line x1={x} y1={r1(y1 + 9)} x2={x} y2={r1(y2 - 9)} stroke="#94a3b8" strokeWidth="1.2" />
      <Arrowhead x={x} y={y1} dir="up" />
      <Arrowhead x={x} y={y2} dir="down" />
      <text
        x={r1(x - 11)}
        y={midY}
        fontSize="10"
        fontWeight="bold"
        fill="#cbd5e1"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        transform={`rotate(-90 ${r1(x - 11)} ${midY})`}
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  );
}

function HorizDimLine({
  y, x1, x2, label, tickFromY,
}: {
  y: number; x1: number; x2: number; label: string; tickFromY: number;
}) {
  const midX = r1((x1 + x2) / 2);
  // If tool is very narrow, extend the line to give room for the label
  const lineX1 = Math.min(x1, midX - 50);
  const lineX2 = Math.max(x2, midX + 50);

  return (
    <g>
      <line x1={x1} y1={tickFromY} x2={x1} y2={r1(y - 3)} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3,2" />
      <line x1={x2} y1={tickFromY} x2={x2} y2={r1(y - 3)} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3,2" />
      <line x1={r1(lineX1 + 9)} y1={y} x2={r1(lineX2 - 9)} y2={y} stroke="#94a3b8" strokeWidth="1.2" />
      <Arrowhead x={x1} y={y} dir="right" />
      <Arrowhead x={x2} y={y} dir="left" />
      <text
        x={midX}
        y={r1(y + 11)}
        fontSize="10"
        fontWeight="bold"
        fill="#cbd5e1"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ToolProfileSVG({
  draft,
  zoom = 1,
  allHolders = [],
  autoHeight = false,
  fillContainer = false,
  hideUnitLabel = false,
}: {
  draft:            LibraryTool;
  zoom?:            number;
  allHolders?:      ToolHolder[];
  autoHeight?:      boolean;
  /** When true, render height="100%" so the SVG fills its parent div exactly. */
  fillContainer?:   boolean;
  /** When true, suppress the in-SVG unit badge (use when the caller renders its own overlay). */
  hideUnitLabel?:   boolean;
}) {
  const { settings } = useSettings();
  const clipId     = useId();
  const dec        = settings.tableDecimalPrecision;
  const unit       = draft.unit;
  const customTypes = settings.customToolTypes;

  // Static illustration for non-geometric cutting tools — return early after hooks
  if (draft.type === 'laser cutter' || draft.type === 'plasma cutter' || draft.type === 'waterjet') {
    return (
      <StaticCutterSVG
        type={draft.type as 'laser cutter' | 'plasma cutter' | 'waterjet'}
        zoom={zoom}
        unit={unit}
        nozzleDiameter={draft.geometry.nozzleDiameter}
        autoHeight={autoHeight}
      />
    );
  }

  // Format a number: round to `dec` places but strip trailing zeros so the
  // result matches what the user typed in the editor (e.g. 6 → "6", not "6.000")
  const fmt = (n: number) => parseFloat(n.toFixed(dec)).toString();

  // Resolve holder data
  const holder     = allHolders.find((h) => h.id === draft.holderId) ?? null;
  const stickOut   = draft.assemblyStickOut;
  const showHolder = holder !== null && stickOut != null && stickOut >= 0;

  // Holder barrel radius in mm (schematic — proportional to shank)
  const resolved = resolveGeometry(draft.type, draft.geometry);
  const holderBarrelMm = showHolder
    ? Math.max(resolved.shaftDiameter * 1.8, (holder!.colletDiameterMax ?? resolved.shaftDiameter * 1.5) * 1.2, 6)
    : 0;

  // Full assembly height (tip to holder spindle face) used for rescaling
  const assemblyTotalH = showHolder ? stickOut! + holder!.gaugeLength : undefined;

  // Zoom is achieved by:
  //   - Keeping viewBox height fixed at 185 (so the full tool stays visible vertically)
  //   - Narrowing viewBox width by 1/zoom, centred on CX=240 (content scales up by zoom)
  //   - Growing the SVG height attribute proportionally so layout space matches
  const vbH  = 185;
  const svgH = Math.round(vbH * zoom);
  const vbW  = r1(480 / zoom);
  const vbX  = r1(CX - vbW / 2);
  const viewBoxAttr = `${vbX} 0 ${vbW} ${vbH}`;

  const scale = computeScale(resolved, assemblyTotalH, holderBarrelMm / 2);

  if (!isFinite(scale) || Math.max(resolved.diameter, resolved.shaftDiameter) * scale < 3) {
    return (
      <svg viewBox={viewBoxAttr} width="100%" height={svgH} className="block">
        <rect x={vbX} y="0" width={vbW} height="185" fill="#0f172a" />
        <text x="240" y="85" textAnchor="middle" fontSize="11" fill="#475569" fontFamily="sans-serif">
          No preview
        </text>
      </svg>
    );
  }

  const profileD = buildProfilePath(draft.type, resolved, scale, customTypes);

  // ── Annotation geometry ────────────────────────────────────────────────────

  const fRpx   = r1(resolved.diameter / 2 * scale);
  const sRpx   = r1(resolved.shaftDiameter / 2 * scale);
  const maxRpx = Math.max(fRpx, sRpx);

  const oalY1    = ty(resolved.overallLength, scale);
  const oalLabel = `OAL ${fmt(resolved.overallLength)} ${unit}`;

  const showFL  = draft.geometry.fluteLength !== undefined;
  const flY1    = ty(resolved.fluteLength, scale);
  const flArrH  = TIP_Y - flY1;
  const flLabel = `Flute ${fmt(resolved.fluteLength)} ${unit}`;

  // Body line y — bodyLength is distance from tip to shank face (top of taper).
  const rawBodyLen = resolved.bodyLength;
  const showBody   = rawBodyLen !== undefined && rawBodyLen > (resolved.shoulderLength ?? resolved.fluteLength);
  const blY1       = showBody ? ty(rawBodyLen!, scale) : null;
  const blLabel    = showBody ? `Body ${fmt(rawBodyLen!)} ${unit}` : '';

  // Shoulder boundary — shoulderLength is distance from tip to bottom of taper.
  // A shoulder zone (non-fluted relief) exists when shoulderLength > fluteLength.
  const slY1    = (resolved.shoulderLength !== undefined && resolved.shoulderLength > resolved.fluteLength)
    ? ty(resolved.shoulderLength, scale)
    : null;
  const shLabel = resolved.shoulderLength !== undefined ? `Shldr ${fmt(resolved.shoulderLength)} ${unit}` : '';

  // ── Holder geometry (computed early so barrel width can inform extX) ──────────
  const holderEntryY   = showHolder ? ty(stickOut!, scale) : null;
  const holderTopY     = showHolder ? ty(stickOut! + holder!.gaugeLength, scale) : null;
  const holderBarrelPx = showHolder ? r1(holderBarrelMm / 2 * scale) : 0;
  const holderShankPx  = showHolder ? r1(resolved.shaftDiameter / 2 * scale) : 0;
  const holderPath     = showHolder
    ? buildHolderPath(holderEntryY!, holderTopY!, holderShankPx, holderBarrelPx)
    : null;

  // Right/left profile edges including holder barrel
  const rightEdgePx = Math.max(maxRpx, holderBarrelPx);
  const extX     = CX + rightEdgePx + 4;
  const leftExtX = CX - maxRpx - 4;

  // Dim lines sit close to the tool — offset from the profile edge, not the SVG edge.
  // When two annotations share a side they're spaced 28 px apart; the shorter span
  // goes in the inner slot (closer to the tool) and the longer span in the outer slot.
  const DIM_STEP = 20;
  // Right side: BL inner, OAL outer (OAL pushed out only when BL is also visible)
  const oalAnnX  = r1(extX + (showBody ? DIM_STEP * 2 : DIM_STEP));
  const blAnnX   = r1(extX + DIM_STEP);
  // Left side: shoulder inner, FL outer (FL pushed out only when shoulder is also visible)
  const showShoulder = showBody && slY1 !== null;
  const flAnnX   = r1(leftExtX - (showShoulder ? DIM_STEP * 2 : DIM_STEP));
  const shAnnX   = r1(leftExtX - DIM_STEP);

  // Diameter line sits in the annotation zone below the profile
  const diamY     = 148;
  const diamLabel = `Ø ${fmt(resolved.diameter)} ${unit}`;

  // Flute zone bounds for hatch marks
  const flzTop = ty(resolved.fluteLength, scale);

  // Coolant indicator
  const coolantCY = ty(resolved.overallLength * 0.65, scale);
  const coolantR  = Math.max(1.5, r1(resolved.shaftDiameter * scale * 0.12));

  // Stick-out annotation (right side, inner slot when OAL also shown)
  const showSO  = showHolder && stickOut! > 0;
  const soAnnX  = r1(extX + (showBody ? DIM_STEP * 3 : DIM_STEP * 2));
  const soLabel = showSO ? `SO ${fmt(stickOut!)} ${unit}` : '';

  // Gauge-length annotation (right side, outermost slot)
  const glAnnX  = r1(extX + (showBody ? DIM_STEP * 4 : DIM_STEP * 3));
  const glLabel = showHolder ? `GL ${fmt(holder!.gaugeLength)} mm` : '';

  return (
    <svg
      viewBox={viewBoxAttr}
      width="100%"
      height={fillContainer ? '100%' : autoHeight ? undefined : svgH}
      className="block"
      aria-label={`${draft.type} profile`}
    >
      <defs>
        {/* Clip flute hatch marks to the profile shape */}
        <clipPath id={clipId}>
          <path d={profileD} />
        </clipPath>
      </defs>

      {/* Background */}
      <rect width="480" height="185" fill="#0f172a" />

      {/* Unit badge — omitted when the caller renders its own HTML overlay */}
      {!hideUnitLabel && (
        <text
          x={vbX + 4} y="10"
          fontSize="10"
          fill="#475569"
          fontFamily="ui-monospace, monospace"
          textAnchor="start"
          dominantBaseline="hanging"
        >
          {unit}
        </text>
      )}

      {/* Centre axis guide */}
      <line x1="240" y1="10" x2="240" y2="130"
            stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,3" />

      {/* Holder body — drawn behind the tool */}
      {holderPath && (
        <>
          <path d={holderPath} fill="#0e2233" />
          <path d={holderPath} fill="none" stroke="#3b6e8f" strokeWidth="1.2" strokeLinejoin="round" />
          {/* Bore channel — shows the cavity the tool sits in */}
          <line
            x1={r1(CX - holderShankPx)} y1={r1(holderEntryY!)}
            x2={r1(CX - holderShankPx)} y2={r1(holderTopY! + (holderEntryY! - holderTopY!) * 0.22)}
            stroke="#3b6e8f" strokeWidth="0.6" strokeOpacity="0.5" strokeDasharray="2,2"
          />
          <line
            x1={r1(CX + holderShankPx)} y1={r1(holderEntryY!)}
            x2={r1(CX + holderShankPx)} y2={r1(holderTopY! + (holderEntryY! - holderTopY!) * 0.22)}
            stroke="#3b6e8f" strokeWidth="0.6" strokeOpacity="0.5" strokeDasharray="2,2"
          />
          {/* Collet face / entry depth line */}
          <line
            x1={r1(CX - holderBarrelPx)} y1={r1(holderEntryY!)}
            x2={r1(CX + holderBarrelPx)} y2={r1(holderEntryY!)}
            stroke="#60a5fa" strokeWidth="0.7" strokeOpacity="0.6" strokeDasharray="3,2"
          />
        </>
      )}

      {/* Profile fill — dark gunmetal steel */}
      <path d={profileD} fill="#1c2e3e" />

      {/* Shoulder zone — violet tint between shoulderLength and fluteLength (non-fluted relief) */}
      {slY1 !== null && (
        <g clipPath={`url(#${clipId})`}>
          <rect
            x={r1(CX - maxRpx - 2)} y={slY1}
            width={r1((maxRpx + 2) * 2)} height={r1(flzTop - slY1)}
            fill="#7c3aed" fillOpacity="0.18"
          />
        </g>
      )}

      {/* Flute hatch marks — clipped to profile, only in flute zone */}
      {resolved.numberOfFlutes !== undefined && (
        <g clipPath={`url(#${clipId})`}>
          <FluteLines
            numberOfFlutes={resolved.numberOfFlutes}
            fRpx={fRpx}
            flzTop={flzTop}
            flzBot={TIP_Y}
          />
        </g>
      )}

      {/* Coolant channel indicator */}
      {resolved.coolantSupport && (
        <circle
          cx={CX} cy={coolantCY} r={coolantR}
          fill="none" stroke="#22d3ee"
          strokeWidth="0.9" strokeDasharray="1.5,1.5"
        />
      )}

      {/* Profile stroke — muted steel edge */}
      <path d={profileD} fill="none" stroke="#7bafc8" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Flute boundary line — amber, top of cutting zone */}
      {Math.abs(flzTop - oalY1) > 6 && (
        <line
          x1={r1(CX - maxRpx)} y1={flzTop}
          x2={r1(CX + maxRpx)} y2={flzTop}
          stroke="#f59e0b" strokeWidth="0.7" strokeOpacity="0.45" strokeDasharray="4,3"
        />
      )}

      {/* Body boundary line — violet, top of shoulder zone */}
      {showBody && Math.abs(blY1! - oalY1) > 4 && (
        <line
          x1={r1(CX - maxRpx)} y1={blY1!}
          x2={r1(CX + maxRpx)} y2={blY1!}
          stroke="#a78bfa" strokeWidth="0.7" strokeOpacity="0.55" strokeDasharray="4,3"
        />
      )}

      {/* Diameter annotation */}
      <HorizDimLine
        y={diamY}
        x1={CX - fRpx}
        x2={CX + fRpx}
        label={diamLabel}
        tickFromY={TIP_Y}
      />

      {/* Overall length annotation — right side outer slot */}
      <VertDimLine
        x={oalAnnX}
        y1={oalY1}
        y2={TIP_Y}
        label={oalLabel}
        extLeft={extX}
      />

      {/* Body length annotation — right side inner slot */}
      {showBody && (TIP_Y - blY1!) >= 18 && (
        <VertDimLine
          x={blAnnX}
          y1={blY1!}
          y2={TIP_Y}
          label={blLabel}
          extLeft={extX}
        />
      )}

      {/* Flute length annotation — left side outer slot */}
      {showFL && flArrH >= 18 && (
        <VertDimLine
          x={flAnnX}
          y1={flY1}
          y2={TIP_Y}
          label={flLabel}
          extLeft={leftExtX}
        />
      )}

      {/* Shoulder annotation — left side inner slot (shoulderLength = distance from tip) */}
      {showShoulder && slY1 !== null && (TIP_Y - slY1) >= 18 && (
        <VertDimLine
          x={shAnnX}
          y1={slY1}
          y2={TIP_Y}
          label={shLabel}
          extLeft={leftExtX}
        />
      )}

      {/* Stick-out annotation (right side) */}
      {showSO && (TIP_Y - holderEntryY!) >= 18 && (
        <VertDimLine
          x={soAnnX}
          y1={holderEntryY!}
          y2={TIP_Y}
          label={soLabel}
          extLeft={extX}
        />
      )}

      {/* Gauge-length annotation (right side, outermost) */}
      {showHolder && (holderEntryY! - holderTopY!) >= 18 && (
        <VertDimLine
          x={glAnnX}
          y1={holderTopY!}
          y2={holderEntryY!}
          label={glLabel}
          extLeft={extX}
        />
      )}

      {/* Holder name badge (only if room above the spindle face) */}
      {showHolder && holderTopY! > 14 && (
        <text
          x={r1(CX)} y={r1(holderTopY! - 4)}
          fontSize="10" fontWeight="500"
          fill="#60a5fa" fillOpacity="0.8"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          dominantBaseline="auto"
        >
          {holder!.name}
        </text>
      )}

      {/* Tool type label — centred */}
      <text x={CX} y="178" fontSize="9" fontWeight="600" fill="#64748b" fontFamily="ui-sans-serif, sans-serif" textAnchor="middle">
        {getTypeLabel(draft.type, customTypes)}
        {resolved.numberOfFlutes ? `  ·  ${resolved.numberOfFlutes} flutes` : ''}
      </text>
    </svg>
  );
}
