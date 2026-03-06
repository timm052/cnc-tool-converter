# CNC Tool Converter

A browser-based tool library converter for CNC and CAM software. Convert tool definitions between formats without installing anything — everything runs locally in your browser.

## Features

- **Format conversion** — parse tool libraries from one format and export to another in one click
- **Multi-file support** — drop multiple files at once; merge them into a single output or convert them separately
- **Parsed tool preview** — inspect every tool's geometry, feeds, and cutting parameters before committing to an export
- **Persistent tool library** — save tools to a local library (IndexedDB), organised by machine group, with tags, starred favourites, and full-text search
- **Tool editor** — create or edit tools manually with a live SVG profile preview
- **Import / Export panels** — bring tools in from any supported format and export selected tools back out
- **Settings** — control decimal precision, pocket assignment, header comments, column visibility, and more — all saved automatically to your browser

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
2. Drag and drop one or more tool library files onto the drop zone (or click to browse).
3. The tools are parsed and displayed in the preview table.
4. Click **Convert** (or enable *Auto-convert on file load* in Settings).
5. Copy the output to the clipboard or download the file.

### Tool Library

The **Tool Library** page provides a persistent local store for your tools:

- **Import** — load tools from any supported format file into the library
- **New Tool** — create a tool from scratch using the editor
- **Edit** — click any row to open the tool editor
- **Star** — mark frequently used tools as favourites
- **Tags** — apply freeform labels for filtering (e.g. `roughing`, `aluminium`)
- **Machine Groups** — organise tools by machine name; the sidebar shows a per-machine count
- **Export** — select one or more tools and export them to any supported format

All data is stored in your browser's IndexedDB and never sent anywhere.

## Data Model

All converters share a single internal `Tool` model (`src/types/tool.ts`). The model covers the union of fields used by all supported formats:

| Group | Fields |
|-------|--------|
| Identity | `toolNumber`, `pocketNumber`, `type`, `description`, `manufacturer`, `productId` |
| Geometry | `diameter`, `shaftDiameter`, `overallLength`, `fluteLength`, `cornerRadius`, `taperAngle`, `numberOfFlutes`, … |
| Cutting | `spindleRpm`, `feedCutting`, `feedPlunge`, `feedRamp`, `coolant`, `clockwise`, … |
| Offsets | `x`, `y`, `z`, `a`, `b`, `c`, `u`, `v`, `w` |
| NC | `breakControl`, `liveTool`, `turret`, `manualToolChange` |

Fields that have no equivalent in the target format are silently dropped (with an optional data-loss warning).
Format-specific fields that don't map to the core model are preserved in `Tool.sourceData` for round-trip fidelity.

## Project Structure

```
src/
├── components/
│   ├── pages/          # ConverterPage, ToolManagerPage, SettingsPage
│   └── library/        # Library-specific sub-components
├── contexts/
│   ├── LibraryContext  # Tool library state + IndexedDB bridge
│   └── SettingsContext # App-wide settings (localStorage)
├── converters/
│   ├── index.ts        # ConverterRegistry + format registration
│   ├── hsmlib/         # Fusion 360 / HSMLib parser + writer
│   └── linuxcnc/       # LinuxCNC .tbl parser + writer
├── db/
│   └── library.ts      # Dexie (IndexedDB) schema
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
