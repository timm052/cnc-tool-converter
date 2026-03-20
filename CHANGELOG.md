# Changelog

All notable changes to CNC Tool Converter are documented here.

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
