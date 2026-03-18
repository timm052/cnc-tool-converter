# Adding a New Format Converter

This guide walks through adding support for a new tool library format. The architecture is designed so adding a format requires touching exactly three files — the two you create and the registry.

## Overview

Every format is implemented as a `Converter` object that satisfies this interface (`src/types/converter.ts`):

```ts
interface Converter {
  format: FormatInfo;
  parse(content: string | ArrayBuffer, filename?: string): Promise<ParseResult>;
  write(tools: Tool[], options?: WriteOptions): Promise<WriteResult>;
}
```

`parse()` converts a raw file into the internal `Tool[]` model.
`write()` converts a `Tool[]` back into a serialised file string.

Once registered, a converter automatically appears in:
- The **Converter page** source / target dropdowns
- The **Tool Library** Import panel
- The **Tool Library** Export panel (if `canExport: true`)

---

## Step 1 — Create the converter directory

```
src/converters/<format-id>/
├── index.ts    ← exports the Converter object
├── parser.ts   ← implements parse()
└── writer.ts   ← implements write() (omit if import-only)
```

Replace `<format-id>` with a short, lowercase identifier (e.g. `haas`, `fanuc`, `mach3`).

---

## Step 2 — Fill in `index.ts`

```ts
import type { Converter } from '../../types/converter';
import { parseMyFormat } from './parser';
import { writeMyFormat } from './writer';

export const myFormatConverter: Converter = {
  format: {
    id:             'myformat',
    name:           'My CAM Software',
    description:    'My CAM Software tool library (.ext)',
    fileExtensions: ['.ext'],
    mimeTypes:      ['text/plain'],
    canImport:      true,
    canExport:      true,
    readAs:         'text',   // or 'arraybuffer' for binary / UTF-16 files
  },
  parse: (content, filename) => parseMyFormat(content, filename),
  write: (tools, options)    => writeMyFormat(tools, options),
};
```

Set `canImport: false` or `canExport: false` if the format only goes one way.
Set `readAs: 'arraybuffer'` for binary formats (e.g. RhinoCAM `.vkb`, UTF-16 files).

---

## Step 3 — Implement `parser.ts`

`parse()` receives the raw file content and must return a `ParseResult`:

```ts
import type { Tool } from '../../types/tool';
import type { ParseResult } from '../../types/converter';

export async function parseMyFormat(
  input: string | ArrayBuffer,
  filename?: string,
): Promise<ParseResult> {
  const warnings: string[] = [];
  const errors:   string[] = [];
  const tools:    Tool[]   = [];

  // Decode if needed
  const text = typeof input === 'string'
    ? input
    : new TextDecoder('utf-8').decode(input);

  // Parse the file and push Tool objects
  tools.push({
    id:          crypto.randomUUID(),
    toolNumber:  1,
    type:        'flat end mill',
    description: 'My tool',
    unit:        'mm',
    geometry: {
      diameter: 10,
    },
  });

  return { tools, warnings, errors };
}
```

### Tips

- Use `warnings.push(...)` for recoverable issues (unknown field, out-of-range value).
- Use `errors.push(...)` only for file-level failures (wrong format, corrupt data). The UI surfaces errors more prominently.
- Map every field you can to the canonical `Tool` model (see `src/types/tool.ts`).
- Fields with no equivalent in the core model go into `tool.sourceData` as a plain object — they are preserved for round-trip export back to the same format.
- If the format doesn't specify units, default to `'mm'` and add a warning.
- Always generate a fresh `id: crypto.randomUUID()` for each tool.

---

## Step 4 — Implement `writer.ts`

`write()` receives the `Tool[]` from the internal model and must return a `WriteResult`:

```ts
import type { Tool } from '../../types/tool';
import type { WriteResult, WriteOptions } from '../../types/converter';

export async function writeMyFormat(
  tools: Tool[],
  options: WriteOptions = {},
): Promise<WriteResult> {
  const warnings: string[] = [];
  const lines: string[] = [];

  for (const tool of tools) {
    if (tool.cutting?.spindleRpm === undefined) {
      warnings.push(`T${tool.toolNumber}: no spindle RPM — omitted from output`);
    }
    lines.push(`T${tool.toolNumber} D${tool.geometry?.diameter ?? 0}`);
  }

  const sourceName = (options.filename ?? 'tools').replace(/\.[^.]+$/, '');

  return {
    content:  lines.join('\n'),
    filename: `${sourceName}.ext`,
    mimeType: 'text/plain',
    warnings,
  };
}
```

### Tips

- `options.filename` is the source file name — derive a sensible output filename from it.
- Emit warnings for any `Tool` field that can't be represented in the target format.
- Don't crash on missing optional fields — most `Tool` properties are optional.
- Check `tool.sourceData` for format-specific data stashed during `parse()`.
- For binary output, return `content` as a `Uint8Array` and set an appropriate `mimeType`.

---

## Step 5 — Register the converter

Open `src/converters/index.ts` and add two lines:

```ts
import { myFormatConverter } from './myformat';   // ← add

registry.register(myFormatConverter);              // ← add
```

That's it. The format will appear in both the Converter page dropdowns and the Library import/export panels.

---

## Step 6 — Add tests

Create `src/__tests__/converters/myformat.test.ts`. At minimum, cover:

- A round-trip: `parse` then `write` then `parse` again, assert the field values survive
- A known-good file from real CAM software (add it to `Example Files/Tool Libs/MyFormat/example.ext`)
- Graceful handling of an empty file and a malformed file
- Any format-specific quirks (unit detection, optional header rows, binary decoding, etc.)

See `src/__tests__/converters/haas.test.ts` or `fanuc.test.ts` for concise examples.

Add the real-file test to `src/__tests__/converters/integration.test.ts`:

```ts
it('MyFormat: round-trips example.ext', async () => {
  const content = readExampleFile('MyFormat/example.ext');
  const { tools } = await myFormatConverter.parse(content);
  expect(tools.length).toBeGreaterThan(0);
  const { content: out } = await myFormatConverter.write(tools);
  const { tools: tools2 } = await myFormatConverter.parse(out);
  expect(tools2.length).toBe(tools.length);
});
```

---

## Data Model Reference

Key fields from `src/types/tool.ts` that most formats will use:

| Field | Type | Notes |
|-------|------|-------|
| `toolNumber` | `number` | T number in G-code |
| `pocketNumber` | `number?` | Carousel pocket (P field) |
| `type` | `ToolType` | See the `ToolType` union in `tool.ts` |
| `description` | `string` | Human-readable name / comment |
| `unit` | `'mm' \| 'inch'` | |
| `geometry.diameter` | `number` | Required; primary cutting diameter |
| `geometry.shaftDiameter` | `number?` | Shank / holder bore |
| `geometry.overallLength` | `number?` | OAL |
| `geometry.fluteLength` | `number?` | |
| `geometry.numberOfFlutes` | `number?` | |
| `geometry.cornerRadius` | `number?` | Bull-nose tools |
| `geometry.taperAngle` | `number?` | Half-angle in degrees |
| `cutting.spindleRpm` | `number?` | |
| `cutting.feedCutting` | `number?` | Main cutting feed rate |
| `cutting.feedPlunge` | `number?` | Vertical plunge feed |
| `cutting.coolant` | `CoolantMode?` | `'flood' \| 'mist' \| 'air' \| 'disabled'` |
| `offsets.z` | `number?` | Tool length offset |
| `offsets.x` | `number?` | Tool diameter offset (lathe / some mills) |
| `material` | `ToolMaterial?` | `'carbide' \| 'hss' \| 'ceramic' \| …` |
| `sourceData` | `Record<string,unknown>?` | Format-specific passthrough |

### LibraryTool vs Tool

`LibraryTool` (`src/types/libraryTool.ts`) extends `Tool` with library metadata: `tags`, `starred`, `machineGroups`, `quantity`, `reorderPoint`, `unitCost`, `supplier`, `location`, `condition`, `useCount`, `regrindThreshold`, `holderId`, `imageBase64`, `customFields`, and `toolMaterials`. Converters work with the base `Tool` model; the library adds metadata on top.

---

## Reference Implementations

| Converter | Good for |
|-----------|----------|
| `src/converters/linuxcnc/` | Simple line-by-line text format |
| `src/converters/haas/` | Parenthesised-comment text format with offsets |
| `src/converters/fanuc/` | G-code output with multiple block types |
| `src/converters/mach3/` | CSV with optional header row detection |
| `src/converters/hsmlib/` | XML-based format using `ArrayBuffer` + `DOMParser` |
| `src/converters/fusion360json/` | Deeply nested JSON with unit normalization |
| `src/converters/rhinocam/` | Binary format (import only) |
