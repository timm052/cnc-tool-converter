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
  bodyLength?:     number;   // undefined = not set
  shoulderLength?: number;   // undefined = not set
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
    bodyLength:      geo.bodyLength,      // pass through; undefined = not set
    shoulderLength:  geo.shoulderLength,  // pass through; undefined = not set
    cornerRadius:    cr,
    taperAngle:      ta,
    tipDiameter:     td,
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

  // Shared preamble: top-left shank → top-right shank → down right shank → shoulder step
  const preamble = [
    `M${tx(-sR, s)},${ty(OL, s)}`,           // top-left shank
    `L${tx(sR, s)},${ty(OL, s)}`,            // top-right shank
    `L${tx(sR, s)},${ty(shoulderTS, s)}`,    // down right shank
    // Step to flute radius regardless of direction (in OR out)
    ...(sR !== fR ? [`L${tx(fR, s)},${ty(shoulderTS, s)}`] : []),
  ].join(' ');

  // Shared close: left flute top → step back to shank → Z closes to top-left
  const close = [
    `L${tx(-fR, s)},${ty(shoulderTS, s)}`,   // left flute top
    ...(sR !== fR ? [`L${tx(-sR, s)},${ty(shoulderTS, s)}`] : []),
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
        x={r1(x - 15)}
        y={midY}
        fontSize="13"
        fontWeight="bold"
        fill="#cbd5e1"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        transform={`rotate(-90 ${r1(x - 15)} ${midY})`}
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
        y={r1(y + 15)}
        fontSize="13"
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

export function ToolProfileSVG({ draft }: { draft: LibraryTool }) {
  const { settings } = useSettings();
  const dec  = settings.tableDecimalPrecision;
  const unit = draft.unit;

  // Format a number: round to `dec` places but strip trailing zeros so the
  // result matches what the user typed in the editor (e.g. 6 → "6", not "6.000")
  const fmt = (n: number) => parseFloat(n.toFixed(dec)).toString();

  const resolved = resolveGeometry(draft.type, draft.geometry);
  const scale    = computeScale(resolved);

  if (!isFinite(scale) || resolved.diameter * scale < 3) {
    return (
      <svg viewBox="0 0 480 185" width="100%" height="185" className="block">
        <rect width="480" height="185" fill="#0f172a" />
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
  const oalLabel = `OAL ${fmt(resolved.overallLength)} ${unit}`;

  const showFL  = draft.geometry.fluteLength !== undefined;
  const flY1    = ty(resolved.fluteLength, scale);
  const flArrH  = TIP_Y - flY1;
  const flLabel = `Flute ${fmt(resolved.fluteLength)} ${unit}`;

  // Body / shoulder zone — body length measured from tip, shoulder is the non-fluted band above flutes
  // Body line y (body/shank boundary): prefer bodyLength; fall back to fluteLength+shoulderLength
  const rawBodyLen = resolved.bodyLength
    ?? (resolved.shoulderLength !== undefined
          ? resolved.fluteLength + resolved.shoulderLength
          : undefined);
  const showBody  = rawBodyLen !== undefined && rawBodyLen > resolved.fluteLength;
  const blY1      = showBody ? ty(rawBodyLen!, scale) : null;
  const blLabel   = showBody ? `Body ${fmt(rawBodyLen!)} ${unit}` : '';

  // Shoulder span shown if the zone is tall enough to annotate
  const rawShoulderLen = resolved.shoulderLength
    ?? (showBody ? rawBodyLen! - resolved.fluteLength : undefined);
  const shLabel = rawShoulderLen !== undefined ? `Shldr ${fmt(rawShoulderLen)} ${unit}` : '';

  const extX     = CX + maxRpx + 4;
  const leftExtX = CX - maxRpx - 4;

  // Dim lines sit close to the tool — offset from the profile edge, not the SVG edge.
  // When two annotations share a side they're spaced 28 px apart; the shorter span
  // goes in the inner slot (closer to the tool) and the longer span in the outer slot.
  const DIM_STEP = 28;
  // Right side: BL inner, OAL outer (OAL pushed out only when BL is also visible)
  const oalAnnX  = r1(extX + (showBody ? DIM_STEP * 2 : DIM_STEP));
  const blAnnX   = r1(extX + DIM_STEP);
  // Left side: shoulder inner, FL outer (FL pushed out only when shoulder is also visible)
  const showShoulder = showBody && rawShoulderLen !== undefined;
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

  return (
    <svg
      viewBox="0 0 480 185"
      width="100%"
      height="185"
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
      <rect width="480" height="185" fill="#0f172a" />

      {/* Unit badge */}
      <text
        x="474" y="10"
        fontSize="10"
        fill="#475569"
        fontFamily="ui-monospace, monospace"
        textAnchor="end"
        dominantBaseline="hanging"
      >
        {unit}
      </text>

      {/* Centre axis guide */}
      <line x1="240" y1="10" x2="240" y2="130"
            stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,3" />

      {/* Profile fill — dark gunmetal steel */}
      <path d={profileD} fill="#1c2e3e" />

      {/* Shoulder zone — violet tint between flute top and body/shank boundary */}
      {showBody && (
        <g clipPath="url(#toolProfileClip)">
          <rect
            x={r1(CX - maxRpx - 2)} y={blY1!}
            width={r1((maxRpx + 2) * 2)} height={r1(flzTop - blY1!)}
            fill="#7c3aed" fillOpacity="0.18"
          />
        </g>
      )}

      {/* Flute hatch marks — clipped to profile, only in flute zone */}
      {resolved.numberOfFlutes !== undefined && (
        <g clipPath="url(#toolProfileClip)">
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

      {/* Shoulder annotation — left side inner slot */}
      {showShoulder && (flzTop - blY1!) >= 18 && (
        <VertDimLine
          x={shAnnX}
          y1={blY1!}
          y2={flzTop}
          label={shLabel}
          extLeft={leftExtX}
        />
      )}

      {/* Tool type label */}
      <text x="6" y="178" fontSize="11" fontWeight="600" fill="#64748b" fontFamily="ui-sans-serif, sans-serif">
        {draft.type}
        {resolved.numberOfFlutes ? `  ·  ${resolved.numberOfFlutes} flutes` : ''}
      </text>
    </svg>
  );
}
