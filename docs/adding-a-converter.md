# Adding a New Format Converter

This guide walks through adding support for a new tool library format. The architecture is designed so that adding a format requires touching exactly three files — the two you create and the registry.

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

---

## Step 1 — Create the converter directory

```
src/converters/<format-id>/
├── index.ts    ← exports the Converter object
├── parser.ts   ← implements parse()
└── writer.ts   ← implements write()
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

  // --- decode -----------------------------------------------------------
  const text = typeof input === 'string'
    ? input
    : new TextDecoder('utf-8').decode(input);

  // --- parse ------------------------------------------------------------
  // ... your format-specific logic here ...
  // For each tool found, push a Tool object:
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
- Use `errors.push(...)` only for file-level failures (wrong format, corrupt data). The UI surfaces errors more prominently than warnings.
- Map every field you can to the canonical `Tool` model (see `src/types/tool.ts`).
- Fields with no equivalent in the core model go into `tool.sourceData` as a plain object — this keeps them available for a round-trip export back to the same format.
- If the format doesn't specify units, default to `'mm'` and add a warning.

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
    // ... serialise each tool ...
    if (tool.cutting?.spindleRpm === undefined) {
      warnings.push(`T${tool.toolNumber}: no spindle RPM — omitted from output`);
    }
    lines.push(`T${tool.toolNumber} D${tool.geometry.diameter}`);
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

- `options.filename` is the source file name — use it to derive a sensible output filename.
- Emit warnings for any `Tool` field that can't be represented in the target format.
- Don't crash on missing optional fields — most `Tool` properties are optional.
- Check `tool.sourceData` for any format-specific data you stashed during `parse()`.

---

## Step 5 — Register the converter

Open `src/converters/index.ts` and add two lines:

```ts
import { myFormatConverter } from './myformat';   // ← add

registry.register(myFormatConverter);              // ← add
```

That's it. The format will now appear in both the Source and Target dropdowns (respecting `canImport` / `canExport`), and will be available in the Tool Library import/export panels.

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
| `geometry.fluteLength` | `number?` | |
| `geometry.numberOfFlutes` | `number?` | |
| `geometry.cornerRadius` | `number?` | Bull-nose tools |
| `geometry.taperAngle` | `number?` | Half-angle in degrees |
| `cutting.spindleRpm` | `number?` | |
| `cutting.feedCutting` | `number?` | Main cutting feed rate |
| `cutting.feedPlunge` | `number?` | Vertical plunge feed |
| `cutting.coolant` | `CoolantMode?` | `'flood' \| 'mist' \| 'air' \| 'disabled'` |
| `offsets.z` | `number?` | Tool length offset |
| `material` | `ToolMaterial?` | `'carbide' \| 'hss' \| …` |
| `sourceData` | `Record<string,unknown>?` | Format-specific passthrough |

---

## Example: LinuxCNC

The existing LinuxCNC converter (`src/converters/linuxcnc/`) is a good reference for a simple text-based format. The HSMLib converter (`src/converters/hsmlib/`) shows how to handle XML-based formats that use `ArrayBuffer` decoding.
