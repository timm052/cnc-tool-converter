# Supported Formats

The app can read and/or write the following tool library formats.

---

## Format table

| Format | Extension(s) | Read | Write | Notes |
|--------|-------------|------|-------|-------|
| Autodesk Fusion 360 HSMLib | `.hsmlib` | ✅ | ✅ | JSON-based; full geometry and F&S round-trip |
| Fusion 360 Cloud Library JSON | `.json` | ✅ | ✅ | Fusion 360 cloud sync / backup export |
| LinuxCNC tool table | `.tbl`, `.tool` | ✅ | ✅ | Plain-text column format |
| HAAS offset list | `.ofs` | ✅ | ✅ | T/D/H offset table |
| Fanuc G10 | `.nc` | ✅ | ✅ | Parametric offset blocks (`G10 L1 P… R…`) |
| Mach3 CSV | `.csv` | ✅ | ✅ | Comma-separated, Mach3-compatible header |
| Generic CSV | `.csv` | ✅ | ✅ | Simplified CSV, all fields, spreadsheet-friendly |
| Excel XLSX | `.xlsx` | ✅ | ✅ | One row per tool |
| RhinoCAM VKB | `.vkb` | ✅ | ❌ | Binary format; import only |
| Backup JSON v2 | `.json` | ✅ | ✅ | Full backup: tools + materials + holders |

---

## Format details

### Autodesk Fusion 360 HSMLib

The native format for Fusion 360's local tool library. Stores tool geometry, cutting parameters, and material-specific feeds and speeds in a JSON file.

- **Round-trip safe** — all fields preserved
- **Multiple tools per file** — one `.hsmlib` can contain an entire library
- **HSMLib Writer options** in Settings: default vendor and model fields

### Fusion 360 Cloud Library JSON

The JSON format exported from Fusion 360's cloud tool library or produced by Autodesk's sync backup. Similar structure to HSMLib but with cloud-specific metadata.

### LinuxCNC tool table

Plain-text format read by LinuxCNC's `tooltable` component. Each line defines one tool with pocket, length offset, diameter offset, and comment.

```
T1 P1 D6.0 Z25.0 ;6mm end mill
T2 P2 D10.0 Z40.0 ;10mm drill
```

- **LinuxCNC Writer options** in Settings: decimal places, pocket assignment (`match-T` or sequential), header comment

### HAAS offset list

Tab-separated offset file from HAAS control. Contains tool length (H) and diameter (D) registers.

### Fanuc G10

G-code using `G10 L1` (tool length offset) and `G10 L10` (tool diameter offset) blocks:

```
(T1 - 6mm End Mill)
G10 L1 P1 R25.0
G10 L10 P1 R3.0
```

### Mach3 CSV

Comma-separated file with the Mach3 tool table header:

```
Tool,X,Y,Z,A,B,C,U,V,W,Dia,FrontAngle,BackAngle,Orientation
```

### Generic CSV

A simplified CSV with one row per tool, covering the most common fields: T#, Type, Description, Diameter, OAL, Flutes, RPM, Feed, Material, Tags, Notes.

### Excel XLSX

Spreadsheet format with one row per tool. All tool fields are included as columns. Useful for bulk editing in Excel or importing from spreadsheet-based tool registers.

### RhinoCAM VKB

Binary format used by RhinoCAM's tool library. The app can parse VKB files and import the tools — it cannot write this format back out. Use HSMLib or another writable format for export.

### Backup JSON v2

The app's native full-backup format. Contains three sections: `tools`, `materials`, and `holders`. Importing a backup file restores all three simultaneously.

```json
{
  "version": 2,
  "exportedAt": "2026-03-18T12:00:00Z",
  "syncVersion": 42,
  "tools": [...],
  "materials": [...],
  "holders": [...]
}
```

---

## Field coverage by format

Not all formats support all fields. The table below shows key field coverage:

| Field | HSMLib | LinuxCNC | HAAS | Fanuc | Mach3 | CSV | XLSX |
|-------|--------|----------|------|-------|-------|-----|------|
| T number | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Type | ✅ | — | — | — | — | ✅ | ✅ |
| Diameter | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OAL | ✅ | — | — | — | — | ✅ | ✅ |
| Flutes | ✅ | — | — | — | — | ✅ | ✅ |
| RPM | ✅ | — | — | — | — | ✅ | ✅ |
| Feed rate | ✅ | — | — | — | — | ✅ | ✅ |
| Corner radius | ✅ | — | — | — | — | ✅ | ✅ |
| Length offset | — | ✅ | ✅ | ✅ | ✅ | — | — |
| Tags | ✅ | — | — | — | — | ✅ | ✅ |
| Notes | ✅ | ✅ (comment) | — | ✅ (comment) | — | ✅ | ✅ |

Fields without a native equivalent in the target format are dropped on export. Enable **Warn on data loss** in Settings → File Handling to see which fields will be lost before exporting.

---

## Adding a new format

If you are a developer and want to add support for another format, see the [developer guide](https://github.com/timm052/cnc-tool-converter/blob/main/docs/adding-a-converter.md).
