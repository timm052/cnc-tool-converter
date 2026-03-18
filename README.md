# CNC Tool Converter

A browser-based CNC tool library manager and format converter. Convert tool definitions between formats, maintain a persistent tool library with inventory tracking, and sync to a remote server — all without installing anything. Everything runs locally in your browser.

**Current version: v0.3** (Phase 1 + 2 complete; Phase 3 in progress)

---

## Features

### Format Conversion
- **10 formats supported** — parse tool libraries from one format and export to another in one click
- **Batch / folder mode** — drop an entire folder and convert all matching files at once
- **Field mapping** — copy values between fields after parsing; rules saved per format-pair
- **Parsed tool preview** — inspect every tool's geometry, feeds, and cutting parameters before exporting

### Persistent Tool Library
- **IndexedDB storage** — tools, materials, holders, templates, stock transactions, audit log, and snapshots persist between sessions
- **Machine groups** — organise tools by machine; collapsible sidebar shows per-group tool counts and inventory value
- **Tags, stars, conditions** — freeform labels, favourites, and `New / Good / Worn / Needs Regrind / Scrapped` lifecycle states
- **Full-text search** — searches description, type, tags, manufacturer, productId, supplier, and location simultaneously
- **Table virtualisation** — renders only visible rows via `@tanstack/react-virtual`; smooth at 1000+ tools

### Editing
- **Tool editor** — full slide-over editor with live SVG profile preview, undo/redo (`Ctrl+Z` / `Ctrl+Y`), `Ctrl+S` to save
- **Templates** — save any tool as a named template; stamp out new tools from the template picker
- **Bulk edit** — patch machine group, tags, material, quantity, reorder point, and more across many tools at once
- **Unit conversion** — convert selected tools between mm and inch with one click; scales all geometry and feed fields; 8-second undo toast
- **Renumber** — resequence T numbers with configurable start and step; live before/after preview; smart presets (Mills@100, Drills@200, Taps@300)

### Import / Export
- **Import panel** — full duplicate detection with per-tool Skip / Merge / Add-as-new controls; field-level diff for merges; recent files list
- **Export panel** — single file or split by machine group / material; staggered multi-file downloads
- **Excel (.xlsx)** — import and export with auto-width columns; all library fields included
- **JSON sync file** — backup/restore covers tools + materials + holders in one v2 JSON file
- **Copy to group** — duplicate selected tools into a target machine group

### Inventory & Lifecycle
- **Stock transaction log** — auto-logged on quantity change; manual entries with reason and note
- **Low-stock dashboard** — red toolbar button appears when any tool is at/below reorder point; exports a purchasing CSV
- **Inventory value** — total value (`unitCost × quantity`) shown in the sidebar footer
- **Usage tracking** — `useCount` field with `+1` button; regrind threshold with progress bar (amber ≥ 80%, red ≥ 100%)
- **Tool assembly** — holder library, stick-out visualisation, compatibility check (shaft vs collet diameter)
- **Periodic backup nudge** — amber warning after 7 days without a backup

### Materials & Cutting Data
- **Material database** — 14 preset materials (aluminium alloys, steels, stainless, titanium, cast iron, brass, Delrin)
- **Per-material F&S** — store separate RPM/feed/plunge/DoC/WoC per material per tool
- **F&S calculator** — Vc ↔ RPM, chip load, quick-fill from surface speed presets (5 tool grades × 8 material groups)
- **Cutting data wizard** — 3-step guided entry: tool + material → grade + machine + DOC → review and apply

### Output & Reference Sheets
- **Tool sheet PDF** — compact multi-column layout; configurable sections; direct download via `jspdf`
- **Tool labels** — printable QR-coded labels; configurable size, fields, and QR content
- **G-code tool offset sheet** — `.txt` reference card with T#, diameter, Z-offset, flutes, description
- **Work offset sheet (G54–G59)** — Print → Work Offsets: dialect-aware (Fanuc / HAAS / Mach3 / LinuxCNC / Siemens), X/Y/Z/A/B per slot, autocomplete from machine groups, localStorage persistence, `.txt` or `.csv` download
- **CAM snippet generator** — tool-call G-code blocks for Fanuc, HAAS, Mach3, LinuxCNC, Siemens Sinumerik; live preview; copy or download

### Data Safety & Sync
- **Audit log** — every field change is recorded with old/new value and operator name; shown in the Crib tab change log
- **Library snapshots** — save up to 10 named snapshots; restore atomically with one click (Maintain → Snapshots)
- **Cross-tab sync** — `BroadcastChannel` keeps all open tabs in sync without a reload
- **Remote database sync** — push/pull to any REST or WebDAV endpoint (Nextcloud, ownCloud, etc.):
  - Bearer token or Basic auth (username + password)
  - Merge-on-push: fetches remote before writing; prefers newer `updatedAt` per record
  - ETag-based optimistic locking; auto-retries on 412 up to 3×
  - `syncVersion` monotonic counter + `lastModifiedBy` in every payload
  - Auto-sync on change, manual push/pull, test-connection; cloud toolbar icon with status colour

### Settings & Themes
- **6 themes** — Dark (default), Light, Retro 90s, Windows XP, Mac OS 9, Auto (follows OS)
- **Column visibility** — toggle 20+ columns independently; density (compact / comfortable)
- **Display unit override** — show all geometry in mm or inch regardless of stored unit
- **Operator name** — recorded in audit log and remote sync payloads (no login required)
- **LinuxCNC writer options** — decimal places, pocket assignment, header comment
- **HSMLib writer options** — machine vendor and model defaults
- **Dev mode** — exposes a debug tab for raw tool data inspection

---

## Supported Formats

| Format | Import | Export | Extensions |
|--------|:------:|:------:|------------|
| Autodesk Fusion 360 / Inventor CAM (HSMLib) | ✅ | ✅ | `.hsmlib` |
| Fusion 360 Cloud Library JSON | ✅ | ✅ | `.json` |
| LinuxCNC / EMC2 tool table | ✅ | ✅ | `.tbl`, `.tool` |
| HAAS offset table | ✅ | ✅ | `.ofs` |
| Fanuc G10 Memory C | ✅ | ✅ | `.nc` |
| Mach3 / Mach4 CSV tool table | ✅ | ✅ | `.csv` (Mach3 dialect) |
| Generic CSV | ✅ | ✅ | `.csv` |
| Excel | ✅ | ✅ | `.xlsx` |
| RhinoCAM | ✅ | — | `.vkb` (binary) |

---

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

---

## Usage

### Converter page

1. Select **Source Format** and **Target Format**.
2. Drop one or more files onto the drop zone, or switch to **Folder** mode to convert all matching files in a directory.
3. Inspect the parsed tool preview table.
4. Optionally open the **Field Mapping** editor to copy values between fields.
5. Click **Convert** (or enable *Auto-convert on file load* in Settings).
6. Copy the output or download the file.

### Tool Library page

| Action | How |
|--------|-----|
| Import | Import button → drop a file → review duplicates |
| New tool | "New Tool" button or `n` key |
| Edit | Click a row, or focus it with `j`/`k` and press `Enter` |
| Filter | Machine group sidebar, tag filter, star filter, condition filter, low-stock filter |
| Select | Click checkbox, `Space` to toggle, `Ctrl+A` to select all visible |
| Bulk actions | "N selected ▾" dropdown — Duplicate, Copy to Group, F&S Calculator, Convert units, Compare |
| Export | "Export N" button → choose format + optional split mode |
| Backup | Backup button (cloud icon with arrow) → downloads JSON v2 |
| Restore | Restore button → pick a JSON backup file |
| Snapshot | Maintain ▾ → Snapshots → label + save; restore any past state |
| Remote sync | Cloud icon in toolbar (visible when URL configured) → Push / Pull / Test |

### Keyboard shortcuts (Tool Library)

| Key | Action |
|-----|--------|
| `j` / `↓` | Move focus down |
| `k` / `↑` | Move focus up |
| `Enter` / `e` | Edit focused tool |
| `Space` | Toggle selection |
| `n` | New tool |
| `/` | Focus search |
| `Esc` | Clear search / close panel |
| `Ctrl+D` | Duplicate selected tool |
| `Ctrl+Z` | Undo (Tool Editor) |
| `Ctrl+Shift+Z` | Redo (Tool Editor) |
| `Ctrl+S` | Save (Tool Editor) |
| `Ctrl+Q` | Open QR scanner |
| `?` | Toggle shortcut help |

---

## Remote Sync / WebDAV

Settings → Remote Database lets you configure a sync endpoint:

- **REST API** — any server that accepts `GET` / `PUT` of the v2 JSON payload
- **WebDAV** — Nextcloud, ownCloud, or any standard WebDAV server

The payload format is identical to the JSON backup file, so you can test it locally with any static file server.

Example Nextcloud URL:
```
https://cloud.example.com/remote.php/dav/files/username/cnc-library.json
```

Use an **app password** (Settings → Security → App passwords in Nextcloud) rather than your main password. Enable auto-sync to push after every change, or use manual push/pull from the cloud icon in the toolbar.

Multi-user safety: before every push the current remote is fetched and merged (newer `updatedAt` wins per record). WebDAV `If-Match` ETag locking detects concurrent writes and retries automatically.

---

## Data Model

All converters share a single internal `Tool` model (`src/types/tool.ts`). `LibraryTool` extends `Tool` with library metadata (`src/types/libraryTool.ts`).

| Group | Fields |
|-------|--------|
| Identity | `toolNumber`, `pocketNumber`, `type`, `description`, `manufacturer`, `productId`, `comment` |
| Geometry | `diameter`, `shaftDiameter`, `overallLength`, `fluteLength`, `bodyLength`, `shoulderLength`, `cornerRadius`, `taperAngle`, `tipDiameter`, `threadPitch`, `numberOfFlutes` |
| Cutting | `spindleRpm`, `feedCutting`, `feedPlunge`, `feedRamp`, `feedEntry`, `feedExit`, `feedRetract`, `feedMode`, `coolant`, `clockwise` |
| Offsets | `x`, `y`, `z`, `a`, `b`, `c`, `u`, `v`, `w` |
| NC | `breakControl`, `liveTool`, `turret`, `manualToolChange` |
| Library | `tags`, `starred`, `machineGroups`, `quantity`, `reorderPoint`, `unitCost`, `supplier`, `location`, `condition`, `useCount`, `regrindThreshold`, `holderId`, `imageBase64`, `customFields`, `toolMaterials` |

Format-specific fields not in the core model are preserved in `Tool.sourceData` for round-trip fidelity.

---

## Project Structure

```
src/
├── components/
│   ├── converter/       # BatchFolderDropZone, FieldMappingEditor, ThemeShowcasePage
│   ├── pages/           # ConverterPage, ToolManagerPage, SettingsPage, ToolDebugPage
│   └── library/         # LibraryTable, ToolEditor, ImportPanel, ExportPanel,
│                        # BulkEditPanel, ToolComparePanel, LabelPrintPanel,
│                        # ToolSheetPanel, SpeedsFeedsPanel, CuttingWizardPanel,
│                        # MaterialLibraryPanel, HolderLibraryPanel,
│                        # DuplicateFinderPanel, ValidationPanel, LowStockPanel,
│                        # TemplatePickerPanel, QrScannerPanel, CamSnippetPanel,
│                        # SnapshotPanel, WorkOffsetSheetPanel, AuditLogHistory,
│                        # StockTransactionHistory, ToolProfileSVG
├── contexts/
│   ├── LibraryContext   # Tools, templates, snapshots, audit log, replaceLibrary
│   ├── SettingsContext  # All settings (localStorage)
│   ├── MaterialContext  # Work materials (IndexedDB)
│   └── HolderContext    # Tool holders (IndexedDB)
├── converters/
│   ├── index.ts         # ConverterRegistry + format registration
│   ├── hsmlib/          # Fusion 360 HSMLib parser + writer
│   ├── fusion360json/   # Fusion 360 Cloud Library JSON parser + writer
│   ├── linuxcnc/        # LinuxCNC .tbl parser + writer
│   ├── haas/            # HAAS offset table parser + writer
│   ├── fanuc/           # Fanuc G10 Memory C parser + writer
│   ├── mach3/           # Mach3 CSV parser + writer
│   ├── csv/             # Generic CSV parser + writer
│   ├── xlsx/            # Excel import + export
│   └── rhinocam/        # RhinoCAM .vkb parser (import only)
├── db/
│   └── library.ts       # Dexie (IndexedDB) schema — v7 (tools, materials, holders,
│                        #   templates, transactions, auditLog, snapshots)
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── useUndoRedo.ts
│   └── useRemoteSync.ts  # Push/pull/merge with ETag + 412 retry
├── lib/
│   ├── fieldMapping.ts        # Post-parse field copy rules (localStorage)
│   ├── printUtils.ts          # PDF tool sheet + label generation
│   ├── gcodeOffsetSheet.ts    # Tool offset reference .txt
│   ├── workOffsetSheet.ts     # G54–G59 work offset reference
│   ├── camSnippet.ts          # CAM post-processor snippet generator
│   ├── remoteSync.ts          # HTTP push/pull, ETag, merge-by-id
│   ├── surfaceSpeedPresets.ts # Vc lookup table (8 materials × 5 grades)
│   ├── materialPresets.ts     # 14 preset work materials
│   ├── customToolTypes.ts     # User-defined tool type definitions
│   ├── downloadUtils.ts       # triggerDownload / triggerBinaryDownload
│   ├── backupNudge.ts         # Periodic backup reminder logic
│   └── unitConvert.ts         # mm ↔ inch geometry + feed scaling
└── types/
    ├── tool.ts             # Canonical Tool model
    ├── libraryTool.ts      # LibraryTool (Tool + library metadata)
    ├── converter.ts        # Converter interface + registry
    ├── material.ts         # WorkMaterial
    ├── holder.ts           # ToolHolder
    ├── template.ts         # ToolTemplate
    ├── stockTransaction.ts # StockTransaction, StockReason
    ├── auditEntry.ts       # ToolAuditEntry, AuditField
    └── snapshot.ts         # LibrarySnapshot, MAX_AUTO_SNAPSHOTS
```

---

## Contributing

Contributions are welcome — bug reports, new format converters, UI improvements, and documentation fixes alike.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, and [docs/adding-a-converter.md](docs/adding-a-converter.md) for a step-by-step walkthrough of adding a new format.

## License

MIT — see [LICENSE](LICENSE) for details.
