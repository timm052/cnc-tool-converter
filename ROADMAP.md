# CNC Tool Converter — Roadmap

This document tracks planned improvements, from near-term polish to the long-term goal of a standalone Electron desktop application.

---

## Phase 1 — Foundation & Quick Wins

_Goal: Fill the most obvious gaps. Each item is self-contained and shippable independently._

### 1.1 Format Support ✅ Complete
- ✅ **HAAS offset table** — Format A parenthesised comment table (`.ofs`). Import + export. Length geometry → `offsets.z`, DIA geometry → `geometry.diameter`, wear values preserved in `sourceData`. (`src/converters/haas/`)
- ✅ **CSV import / export** — Unified as a proper `Converter` in the registry (`src/converters/csv/`). Wraps `csvLibrary.ts`; carries all library fields (tags, starred, machineGroups, toolMaterials). ExportPanel no longer has a hardcoded CSV path.
- ✅ **Fanuc G10 punch format** — Memory C G-code offset export (`.nc`). L10=H geometry, L11=H wear, L12=D geometry, L13=D wear. Import + export. (`src/converters/fanuc/`)
- ✅ **Mach3 / Mach4 CSV tool table** — 6-column CSV (Tool#, Description, Diameter, DiaWear, Height, HeightWear). Auto-detects optional header row. Import + export. (`src/converters/mach3/`)
- ⏳ **Mastercam .tooldb import** — SQLite-based, schema undocumented and version-dependent. Deferred — requires actual sample files to reverse-engineer schema safely.
- ⏳ **Integration test example files** — HAAS, Fanuc G10, and Mach3 are unit-tested with synthetic fixtures but lack real exported files. Add real files to `Example Files/Tool Libs/HAAS/`, `…/Fanuc/`, and `…/Mach3/`, then uncomment the stubs in `src/__tests__/converters/integration.test.ts`.

### 1.2 Speeds & Feeds Calculator ✅ Complete
- ✅ **Inline F&S calculator panel** — `SpeedsFeedsPanel` slide-over: diameter, material reference, surface speed (Vc m/min or SFM), chip load per tooth → RPM + feed rates. "Apply to tool" writes back to the tool editor.
- ✅ **Surface speed ↔ RPM converter** — Bidirectional Vc↔RPM widget in the calculator panel.
- ✅ **Per-material F&S visible in library table** — Click the green `⊞ N` badge in the Tags column to pop over a card showing RPM, Vc, feed, plunge, fz, DoC, WoC and notes per material. Badge only appears when the tool has `toolMaterials` entries.

### 1.3 Library Workflow ✅ Complete
- ✅ **Tool templates** — Save any tool as a named template (IndexedDB). Stamp out new tools from templates via the "Templates" toolbar button. Template picker slide-over shows type, diameter, flute count per template. (`src/components/library/TemplatePickerPanel.tsx`, `src/types/template.ts`)
- ✅ **Copy to machine group** — CopyToGroupModal toolbar action; duplicates selected tools into a target machine group.
- ✅ **Ctrl+D keyboard shortcut** — Duplicates the selected tool from the table.
- ✅ **Search across all fields** — Keyword search covers description, type, tags, manufacturer, productId, supplier, and location.
- ✅ **Multi-machine support** — Tools can now belong to multiple machine groups (`machineGroups: string[]`). DB migrated via Dexie v3. Export panel has "split by machine group" option.

### 1.4 Data Integrity ✅ Complete
- ✅ **Periodic backup nudge** — Amber warning in sidebar footer after 7 days without a backup. Implemented via `src/lib/backupNudge.ts`.
- ✅ **Cross-tab sync** — BroadcastChannel (`cnc-tool-library`) in `LibraryContext`; reloads library from IndexedDB when another tab mutates it. `suppressRef` prevents echo.
- ✅ **Bulk operation confirmation** — "Apply to N tools?" step added to `BulkEditPanel` and `RenumberModal` before committing changes. Inline confirm/cancel row replaces the apply button.
- ✅ **Undo for bulk operations** — After BulkEditPanel or RenumberModal applies, an 8-second "Undo" toast appears (bottom-centre). Clicking it snapshots the original values for every patched field and reverts via `patchEach`.

### 1.5 Output ✅ Complete
- ✅ **G-code tool offset sheet** — Downloads a `.txt` reference card with T#, diameter, Z-offset, flutes, description. Implemented in `src/lib/gcodeOffsetSheet.ts`.
- ✅ **Validation issues panel** — `ValidationPanel` scans the full library for duplicate T#, missing description, zero diameter, negative geometry, missing OAL, no cutting data, and low stock. Click-to-navigate to the flagged tool.

---

## Phase 2 — Advanced Library Features

_Goal: Make the tool library the single source of truth for a real toolroom._

### 2.1 Inventory & Stock Management
- **Stock transaction log** — Record every stock-in / stock-out event (quantity, date, reason, user note). Display a per-tool history. Currently only the current quantity is stored.
- **Low-stock dashboard** — Dedicated view showing all tools at or below reorder point, grouped by supplier. One-click generates a purchase order CSV.
- **Cost tracking** — Use `unitCost` (already stored) to calculate total inventory value per machine group or material category. Summary card in the sidebar.
- **Reorder point bulk edit** — Set reorder points for all tools of a given type or diameter range in one operation.

### 2.2 Tool Assembly
- **Stick-out visualisation** — When a tool has a linked holder (`holderId`), display a combined SVG profile: holder + tool, with the effective reach / stick-out dimension annotated. Uses `assemblyStickOut` field.
- **Assembly compatibility check** — Warn when the tool shank diameter doesn't match the holder bore, or when stick-out exceeds a configurable max.
- **Holder search in tool editor** — Typeahead search in the holder dropdown, instead of a flat list.

### 2.3 Tool Lifecycle
- **Usage tracking** — Record when a tool is loaded into a machine (via QR scan or manual entry). Log cumulative run time or part count. Basis for a tool life model.
- **Maintenance reminders** — Set a "regrind / replace" threshold (hours or part count). Flag tools approaching the threshold in the library table and on the label.
- **Tool condition notes** — Quick status tag: New / Good / Worn / Requires regrind / Scrapped. Filterable from the sidebar.

### 2.4 Improved Import Workflow
- **Merge on duplicate** — During import, when a matching tool is found, offer a field-level merge: choose which fields to take from the incoming tool and which to keep from the existing record. Currently only skip or overwrite.
- **Import preview diff** — Show a before/after diff for overwrite candidates before committing.
- **Supplier catalogue import** — Import directly from supplier CSV formats (e.g. Sandvik CoroPlus, Kennametal, Iscar) with pre-built column maps.

### 2.5 Materials & Cutting Data
- **Material database presets** — Ship a default material library (6061 aluminium, 304 stainless, 4140 steel, Ti-6Al-4V, nylon, MDF, etc.) that users can customise. Currently the library starts empty.
- **Cutting data wizard** — Step-by-step guided entry for a new tool+material combination. Prompts for tool geometry, material hardness, and machine type, then suggests starting F&S values based on a built-in lookup table.
- **Surface speed library** — Per-material, per-tool-material (carbide vs HSS vs ceramics) recommended Vc ranges. Used by the F&S calculator.

---

## Phase 3 — Integration & Intelligence

_Goal: Connect the tool library to the broader CNC workflow._

### 3.1 Advanced Export
- **Split-by-machine-group export** — Export each machine group as a separate file in one click (already exists per-format; expose as a batch action).
- **G54–G59 offset sheet export** — Generate a work-offset reference sheet with tool numbers and offsets formatted for a specific machine's control dialect (Fanuc, HAAS, Siemens).
- **BOM / tool list for a job** — Create a named "job" that links to a subset of library tools. Export the job's tool list as a formatted PDF or CSV for the machine operator.
- **CAM post-processor snippet** — Generate the tool definition block (tool call + F&S) in the syntax of a selected post-processor (Fanuc, HAAS, Mach3, LinuxCNC). Paste directly into a CAM tool library or G-code program.

### 3.2 Batch & Automation
- **Watch-folder mode (PWA / Electron only)** — Monitor a directory for new tool library files and auto-import them. Useful for automated tool pre-setting workflows.
- **Command-line interface (Electron only)** — `cnc-tools convert --from hsmlib --to linuxcnc input.hsmlib > output.tbl`. Scriptable conversion for CI/post-processor pipelines.
- **Scheduled backup** — Auto-backup the library to a chosen folder at a set interval (daily / weekly). Electron only (requires filesystem access).

### 3.3 Collaboration (Nice to Have)
- **JSON sync file** — Export / import a "sync package" (library + materials + holders) that can be shared via a network drive or USB stick. No cloud required.
- **Change log** — Track who changed what field and when (name is free-text; no auth required). Stored as a per-tool audit trail in IndexedDB.
- **Library snapshot versioning** — Keep N most recent snapshots of the full library locally. Roll back to any snapshot with one click.

### 3.4 UI & UX Polish
- **Table virtualisation** — Windowed rendering for the library table (e.g. TanStack Virtual). Fixes performance at 300+ tools. High priority before Electron launch.
- **Resizable sidebar** — Drag the machine group sidebar to a preferred width. Persisted to settings.
- **Pinned columns** — Pin T# and description columns so they stay visible when scrolling right through many geometry columns.
- **Keyboard shortcut cheat sheet overlay** — Already triggered by `?` key; improve the layout and add the new shortcuts from Phase 1–2.
- **Dark / light mode auto-follow OS** — Detect `prefers-color-scheme` and switch theme automatically (with a "manual override" option in Settings).
- **Internationalisation (i18n)** — Extract all UI strings to a translation file. Ship English by default; allow community language packs.

---

## Phase 4 — Electron Desktop Application

_Goal: Ship CNC Tool Converter as a standalone `.exe` / `.dmg` / `.AppImage` with filesystem access and OS integration._

### 4.1 Why Electron

A browser-based app can't:
- Open and save files directly from the local filesystem without user interaction every time
- Watch folders for changes
- Run a CLI
- Integrate with the OS (file associations, system tray, native file dialogs)
- Store data outside the browser sandbox (IndexedDB is browser-profile-scoped and can be cleared)

Electron provides all of these while reusing the entire React UI without changes.

### 4.2 Migration Plan

**Step 1 — Add Electron boilerplate**
- Install `electron`, `electron-builder`, `@electron/remote` (or use IPC pattern)
- Create `electron/main.ts` — the Electron main process
- Create `electron/preload.ts` — exposes a safe IPC bridge to the renderer (no `nodeIntegration`)
- Add `electron:dev` and `electron:build` npm scripts (Vite builds the renderer; Electron wraps it)
- Keep the Vite web build working — both targets share 100% of the React codebase

**Step 2 — Replace IndexedDB with SQLite**
- Use `better-sqlite3` in the main process (native, synchronous, fast)
- Expose DB operations via IPC: `db:getTools`, `db:putTool`, `db:deleteTool`, etc.
- Create an `ElectronLibraryAdapter` that implements the same interface as the current Dexie adapter
- Migrate the `LibraryContext` to use the adapter pattern (thin abstraction over either backend)
- On first Electron run, migrate existing IndexedDB data to SQLite automatically

**Step 3 — Native file dialogs**
- Replace the `<input type="file">` drop zone with `dialog.showOpenDialog` via IPC
- Replace the `URL.createObjectURL` download with `fs.writeFile` + optional `shell.showItemInFolder`
- Keep the web file drop zone working as a fallback for the browser build

**Step 4 — Filesystem features**
- Watch-folder mode (Phase 3.2) — use `chokidar` or `fs.watch` in the main process
- Scheduled backup to a user-chosen directory (Phase 3.2)
- File associations — register `.hsmlib`, `.tbl` so double-clicking opens them directly in the app
- Auto-updater via `electron-updater` (GitHub Releases or a self-hosted endpoint)

**Step 5 — CLI interface**
- `electron/cli.ts` — parse `process.argv` in the main process; if arguments are present, run headless conversion and exit
- Reuses the converter registry directly; no renderer involved
- Package as both a GUI app and a CLI tool in the same binary

**Step 6 — Packaging & distribution**
- `electron-builder` targets: Windows (NSIS installer + portable `.exe`), macOS (`.dmg`), Linux (`.AppImage` + `.deb`)
- Code-sign on Windows (Authenticode) and macOS (Developer ID)
- Publish to GitHub Releases; auto-updater checks on startup
- Optional: Snap / Flatpak for Linux distribution

### 4.3 Electron-only Nice-to-Have Features
- **System tray icon** — Quick access to backup, recent conversions, and library stats without opening the full window
- **Native notifications** — Low-stock alerts, backup reminders, and tool-life warnings as OS notifications
- **Drag files out** — Drag a converted file from the output panel directly onto the desktop or into another app
- **Multi-window support** — Open the library and converter in separate windows simultaneously
- **Offline map** — Not applicable (already fully offline), but ensure no CDN dependencies in packaged build

---

## Nice-to-Have Features (Any Phase)

These can be picked up opportunistically when they fit alongside other work.

| Feature | Status | Notes |
|---|---|---|
| **Dark mode follows OS** | ✅ Done | `'auto'` theme option added; reads `prefers-color-scheme` and listens for changes |
| **Smart renumber suggestions** | ✅ Done | Quick-preset buttons in Renumber modal: Seq×1, Seq×10, Mills@100, Drills@200, Taps@300 |
| **Batch unit conversion** | ✅ Done | `→ mm` / `→ in` split-button in toolbar when tools selected; geometry + feeds scaled; undo toast |
| **Colour-coded tool types in table** | ✅ Done | Subtle left border accent on each row, colour matched to tool type badge |
| **Tooltip on truncated description** | ✅ Done | Description title shows comment text too when present (`Description — Comment`) |
| **Inline tag editing** | ✅ Done | Hover a tag chip → × button removes the tag via `onPatchTool` without opening the editor |
| **Notes / comments field on tool** | ✅ Done | `comment` field already on model; now surfaced as tooltip on description cell |
| **Recent files list** | ✅ Done | Last 5 successfully-imported file names shown in ImportPanel (localStorage) |
| **Metric ↔ Imperial display toggle** | ✅ Done | `as-is / mm / inch` toggle in filter bar; geometry columns convert on-the-fly without mutating stored values |
| **Export to Excel (.xlsx)** | ✅ Done | `xlsx` package; `xlsxExport.ts` writes all tool fields with auto-width columns; first option in ExportPanel |
| **Import from Excel (.xlsx)** | ✅ Done | `xlsxImport.ts` parses `.xlsx` to `Tool[]`; permissive column matching; full duplicate-detection flow in ImportPanel |
| **Print labels from QR scan** | ✅ Done | Find-mode no longer auto-opens editor; shows action card with Open Editor / Print Label / Scan Again buttons |
| **Changelog / release notes overlay** | ✅ Done | `ChangelogModal` shown once per version (keyed to `package.json` version in localStorage); dismissed with "Got it" |
| **Keyboard-driven new-tool wizard** | — | Tab through fields; create a tool without touching the mouse |
| **Tool image / photo** | ✅ Done | Click/drag-drop upload in ToolEditor Library tab; resized client-side (≤800px JPEG, ~100 KB) via canvas; stored as `imageBase64` in IndexedDB; shown as preview with remove button; appears as a 16mm photo strip above card in PDF tool sheet |
| **Barcode support** | — | Scan a manufacturer barcode to auto-fill `productId` and look up specs from a tool database |
| **Supplier pricing integration** | — | Optional API key for distributor catalogues (e.g. McMaster-Carr, MSC) to fetch current pricing |
| **Tool comparison history** | — | Save a compare session and reload it later |
| **Custom report builder** | — | Drag-and-drop column picker to create custom PDF/CSV reports |
| **Machine OEE tie-in** | — | Link tool usage to machine utilisation data (via CSV upload from OEE software) |
| **Augmented reality label** | — | QR code on label links to the tool's live record in the app (when hosted as PWA) |
| **Voice search** | — | `window.SpeechRecognition` — say "show all 10mm drills" to filter the table |
| **Tool wear tracking** | — | Record edge wear / chipping observations per use with a photo attachment. Feeds into tool life modelling. |
| **Favourite cutting conditions** | — | Save named F&S presets (e.g. "Aluminium roughing") and apply them to any tool in one click. |
| **Tool set / kit grouping** | — | Group tools into named sets (e.g. "Fixture drilling kit"). Export a kit as a single file. |
| **Configurable low-stock colour** | — | Let users choose the threshold colour for low-stock qty cells (default red). |
| **Drag to reorder tools** | — | Drag rows in the library table to manually reorder, then lock order with a "manual sort" setting. |
| **Column width memory** | — | Persist resized column widths to settings, restored on reload. |
| **Mastercam .tooldb import** | Blocked | Requires real sample files to reverse-engineer. |
| **SFM / Vc lookup table in F&S panel** | — | Drop-down of common material + tool-material combos with recommended Vc ranges pre-filled. |

---

## Version Milestones (Suggested)

| Version | Scope |
|---|---|
| **v0.2** | Phase 1 complete — HAAS/CSV converters, F&S calculator, templates, backup nudge |
| **v0.3** | Phase 2 complete — inventory tracking, assembly view, improved import, material presets |
| **v0.4** | Phase 3 complete — table virtualisation, job BOM, sync file, CLI (web build) |
| **v1.0** | Phase 4 complete — Electron desktop app, SQLite, native dialogs, auto-updater |
| **v1.x** | Nice-to-have features, community language packs, supplier integrations |
