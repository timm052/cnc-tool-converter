# CNC Tool Converter — Wiki

**CNC Tool Converter** is a tool library manager and format converter for CNC machinists and CAM programmers. Available as a **desktop app** (~10 MB, no install dependencies) and as a **web/PWA app** (runs in any modern browser). Everything runs locally — no account, no server, no data leaves your machine unless you configure a remote sync endpoint.

---

## What can it do?

| Capability | Summary |
|---|---|
| **Desktop app** | Native Windows / macOS / Linux app with SQLite, native dialogs, and auto-updater |
| **Format conversion** | Convert tool libraries between 10 formats in one click |
| **Persistent library** | Store, organise, search, and edit tools in a local database |
| **Inventory tracking** | Quantities, reorder points, low-stock alerts, purchasing CSV |
| **Tool lifecycle** | Use-count tracking, regrind thresholds, condition states, audit log |
| **Speeds & feeds** | Built-in calculator, per-material F&S storage, cutting data wizard |
| **Printing** | PDF tool sheets, QR-coded bin labels, G-code offset reference cards |
| **Work offsets** | G54–G59 reference sheet (Fanuc / HAAS / Mach3 / LinuxCNC / Siemens) |
| **CAM snippets** | Generate tool-call G-code blocks for 5 control dialects |
| **Remote sync** | Push/pull to a REST API or WebDAV server (Nextcloud, ownCloud, etc.) |
| **Multi-user** | Merge-on-push with ETag locking; change log with operator attribution |

---

## Quick navigation

### Using the app
- [Getting Started](Getting-Started) — install, first run, basic orientation
- [Format Converter](Format-Converter) — converting files between formats
- [Tool Library](Tool-Library) — the library table, machine groups, filters
- [Importing Tools](Importing-Tools) — bringing tools in from files
- [Editing Tools](Editing-Tools) — the tool editor, undo/redo, SVG preview
- [Bulk Operations](Bulk-Operations) — bulk edit, renumber, unit conversion, compare
- [Exporting Tools](Exporting-Tools) — export panel, split modes, Excel, CAM snippets
- [Speeds and Feeds](Speeds-and-Feeds) — F&S calculator, per-material data, cutting wizard
- [Materials and Holders](Materials-and-Holders) — reference libraries, assembly view
- [Inventory and Stock](Inventory-and-Stock) — quantities, reorder points, low-stock dashboard
- [Printing and Labels](Printing-and-Labels) — tool sheets, bin labels, offset reference cards
- [Remote Sync](Remote-Sync) — REST API and WebDAV sync, multi-user editing
- [Snapshots and Backup](Snapshots-and-Backup) — local snapshots, JSON backup/restore
- [Settings](Settings) — all configuration options
- [Keyboard Shortcuts](Keyboard-Shortcuts) — full shortcut reference

### Reference
- [Supported Formats](Supported-Formats) — all 10 formats, field mapping, limitations

---

## At a glance

```
┌─────────────────────────────────────────────────────────┐
│  Converter   │  Tool Library   │  Settings               │
├─────────────────────────────────────────────────────────┤
│  Drop files  │  Search / filter│  Themes, units, display │
│  Preview     │  Edit tools     │  LinuxCNC/HSMLib opts   │
│  Export      │  Import / Export│  Operator name          │
│              │  Bulk ops       │  Remote database        │
│              │  Print / Labels │                         │
└─────────────────────────────────────────────────────────┘
```

**Desktop build:** data is stored in SQLite (`cnc-tool-converter.db` in your app data folder). **Web/PWA build:** data is stored in your browser's IndexedDB. Neither version sends data anywhere unless you configure a remote sync endpoint in Settings → Remote Database.

---

## Desktop app

Download the installer from [GitHub Releases](https://github.com/timm052/cnc-tool-converter/releases):

| Platform | File |
|---|---|
| Windows (installer) | `CNC-Tool-Converter_*_x64-setup.exe` |
| Windows (MSI) | `CNC-Tool-Converter_*_x64_en-US.msi` |
| macOS (Apple Silicon) | `CNC-Tool-Converter_*_aarch64.dmg` |
| macOS (Intel) | `CNC-Tool-Converter_*_x64.dmg` |
| Linux (.deb) | `cnc-tool-converter_*_amd64.deb` |
| Linux (AppImage) | `cnc-tool-converter_*_amd64.AppImage` |

> **macOS note:** builds are currently unsigned. Right-click → Open on first launch to bypass Gatekeeper.

---

## Browser compatibility (web build)

Any modern browser that supports IndexedDB, BroadcastChannel, and the Web Crypto API:

- Chrome / Edge 90+
- Firefox 88+
- Safari 15+

The app works fully offline after the first load (no CDN dependencies in production builds).
