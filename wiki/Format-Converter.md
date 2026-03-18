# Format Converter

The **Converter** page converts tool library files from one format to another without touching your persistent library. It is a stateless tool — nothing is saved unless you explicitly import the output into the library.

---

## Basic workflow

1. Select **Source Format** from the left dropdown.
2. Select **Target Format** from the right dropdown.
3. Drop one or more files onto the drop zone (or click to browse).
4. Review the **parsed tool preview** table.
5. Click **Convert**.
6. Copy the output to clipboard or click **Download**.

---

## Folder / batch mode

Switch to **Folder** mode (toggle above the drop zone) to convert an entire directory at once:

- The app recursively finds all files matching the source format's extensions.
- Each file is converted individually.
- Results are shown in a list; download them one by one or use the **Download all** button.

---

## Field Mapping

The **Field Mapping** editor (map icon ⤢ in the toolbar) lets you copy values between fields *after* parsing but *before* writing. This is useful when the source format uses a non-standard field for something you want in a specific target field.

**Example:** Your HSMLib files store the part number in a comment field. You want it to appear as the `description` in the LinuxCNC output. Create a rule: `sourceData.comment → description`.

Rules are saved per **source format → target format pair** and remembered across sessions.

### How to add a rule

1. Open the field mapping editor.
2. Click **Add rule**.
3. Choose a **source field** (any field from the parsed tool).
4. Choose a **destination field** (any field in the `Tool` model).
5. Optionally set a **transform** (e.g. prefix, trim, uppercase).
6. Rules are applied in order — drag to reorder.

---

## Auto-convert on load

Enable **Auto-convert on file load** in Settings → Conversion Defaults. When active, the output is regenerated immediately when you drop a new file — no need to click Convert.

---

## Format-specific options

Some formats have extra options controlled from Settings:

| Format | Option location |
|--------|----------------|
| LinuxCNC | Settings → LinuxCNC Writer — decimal places, pocket assignment (`match-T` or sequential), header comment |
| HSMLib | Settings → HSMLib Writer — default machine vendor and model |

---

## Data loss warnings

Fields that have no equivalent in the target format are silently dropped. If **Warn on data loss** is enabled (Settings → File Handling), a yellow warning badge appears on any tool where fields were dropped. Click the badge to see which fields were lost.

---

## Tips

- The app remembers your last source/target format pair (Settings → Remember last format pair).
- RhinoCAM (`.vkb`) is import-only — it can be a source but not a target.
- For large libraries, use the Tool Library Import/Export panels instead of the Converter page — they give you duplicate detection and per-field merge controls.
