# Speeds and Feeds

The app has three layers of speeds and feeds support: per-tool default values, per-material overrides, and the guided Cutting Wizard.

---

## Per-tool default values (Cutting tab)

Every tool stores a set of default cutting parameters in the **Cutting** tab of the editor:

| Field | Description |
|-------|-------------|
| **Spindle RPM** | Default spindle speed |
| **Feed rate** | Cutting feed (XY) |
| **Feed plunge** | Z plunge feed |
| **Feed ramp** | Ramp-entry feed |
| **Feed retract** | Retract feed |
| **Feed mode** | `mm/min`, `mm/rev`, `inch/min`, `inch/rev` |
| **Coolant** | None / Flood / Mist / Through-spindle / Air blast |
| **Clockwise** | Spindle direction |

These values are written into exported files (HSMLib, Fanuc G10, etc.) when the format supports them.

---

## Per-material F&S overrides

A tool can store different cutting parameters for each material it cuts. These are called **ToolMaterialEntries**.

### Viewing material entries

In the library table, hover the **Tags** column badge (e.g. `⊞ 3`) on a tool — a popover lists the material names and their feed/speed values.

### Adding or editing a material entry

1. Select one or more tools.
2. From the **N selected ▾** dropdown, choose **F&S Calculator**.
3. The Speeds & Feeds panel opens.

### Speeds & Feeds panel

The panel has two modes:

**Quick fill ▾** — pick a material group from the dropdown. The app looks up the recommended surface speed (Vc) and chip load from the built-in preset table, calculates RPM and feed, and fills the fields.

**Manual** — enter Vc, chip load, DOC, WOC, and number of flutes directly. The panel recalculates RPM and feed in real time.

Fields:

| Field | Notes |
|-------|-------|
| **Material** | Select from your materials library or type a name |
| **Surface speed (Vc)** | m/min or SFM depending on display unit |
| **Chip load per flute** | mm or inch |
| **DOC** (depth of cut) | Axial depth |
| **WOC** (width of cut) | Radial engagement |
| **Calculated RPM** | `Vc × 1000 / (π × D)` |
| **Calculated feed** | `RPM × flutes × chip load` |

Click **Save to tool** to write the entry to the selected tool. If the material already has an entry it is overwritten.

---

## Cutting Wizard

The **Cutting Wizard** is a 3-step guided assistant for setting up a complete set of cutting parameters.

Open it from: **Maintain ▾ → Cutting Wizard** (or select a tool and use the **N selected ▾ → F&S Calculator** path).

### Step 1 — Tool + Material

- Choose the tool from the library.
- Choose or type a material name.
- The wizard shows the tool's current geometry (diameter, flutes, corner radius).

### Step 2 — Grade + Machine + DOC

- Select tool grade (HSS / Carbide / Coated / CBN / Ceramic).
- Select machine type (VMC / HMC / Router / Lathe / Swiss).
- Enter DOC and WOC.
- The wizard looks up the surface speed and chip load preset and displays the calculated values.

### Step 3 — Review + Apply

- Review the 7 calculated values: RPM, feed, plunge, ramp, retract, DOC, WOC.
- Adjust any value manually before applying.
- Click **Apply** — the values are written as a ToolMaterialEntry on the tool.

---

## Surface speed presets

The built-in preset table covers **8 material groups × 5 tool grades**:

| Material group | Examples |
|----------------|---------|
| Aluminium alloys | 6061, 7075, cast Al |
| Ferrous (mild steel) | 1018, A36 |
| Alloy steel | 4140, 4340 |
| Stainless steel | 304, 316 |
| Titanium | Ti-6Al-4V |
| Hardened steel | >45 HRC |
| Plastics | Delrin, ABS, Nylon |
| Composites | CFRP, GFRP |

These are conservative starting points — adjust for your specific tooling and machine rigidity.
