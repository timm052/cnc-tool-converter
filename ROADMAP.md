# CNC Tool Converter — Roadmap

This document tracks planned improvements, from near-term polish to the long-term goal of a standalone Electron desktop application.

---

## Phase 1 — Foundation & Quick Wins

_Goal: Fill the most obvious gaps. Each item is self-contained and shippable independently._

### 1.1 Format Support ✅ Complete (all items done)
- ✅ **HAAS offset table** — Format A parenthesised comment table (`.ofs`). Import + export. Length geometry → `offsets.z`, DIA geometry → `geometry.diameter`, wear values preserved in `sourceData`. (`src/converters/haas/`)
- ✅ **CSV import / export** — Unified as a proper `Converter` in the registry (`src/converters/csv/`). Wraps `csvLibrary.ts`; carries all library fields (tags, starred, machineGroups, toolMaterials). ExportPanel no longer has a hardcoded CSV path.
- ✅ **Fanuc G10 punch format** — Memory C G-code offset export (`.nc`). L10=H geometry, L11=H wear, L12=D geometry, L13=D wear. Import + export. (`src/converters/fanuc/`)
- ✅ **Mach3 / Mach4 CSV tool table** — 6-column CSV (Tool#, Description, Diameter, DiaWear, Height, HeightWear). Auto-detects optional header row. Import + export. (`src/converters/mach3/`)
- ⏳ **Mastercam .tooldb import** — SQLite-based, schema undocumented and version-dependent. Deferred — requires actual sample files to reverse-engineer schema safely.
- ✅ **Integration test example files** — Synthetic example files added to `Example Files/Tool Libs/HAAS/example.ofs`, `…/Fanuc/example.nc`, and `…/Mach3/tooltable.csv`. Integration tests enabled in `src/__tests__/converters/integration.test.ts` (15 new tests, 378 total, all green).

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

## Phase 2 — Advanced Library Features ✅ Complete

_Goal: Make the tool library the single source of truth for a real toolroom._

### 2.1 Inventory & Stock Management ✅ Complete
- ✅ **Stock transaction log** — `StockTransaction` type + DB v5 `transactions` table. `updateTool` auto-logs a transaction whenever `quantity` changes (reason: `initial` for first entry, `adjustment` otherwise). Manual entries via "+ Log entry" form. (`src/types/stockTransaction.ts`, `src/db/library.ts` v5, `src/contexts/LibraryContext.tsx`)
- ✅ **Low-stock dashboard** — `LowStockPanel` slide-over shows all tools at/below reorder point grouped by supplier; red toolbar button appears automatically when any tool is low. "Export PO CSV" downloads a purchasing CSV. (`src/components/library/LowStockPanel.tsx`)
- ✅ **Inventory value summary** — Total inventory value (`unitCost × quantity`) computed in real time; displayed in the machine group sidebar footer. Low-stock tool count shown alongside. (`src/components/pages/ToolManagerPage.tsx`)
- ✅ **Reorder point bulk edit** — `BulkEditPanel` Crib tab includes reorder point field; batch-set for all selected tools in one operation.

### 2.2 Tool Assembly ✅ Complete
- ✅ **Stick-out visualisation** — `ToolProfileSVG` already rendered holder silhouette when `holderId` is set; `allHolders` prop passed from `ToolEditor` enables combined assembly view with annotated stick-out. (`src/components/library/ToolProfileSVG.tsx`)
- ✅ **Assembly compatibility check** — Orange warning banner in ToolEditor Assembly section when tool `shaftDiameter` is outside the holder's `colletDiameterMin`/`Max` range. (`src/components/library/ToolEditor.tsx`)
- ✅ **Holder search in tool editor** — `HolderSearchField` inline typeahead combobox replaces flat `<select>` in the Assembly section; filters by name/type, highlights current selection, shows bore info in dropdown. (`src/components/library/ToolEditor.tsx`)

### 2.3 Tool Lifecycle ✅ Complete
- ✅ **Usage tracking** — `useCount` field on `LibraryTool`. Manual "+1" button in ToolEditor Crib tab increments the use count. `Uses` column in LibraryTable (toggleable, hidden by default) shows count/threshold ratio. (`src/types/libraryTool.ts`, `src/components/library/ToolEditor.tsx`, `src/components/library/LibraryTable.tsx`)
- ✅ **Maintenance reminders** — `regrindThreshold` field on `LibraryTool`. Progress bar in Crib tab turns amber at 80% and red at 100%. LibraryTable `Uses` column shows amber "soon" or red "regrind" badge when approaching/exceeding threshold.
- ✅ **Tool condition** — `ToolCondition` type: New / Good / Worn / Needs Regrind / Scrapped. Colour-coded badge in LibraryTable (toggleable column). Dropdown in ToolEditor Crib tab with live colour preview. Condition filter in sidebar. (`src/types/libraryTool.ts`, `src/components/library/LibraryTable.tsx`, `src/components/library/ToolEditor.tsx`)
- ✅ **Stock transaction history in Crib tab** — `StockTransactionHistory` component shows newest-first timeline per tool: reason badge, ±delta, qty-after, note, date. Manual "+ Log entry" form. (`src/components/library/StockTransactionHistory.tsx`)

### 2.4 Improved Import Workflow ✅ Complete
- ✅ **Merge on duplicate** — During import, each duplicate tool has its own card with Skip / Merge / Add as new buttons. Merge expands a field-diff view: only changed fields shown with old→new values and individual checkboxes. Selected field patches applied via `updateTool`; footer button shows combined "Add N + merge M" count. (`src/components/library/ImportPanel.tsx`)
- ✅ **Import preview diff** — Covered by the per-field merge UI above; each field shown individually with old→new values and individual accept checkboxes.
- ⏳ **Supplier catalogue import** — Import directly from supplier CSV formats (e.g. Sandvik CoroPlus, Kennametal, Iscar). Deferred to Phase 3 — requires real sample files from each supplier.

### 2.5 Materials & Cutting Data ✅ Complete
- ✅ **Material database presets** — 14 preset materials (Al 6061/7075/2024, Steel 1018/4140/D2, SS 304/316/17-4PH, Ti-6Al-4V, gray cast iron, brass C360, Delrin) with SFM/Vc ranges, hardness, machinability, and notes. "Presets" button in MaterialLibraryPanel footer — skips any that already exist by name. (`src/lib/materialPresets.ts`, `src/contexts/MaterialContext.tsx`, `src/components/library/MaterialLibraryPanel.tsx`)
- ✅ **Cutting data wizard** — 3-step guided entry: (1) pick tool + material, (2) choose tool grade + machine type + DOC/WOC, (3) review suggested Vc/RPM/feed/plunge/DoC/WoC and apply to the tool's per-material entry. Accessible via Maintain ▾ → F&S Wizard. (`src/components/library/CuttingWizardPanel.tsx`)
- ✅ **Surface speed library** — `src/lib/surfaceSpeedPresets.ts` — per-material, per-tool-grade (carbide/HSS/ceramic/CBN/PCD) Vc ranges with chip-load factors and notes. Used by the F&S calculator "Quick fill ▾" dropdown and the cutting data wizard.

---

## Phase 3 — Integration & Intelligence ✅ Complete (v0.4)

_Goal: Connect the tool library to the broader CNC workflow._

### 3.1 Advanced Export
- ✅ **Split-by-machine-group export** — `ExportPanel` already supports "Split by machine group" and "Split by material" modes; staggered multi-file downloads. One file per group, with tools pinned to a single group per file.
- ✅ **G54–G59 offset sheet export** — `WorkOffsetSheetPanel` (Print → Work Offsets): dialect selector (Fanuc, HAAS, Mach3, LinuxCNC, Siemens), editable X/Y/Z/A/B per offset slot, autocomplete from library machine groups, persisted per dialect to localStorage. Downloads .txt reference card or .csv. Dialect-specific extended slots (Fanuc G54.1 P1–P48, HAAS G110–G129, LinuxCNC G59.1–G59.3, Siemens G505 D-frames).
- ✅ **BOM / tool list for a job** — `JobsPanel` slide-over (Libraries ▾ → Jobs): create named jobs, pick tools from a searchable checklist, export as PDF (jsPDF) or CSV. Jobs persisted to localStorage (`cnc-tool-jobs`). (`src/types/job.ts`, `src/lib/jobStore.ts`, `src/components/library/JobsPanel.tsx`)
- ✅ **CAM post-processor snippet** — `src/lib/camSnippet.ts` generates tool-call blocks for Fanuc, HAAS, Mach3, LinuxCNC, Siemens Sinumerik. `CamSnippetPanel` slide-over: dialect picker, live preview, Copy + Download buttons. Accessible from the "N selected ▾" toolbar dropdown (falls back to all tools when none selected).

### 3.2 Sync
- ✅ **JSON sync file** — Backup upgraded to v2 format: exports tools + materials + holders in one `.json`. Restore imports all three with skip-on-duplicate logic. Backward-compatible with v1 tool-only files. `addHolders` bulk method added to `HolderContext`.
- ✅ **Change log** — DB v6 `auditLog` table. `updateTool` diffs old vs new for every non-internal field and writes a `ToolAuditEntry`. `AuditLogHistory` component in ToolEditor Crib tab shows newest-first with red/green old→new values. `operatorName` setting added to Settings → Operator section.
- ✅ **Library snapshot versioning** — DB v7 `snapshots` table (Dexie). `saveSnapshot` stores full tools + materials + holders; keeps max 10, auto-deletes oldest. `restoreSnapshot` replaces all three tables atomically. `SnapshotPanel` slide-over (Maintain → Snapshots): optional label, newest-first list, restore with confirmation, delete with confirmation.
- ✅ **External database support (REST + WebDAV)** — `src/lib/remoteSync.ts`: push/pull, `SyncPayload` v2, ETag optimistic locking, `mergePayloads()` merge-by-id. `useRemoteSync` hook: merge-on-push flow, `If-Match` header, 412 auto-retry (3×), merge stats. `syncVersion` counter + `lastModifiedBy` in every payload. Settings → Remote Database: URL, auth type (Bearer / Basic), username, password, auto-sync. Multi-user: before every push the current remote is fetched and merged (newer `updatedAt` wins per record); concurrent writes detected via ETag and retried automatically; operator name required warning in sync dropdown; merge stats toast after any sync that brought remote changes.

### 3.4 UI & UX Polish
- ✅ **Table virtualisation** — `@tanstack/react-virtual` v3; `useVirtualizer` in `LibraryTable` with top/bottom spacer rows. Renders only visible rows; estimates 33 px (compact) / 45 px (normal). Fixes performance at 300+ tools.
- ✅ **Resizable sidebar** — Drag handle on the machine group sidebar right edge; width clamped 140–320 px, persisted to localStorage `machine-sidebar-width`.
- ✅ **Pinned columns** — Star, checkbox, edit, and T# columns are `position: sticky` with `left-0/8/16/24` offsets; T# has a right-border separator. Virtualizer spacer heights set via callback refs (no inline-style lint warnings).
- ✅ **Keyboard shortcut cheat sheet overlay** — Reorganised into four sections (Navigation, Selection, Panels, Editor) in a two-column grid; `Ctrl+I` (Import) added as functional shortcut.
- **Dark / light mode auto-follow OS** — Detect `prefers-color-scheme` and switch theme automatically (with a "manual override" option in Settings).
- **Internationalisation (i18n)** — Extract all UI strings to a translation file. Ship English by default; allow community language packs. _(Deferred to Phase 4+)_

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

## Version Milestones

| Version | Scope | Status |
|---|---|---|
| **v0.2** | Phase 1 complete — HAAS/Fanuc/Mach3/CSV/XLSX converters, F&S calculator, templates, backup nudge | ✅ Done |
| **v0.3** | Phase 2 complete — inventory tracking, assembly view, improved import, material presets, audit log | ✅ Done |
| **v0.4** | Phase 3 complete — table virtualisation, remote sync (REST + WebDAV), CAM snippets, work offset sheet, snapshots | ✅ Done |
| **v1.0** | Phase 4 complete — Electron desktop app, SQLite, native dialogs, auto-updater | Planned |
| **v1.x** | Nice-to-have features, community language packs, supplier integrations | Future |
