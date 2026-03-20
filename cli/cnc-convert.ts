#!/usr/bin/env tsx
/**
 * CNC Tool Converter — CLI
 *
 * Usage:
 *   cnc-convert convert <input> --to <format> [options]
 *   cnc-convert formats
 *   cnc-convert inspect <input> [--from <format>]
 *
 * Run via:  npm run cli -- <args>
 *       or: npx tsx cli/cnc-convert.ts <args>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, basename, dirname, resolve, join } from 'node:path';

// ── DOMParser polyfill (needed by hsmlib XML parser) ─────────────────────────
// jsdom is already installed as a devDependency.
if (typeof DOMParser === 'undefined') {
  const { JSDOM } = await import('jsdom');
  (globalThis as unknown as Record<string, unknown>).DOMParser =
    new JSDOM('').window.DOMParser;
}

import { registry } from '../src/converters/index.js';

// ── ANSI colour helpers ────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
};

function ok  (msg: string) { process.stdout.write(`${c.green}✓${c.reset} ${msg}\n`); }
function warn(msg: string) { process.stdout.write(`${c.yellow}⚠${c.reset}  ${msg}\n`); }
function err (msg: string) { process.stderr.write(`${c.red}✗${c.reset}  ${msg}\n`); }
function info(msg: string) { process.stdout.write(`${c.cyan}${msg}${c.reset}\n`); }
function dim (msg: string) { process.stdout.write(`${c.dim}${msg}${c.reset}\n`); }

// ── Arg parser ────────────────────────────────────────────────────────────────

interface Args {
  command:    string;
  input?:     string;
  from?:      string;
  to?:        string;
  output?:    string;
  overwrite:  boolean;
  help:       boolean;
  version:    boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: '', overwrite: false, help: false, version: false };
  let i = 0;

  // First non-flag arg is the command
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--help' || a === '-h')    { args.help    = true; i++; continue; }
    if (a === '--version' || a === '-v') { args.version = true; i++; continue; }
    if (a === '--overwrite')             { args.overwrite = true; i++; continue; }
    if ((a === '--from'   || a === '-f') && argv[i + 1]) { args.from   = argv[++i]; i++; continue; }
    if ((a === '--to'     || a === '-t') && argv[i + 1]) { args.to     = argv[++i]; i++; continue; }
    if ((a === '--output' || a === '-o') && argv[i + 1]) { args.output = argv[++i]; i++; continue; }
    if ((a === '--input'  || a === '-i') && argv[i + 1]) { args.input  = argv[++i]; i++; continue; }
    if (!a.startsWith('-')) {
      if (!args.command) { args.command = a; i++; continue; }
      if (!args.input)   { args.input   = a; i++; continue; }
    }
    i++;
  }

  return args;
}

// ── Format auto-detection ─────────────────────────────────────────────────────

function detectFormat(filePath: string): string | undefined {
  const ext = extname(filePath).toLowerCase();
  const formats = registry.getImportableFormats();
  return formats.find((f) => f.fileExtensions.includes(ext))?.id;
}

// ── File I/O helpers ──────────────────────────────────────────────────────────

function readInput(filePath: string, readAs: 'text' | 'arraybuffer'): string | ArrayBuffer {
  const buf = readFileSync(filePath);
  if (readAs === 'arraybuffer') {
    // Return a proper copy of the buffer as an ArrayBuffer (safe against Node's buffer pool)
    const ab = new ArrayBuffer(buf.byteLength);
    new Uint8Array(ab).set(buf);
    return ab;
  }
  return buf.toString('utf-8');
}

function resolveOutputPath(
  inputPath:  string,
  outputArg:  string | undefined,
  suggestion: string,
): string {
  if (!outputArg) {
    return join(dirname(resolve(inputPath)), suggestion);
  }
  const out = resolve(outputArg);
  // If outputArg is an existing directory (or looks like one), put file inside it
  if (existsSync(out) && statSync(out).isDirectory()) {
    return join(out, suggestion);
  }
  // If outputArg ends with separator it's intended as a directory
  if (outputArg.endsWith('/') || outputArg.endsWith('\\')) {
    mkdirSync(out, { recursive: true });
    return join(out, suggestion);
  }
  return out;
}

// ── Commands ──────────────────────────────────────────────────────────────────

function cmdFormats() {
  const all = registry.getAllFormats();
  info(`\n${c.bold}Supported formats${c.reset}`);
  process.stdout.write('\n');

  const rows = all.map((f) => ({
    id:   f.id,
    name: f.name,
    exts: f.fileExtensions.join(', '),
    cap:  [f.canImport ? 'import' : '', f.canExport ? 'export' : ''].filter(Boolean).join(' + '),
  }));

  const idW   = Math.max(8, ...rows.map((r) => r.id.length));
  const nameW = Math.max(12, ...rows.map((r) => r.name.length));
  const extW  = Math.max(10, ...rows.map((r) => r.exts.length));

  const hdr = `${'ID'.padEnd(idW)}  ${'Name'.padEnd(nameW)}  ${'Extensions'.padEnd(extW)}  Capabilities`;
  process.stdout.write(`${c.bold}${c.white}${hdr}${c.reset}\n`);
  process.stdout.write(`${c.dim}${'─'.repeat(hdr.length)}${c.reset}\n`);

  for (const r of rows) {
    const cap = r.cap.includes('import') && r.cap.includes('export')
      ? `${c.green}import + export${c.reset}`
      : r.cap.includes('import')
        ? `${c.cyan}import only${c.reset}`
        : `${c.yellow}export only${c.reset}`;
    process.stdout.write(
      `${c.blue}${r.id.padEnd(idW)}${c.reset}  ${r.name.padEnd(nameW)}  ${c.dim}${r.exts.padEnd(extW)}${c.reset}  ${cap}\n`,
    );
  }
  process.stdout.write('\n');
}

async function cmdInspect(args: Args) {
  const inputPath = args.input;
  if (!inputPath) { err('No input file specified.'); process.exit(1); }

  const resolved = resolve(inputPath);
  if (!existsSync(resolved)) { err(`File not found: ${resolved}`); process.exit(1); }

  const formatId = args.from ?? detectFormat(resolved);
  if (!formatId) {
    err(`Cannot detect format for "${basename(resolved)}". Use --from <format>.`);
    process.exit(1);
  }

  const converter = registry.getConverter(formatId);
  if (!converter) { err(`Unknown format: ${formatId}`); process.exit(1); }

  info(`\n${c.bold}Inspecting:${c.reset} ${basename(resolved)}`);
  dim(`  Format  : ${converter.format.name} (${formatId})`);
  dim(`  Path    : ${resolved}`);

  const content = readInput(resolved, converter.format.readAs);
  const result  = await converter.parse(content, basename(resolved));

  process.stdout.write('\n');
  ok(`${result.tools.length} tool${result.tools.length !== 1 ? 's' : ''} found`);

  if (result.warnings.length > 0) {
    result.warnings.forEach((w) => warn(w));
  }
  if (result.errors.length > 0) {
    result.errors.forEach((e) => err(e));
  }

  if (result.tools.length > 0) {
    process.stdout.write('\n');
    const shown = result.tools.slice(0, 20);
    for (const t of shown) {
      const dia = t.geometry?.diameter != null ? ` ⌀${t.geometry.diameter}mm` : '';
      process.stdout.write(
        `  ${c.blue}T${String(t.toolNumber).padEnd(4)}${c.reset} ${c.dim}[${t.type}]${c.reset} ${t.description ?? ''}${c.yellow}${dia}${c.reset}\n`,
      );
    }
    if (result.tools.length > 20) {
      dim(`  … and ${result.tools.length - 20} more`);
    }
  }

  if (result.metadata && Object.keys(result.metadata).length > 0) {
    process.stdout.write('\n');
    dim('  Metadata:');
    for (const [k, v] of Object.entries(result.metadata)) {
      dim(`    ${k}: ${JSON.stringify(v)}`);
    }
  }

  process.stdout.write('\n');
}

async function cmdConvert(args: Args) {
  const inputPath = args.input;
  if (!inputPath) { err('No input file specified.'); printHelp(); process.exit(1); }
  if (!args.to)   { err('--to <format> is required.'); printHelp(); process.exit(1); }

  const resolved = resolve(inputPath);
  if (!existsSync(resolved)) { err(`File not found: ${resolved}`); process.exit(1); }

  const fromId = args.from ?? detectFormat(resolved);
  if (!fromId) {
    err(`Cannot detect source format for "${basename(resolved)}". Use --from <format>.`);
    process.exit(1);
  }

  const fromConverter = registry.getConverter(fromId);
  if (!fromConverter) { err(`Unknown source format: ${fromId}`); process.exit(1); }
  if (!fromConverter.format.canImport) { err(`Format "${fromId}" does not support import.`); process.exit(1); }

  const toConverter = registry.getConverter(args.to);
  if (!toConverter) { err(`Unknown target format: ${args.to}`); process.exit(1); }
  if (!toConverter.format.canExport) { err(`Format "${args.to}" does not support export.`); process.exit(1); }

  process.stdout.write(`\n${c.bold}Converting:${c.reset} ${basename(resolved)}\n`);
  dim(`  From    : ${fromConverter.format.name} (${fromId})`);
  dim(`  To      : ${toConverter.format.name} (${args.to})`);

  // Parse
  const content    = readInput(resolved, fromConverter.format.readAs);
  const parseResult = await fromConverter.parse(content, basename(resolved));

  if (parseResult.errors.length > 0) {
    parseResult.errors.forEach((e) => err(`Parse: ${e}`));
  }
  if (parseResult.warnings.length > 0) {
    parseResult.warnings.forEach((w) => warn(`Parse: ${w}`));
  }

  ok(`Parsed ${parseResult.tools.length} tool${parseResult.tools.length !== 1 ? 's' : ''}`);

  if (parseResult.tools.length === 0) {
    warn('No tools to convert. Output file will not be written.');
    process.exit(0);
  }

  // Write
  const writeResult = await toConverter.write(parseResult.tools, {
    filename: basename(resolved, extname(resolved)),
  });

  if (writeResult.warnings.length > 0) {
    writeResult.warnings.forEach((w) => warn(`Write: ${w}`));
  }

  const outPath = resolveOutputPath(resolved, args.output, writeResult.filename);

  if (existsSync(outPath) && !args.overwrite) {
    err(`Output file already exists: ${outPath}`);
    err('Use --overwrite to replace it.');
    process.exit(1);
  }

  // Ensure output directory exists
  const outDir = dirname(outPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(outPath, writeResult.content, 'utf-8');

  ok(`Written: ${outPath}`);
  process.stdout.write('\n');
}

// ── Help ──────────────────────────────────────────────────────────────────────

function printHelp() {
  process.stdout.write(`
${c.bold}CNC Tool Converter CLI${c.reset}
Convert CNC tool library files between CAM and controller formats.

${c.bold}Usage:${c.reset}
  cnc-convert ${c.cyan}convert${c.reset}  <input> ${c.dim}--to <format>${c.reset} [options]
  cnc-convert ${c.cyan}formats${c.reset}
  cnc-convert ${c.cyan}inspect${c.reset}  <input> [${c.dim}--from <format>${c.reset}]

${c.bold}Convert options:${c.reset}
  <input>               Input file path (positional)
  ${c.dim}-i, --input  <file>${c.reset}   Input file (explicit flag)
  ${c.dim}-f, --from   <id>${c.reset}     Source format (auto-detected from extension)
  ${c.dim}-t, --to     <id>${c.reset}     Target format ${c.yellow}(required)${c.reset}
  ${c.dim}-o, --output <path>${c.reset}   Output file or directory (default: alongside input)
      ${c.dim}--overwrite${c.reset}       Overwrite existing output file

${c.bold}Examples:${c.reset}
  ${c.dim}# Convert HSMLib to LinuxCNC tool table${c.reset}
  cnc-convert convert tools.hsmlib --to linuxcnc

  ${c.dim}# Convert to Fanuc and write to a specific directory${c.reset}
  cnc-convert convert tools.hsmlib --to fanuc --output ./nc-files/

  ${c.dim}# Convert from a format that can't be detected from extension${c.reset}
  cnc-convert convert export.json --from fusion360json --to hsmlib

  ${c.dim}# List all available formats${c.reset}
  cnc-convert formats

  ${c.dim}# Inspect a file without converting${c.reset}
  cnc-convert inspect tools.hsmlib

Run via npm:  ${c.cyan}npm run cli -- convert tools.hsmlib --to linuxcnc${c.reset}
`);
}

function printVersion() {
  process.stdout.write('cnc-convert 1.0.0\n');
}

// ── Entry point ───────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));

if (args.version) { printVersion(); process.exit(0); }
if (args.help || !args.command) { printHelp(); process.exit(0); }

switch (args.command) {
  case 'convert':  await cmdConvert(args);  break;
  case 'formats':  cmdFormats();            break;
  case 'inspect':  await cmdInspect(args);  break;
  default:
    err(`Unknown command: ${args.command}`);
    printHelp();
    process.exit(1);
}
