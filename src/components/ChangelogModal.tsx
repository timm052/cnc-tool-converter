/**
 * ChangelogModal — "What's New" overlay shown once per version.
 * The current version is pulled from package.json at build time.
 * The user's last-seen version is persisted in localStorage.
 */
import { X, Sparkles } from 'lucide-react';
import { version as VERSION } from '../../package.json';

const LAST_SEEN_KEY = 'cnc-tool-converter:lastSeenVersion';

export function shouldShowChangelog(): boolean {
  try {
    return localStorage.getItem(LAST_SEEN_KEY) !== VERSION;
  } catch {
    return false;
  }
}

export function markChangelogSeen(): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, VERSION);
  } catch { /* quota */ }
}

// ── Changelog entries ────────────────────────────────────────────────────────

interface ChangelogEntry {
  version: string;
  date:    string;
  items:   string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date:    'March 2026',
    items: [
      'Metric ↔ Imperial display toggle in Tool Library filter bar',
      'Excel (.xlsx) export and import support',
      'Print Label button directly from QR scanner "found" state',
      'Auto (OS) theme — follows system dark/light preference',
      'Tag removal X button directly on tag chips in the table',
      'Type-coloured left border accent on each tool row',
      'Comment shown as tooltip on Description cell hover',
      'Recent files list shown in Import panel',
      'Unit conversion → mm / → in split-button for selected tools',
      'Smart renumber presets (1,2,3 / 10,20 / Mills@100 / Drills@200 / Taps@300)',
      'Fusion 360 Cloud Library JSON importer/exporter',
      'RhinoCAM / VisualMill .vkb binary format importer',
      'Tool profile SVG visualisation in Tool Manager',
      'Per-material Feeds & Speeds popover in tool rows',
      'QR label printing (configurable size, fields, layout)',
      'PDF tool data sheet export via jsPDF',
      'G-code tool offset reference sheet download',
      'Duplicate detection in import with per-tool skip checkboxes',
      'Bulk edit, compare, renumber, validation panels',
      'Machine group sidebar with per-group tool counts',
      'Custom tool type definitions with custom SVG profiles',
      'Multiple theme options: Dark, Light, Retro 90s, Win XP, macOS 9',
    ],
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function ChangelogModal({ onClose }: { onClose: () => void }) {
  function handleClose() {
    markChangelogSeen();
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={handleClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[540px] max-h-[80vh] flex flex-col bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles size={18} className="text-blue-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">What's New</h2>
              <p className="text-xs text-slate-400">Version {VERSION}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {CHANGELOG.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-blue-400">v{entry.version}</span>
                <span className="text-xs text-slate-500">{entry.date}</span>
              </div>
              <ul className="space-y-1.5">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
}
