# Inventory and Stock

The app tracks physical stock quantities, reorder points, and low-stock alerts for every tool in the library.

---

## Stock fields

Each tool has three inventory fields (editable in the **Library** tab of the tool editor or via Bulk Edit):

| Field | Description |
|-------|-------------|
| **Quantity** | Current number of tools in stock |
| **Reorder point** | Alert threshold — when `quantity ≤ reorderPoint`, the tool is flagged as low stock |
| **Unit cost** | Cost per tool (used for inventory value calculation) |

---

## Low stock alerts

When any tool's quantity is at or below its reorder point:

- A red **Low Stock** button appears in the toolbar.
- The machine group sidebar footer shows a count: `⚠ N low stock`.
- The **Low Stock** filter button appears in the filter bar.

### Low Stock dashboard

Click **Low Stock** in the toolbar to open the Low Stock panel. It shows all tools at or below their reorder point, sorted by how far below the threshold they are (most critical first).

Each row shows: T#, description, current quantity, reorder point, and supplier/location.

---

## Stock history

The **Crib** tab in the tool editor shows a **Stock history** section: a chronological log of quantity changes for that tool, newest first.

Each entry shows:

- Date and time
- Reason: `initial` / `adjustment` / `manual`
- Delta (e.g. `+10`, `-2`)
- Resulting quantity

### Logging a stock movement manually

In the Stock history section, use the **+ Log entry** form:

1. Enter the quantity delta (positive = stock in, negative = stock out).
2. Enter a reason (optional).
3. Click **Log**.

The quantity field is updated automatically, and the entry is added to the history.

---

## Inventory value

The machine group sidebar footer shows the total inventory value for all visible tools:

```
Total: £1,234.56   ⚠ 3 low stock
```

This is calculated as `Σ(unitCost × quantity)` across all tools in the current view. It updates in real time as you filter by machine group.

---

## Condition tracking

Each tool has a **Condition** field:

| Condition | Colour |
|-----------|--------|
| New | Green |
| Good | Blue |
| Worn | Amber |
| Damaged | Orange |
| Scrap | Red |

Filter by condition using the **Condition ▾** button in the filter bar.

---

## Lifecycle tracking

The **Crib** tab also shows the **Lifecycle** section:

- **Use count** — current number of uses. Click **+1** to increment after each job.
- **Regrind threshold** — enter the number of uses before the tool needs regrinding.
- A progress bar turns amber at 80% of threshold and red at 100% (or above).

The **Uses** column in the library table shows a colour-coded badge when a tool is approaching or has exceeded its regrind threshold.

To reset the use count after regrinding: set the count back to 0 in the Crib tab and log a stock-history entry noting the regrind.
