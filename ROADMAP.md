# CNC Tool Converter — Roadmap

This document tracks planned improvements, from near-term polish to the long-term goal of a standalone Electron desktop application.

---

## Phase 1 — Foundation & Quick Wins

_Goal: Fill the most obvious gaps. Each item is self-contained and shippable independently._

### 1.1 Format Support
- **HAAS .cnc converter** — The most common CNC brand in job shops. Framework slot already exists in `converters/index.ts`. Simple columnar text format (T# / diameter / length / description). Import + export.
- **CSV import / export** — Universal spreadsheet compatibility. Configurable column mapping on import (handles supplier catalogues with varied column order). Currently CSV has a hardcoded path outside the registry; unify it as a proper `Converter`.
- **Mastercam .tooldb import** — Read-only import of Mastercam tool libraries (SQLite-based). Very widely used in production shops.
- **Mach3 / Mach4 .xml tool table** — Common on hobby/retrofit CNC machines. Simple XML format.
- **Fanuc offset table** — Plain text `T## R## H##` offset sheets used on Fanuc 0i/31i controls.

### 1.2 Speeds & Feeds Calculator
- **Inline F&S calculator panel** — Accessible from the tool editor and library table. Inputs: diameter, material (from material library), surface speed (SFM or m/min), chip load per tooth. Outputs: RPM, feed rate, plunge rate. Writes calculated values back to the tool with one click.
- **Surface speed ↔ RPM converter** — Bidirectional: enter RPM to get Vc, or enter Vc to get RPM. Aware of tool diameter. Displayed as a small widget alongside spindle RPM in the tool editor.
- **Per-material F&S visible in library table** — Hover a tool row to see a popover of material-specific speeds from `ToolMaterialEntry[]`. Currently this data is stored but invisible from the table.

### 1.3 Library Workflow
- **Tool templates** — Save any tool as a named template. "New from template" stamps out a copy with a fresh ID and incremented tool number. Stored in IndexedDB alongside tools.
- **Copy to machine group** — Toolbar action / context menu: duplicate selected tools into a different machine group, preserving all data except tool number (auto-assigned).
- **Ctrl+D keyboard shortcut** — Duplicate the focused tool directly from the table, without needing the toolbar button.
- **Search across all fields** — Extend the current keyword search (description / type / tags) to also match manufacturer, productId, supplier, and location fields.

### 1.4 Data Integrity
- **Periodic backup nudge** — Show "last backed up X days ago" in the sidebar footer. One-click triggers existing backup download. Prompt appears after 7 days without a backup.
- **Cross-tab sync** — Handle IndexedDB `versionchange` events to refresh the in-memory library context when the same app is open in multiple browser tabs simultaneously.
- **Undo for bulk operations** — Bulk edit, bulk delete, and renumber currently have no undo. Add a confirmation step with a count ("Patch 12 tools?") before committing.

### 1.5 Output
- **G-code tool offset sheet** — Lightweight printable reference card: T# / description / Z-offset / diameter / notes. Formatted as a single-column list a machinist tapes to the machine. Separate from the existing multi-page PDF data sheet.
- **Validation issues panel** — "Show all issues" view listing every tool with warnings/errors across the whole library. Clicking a row jumps to that tool in the table. Useful after a bulk import.

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

| Feature | Notes |
|---|---|
| **Dark mode follows OS** | Detect `prefers-color-scheme`; switch automatically |
| **Keyboard-driven new-tool wizard** | Tab through fields; create a tool without touching the mouse |
| **Tool image / photo** | Attach a photo to a library tool. Store as base64 in IndexedDB. Show in tool editor and print sheet. |
| **Barcode support** | Scan a manufacturer barcode to auto-fill `productId` and look up specs from a tool database |
| **Supplier pricing integration** | Optional API key for distributor catalogues (e.g. McMaster-Carr, MSC) to fetch current pricing |
| **Smart renumber suggestions** | Suggest T# assignment based on tool type (e.g. drills start at T100, taps at T200) |
| **Tool comparison history** — | Save a compare session and reload it later |
| **Custom report builder** | Drag-and-drop column picker to create custom PDF/CSV reports |
| **Machine OEE tie-in** | Link tool usage to machine utilisation data (via CSV upload from OEE software) |
| **Metric ↔ Imperial toggle** | Per-session toggle to view all dimensions in preferred units, regardless of stored unit |
| **Augmented reality label** | QR code on label links to the tool's live record in the app (when hosted as PWA) |
| **Voice search** | `window.SpeechRecognition` — say "show all 10mm drills" to filter the table |
| **Changelog / release notes overlay** | Show a "What's new" panel after an update, keyed to the version in `package.json` |

---

## Version Milestones (Suggested)

| Version | Scope |
|---|---|
| **v0.2** | Phase 1 complete — HAAS/CSV converters, F&S calculator, templates, backup nudge |
| **v0.3** | Phase 2 complete — inventory tracking, assembly view, improved import, material presets |
| **v0.4** | Phase 3 complete — table virtualisation, job BOM, sync file, CLI (web build) |
| **v1.0** | Phase 4 complete — Electron desktop app, SQLite, native dialogs, auto-updater |
| **v1.x** | Nice-to-have features, community language packs, supplier integrations |
