# Changelog

All notable changes to CNC Tool Converter are documented here.

## [1.2.0] — 2026-06-10

### Added

- **Dashboard / home page:** new landing page with at-a-glance cards for library size and top tool types, low-stock count, regrind-due count, machine maintenance due, and remote sync status, plus quick-action shortcuts to convert files, open the Tool Library, and add a tool
- **Help / Format Reference page:** table of all 8 supported formats showing file extensions, import/export support, and format-specific notes (e.g. RhinoCAM `.vkb` is parse-only, HSMLib is UTF-16 XML)
- **Machine maintenance tracking:** machines now have a maintenance interval, last-serviced date, notes, and a log of past maintenance entries; a "Log maintenance now" button records the current date and notes
- **Maintenance & stock notifications (desktop):** native notifications for machines due for maintenance, low-stock tools, and overdue backups, checked hourly and deduplicated to once per day per item
- **Settings — Startup:** choose the default landing page (Dashboard, Converter, Tool Library, Machines, Help, or Settings)
- **Settings — Notifications:** toggle maintenance, low-stock, and backup-reminder notifications independently, and configure how many days in advance maintenance reminders fire
- **Sync conflict resolution:** remote sync now records details of any tool, material, holder, tool set, or job that was changed on both sides since the last pull; a new conflict panel lists each record with a field-level diff and lets you keep the local version instead of the remote one
- **Spreadsheet import mapping wizard:** import an arbitrary CSV/XLSX file by manually mapping its columns to tool fields, with a live preview of the resulting tools before import
- **Command palette (Ctrl+K):** quickly jump to any page, or search for and open a specific tool or machine

### Fixed

- **ImportMappingWizard:** close button was missing `type="button"`

## [1.1.2] — 2026-06-10

### Changed

- **UI unification pass:** new `theme-dark.css` adds shadows, focus rings, and surface depth to the default dark theme
- **Theme accent colors:** type-accent border colors on the tool table are now theme-appropriate across all themes — Win95 VGA palette for `retro90s`, XP Luna palette for `winxp`, System 9 charcoal palette for `macos9`, and a deep-saturated set for `light` (previously all themes shared the same neon Tailwind defaults, which clashed with light/retro palettes)
- **Sidebar:** footer text now reads "8 formats supported" instead of a stale, incomplete format list
- **Header:** GitHub link now points to the project repository
- Added missing `type="button"` attributes across Sidebar, ConverterPage, and FileDropZone interactive buttons

## [1.1.1] — 2026-06-09

### Fixed

- **Backup/restore (Tauri):** tool sets and jobs were silently dropped when restoring a backup via the native file dialog; browser restore was unaffected
- **Backup:** `recordBackup()` now only fires when the file was actually saved — previously it fired even when the user cancelled the native Save dialog
- **Restore errors:** failures (e.g. corrupted JSON) now show a dismissible error toast instead of logging silently to the console
- **ToolSetPanel CSV export:** `mimeType` and `filename` arguments to `triggerDownload` were transposed — every export downloaded a file literally named `text/csv`
- **Fusion 360 JSON parser:** `numOr()` used a truthiness check that discarded valid `0` values for geometry dimensions (e.g. corner radius on a flat endmill)
- **Tauri adapter `toolsBulkPatch`:** the indexed `tool_number` column was not updated alongside the JSON blob, leaving it stale after any renumber operation
- **Tauri adapter update methods:** `materialsUpdate`, `holdersUpdate`, and `machinesUpdate` now wrap their read-modify-write in a `BEGIN`/`COMMIT` transaction to prevent concurrent overwrites
- **Settings:** `updateSettings()` now deep-merges `tableColumnVisibility` so a partial patch no longer erases unrelated column visibility flags; array-type settings are guaranteed to be arrays when loaded from older stored data
- **Sidebar:** `localStorage` access is now wrapped in try-catch; private/incognito browsing no longer crashes the sidebar on init
- **LibraryContext:** `requireAdapter()` now awaits the init Promise instead of throwing "Database not ready" during the startup window
- **LibraryContext:** `logTransaction` was missing a `broadcast()` call — stock events now refresh other open tabs, consistent with all other mutations
- **CLI `--version`:** now reads from `package.json` instead of a hardcoded `1.0.0` string
- **`openFiles` (Tauri):** multiple selected files are now read in parallel (`Promise.all`) instead of sequentially
- **`db/index.ts`:** removed private duplicate of `isTauri()` — now imports the shared implementation from `lib/tauri/fs`

---

## [1.1.0] — 2026-03-21

First desktop release — Tauri-packaged `.exe` / `.dmg` / `.AppImage`.

### Added
- **Tauri desktop build** — standalone ~10 MB native app; no browser or Node.js required to run
- **SQLite persistence** — tool library stored in `cnc-tool-converter.db` (replaces IndexedDB for the desktop build); browser/PWA build continues using IndexedDB unchanged
- **Native file dialogs** — open/save dialogs for all file operations (import, export, backup, restore, PDF save) via `tauri-plugin-dialog` and `tauri-plugin-fs`
- **CLI interface** — `CncToolConverter.exe convert`, `formats`, `inspect` commands for headless/batch use; also available as `npm run cli --`
- **Auto-updater** — startup update check via `tauri-plugin-updater`; downloads and installs from GitHub Releases
- **File associations** — `.hsmlib`, `.tbl`, `.ofs`, `.vkb` files open directly in the app

### Changed
- `triggerDownload` / `triggerBinaryDownload` are now `async` and show native Save-As dialogs in the desktop build
- `renderOffsetPdf` / `generateToolSheetPdf` use `savePdfDoc()` — native dialog in desktop, `doc.save()` in browser

### Fixed
- Release workflow: corrected GitHub secret names (`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`)
- Release workflow: added `"tauri"` npm script required by `tauri-apps/tauri-action`
- Release workflow: removed empty Apple signing env vars that caused macOS codesign failure

### Notes
- macOS builds are unsigned (no Apple Developer account); users must right-click → Open on first launch
- Icons are placeholder (based on Playwright logo); replace `src-tauri/icons/icon.png` and regenerate with `npx tauri icon src-tauri/icons/icon.png` before a future release

---

## [0.2.0] — 2025-xx-xx

See git log for details.
