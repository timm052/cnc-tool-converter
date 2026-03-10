/**
 * Autodesk Inventor CAM / HSMWorks / Fusion 360 Tool Library (.hsmlib) Parser
 *
 * File format: UTF-16 encoded XML
 * Schema: http://www.hsmworks.com/xml/2004/cnc/tool-library (version 14 / 36)
 * Compatible with: Inventor CAM, Fusion 360, HSMWorks
 */

import type { Tool, ToolType, ToolMaterial, CoolantMode, FeedMode } from '../../types/tool';
import type { ParseResult } from '../../types/converter';

// ── Helpers ────────────────────────────────────────────────────────────────

function getAttr(el: Element | null | undefined, attr: string): string | null {
  return el?.getAttribute(attr) ?? null;
}

function getNumAttr(el: Element | null | undefined, attr: string): number | undefined {
  const val = el?.getAttribute(attr);
  if (val === null || val === undefined || val === '') return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

function getBoolAttr(el: Element | null | undefined, attr: string): boolean | undefined {
  const val = el?.getAttribute(attr);
  if (val === null || val === undefined) return undefined;
  return val === '1' || val === 'true' || val === 'yes';
}

function firstChild(parent: Element | null | undefined, tagName: string): Element | null {
  if (!parent) return null;
  return parent.getElementsByTagName(tagName)[0] ?? null;
}

// ── Tool type mapping ──────────────────────────────────────────────────────

const TOOL_TYPE_MAP: Record<string, ToolType> = {
  // Milling
  'flat end mill':         'flat end mill',
  'ball end mill':         'ball end mill',
  'bull nose end mill':    'bull nose end mill',
  'chamfer mill':          'chamfer mill',
  'face mill':             'face mill',
  'tapered mill':          'tapered mill',
  'dovetail mill':         'dovetail mill',
  'slot mill':             'slot mill',
  'lollipop mill':         'lollipop mill',
  'form mill':             'form mill',
  'engraving':             'engraving',
  // Circle segment
  'circle segment barrel': 'circle segment barrel',
  'circle segment lens':   'circle segment lens',
  'circle segment oval':   'circle segment oval',
  // Hole making
  'drill':                 'drill',
  'center drill':          'center drill',
  'spot drill':            'spot drill',
  'counter bore':          'counter bore',
  'counter sink':          'counter sink',
  'reamer':                'reamer',
  'boring bar':            'boring bar',
  // Threading
  'thread mill':           'thread mill',
  'tap right hand':        'tap right hand',
  'tap left hand':         'tap left hand',
  // Special
  'probe':                 'probe',
  'laser cutter':          'laser cutter',
  'plasma cutter':         'plasma cutter',
  'waterjet':              'waterjet',
  'holder':                'holder',
};

function mapToolType(hsmlibType: string): ToolType {
  const lower = hsmlibType.toLowerCase().trim();
  return TOOL_TYPE_MAP[lower] ?? 'custom';
}

// ── Main parser ────────────────────────────────────────────────────────────

export async function parseHSMLib(
  input: string | ArrayBuffer,
  filename?: string,
): Promise<ParseResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const tools: Tool[] = [];

  // Decode UTF-16 ArrayBuffer → string
  let xmlText: string;
  if (typeof input === 'string') {
    xmlText = input;
  } else {
    try {
      const decoder = new TextDecoder('utf-16');
      xmlText = decoder.decode(input);
    } catch (err) {
      errors.push(`Failed to decode file encoding: ${err}`);
      return { tools, warnings, errors };
    }
  }

  // Strip UTF-16 BOM character if present
  if (xmlText.charCodeAt(0) === 0xFEFF) {
    xmlText = xmlText.slice(1);
  }

  // Normalise the encoding declaration so DOMParser doesn't reject it
  // (the JS string is already decoded; the declaration is now just informational)
  xmlText = xmlText.replace(/encoding=["']UTF-16["']/gi, 'encoding="UTF-8"');

  // Parse XML
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(xmlText, 'application/xml');

  const parseError = doc.querySelector('parseerror');
  if (parseError) {
    errors.push(`XML parse error in ${filename ?? 'file'}: ${parseError.textContent?.trim()}`);
    return { tools, warnings, errors };
  }

  // Extract library-level metadata
  const libraryEl = doc.documentElement;
  const metadata: Record<string, unknown> = {
    guid:    libraryEl.getAttribute('guid'),
    version: libraryEl.getAttribute('version'),
    sourceFile: filename,
  };

  // Iterate tool elements
  const toolElements = Array.from(doc.getElementsByTagName('tool'));
  if (toolElements.length === 0) {
    warnings.push(`No tools found in ${filename ?? 'file'}`);
  }

  toolElements.forEach((toolEl, index) => {
    try {
      const guid        = toolEl.getAttribute('guid') ?? crypto.randomUUID();
      const typeStr     = toolEl.getAttribute('type') ?? '';
      const unitStr     = toolEl.getAttribute('unit') ?? 'millimeters';
      const unit        = unitStr === 'inches' ? 'inch' as const : 'mm' as const;

      const descEl      = firstChild(toolEl, 'description');
      const commentEl   = firstChild(toolEl, 'comment');
      const mfgEl       = firstChild(toolEl, 'manufacturer');
      const pidEl       = firstChild(toolEl, 'product-id');
      const plinkEl     = firstChild(toolEl, 'product-link');
      const ncEl        = firstChild(toolEl, 'nc');
      const coolantEl   = firstChild(toolEl, 'coolant');
      const materialEl  = firstChild(toolEl, 'material');
      const bodyEl      = firstChild(toolEl, 'body');
      const motionEl    = firstChild(toolEl, 'motion');
      const holderEl    = firstChild(toolEl, 'holder');

      const toolNumber = parseInt(getAttr(ncEl, 'number') ?? '0', 10);
      // Fallback: use type+diameter when description tag is absent
      const description = descEl?.textContent?.trim() ||
        `${mapToolType(typeStr)} Ø${getNumAttr(bodyEl, 'diameter') ?? 0}`;

      const tool: Tool = {
        id:           guid,
        toolNumber,
        type:         mapToolType(typeStr),
        description,
        comment:      commentEl?.textContent?.trim() || undefined,
        manufacturer: mfgEl?.textContent?.trim()     || undefined,
        productId:    pidEl?.textContent?.trim()      || undefined,
        productLink:  plinkEl?.textContent?.trim()    || undefined,
        unit,

        geometry: {
          diameter:            getNumAttr(bodyEl, 'diameter')             ?? 0,
          shaftDiameter:       getNumAttr(bodyEl, 'shaft-diameter'),
          overallLength:       getNumAttr(bodyEl, 'overall-length'),
          bodyLength:          getNumAttr(bodyEl, 'body-length'),
          fluteLength:         getNumAttr(bodyEl, 'flute-length'),
          shoulderLength:      getNumAttr(bodyEl, 'shoulder-length'),
          numberOfFlutes:      getNumAttr(bodyEl, 'number-of-flutes'),
          cornerRadius:        getNumAttr(bodyEl, 'corner-radius'),
          taperAngle:          getNumAttr(bodyEl, 'taper-angle'),
          tipDiameter:         getNumAttr(bodyEl, 'tip-diameter'),
          threadPitch:         getNumAttr(bodyEl, 'thread-pitch'),
          threadProfileAngle:  getNumAttr(bodyEl, 'thread-profile-angle'),
          numberOfTeeth:       getNumAttr(bodyEl, 'number-of-teeth'),
          coolantSupport:      getAttr(bodyEl, 'coolant-support') === 'yes',
        },

        cutting: {
          spindleRpm:      getNumAttr(motionEl, 'spindle-rpm'),
          rampSpindleRpm:  getNumAttr(motionEl, 'ramp-spindle-rpm'),
          feedCutting:     getNumAttr(motionEl, 'cutting-feedrate'),
          feedPlunge:      getNumAttr(motionEl, 'plunge-feedrate'),
          feedRamp:        getNumAttr(motionEl, 'ramp-feedrate'),
          feedEntry:       getNumAttr(motionEl, 'entry-feedrate'),
          feedExit:        getNumAttr(motionEl, 'exit-feedrate'),
          feedRetract:     getNumAttr(motionEl, 'retract-feedrate'),
          feedMode:        (getAttr(motionEl, 'feed-mode') as FeedMode) ?? 'per-minute',
          coolant:         (getAttr(coolantEl, 'mode') as CoolantMode) ?? 'disabled',
          clockwise:       getAttr(motionEl, 'clockwise') === 'yes',
        },

        nc: {
          breakControl:    getBoolAttr(ncEl, 'break-control'),
          diameterOffset:  getBoolAttr(ncEl, 'diameter-offset'),
          lengthOffset:    getBoolAttr(ncEl, 'length-offset'),
          liveTool:        getBoolAttr(ncEl, 'live-tool'),
          manualToolChange: getBoolAttr(ncEl, 'manual-tool-change'),
          turret:          getNumAttr(ncEl, 'turret'),
        },

        material: (getAttr(materialEl, 'name') as ToolMaterial) || undefined,
      };

      // Preserve Fusion 360 / HSMWorks extended fields in sourceData
      const assemblyGL  = getNumAttr(bodyEl, 'assembly-gauge-length');
      const holderGL    = getNumAttr(holderEl, 'gauge-length');
      if (assemblyGL !== undefined || holderGL !== undefined) {
        tool.sourceData = {
          ...tool.sourceData,
          assemblyGaugeLength: assemblyGL,
          holderGaugeLength:   holderGL,
          holderDescription:   getAttr(holderEl, 'description') || undefined,
          holderGuid:          getAttr(holderEl, 'guid')        || undefined,
        };
      }

      // Parse presets
      const presetEls = toolEl.getElementsByTagName('preset');
      if (presetEls.length > 0) {
        tool.presets = Array.from(presetEls).map((pEl) => ({
          id:          pEl.getAttribute('id')   ?? crypto.randomUUID(),
          name:        pEl.getAttribute('name') ?? 'Default',
          description: pEl.getAttribute('description') ?? undefined,
          parameters:  Object.fromEntries(
            Array.from(pEl.getElementsByTagName('parameter')).map((p) => [
              p.getAttribute('key')   ?? '',
              p.getAttribute('value') ?? '',
            ]),
          ),
        }));
      }

      tools.push(tool);
    } catch (err) {
      warnings.push(`Skipped tool at index ${index} in ${filename ?? 'file'}: ${err}`);
    }
  });

  return { tools, warnings, errors, metadata };
}
