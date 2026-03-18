# Materials and Holders

The app maintains two separate sub-libraries — **Materials** and **Holders** — accessible from the **Libraries ▾** dropdown in the Tool Library toolbar.

---

## Materials library

### What materials are for

Materials give names and properties to the workpiece materials you cut. They are used by:

- The Speeds & Feeds panel (material picker)
- The Cutting Wizard (Step 1 material selection)
- Per-tool ToolMaterialEntries (stored with the tool, referenced by material name)

### Managing materials

Open **Libraries ▾ → Materials**.

| Action | How |
|--------|-----|
| Add a material | Click **+ Add material**, fill in name and properties, click **Save** |
| Edit a material | Click any row |
| Delete a material | Click the row then click **Delete** in the editor footer |

### Material fields

| Field | Description |
|-------|-------------|
| **Name** | Display name (e.g. "6061 Aluminium") |
| **Group** | Material group for preset lookup (Aluminium / Steel / Stainless / Titanium / etc.) |
| **Hardness** | Brinell or Rockwell (optional, informational) |
| **Notes** | Free text |

---

## Holders library

### What holders are for

Tool holders (collet chucks, shrink-fit holders, end mill holders, etc.) can be assigned to tools via the **Assembly** tab in the tool editor. When assigned:

- The live SVG profile in the Geometry tab extends to show the holder shank and bore with an annotated stick-out measurement.
- If the tool's shaft diameter is outside the holder's collet range, an orange compatibility warning appears.

### Managing holders

Open **Libraries ▾ → Holders**.

| Action | How |
|--------|-----|
| Add a holder | Click **+ Add holder**, fill in fields, click **Save** |
| Edit a holder | Click any row |
| Delete a holder | Click the row then click **Delete** |

### Holder fields

| Field | Description |
|-------|-------------|
| **Name** | Display name (e.g. "ER32 Collet Chuck 100mm") |
| **Type** | Collet / Shrink-fit / Hydraulic / Milling chuck / Morse taper / etc. |
| **Shank diameter** | The holder's machine-side shank (e.g. CAT40 / BT30) |
| **Bore diameter** | Tool-side bore for direct-mount holders |
| **Collet min / max** | Clamping range for collet holders |
| **Gauge length** | Distance from spindle face to gauge line |
| **Max RPM** | Maximum rated speed |
| **Supplier** | Supplier name |
| **Product ID** | Catalogue / part number |
| **Notes** | Free text |

### Assigning a holder to a tool

1. Open a tool in the editor.
2. Go to the **Assembly** tab.
3. Type in the holder search field and select one from the results.
4. The SVG preview updates immediately to show the full assembly.

---

## Backup and restore

Materials and holders are included in the **Backup (JSON v2)** export. Importing a backup file restores all three datasets (tools, materials, holders) together.
