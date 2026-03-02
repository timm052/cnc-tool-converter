/**
 * ToolProfileSVG — Live 2D side-profile preview for the ToolEditor slide-over.
 *
 * SVG layout (480 × 170):
 *   │ Left annot 90px │ Profile 300px (cx=240) │ Right annot 90px │
 *   Shank top: y=12   Tip: y=128   Annotation zone: y=130–168
 *
 * Tool is drawn tip-down (machinist convention), symmetrically about cx=240.
 */

import type { LibraryTool } from '../../types/libraryTool';
import type { ToolType, ToolGeometry } from '../../types/tool';
import { useSettings } from '../../contexts/SettingsContext';

// ── Resolved geometry ─────────────────────────────────────────────────────────

interface ResolvedGeometry {
  diameter:        number;
  shaftDiameter:   number;
  overallLength:   number;
  fluteLength:     number;
  cornerRadius:    number;
  taperAngle:      number;   // half-angle from axis, degrees
  tipDiameter:     number;
  threadPitch:     number;
  numberOfTeeth:   number;
  numberOfFlutes?: number;   // undefined = not set → no hatch marks
  coolantSupport:  boolean;
}

function defaultTaperAngle(type: ToolType): number {
  switch (type) {
    case 'drill':        return 59;
    case 'spot drill':   return 45;
    case 'chamfer mill': return 45;
    case 'tapered mill': return 5;
    case 'engraving':    return 15;
    default:             return 30;
  }
}

function resolveGeometry(type: ToolType, geo: ToolGeometry): ResolvedGeometry {
  const d  = geo.diameter || 6;
  const sd = geo.shaftDiameter ?? d;
  const ol = type === 'face mill'
    ? (geo.overallLength ?? d * 0.8)
    : (geo.overallLength ?? d * 5);
  const fl = geo.fluteLength ?? ol * 0.4;
  const cr = Math.min(geo.cornerRadius ?? 0, d / 2 - 0.001);
  const ta = Math.max(1, Math.min(89, geo.taperAngle ?? defaultTaperAngle(type)));
  const td = geo.tipDiameter ?? 0;
  const tp = geo.threadPitch ?? d * 0.15;
  const nt = geo.numberOfTeeth ?? Math.min(20, Math.max(1, Math.floor(fl / tp)));

  return {
    diameter:        d,
    shaftDiameter:   sd,
    overallLength:   ol,
    fluteLength:     fl,
    cornerRadius:    cr,
    taperAngle:      ta,
    tipDiameter:     td,
    threadPitch:     tp,
    numberOfTeeth:   nt,
    numberOfFlutes:  geo.numberOfFlutes,   // pass through; undefined = no marks
    coolantSupport:  geo.coolantSupport ?? false,
  };
}

// ── Layout constants ──────────────────────────────────────────────────────────

const AVAIL_H = 116;   // tipY(128) − shankTopY(12)
const AVAIL_W = 300;   // profile zone width
const CX      = 240;   // profile centre x
const TIP_Y   = 128;   // SVG y of tool tip

// ── Scale ─────────────────────────────────────────────────────────────────────

function computeScale(geo: ResolvedGeometry): number {
  const maxR = Math.max(geo.diameter, geo.shaftDiameter) / 2;
  const s = Math.min(
    AVAIL_H / geo.overallLength,
    (AVAIL_W / 2) / maxR,
  );
  return Math.max(0.5, Math.min(s, 30));
}

// ── Coordinate transform ──────────────────────────────────────────────────────

function r1(n: number): number { return Math.round(n * 10) / 10; }

function tx(toolX: number, scale: number): number { return r1(CX + toolX * scale); }
function ty(toolY: number, scale: number): number { return r1(TIP_Y - toolY * scale); }

function L(toolX: number, toolY: number, s: number): string {
  return `L${tx(toolX, s)},${ty(toolY, s)}`;
}

// ── Profile path builder ──────────────────────────────────────────────────────

function buildProfilePath(type: ToolType, geo: ResolvedGeometry, s: number): string {
  const { diameter, shaftDiameter, overallLength, fluteLength,
          cornerRadius, taperAngle, tipDiameter } = geo;

  const fR = diameter / 2;
  const sR = shaftDiameter / 2;
  const FL = fluteLength;
  const OL = overallLength;

  const shoulderTS = FL;   // tool-space Y where shank meets flute zone

  // Shared preamble: top-centre → down right shank → shoulder step (either direction)
  const preamble = [
    `M${tx(0, s)},${ty(OL, s)}`,            // top centre
    `L${tx(sR, s)},${ty(OL, s)}`,           // top-right shank
    `L${tx(sR, s)},${ty(shoulderTS, s)}`,   // down right shank
    // Step to flute radius regardless of direction (in OR out)
    ...(sR !== fR ? [`L${tx(fR, s)},${ty(shoulderTS, s)}`] : []),
  ].join(' ');

  // Shared close: left flute top → step back to shank → up left shank → top-centre
  const close = [
    `L${tx(-fR, s)},${ty(shoulderTS, s)}`,   // left flute top
    ...(sR !== fR ? [`L${tx(-sR, s)},${ty(shoulderTS, s)}`] : []),
    `L${tx(-sR, s)},${ty(OL, s)}`,           // up left shank
    'Z',
  ].join(' ');

  let tip = '';

  switch (type) {

    case 'flat end mill':
    case 'face mill':
    case 'boring bar':
    case 'custom':
      tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`;
      break;

    case 'ball end mill': {
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

    case 'drill':
    case 'spot drill': {
      const tipR   = tipDiameter / 2;
      const coneH  = (fR - tipR) / Math.tan((taperAngle * Math.PI) / 180);
      tip = [
        `L${tx(fR, s)},${ty(coneH, s)}`,
        `L${tx(tipR, s)},${TIP_Y}`,
        ...(tipR > 0 ? [`L${tx(-tipR, s)},${TIP_Y}`] : []),
        `L${tx(-fR, s)},${ty(coneH, s)}`,
      ].join(' ');
      break;
    }

    case 'chamfer mill':
    case 'tapered mill':
    case 'engraving': {
      const tipR = tipDiameter / 2;
      // Preamble already at (fR, FL); diagonal faces to tip then back to (-fR, FL)
      tip = [
        `L${tx(tipR, s)},${TIP_Y}`,
        ...(tipR > 0 ? [`L${tx(-tipR, s)},${TIP_Y}`] : []),
        `L${tx(-fR, s)},${ty(FL, s)}`,  // back to left shoulder (dup in close, harmless)
      ].join(' ');
      break;
    }

    case 'thread mill': {
      const pitch  = geo.threadPitch;
      const nTeeth = geo.numberOfTeeth;
      const notchD = fR * 0.2;
      const rightPts: string[] = [];
      const leftPts:  string[] = [];

      for (let i = 0; i < nTeeth; i++) {
        const crestY = FL - i * pitch;
        const rootY  = FL - i * pitch - pitch * 0.5;
        if (rootY < 0) break;
        rightPts.push(`L${tx(fR, s)},${ty(crestY, s)}`);
        rightPts.push(`L${tx(fR - notchD, s)},${ty(rootY, s)}`);
        leftPts.unshift(`L${tx(-(fR - notchD), s)},${ty(rootY, s)}`);
        leftPts.unshift(`L${tx(-fR, s)},${ty(crestY, s)}`);
      }

      tip = [
        ...rightPts,
        `L${tx(fR, s)},${TIP_Y}`,
        `L${tx(-fR, s)},${TIP_Y}`,
        ...leftPts,
      ].join(' ');
      break;
    }

    default:
      tip = `${L(fR, 0, s)} ${L(-fR, 0, s)}`;
  }

  return `${preamble} ${tip} ${close}`;
}

// ── Flute hatch marks (diagonal lines clipped to profile) ─────────────────────

interface FluteLinesProps {
  numberOfFlutes: number;
  fRpx:     number;   // flute zone half-width in px
  flzTop:   number;   // SVG y of flute-zone top
  flzBot:   number;   // SVG y of flute-zone bottom (= TIP_Y)
}

function FluteLines({ numberOfFlutes, fRpx, flzTop, flzBot }: FluteLinesProps) {
  const fzH = flzBot - flzTop;
  if (fzH < 8 || numberOfFlutes < 1) return null;

  // Helix diagonal: lines go bottom-left → top-right (right-hand helix)
  // diagOffset: horizontal extent of the angle over the tool diameter
  const diagOffset = r1(Math.min(fRpx * 0.7, 20));
  // Pitch between parallel lines, scaled by flute count
  const pitch = Math.max(4, Math.min(16, (fRpx * 2.2) / numberOfFlutes));

  const lines: JSX.Element[] = [];
  // Start above flzTop so lines fill the zone from edge to edge
  const startY = flzTop - diagOffset;
  const endY   = flzBot + pitch;

  for (let y = startY; y <= endY; y += pitch) {
    const y1 = r1(y);
    const y2 = r1(y - diagOffset);
    lines.push(
      <line
        key={y1}
        x1={r1(CX - fRpx - 4)} y1={y1}
        x2={r1(CX + fRpx + 4)} y2={y2}
        stroke="#93c5fd"
        strokeWidth="0.7"
        strokeOpacity="0.25"
      />
    );
  }

  return <>{lines}</>;
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
  return <polygon points={pts} fill="#64748b" />;
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
      <line x1={extLeft} y1={y1} x2={x - 3} y2={y1} stroke="#475569" strokeWidth="0.7" strokeDasharray="3,2" />
      <line x1={extLeft} y1={y2} x2={x - 3} y2={y2} stroke="#475569" strokeWidth="0.7" strokeDasharray="3,2" />
      <line x1={x} y1={r1(y1 + 9)} x2={x} y2={r1(y2 - 9)} stroke="#64748b" strokeWidth="1" />
      <Arrowhead x={x} y={y1} dir="up" />
      <Arrowhead x={x} y={y2} dir="down" />
      <text
        x={x}
        y={midY}
        fontSize="10"
        fill="#94a3b8"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        transform={`rotate(-90 ${x} ${midY})`}
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
  const lineX1 = Math.min(x1, midX - 45);
  const lineX2 = Math.max(x2, midX + 45);

  return (
    <g>
      <line x1={x1} y1={tickFromY} x2={x1} y2={r1(y - 3)} stroke="#475569" strokeWidth="0.7" strokeDasharray="3,2" />
      <line x1={x2} y1={tickFromY} x2={x2} y2={r1(y - 3)} stroke="#475569" strokeWidth="0.7" strokeDasharray="3,2" />
      <line x1={r1(lineX1 + 9)} y1={y} x2={r1(lineX2 - 9)} y2={y} stroke="#64748b" strokeWidth="1" />
      <Arrowhead x={x1} y={y} dir="left" />
      <Arrowhead x={x2} y={y} dir="right" />
      <text
        x={midX}
        y={r1(y + 13)}
        fontSize="10"
        fill="#94a3b8"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ToolProfileSVG({ draft }: { draft: LibraryTool }) {
  const { settings } = useSettings();
  const dec  = settings.tableDecimalPrecision;
  const unit = draft.unit;

  const resolved = resolveGeometry(draft.type, draft.geometry);
  const scale    = computeScale(resolved);

  if (!isFinite(scale) || resolved.diameter * scale < 3) {
    return (
      <svg viewBox="0 0 480 170" width="100%" height="170" className="block">
        <rect width="480" height="170" fill="#0f172a" />
        <text x="240" y="85" textAnchor="middle" fontSize="11" fill="#475569" fontFamily="sans-serif">
          No preview
        </text>
      </svg>
    );
  }

  const profileD = buildProfilePath(draft.type, resolved, scale);

  // ── Annotation geometry ────────────────────────────────────────────────────

  const fRpx   = r1(resolved.diameter / 2 * scale);
  const sRpx   = r1(resolved.shaftDiameter / 2 * scale);
  const maxRpx = Math.max(fRpx, sRpx);

  const oalY1    = ty(resolved.overallLength, scale);
  const oalLabel = `${resolved.overallLength.toFixed(dec)} ${unit}`;

  const showFL  = draft.geometry.fluteLength !== undefined;
  const flY1    = ty(resolved.fluteLength, scale);
  const flArrH  = TIP_Y - flY1;
  const flLabel = `FL ${resolved.fluteLength.toFixed(dec)}`;

  const extX = CX + maxRpx + 4;

  // Diameter line sits in the annotation zone below the profile
  const diamY     = 143;
  const diamLabel = `Ø ${resolved.diameter.toFixed(dec)} ${unit}`;

  // Flute zone bounds for hatch marks
  const flzTop = ty(resolved.fluteLength, scale);

  // Coolant indicator
  const coolantCY = ty(resolved.overallLength * 0.65, scale);
  const coolantR  = Math.max(1.5, r1(resolved.shaftDiameter * scale * 0.12));

  return (
    <svg
      viewBox="0 0 480 170"
      width="100%"
      height="170"
      className="block"
      aria-label={`${draft.type} profile`}
    >
      <defs>
        {/* Clip flute hatch marks to the profile shape */}
        <clipPath id="toolProfileClip">
          <path d={profileD} />
        </clipPath>
      </defs>

      {/* Background */}
      <rect width="480" height="170" fill="#0f172a" />

      {/* Centre axis guide */}
      <line x1="240" y1="10" x2="240" y2="130"
            stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,3" />

      {/* Profile fill */}
      <path d={profileD} fill="#1e3a5f" />

      {/* Flute hatch marks — clipped to profile, only in flute zone */}
      {resolved.numberOfFlutes !== undefined && (
        <g clipPath="url(#toolProfileClip)">
          {/* Restrict lines to flute zone by masking above via a rect */}
          <FluteLines
            numberOfFlutes={resolved.numberOfFlutes}
            fRpx={fRpx}
            flzTop={flzTop}
            flzBot={TIP_Y}
          />
        </g>
      )}

      {/* Shank hatching (cross-hatch to visually distinguish shank from flute zone) */}
      {sRpx > 4 && (
        <g clipPath="url(#toolProfileClip)">
          {/* Light cross-hatch in shank zone only */}
          {Array.from({ length: Math.ceil((TIP_Y - oalY1) / 8) }, (_, i) => {
            const y = r1(oalY1 + i * 8);
            if (y >= flzTop) return null;  // stop at flute zone boundary
            return (
              <line key={i}
                x1={r1(CX - sRpx - 4)} y1={y}
                x2={r1(CX + sRpx + 4)} y2={r1(y + 6)}
                stroke="#93c5fd" strokeWidth="0.5" strokeOpacity="0.12"
              />
            );
          })}
        </g>
      )}

      {/* Coolant channel indicator */}
      {resolved.coolantSupport && (
        <circle
          cx={CX} cy={coolantCY} r={coolantR}
          fill="none" stroke="#38bdf8"
          strokeWidth="0.9" strokeDasharray="1.5,1.5"
        />
      )}

      {/* Profile stroke (drawn on top of hatch marks) */}
      <path d={profileD} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Shoulder line — horizontal rule at flute/shank boundary */}
      {Math.abs(flzTop - oalY1) > 6 && (
        <line
          x1={r1(CX - Math.max(fRpx, sRpx))} y1={flzTop}
          x2={r1(CX + Math.max(fRpx, sRpx))} y2={flzTop}
          stroke="#3b82f6" strokeWidth="0.6" strokeOpacity="0.5" strokeDasharray="4,3"
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

      {/* Overall length annotation */}
      <VertDimLine
        x={432}
        y1={oalY1}
        y2={TIP_Y}
        label={oalLabel}
        extLeft={extX}
      />

      {/* Flute length annotation */}
      {showFL && flArrH >= 18 && (
        <VertDimLine
          x={415}
          y1={flY1}
          y2={TIP_Y}
          label={flLabel}
          extLeft={extX}
        />
      )}

      {/* Tool type label */}
      <text x="6" y="165" fontSize="9" fill="#475569" fontFamily="sans-serif">
        {draft.type}
        {resolved.numberOfFlutes ? `  ·  ${resolved.numberOfFlutes}F` : ''}
      </text>
    </svg>
  );
}
