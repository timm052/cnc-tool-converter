import { describe, it, expect } from 'vitest';
import { parseRhinoCamVKB } from '../../converters/rhinocam/parser';

// ── Binary fixture helpers ────────────────────────────────────────────────────
//
// .vkb binary layout (all little-endian):
//   File is N * 7298 bytes (one record per tool).
//   Within each record (base = i * 7298):
//     0x020 (32)  — magic string "VisualMill Part File" in UTF-16 LE (only in record 0)
//     0x0DE (222) — tool name string, UTF-16 LE, null-terminated
//     0x1E0 (480) — number of flutes, int32 LE
//     0x1E4 (484) — diameter,          float64 LE
//     0x1EC (492) — d1 (secondary dim), float64 LE
//     0x1F4 (500) — d2 (flute/body len),float64 LE
//     0x1FC (508) — d3 (overall length), float64 LE
//     0x204 (516) — d4 (angle),          float64 LE
//     0x220 (544) — material string,     UTF-16 LE, null-terminated

const RECORD_SIZE  = 7298;
const MAGIC_OFFSET = 0x20;
const MAGIC_STR    = 'VisualMill Part File';
const NAME_OFFSET  = 0x0DE;
const NOF_OFFSET   = 0x1E0;
const DATA_OFFSET  = 0x1E4;
const MAT_OFFSET   = 0x220;

function writeUTF16LE(view: DataView, byteOffset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint16(byteOffset + i * 2, str.charCodeAt(i), true);
  }
  view.setUint16(byteOffset + str.length * 2, 0, true); // null terminator
}

function writeF64LE(view: DataView, byteOffset: number, value: number): void {
  view.setFloat64(byteOffset, value, true);
}

function writeI32LE(view: DataView, byteOffset: number, value: number): void {
  view.setInt32(byteOffset, value, true);
}

interface ToolRecord {
  name:         string;
  flutes:       number;
  diameter:     number;
  d1:           number;  // secondary dim (corner radius for bull nose, etc.)
  d2:           number;  // flute/body length
  d3:           number;  // overall length
  d4:           number;  // angle (taper, chamfer)
  material:     string;
}

function makeVKBBuffer(records: ToolRecord[]): ArrayBuffer {
  const buf  = new ArrayBuffer(records.length * RECORD_SIZE);
  const view = new DataView(buf);

  records.forEach((rec, i) => {
    const base = i * RECORD_SIZE;

    // Magic string only needs to be readable at the absolute offset 0x20
    // (i.e. within record 0 when base = 0)
    if (i === 0) {
      writeUTF16LE(view, MAGIC_OFFSET, MAGIC_STR);
    }

    writeUTF16LE(view, base + NAME_OFFSET, rec.name);
    writeI32LE  (view, base + NOF_OFFSET,  rec.flutes);
    writeF64LE  (view, base + DATA_OFFSET,      rec.diameter);
    writeF64LE  (view, base + DATA_OFFSET + 8,  rec.d1);
    writeF64LE  (view, base + DATA_OFFSET + 16, rec.d2);
    writeF64LE  (view, base + DATA_OFFSET + 24, rec.d3);
    writeF64LE  (view, base + DATA_OFFSET + 32, rec.d4);
    writeUTF16LE(view, base + MAT_OFFSET,  rec.material);
  });

  return buf;
}

const FLAT_MILL_RECORD: ToolRecord = {
  name: 'flatmill 10mm',
  flutes: 4,
  diameter: 10.0,
  d1: 0,
  d2: 22.0,
  d3: 72.0,
  d4: 0,
  material: 'carbide',
};

const BALL_MILL_RECORD: ToolRecord = {
  name: 'ballmill 6mm',
  flutes: 2,
  diameter: 6.0,
  d1: 3.0,   // not used for ball — cornerRadius = diam/2
  d2: 18.0,  // fluteLength
  d3: 60.0,  // overallLength
  d4: 0,
  material: 'hss',
};

const CHAMFER_RECORD: ToolRecord = {
  name: 'chamfermill 8mm',
  flutes: 3,
  diameter: 8.0,
  d1: 0,
  d2: 12.0,  // fluteLength
  d3: 50.0,  // overallLength
  d4: 45.0,  // taperAngle
  material: 'carbide',
};

// ── Parser tests ──────────────────────────────────────────────────────────────

describe('RhinoCAM parser', () => {
  it('returns error when magic header is missing', async () => {
    const buf = new ArrayBuffer(RECORD_SIZE);
    const result = await parseRhinoCamVKB(buf, 'bad.vkb');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.tools).toHaveLength(0);
  });

  it('returns warning when file is too small for any records', async () => {
    const buf  = new ArrayBuffer(100);
    const view = new DataView(buf);
    writeUTF16LE(view, MAGIC_OFFSET, MAGIC_STR);
    const result = await parseRhinoCamVKB(buf, 'tiny.vkb');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.tools).toHaveLength(0);
  });

  it('parses a single flat end mill record', async () => {
    const buf    = makeVKBBuffer([FLAT_MILL_RECORD]);
    const result = await parseRhinoCamVKB(buf, 'test.vkb');
    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(1);

    const tool = result.tools[0];
    expect(tool.type).toBe('flat end mill');
    expect(tool.description).toBe('flatmill 10mm');
    expect(tool.geometry.diameter).toBe(10.0);
    expect(tool.geometry.numberOfFlutes).toBe(4);
    expect(tool.geometry.fluteLength).toBe(22.0);
    expect(tool.geometry.overallLength).toBe(72.0);
    expect(tool.material).toBe('carbide');
    expect(tool.unit).toBe('mm');
  });

  it('parses a ball end mill with cornerRadius = diam/2', async () => {
    const buf    = makeVKBBuffer([BALL_MILL_RECORD]);
    const result = await parseRhinoCamVKB(buf, 'test.vkb');
    const tool   = result.tools[0];
    expect(tool.type).toBe('ball end mill');
    expect(tool.geometry.diameter).toBe(6.0);
    expect(tool.geometry.cornerRadius).toBe(3.0);
    expect(tool.geometry.fluteLength).toBe(18.0);
    expect(tool.geometry.overallLength).toBe(60.0);
    expect(tool.material).toBe('hss');
  });

  it('parses chamfer mill with taper angle from d4', async () => {
    const buf    = makeVKBBuffer([CHAMFER_RECORD]);
    const result = await parseRhinoCamVKB(buf, 'test.vkb');
    const tool   = result.tools[0];
    expect(tool.type).toBe('chamfer mill');
    expect(tool.geometry.taperAngle).toBe(45.0);
    expect(tool.geometry.fluteLength).toBe(12.0);
    expect(tool.geometry.overallLength).toBe(50.0);
  });

  it('parses multiple records from one file', async () => {
    const buf    = makeVKBBuffer([FLAT_MILL_RECORD, BALL_MILL_RECORD, CHAMFER_RECORD]);
    const result = await parseRhinoCamVKB(buf, 'multi.vkb');
    expect(result.errors).toHaveLength(0);
    expect(result.tools).toHaveLength(3);
  });

  it('assigns sequential tool numbers starting at 1', async () => {
    const buf    = makeVKBBuffer([FLAT_MILL_RECORD, BALL_MILL_RECORD]);
    const result = await parseRhinoCamVKB(buf, 'test.vkb');
    expect(result.tools[0].toolNumber).toBe(1);
    expect(result.tools[1].toolNumber).toBe(2);
  });

  it('stores rhinocamName and sourceFile in sourceData', async () => {
    const buf    = makeVKBBuffer([FLAT_MILL_RECORD]);
    const result = await parseRhinoCamVKB(buf, 'mylib.vkb');
    const sd     = result.tools[0].sourceData!;
    expect(sd.rhinocamName).toBe('flatmill 10mm');
    expect(sd.sourceFile).toBe('mylib.vkb');
  });

  it('maps lollipopmill name to lollipop mill type', async () => {
    const rec: ToolRecord = { ...FLAT_MILL_RECORD, name: 'lollipopmill 8mm' };
    const result          = await parseRhinoCamVKB(makeVKBBuffer([rec]), 'test.vkb');
    expect(result.tools[0].type).toBe('lollipop mill');
  });

  it('maps reammill name to reamer type', async () => {
    const rec: ToolRecord = { ...FLAT_MILL_RECORD, name: 'reammill 6mm' };
    const result          = await parseRhinoCamVKB(makeVKBBuffer([rec]), 'test.vkb');
    expect(result.tools[0].type).toBe('reamer');
  });

  it('maps centerdrill name to center drill type', async () => {
    const rec: ToolRecord = { ...FLAT_MILL_RECORD, name: 'centerdrill 4mm' };
    const result          = await parseRhinoCamVKB(makeVKBBuffer([rec]), 'test.vkb');
    expect(result.tools[0].type).toBe('center drill');
  });

  it('falls back to custom type for unrecognised names', async () => {
    const rec: ToolRecord = { ...FLAT_MILL_RECORD, name: 'specialwidget 10mm' };
    const result          = await parseRhinoCamVKB(makeVKBBuffer([rec]), 'test.vkb');
    expect(result.tools[0].type).toBe('custom');
  });

  it('sets numberOfFlutes to undefined when flute count is 0', async () => {
    const rec: ToolRecord = { ...FLAT_MILL_RECORD, flutes: 0 };
    const result          = await parseRhinoCamVKB(makeVKBBuffer([rec]), 'test.vkb');
    expect(result.tools[0].geometry.numberOfFlutes).toBeUndefined();
  });

  it('sets fluteLength/overallLength to undefined when values are 0', async () => {
    const rec: ToolRecord = { ...FLAT_MILL_RECORD, d2: 0, d3: 0 };
    const result          = await parseRhinoCamVKB(makeVKBBuffer([rec]), 'test.vkb');
    expect(result.tools[0].geometry.fluteLength).toBeUndefined();
    expect(result.tools[0].geometry.overallLength).toBeUndefined();
  });
});
