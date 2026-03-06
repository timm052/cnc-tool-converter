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
npm run dev
```

## Coding Conventions

- **TypeScript** — all new code should be typed; avoid `any`
- **Tailwind CSS** — use utility classes; avoid custom CSS unless necessary
- **Lucide icons** — use the existing `lucide-react` package for any new icons
- **No backend** — the app is intentionally fully client-side; keep it that way

## Submitting a Pull Request

1. Fork the repo and create a branch: `git checkout -b my-feature`
2. Make your changes
3. Run `npm run build` to verify there are no TypeScript or build errors
4. Open a pull request with a clear description of what you changed and why

## Reporting a File-parsing Bug

If a tool library file isn't being parsed correctly, please attach the file (or a minimal reproduction) to the issue. Removing sensitive data (machine names, vendor part numbers) before sharing is fine — the tool geometry fields are what matter for debugging.
