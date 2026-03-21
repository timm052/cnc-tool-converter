# Getting Started

## Running the app

### Desktop app (recommended)

Download the latest installer from [GitHub Releases](https://github.com/timm052/cnc-tool-converter/releases):

| Platform | File |
|---|---|
| Windows (installer) | `CNC-Tool-Converter_*_x64-setup.exe` |
| Windows (MSI) | `CNC-Tool-Converter_*_x64_en-US.msi` |
| macOS (Apple Silicon) | `CNC-Tool-Converter_*_aarch64.dmg` |
| macOS (Intel) | `CNC-Tool-Converter_*_x64.dmg` |
| Linux (.deb) | `cnc-tool-converter_*_amd64.deb` |
| Linux (AppImage) | `cnc-tool-converter_*_amd64.AppImage` |

The desktop app stores your library in SQLite and uses native file-open/save dialogs for imports, exports, and backups.

> **macOS note:** builds are currently unsigned. Right-click → Open on first launch to bypass Gatekeeper.

#### Desktop CLI

The desktop build also ships a CLI for headless/batch use:

```
CncToolConverter.exe convert tools.hsmlib --to linuxcnc
CncToolConverter.exe formats
CncToolConverter.exe inspect tools.hsmlib
```

On macOS/Linux use the binary name without `.exe`.

---

### Web / PWA (no install)

If you have a deployed build, simply open the URL in your browser — no installation required. The app works fully offline after the first load and can be installed as a PWA from your browser's address bar.

Data is stored in your browser's IndexedDB. Use the Backup button regularly, since clearing browser site data will erase the library.

### Running locally (development)

**Prerequisites:** Node.js 18 or later (includes npm).

```bash
git clone https://github.com/timm052/cnc-tool-converter.git
cd cnc-tool-converter
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### Building for production (web)

```bash
npm run build        # outputs to dist/
npm run preview      # serve the production build locally
```

The `dist/` folder is a static site — deploy it on GitHub Pages, Netlify, Cloudflare Pages, or any static host.

---

## First run

When you first open the app you'll see four items in the left sidebar:

| Sidebar button | Page | Purpose |
|----------------|------|---------|
| **Converter** | Converter | Convert tool library files between formats |
| **Tool Manager** | Tool Library | Manage a persistent local library of tools |
| **Machines** | Machines | Configure machine groups |
| **Settings** | Settings | Configure the app |

The sidebar is collapsible — click the **◀ / ▶** arrow at the bottom to toggle it.

---

## Your first conversion

1. Go to the **Converter** page.
2. Select a **Source Format** (e.g. *Autodesk Fusion 360 HSMLib*).
3. Select a **Target Format** (e.g. *LinuxCNC tool table*).
4. Drop a tool library file onto the drop zone.
5. The tools are parsed and shown in the preview table.
6. Click **Convert** — the output appears below.
7. Click **Copy** or **Download** to use the result.

![Converter page](screenshots/converter-page.png)

> **Tip:** Enable *Auto-convert on file load* in Settings → Conversion Defaults so step 6 happens automatically.

---

## Your first library entry

1. Click **Tool Manager** in the sidebar to open the Tool Library.
2. Click **New Tool** (top right) — the tool editor opens.
3. Fill in at minimum: **Tool Number**, **Type**, and **Diameter**.
4. Click **Save** (or press `Ctrl+S`).

The tool is now saved permanently in your browser's IndexedDB.

---

## Importing an existing tool library

1. Click **Tool Manager** in the sidebar to open the Tool Library.
2. Click **Import**.
3. Drop a tool library file onto the panel.
4. Review any duplicates and click **Add N tools** (or **Import**) to confirm.

See [Importing Tools](Importing-Tools) for full details.

---

## Data storage

| Build | Storage | Location |
|-------|---------|----------|
| Desktop app | SQLite | `cnc-tool-converter.db` in your OS app-data folder |
| Web / PWA | IndexedDB | Browser database `cnc-tool-library` |

Both builds persist data between sessions automatically.

> **Web/PWA:** Clearing your browser's site data or using private/incognito mode will delete the library. Use [Snapshots and Backup](Snapshots-and-Backup) to protect your data.

---

## Orientation: toolbar buttons (Tool Library)

![Tool Library page](screenshots/tool-library-page.png)

| Button | What it does |
|--------|-------------|
| **Import** | Load tools from a file |
| **Export N** | Export selected (or all) tools |
| **Low Stock** | Red — appears when tools are at/below reorder point |
| **Libraries ▾** | Materials, Holders, Templates, Jobs, Tool Sets |
| **Maintain ▾** | Find Duplicates, Renumber, Issues, Scan QR, F&S Wizard, Snapshots, Supplier Invoice |
| **Print ▾** | Setup Sheet, Tool Sheet, Tool Offsets, Work Offsets, Labels |
| **?** | Keyboard shortcut help |
| **☁** | Remote sync (only visible when a URL is configured in Settings) |
| **New Tool** | Open the editor to create a tool |
