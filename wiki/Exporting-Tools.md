# Exporting Tools

---

## Opening the Export panel

- With no tools selected: click **Export** in the toolbar — exports all tools in the current view (filtered or unfiltered).
- With tools selected: click **Export N** — exports only the selected tools.

---

## Choosing a format

Select the target format from the dropdown at the top of the Export panel:

| Format | Extension | Notes |
|--------|-----------|-------|
| Fusion 360 HSMLib | `.hsmlib` | Full round-trip; includes all geometry and F&S |
| Fusion 360 Cloud JSON | `.json` | Fusion 360 cloud library sync format |
| LinuxCNC tool table | `.tbl` | Plain-text pocket table |
| HAAS offset list | `.ofs` | T/D/H offset format |
| Fanuc G10 | `.nc` | Parametric offset blocks |
| Mach3 CSV | `.csv` | Comma-separated, Mach3 compatible |
| Generic CSV | `.csv` | Simplified CSV for spreadsheet use |
| Excel XLSX | `.xlsx` | One row per tool, all fields |
| Backup (JSON v2) | `.json` | Full backup including materials and holders |

---

## Filter by machine group

Use the **Machine group** dropdown in the Export panel to restrict the export to tools belonging to a specific group.

---

## Download or copy

| Button | What it does |
|--------|-------------|
| **Download** | Saves the file to your Downloads folder |
| **Copy to clipboard** | Copies the raw text output (useful for formats like LinuxCNC or Fanuc G10) |

---

## Backup export

The **Backup (JSON v2)** format exports tools, materials, and holders in a single file. This is the recommended format for:

- Full library backup before a major change
- Moving your library to another browser or machine
- Remote sync endpoint seed

See also [Snapshots and Backup](Snapshots-and-Backup).

---

## Data loss warnings

Fields that have no equivalent in the target format are silently dropped. If **Warn on data loss** is enabled (Settings → File Handling), a yellow badge appears next to any tool where fields will be lost. Click the badge to see which fields.

---

## Tips

- Export to **Generic CSV** or **XLSX** when you need to bring tool data into a spreadsheet or ERP system.
- To export a single machine group's tools: filter by group in the sidebar, then click **Export** (no selection needed — the filter is respected).
- For round-trip fidelity (export then re-import with no data loss) use the **HSMLib** or **Backup JSON** formats.
