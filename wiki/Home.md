# CNC Tool Converter — Wiki

**CNC Tool Converter** is a browser-based tool library manager and format converter for CNC machinists and CAM programmers. Everything runs locally in your browser — no account, no installation, no data leaves your machine unless you configure a remote sync endpoint.

---

## What can it do?

| Capability | Summary |
|---|---|
| **Format conversion** | Convert tool libraries between 9 formats in one click |
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
- [Supported Formats](Supported-Formats) — all 9 formats, field mapping, limitations

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

All data is stored in your browser's **IndexedDB** and never sent anywhere unless you configure a remote sync endpoint in Settings → Remote Database.

---

## Browser compatibility

Any modern browser that supports IndexedDB, BroadcastChannel, and the Web Crypto API:

- Chrome / Edge 90+
- Firefox 88+
- Safari 15+

The app works fully offline after the first load (no CDN dependencies in production builds).
