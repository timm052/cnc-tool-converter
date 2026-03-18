# Printing and Labels

All print output is generated client-side as a PDF and downloaded directly — no browser print dialog.

Access print options from the **Print ▾** dropdown in the Tool Library toolbar.

---

## Tool Sheet

**Print ▾ → Tool Sheet**

Generates a multi-page PDF tool sheet for the selected tools (or all tools if none are selected).

Each page covers one tool and includes:

- Header: tool number, type, description
- Geometry diagram (SVG profile)
- Geometry table: diameter, OAL, flute length, flutes, corner radius, taper angle
- Cutting data table: RPM, feed, plunge, coolant
- Per-material F&S table (if material entries exist)
- Assembly info: holder name, stick-out
- Inventory: quantity, location, supplier, unit cost
- Tool photo (if one has been attached)
- QR code linking to the tool record

### Tool Sheet options

| Option | Description |
|--------|-------------|
| **Paper size** | A4 / Letter |
| **Include photos** | Toggle tool images on/off |
| **Include QR codes** | Toggle QR code generation |
| **Header logo** | Upload a logo to appear in the top-left of each page |

---

## Tool Offsets Sheet

**Print ▾ → Tool Offsets**

Generates a table of tool length and diameter offsets, one row per tool. Intended for use at the machine as a setup reference.

Columns: T#, Description, Length Offset (H), Diameter Offset (D), Notes.

---

## Work Offsets Sheet

**Print ▾ → Work Offsets**

Opens the **Work Offset Sheet** panel, which lets you record and download G54–G59 (and extended) work coordinate offsets for each machine.

Offsets are stored **per machine** — switching the machine selector loads that machine's saved offsets, dialect, and fixture labels independently.

### Using the Work Offset Sheet

1. Select your **Machine** from the dropdown (populated from your machine groups in the library). Choose *Default (no group)* if you haven't set up machine groups yet.
2. Select the **Control dialect** for that machine (Fanuc / HAAS / Mach3 / LinuxCNC / Siemens). The dialect is remembered per machine.
3. The table shows the WCS slots available for that dialect:
   - **Fanuc / ISO**: G54–G59 + G54.1 P1–P48
   - **HAAS**: G54–G59 + G110–G129
   - **LinuxCNC**: G54–G59 + G59.1–G59.3
   - **Siemens Sinumerik**: G54–G57 + G505 D-frames
   - **Mach3**: G54–G59
4. For each row: choose a **slot code**, enter a **fixture / setup label**, and enter X/Y/Z offsets (A/B optional).
5. Click **+ Add slot** to add more rows; click the trash icon to remove a row.
6. Download as **PDF Card** (formatted reference card, ready to hang at the machine) or **CSV** (spreadsheet-ready).

Entries are saved to localStorage automatically per machine and restored on next open.

### PDF Card

The PDF card output includes:

- Machine name and dialect in the header
- A clean table: Offset Code | Fixture / Label | X | Y | Z (+ A/B columns only when used)
- Monospace offset values right-aligned for easy reading at a glance
- Date stamped in the corner

---

## Labels

**Print ▾ → Labels**

Generates a printable label sheet — intended for printing on standard label stock and affixing to drawers, racks, or tool holders.

### Label options

| Option | Description |
|--------|-------------|
| **Label size** | 38×21 mm (2×5 per A4) / 63×38 mm (2×3) / Custom |
| **Content** | Choose which fields appear: T#, description, diameter, location, QR code |
| **Tools** | All visible tools, selected tools only, or a specific machine group |
| **QR code** | Encodes the tool number for quick scanning at the machine |

Each label shows the fields you selected, with the QR code in the bottom-right corner when enabled.

---

## QR codes

QR codes encode the tool's T number (e.g. `T42`). Scanning a QR code with the **Scan QR** feature (Maintain ▾ → Scan QR, or `Ctrl+Q`) jumps directly to that tool in the library table and opens the editor.

This is useful for physical tool crib management — scan the label on a tool drawer to instantly pull up its record.
