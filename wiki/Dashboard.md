# Dashboard

The **Dashboard** is the home page of the app — an at-a-glance overview of your library, stock, machines, and sync status, with quick links to common actions.

---

## Cards

| Card | Shows |
|---|---|
| **Library** | Total tool count and the top 5 tool types by count. "Open Tool Library" jumps to the Tool Library page. |
| **Low Stock** | Count of tools at or below their reorder point. "View low stock" opens the Tool Library with the Low Stock panel. |
| **Regrind Due** | Count of tools whose use count has reached their regrind threshold. |
| **Maintenance Due** | Machines whose maintenance interval has elapsed (or is within the configured lead time). "View Machines" jumps to the Machines page. |
| **Remote Sync** | Last push/pull time and synced tool count — only shown when a remote database URL is configured in Settings. |
| **Quick Actions** | Convert files, Open Tool Library, Add Tool. |

---

## Setting the default landing page

By default the Dashboard opens first. To change this, go to **Settings → Startup → Default page** and choose Converter, Tool Library, Machines, Help, or Settings instead.

---

## Help / Format Reference page

The **Help** page (sidebar, question-mark icon) lists every supported tool library format in one table:

| Column | Meaning |
|---|---|
| **Format** | Format name |
| **Extensions** | File extensions recognised for that format |
| **Import** / **Export** | Whether the app can read / write that format |
| **Notes** | Short caveats — e.g. "Parse only — binary format", "UTF-16 XML" |

See [Supported Formats](Supported-Formats) for the full field-coverage breakdown.

---

## Command Palette (Ctrl+K)

Press **`Ctrl+K`** anywhere in the app to open the command palette:

- **Navigate** — type a page name (Dashboard, Converter, Tool Library, Machines, Help, Settings) and press `Enter` to jump there
- **Find a tool** — type part of a tool's description, manufacturer, type, or T number; selecting a result opens that tool in the editor
- **Find a machine** — type part of a machine's name; selecting a result opens it on the Machines page

Use `↑` / `↓` to move between results, `Enter` to select, and `Esc` to close.
