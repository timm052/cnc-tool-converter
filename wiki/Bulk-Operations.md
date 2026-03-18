# Bulk Operations

Bulk operations let you act on multiple tools at once from the Tool Library table.

---

## Selecting tools

| Action | How |
|--------|-----|
| Select one tool | Click its checkbox |
| Toggle focused row | `Space` |
| Select all visible | `Ctrl+A` or click the header checkbox |
| Deselect all | Click the header checkbox again |

The selection count badge appears in the toolbar as soon as one or more tools are selected.

---

## The "N selected ▾" dropdown

With one or more tools selected, click the **N selected ▾** button:

| Option | Min. selection | What it does |
|--------|---------------|-------------|
| **Duplicate** | 1 | Copies the tool(s), appending " (copy)" to the description; new T numbers are assigned sequentially from the highest existing |
| **Copy to Group** | 1 | Adds selected tools to an additional machine group without removing them from their current groups |
| **F&S Calculator** | 1 | Opens the Speeds & Feeds panel pre-loaded with the first selected tool |
| **Convert to mm** | 1 | Converts all geometry fields to millimetres and sets the tool unit flag |
| **Convert to inch** | 1 | Converts all geometry fields to inches and sets the tool unit flag |
| **Compare** | 2 | Opens the side-by-side comparison panel for up to 4 selected tools |

---

## Bulk Edit

With **two or more tools selected**, click **Bulk Edit** in the toolbar. The bulk edit panel opens with:

- A list of the selected tools (description + T number).
- A **field set** — check any field to edit it for all selected tools simultaneously.

### Which fields can be bulk-edited

| Field | Notes |
|-------|-------|
| **Machine Group** | Add or remove a group across all selected tools |
| **Tags** | Add or remove tags |
| **Condition** | Set condition for all (New / Good / Worn / Damaged / Scrap) |
| **Coolant** | Override coolant setting |
| **Supplier** | Set supplier string |
| **Location** | Set location string |
| **Reorder Point** | Set reorder quantity |
| **Regrind Threshold** | Set use-count threshold |
| **Notes** | Append or replace notes |

Unchanged fields (unchecked) are not touched. Click **Apply to N tools** to commit — changes are logged in each tool's change log.

---

## Export selected

With tools selected, click **Export N** in the toolbar. This opens the Export panel filtered to the selected tools. See [Exporting Tools](Exporting-Tools) for format options.

---

## Deselecting after an action

After most bulk actions the selection is cleared automatically. You can also press `Esc` or click the header checkbox to clear manually.
