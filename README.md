# CNC Tool Converter

A browser-based tool library converter for CNC and CAM software. Convert tool definitions between formats without installing anything — everything runs locally in your browser.

## Features

- **Format conversion** — parse tool libraries from one format and export to another in one click
- **Batch / folder mode** — drop an entire folder and convert all matching files at once
- **Field mapping** — copy values between fields after parsing (e.g. map a custom description field to the standard one) — rules saved per format-pair
- **Parsed tool preview** — inspect every tool's geometry, feeds, and cutting parameters before committing to an export
- **Persistent tool library** — save tools to a local library (IndexedDB), organised by machine group, with tags, starred favourites, and full-text search
- **Tool editor** — create or edit tools manually with a live SVG profile preview and undo/redo
- **Import / Export panels** — bring tools in from any supported format; duplicate detection with per-tool skip controls
- **Bulk edit** — patch machine group, tags, material, and more across many tools at once
- **Compare** — side-by-side comparison of up to 4 tools
- **Renumber** — resequence tool numbers with configurable start and step
- **Print Sheet** — export a compact PDF tool sheet (direct download, no browser print dialog); configurable columns per page and section visibility
- **Print Labels** — generate printable labels with QR codes for physical tool bins; configurable label size, field selection, and QR content
- **Settings** — control decimal precision, pocket assignment, header comments, column visibility, sort order, and more — all saved automatically

## Supported Formats

| Format | Import | Export | Extensions |
|--------|:------:|:------:|------------|
| Autodesk Inventor CAM / Fusion 360 (HSMLib) | ✅ | ✅ | `.hsmlib` |
| LinuxCNC / EMC2 tool table | ✅ | ✅ | `.tbl`, `.tool` |

> More formats are planned — see [Adding a Converter](docs/adding-a-converter.md) if you'd like to contribute one.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (bundled with Node.js)

### Install and run

```bash
git clone https://github.com/timm052/cnc-tool-converter.git
cd cnc-tool-converter
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build for production

```bash
npm run build        # outputs to dist/
npm run preview      # serve the production build locally
```

The output is a static site — drop the `dist/` folder on any static host (GitHub Pages, Netlify, Cloudflare Pages, etc.).

## Usage

### Converter

1. Select a **Source Format** and **Target Format** from the dropdowns.
2. Drag and drop one or more tool library files onto the drop zone, or switch to **Folder** mode to load all matching files from a directory recursively.
3. The tools are parsed and displayed in the preview table.
4. Optionally open the **Field Mapping** editor (map icon) to copy values between fields before the output is written.
5. Click **Convert** (or enable *Auto-convert on file load* in Settings).
6. Copy the output to the clipboard or download the file.

### Tool Library

The **Tool Library** page provides a persistent local store for your tools:

- **Import** — load tools from any supported format file; duplicates are detected and can be skipped individually
- **New Tool** — create a tool from scratch using the editor
- **Edit** — click any row to open the tool editor (with undo/redo and `Ctrl+S` to save)
- **Star** — mark frequently used tools as favourites
- **Tags** — apply freeform labels for filtering (e.g. `roughing`, `aluminium`)
- **Machine Groups** — organise tools by machine name; the sidebar shows a per-machine count
- **Bulk Edit** — select multiple tools and patch shared fields in one operation
- **Compare** — select 2–4 tools and view them side by side
- **Renumber** — resequence T numbers with a configurable start and step; live preview shows the before/after mapping
- **Export** — select one or more tools and export them to any supported format
- **Print Sheet** — download a PDF tool sheet with compact multi-column layout; choose which sections (geometry, cutting, material, etc.) to include
- **Print Labels** — print sticky labels for tool bins; configure label dimensions, columns per row, QR code content (UUID / description / full info), and which fields appear on each label

### Keyboard Shortcuts (Tool Library)

| Key | Action |
|-----|--------|
| `j` / `↓` | Move focus down |
| `k` / `↑` | Move focus up |
| `Enter` / `e` | Edit focused tool |
| `Space` | Toggle selection |
| `/` | Focus search |
| `Esc` | Clear search / close panel |
| `Ctrl+Z` | Undo (Tool Editor) |
| `Ctrl+Shift+Z` | Redo (Tool Editor) |
| `Ctrl+S` | Save (Tool Editor) |
| `?` | Toggle shortcut help |

All data is stored in your browser's IndexedDB and never sent anywhere.

## Data Model

All converters share a single internal `Tool` model (`src/types/tool.ts`). The model covers the union of fields used by all supported formats:

| Group | Fields |
|-------|--------|
| Identity | `toolNumber`, `pocketNumber`, `type`, `description`, `manufacturer`, `productId` |
| Geometry | `diameter`, `shaftDiameter`, `overallLength`, `fluteLength`, `bodyLength`, `shoulderLength`, `cornerRadius`, `taperAngle`, `tipDiameter`, `threadPitch`, `numberOfFlutes` |
| Cutting | `spindleRpm`, `feedCutting`, `feedPlunge`, `feedRamp`, `coolant`, `clockwise` |
| Offsets | `x`, `y`, `z`, `a`, `b`, `c`, `u`, `v`, `w` |
| NC | `breakControl`, `liveTool`, `turret`, `manualToolChange` |

Fields that have no equivalent in the target format are silently dropped (with an optional data-loss warning).
Format-specific fields that don't map to the core model are preserved in `Tool.sourceData` for round-trip fidelity.

## Project Structure

```
src/
├── components/
│   ├── converter/      # BatchFolderDropZone, FieldMappingEditor
│   ├── pages/          # ConverterPage, ToolManagerPage, SettingsPage
│   └── library/        # LibraryTable, ToolEditor, ImportPanel, ExportPanel,
│                       # BulkEditPanel, ToolComparePanel, LabelPrintPanel,
│                       # ToolSheetPanel, MachineGroupInput
├── contexts/
│   ├── LibraryContext  # Tool library state + IndexedDB bridge
│   └── SettingsContext # App-wide settings (localStorage)
├── converters/
│   ├── index.ts        # ConverterRegistry + format registration
│   ├── hsmlib/         # Fusion 360 / HSMLib parser + writer
│   └── linuxcnc/       # LinuxCNC .tbl parser + writer
├── db/
│   └── library.ts      # Dexie (IndexedDB) schema
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   └── useUndoRedo.ts
├── lib/
│   ├── fieldMapping.ts # Post-parse field copy rules (localStorage)
│   ├── printUtils.ts   # PDF tool sheet + label print utilities
│   └── customToolTypes.ts
└── types/
    ├── tool.ts          # Canonical Tool model
    ├── libraryTool.ts   # LibraryTool (Tool + library metadata)
    └── converter.ts     # Converter interface + registry
```

## Contributing

Contributions are welcome — bug reports, new format converters, UI improvements, and documentation fixes alike.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, and [docs/adding-a-converter.md](docs/adding-a-converter.md) for a step-by-step walkthrough of adding a new format.

## License

MIT — see [LICENSE](LICENSE) for details.
