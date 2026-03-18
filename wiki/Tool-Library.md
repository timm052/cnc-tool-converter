# Tool Library

The **Tool Library** page is the main workspace. It holds all your tools in a persistent local database and gives you a full set of management, editing, and export tools.

---

## The library table

Each row is one tool. Columns are configurable — click **Columns** (column icon in toolbar) to show or hide any column. Drag the header to reorder (coming soon).

### Default columns

| Column | Notes |
|--------|-------|
| **T#** | Tool number |
| **Type** | Tool type with colour-coded left border |
| **Description** | Truncated; hover for full text + comment |
| **Diameter** | In the display unit (mm / inch / as-stored) |
| **OAL** | Overall length |
| **Flutes** | Number of cutting edges |
| **RPM** | Spindle speed |
| **Feed** | Cutting feed rate |
| **Tags** | Tag chips; hover a chip to remove it; click `⊞ N` badge to see per-material F&S |
| **★** | Starred / favourite |

### Optional columns (hidden by default)

Flute Length, Shaft Dia, Corner Radius, Taper Angle, Feed Plunge, Coolant, Material, Machine Group, Qty, Reorder Pt, Supplier, Unit Cost, Location, Condition, Uses.

---

## Machine group sidebar

The left sidebar lists all machine groups. Click a group to filter the table to that machine's tools.

- **All** shows the full library.
- The badge on each group shows the tool count.
- The sidebar footer shows total inventory value and low-stock count.
- Click **◀** to collapse the sidebar to an icon strip.

Tools can belong to **multiple** machine groups — they appear under each relevant group.

---

## Search

The search box (🔍 or `/` key) searches across:

- Description
- Type
- Tags
- Manufacturer
- Product ID
- Supplier
- Location

Matches are highlighted. Search is case-insensitive and instant.

---

## Filters

Filter buttons appear to the right of the search box:

| Button | Effect |
|--------|--------|
| **★** | Show only starred tools |
| **Tag ▾** | Filter by one or more tags |
| **Condition ▾** | Filter by condition (New, Good, Worn, etc.) |
| **Low stock** | Show only tools at or below reorder point |
| **mm / inch / as-is** | Override the display unit for all geometry columns |

Filters stack — you can combine machine group + star + tag simultaneously.

---

## Selecting tools

- Click the **checkbox** on a row to select it.
- `Space` toggles selection on the focused row.
- `Ctrl+A` selects all visible (filtered) tools.
- Click the header checkbox to select/deselect all visible.

When tools are selected, additional toolbar buttons appear:

- **N selected ▾** — dropdown with Duplicate, Copy to Group, F&S Calculator, Convert units, Compare
- **Edit N / Bulk Edit** — open the editor for a single tool or bulk edit for multiple
- **Export N** — export the selected tools

---

## Row focus and keyboard navigation

Use `j` / `↓` and `k` / `↑` to move focus between rows without selecting. Press `Enter` or `e` to open the editor for the focused tool.

---

## Table density

Settings → Display → Table row density: **Comfortable** (45 px rows, more whitespace) or **Compact** (33 px rows, more tools visible). The table virtualises rendering either way, so 1 000+ tools scroll smoothly.

---

## Duplicate tool numbers

If two tools have the same T number, a red badge appears in the **T#** column on both. Use Maintain ▾ → **Find Duplicates** (choose *Tool Number* criteria) to review and resolve them.

---

## Inventory value

The machine group sidebar footer shows:

```
Total: £1,234.56   ⚠ 3 low stock
```

This is `Σ(unitCost × quantity)` across all visible tools. The low-stock count is a link to the Low Stock dashboard.
