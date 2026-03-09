import { describe, it, expect } from 'vitest';
import { parseHSMLib } from '../../converters/hsmlib/parser';
import { writeHSMLib } from '../../converters/hsmlib/writer';
import type { Tool } from '../../types/tool';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeHSMLibXml(toolsXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<tool-library xmlns="http://www.hsmworks.com/xml/2004/cnc/tool-library" guid="{TEST-GUID}" version="14">
${toolsXml}
</tool-library>`;
}

const FLAT_END_MILL_XML = makeHSMLibXml(`
  <tool guid="tool-guid-1" type="flat end mill" unit="millimeters" version="1.5">
    <description>10mm Flat End Mill</description>
    <comment>General purpose</comment>
    <manufacturer>Sandvik</manufacturer>
    <nc number="1" break-control="0" diameter-offset="1" length-offset="1" live-tool="0" manual-tool-change="0" turret="0"/>
    <coolant mode="flood"/>
    <material name="carbide"/>
    <body diameter="10" flute-length="22" body-length="32" overall-length="72" shaft-diameter="10"
          number-of-flutes="4" coolant-support="no"/>
    <motion spindle-rpm="8000" cutting-feedrate="1200" plunge-feedrate="400"
            clockwise="yes" feed-mode="per-minute"/>
  </tool>
`);

const BALL_END_MILL_XML = makeHSMLibXml(`
  <tool guid="tool-guid-2" type="ball end mill" unit="inches" version="1.5">
    <description>1/4in Ball End Mill</description>
    <nc number="2"/>
    <coolant mode="disabled"/>
    <body diameter="0.25" flute-length="0.75" overall-length="2.5" number-of-flutes="2"/>
    <motion spindle-rpm="12000" cutting-feedrate="60"/>
  </tool>
`);

const MINIMAL_TOOL: Tool = {
  id: 'test-id-1',
  toolNumber: 3,
  type: 'drill',
  description: 'Test Drill',
  unit: 'mm',
  geometry: { diameter: 8 },
};

// ── Parser tests ──────────────────────────────────────────────────────────────

describe('HSMLib parser', () => {
  it('parses basic tool fields', async () => {
    const result = await parseHSMLib(FLAT_END_MILL_XML, 'test.hsmlib');
    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(1);

    const tool = result.tools[0];
    expect(tool.id).toBe('tool-guid-1');
    expect(tool.type).toBe('flat end mill');
    expect(tool.description).toBe('10mm Flat End Mill');
    expect(tool.comment).toBe('General purpose');
    expect(tool.manufacturer).toBe('Sandvik');
    expect(tool.unit).toBe('mm');
    expect(tool.toolNumber).toBe(1);
  });

  it('parses geometry fields', async () => {
    const result = await parseHSMLib(FLAT_END_MILL_XML, 'test.hsmlib');
    const geo = result.tools[0].geometry;
    expect(geo.diameter).toBe(10);
    expect(geo.fluteLength).toBe(22);
    expect(geo.bodyLength).toBe(32);
    expect(geo.overallLength).toBe(72);
    expect(geo.numberOfFlutes).toBe(4);
  });

  it('parses cutting parameters', async () => {
    const result = await parseHSMLib(FLAT_END_MILL_XML, 'test.hsmlib');
    const cut = result.tools[0].cutting!;
    expect(cut.spindleRpm).toBe(8000);
    expect(cut.feedCutting).toBe(1200);
    expect(cut.feedPlunge).toBe(400);
    expect(cut.coolant).toBe('flood');
    expect(cut.clockwise).toBe(true);
  });

  it('parses material', async () => {
    const result = await parseHSMLib(FLAT_END_MILL_XML, 'test.hsmlib');
    expect(result.tools[0].material).toBe('carbide');
  });

  it('maps tool type strings correctly', async () => {
    const result = await parseHSMLib(BALL_END_MILL_XML, 'test.hsmlib');
    expect(result.tools[0].type).toBe('ball end mill');
  });

  it('parses inch unit', async () => {
    const result = await parseHSMLib(BALL_END_MILL_XML, 'test.hsmlib');
    expect(result.tools[0].unit).toBe('inch');
    expect(result.tools[0].geometry.diameter).toBe(0.25);
  });

  it('maps unknown type to custom', async () => {
    const xml = makeHSMLibXml(`
      <tool guid="x" type="super special tool" unit="millimeters" version="1.5">
        <description>Unknown</description>
        <nc number="99"/>
        <coolant mode="disabled"/>
        <body diameter="5"/>
        <motion spindle-rpm="1000"/>
      </tool>
    `);
    const result = await parseHSMLib(xml);
    expect(result.tools[0].type).toBe('custom');
  });

  it('returns no tools for invalid XML (graceful degradation)', async () => {
    // jsdom's DOMParser may not produce a <parseerror> element like browsers do,
    // but the parser should always return an empty tools array for malformed input.
    const result = await parseHSMLib('<not valid xml <<<', 'bad.hsmlib');
    expect(result.tools).toHaveLength(0);
  });

  it('warns when no tools found', async () => {
    const empty = makeHSMLibXml('');
    const result = await parseHSMLib(empty, 'empty.hsmlib');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ── Writer tests ──────────────────────────────────────────────────────────────

describe('HSMLib writer', () => {
  it('outputs valid XML with tool-library root', async () => {
    const result = await writeHSMLib([MINIMAL_TOOL]);
    expect(result.content).toContain('<tool-library');
    expect(result.content).toContain('</tool-library>');
    expect(result.mimeType).toBe('application/xml');
  });

  it('includes tool element with correct type and number', async () => {
    const result = await writeHSMLib([MINIMAL_TOOL]);
    expect(result.content).toContain('type="drill"');
    expect(result.content).toContain('number="3"');
  });

  it('writes description', async () => {
    const result = await writeHSMLib([MINIMAL_TOOL]);
    expect(result.content).toContain('<description>Test Drill</description>');
  });

  it('escapes XML special characters in description', async () => {
    const tool: Tool = { ...MINIMAL_TOOL, description: 'R&D Tool <3>' };
    const result = await writeHSMLib([tool]);
    expect(result.content).toContain('R&amp;D Tool &lt;3&gt;');
  });

  it('sets output filename with .hsmlib extension', async () => {
    const result = await writeHSMLib([MINIMAL_TOOL], { filename: 'library.tbl' });
    expect(result.filename).toBe('library.hsmlib');
  });

  it('falls back to converted-tools.hsmlib when no filename', async () => {
    const result = await writeHSMLib([MINIMAL_TOOL]);
    expect(result.filename).toBe('converted-tools.hsmlib');
  });

  it('writes millimeters unit for mm tools', async () => {
    const result = await writeHSMLib([MINIMAL_TOOL]);
    expect(result.content).toContain('unit="millimeters"');
  });

  it('writes inches unit for inch tools', async () => {
    const tool: Tool = { ...MINIMAL_TOOL, unit: 'inch' };
    const result = await writeHSMLib([tool]);
    expect(result.content).toContain('unit="inches"');
  });

  it('warns when no tools provided', async () => {
    const result = await writeHSMLib([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('includes machine vendor comment when option set', async () => {
    const result = await writeHSMLib([MINIMAL_TOOL], {
      hsmlibMachineVendor: 'Haas',
      hsmlibMachineModel: 'VF-2',
    });
    expect(result.content).toContain('Haas VF-2');
  });
});

// ── Round-trip test ───────────────────────────────────────────────────────────

describe('HSMLib round-trip', () => {
  it('parse → write → parse preserves core tool fields', async () => {
    const first = await parseHSMLib(FLAT_END_MILL_XML, 'test.hsmlib');
    expect(first.errors).toHaveLength(0);

    const written = await writeHSMLib(first.tools);
    const second = await parseHSMLib(written.content, 'round-trip.hsmlib');

    expect(second.errors).toHaveLength(0);
    expect(second.tools).toHaveLength(1);

    const t1 = first.tools[0];
    const t2 = second.tools[0];
    expect(t2.toolNumber).toBe(t1.toolNumber);
    expect(t2.type).toBe(t1.type);
    expect(t2.description).toBe(t1.description);
    expect(t2.unit).toBe(t1.unit);
    expect(t2.geometry.diameter).toBe(t1.geometry.diameter);
    expect(t2.cutting?.spindleRpm).toBe(t1.cutting?.spindleRpm);
    expect(t2.cutting?.feedCutting).toBe(t1.cutting?.feedCutting);
  });
});
