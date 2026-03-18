# Contributing

Thank you for your interest in contributing to CNC Tool Converter!

## Ways to Contribute

- **Bug reports** — open an issue with steps to reproduce, the file that caused the problem, and what you expected vs. what happened
- **New format converters** — see [docs/adding-a-converter.md](docs/adding-a-converter.md) for a full walkthrough
- **UI / UX improvements** — open an issue first to discuss the change
- **Documentation** — fixes and improvements are always welcome

## Development Setup

```bash
git clone https://github.com/timm052/cnc-tool-converter.git
cd cnc-tool-converter
npm install
npm run dev        # Vite dev server at http://localhost:5173
```

## Testing

The project uses **Vitest** + **jsdom** + **@testing-library/react**.

```bash
npm test              # single run (all 434 tests across 18 files)
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

Test files live in `src/__tests__/`. Key suites:

| File | What it covers |
|------|----------------|
| `converters/linuxcnc.test.ts` | LinuxCNC parser + writer round-trips |
| `converters/hsmlib.test.ts` | HSMLib XML parsing and field extraction |
| `converters/fusion360json.test.ts` | Fusion 360 Cloud Library JSON |
| `converters/haas.test.ts` | HAAS Format A offset table |
| `converters/fanuc.test.ts` | Fanuc G10 Memory C |
| `converters/mach3.test.ts` | Mach3 CSV (with and without header row) |
| `converters/rhinocam.test.ts` | RhinoCAM binary .vkb parsing |
| `converters/integration.test.ts` | Real example files end-to-end |
| `lib/printUtils.test.ts` | PDF label + tool sheet generation |
| `lib/toolProfileSVG.test.ts` | SVG profile rendering for all tool types |
| `lib/surfaceSpeedPresets.test.ts` | Vc/SFM lookup and unit conversion |
| `lib/lifecycleTracking.test.ts` | useCount, regrind threshold, audit trail |
| `themes/themeFiles.test.ts` | CSS theme file completeness |
| `pages/ToolDebugPage.test.tsx` | React rendering sanity check |

All PRs must keep the full test suite green.

## Coding Conventions

- **TypeScript** — all new code should be typed; avoid `any`
- **Tailwind CSS** — use utility classes; avoid custom CSS unless necessary
- **Lucide icons** — use the existing `lucide-react` package for any new icons
- **React patterns** — wrap expensive computations in `useMemo`; wrap callbacks in `useCallback`; wrap heavy list components in `React.memo`
- **No backend** — the app is intentionally fully client-side and works offline; the optional remote sync is additive and never required
- **IndexedDB via Dexie** — all persistent data goes through `src/db/library.ts`; new tables require a new DB version with a migration
- **Context pattern** — library state in `LibraryContext`, settings in `SettingsContext`, materials in `MaterialContext`, holders in `HolderContext`; avoid prop-drilling

## UI Consistency Standards

All slide-over panels follow these conventions:

- **Panel**: `fixed right-0 top-0 h-full bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl`; backdrop `fixed inset-0 bg-black/40 z-40`
- **Header**: `px-5 py-4 border-b border-slate-700`; title `text-base font-semibold text-slate-100`; icon size 16 `text-slate-400`; close button `p-1.5 rounded` with X size 16
- **Section labels**: `text-xs font-medium uppercase tracking-wider text-slate-400 mb-2`
- **Primary button**: `px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors`
- **Secondary button**: `px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700`
- **Footer**: `px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3`
- **Text inputs**: `px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500`

## Architecture Notes

- **Converter registry** (`src/converters/index.ts`) — call `registry.register(converter)` to add a format; it appears in both the Converter page dropdowns and the Library import/export panels automatically
- **LibraryContext `replaceLibrary`** — atomically clears and reinserts tools + materials + holders in a single Dexie transaction; used by snapshot restore and remote sync merge
- **Remote sync merge** — `mergePayloads()` in `src/lib/remoteSync.ts` resolves conflicts by `updatedAt` timestamp (remote wins when newer); local-only records are always kept; ETag `If-Match` provides optimistic locking; 412 responses trigger automatic retry
- **Performance** — `LibraryTable` is wrapped in `React.memo`; expensive derivations use `useMemo`; row rendering uses `@tanstack/react-virtual` so only visible rows are in the DOM
- **Themes** — each theme is a CSS file in `src/themes/`; applied via `data-theme` on the root div; all overrides use `!important` to guarantee specificity

## Submitting a Pull Request

1. Fork the repo and create a branch: `git checkout -b my-feature`
2. Make your changes
3. Run `npm test` — all 434 tests must pass
4. Run `npm run build` — no TypeScript or build errors
5. Open a pull request with a clear description of what you changed and why

## Reporting a File-parsing Bug

If a tool library file isn't being parsed correctly, attach the file (or a minimal reproduction) to the issue. Removing sensitive data (machine names, vendor part numbers) before sharing is fine — the tool geometry fields are what matter for debugging.
