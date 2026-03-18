/**
 * ThemeShowcasePage — dev tool for comparing all themes side by side.
 *
 * Renders via createPortal directly into document.body so it escapes the
 * app's outer [data-theme] wrapper. Without this, the active theme's
 * !important rules would bleed into the inner theme columns (same CSS
 * specificity, last-imported wins).
 */
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { ArrowLeft, ChevronDown, AlertTriangle, Star, Tag } from 'lucide-react';

// ── Theme definitions ─────────────────────────────────────────────────────────

const THEMES = [
  { id: 'dark',    label: 'Dark',       subtitle: 'default Tailwind' },
  { id: 'light',   label: 'Light',      subtitle: 'modern clean' },
  { id: 'retro90s', label: 'Retro 90s', subtitle: 'Windows 95/98' },
  { id: 'winxp',   label: 'Windows XP', subtitle: 'Luna / Fisher-Price' },
  { id: 'macos9',  label: 'Mac OS 9',   subtitle: 'Platinum' },
] as const;

// ── Type badge data (mirrors customToolTypes.ts BUILTIN_COLOURS) ──────────────

const TYPE_BADGES = [
  { label: 'Flat EM',   cls: 'bg-blue-500/20 text-blue-300' },
  { label: 'Ball EM',   cls: 'bg-purple-500/20 text-purple-300' },
  { label: 'Drill',     cls: 'bg-green-500/20 text-green-300' },
  { label: 'Chamfer',   cls: 'bg-orange-500/20 text-orange-300' },
  { label: 'Thread',    cls: 'bg-amber-500/20 text-amber-300' },
  { label: 'Engraving', cls: 'bg-rose-500/20 text-rose-300' },
  { label: 'Probe',     cls: 'bg-sky-500/20 text-sky-300' },
  { label: 'Face Mill', cls: 'bg-cyan-500/20 text-cyan-300' },
];

// ── Row accent data (mirrors customToolTypes.ts BORDER_CLASSES) ───────────────

const ROW_ACCENTS = [
  { label: 'Flat End Mill',  border: 'border-l-blue-400',    badge: 'bg-blue-500/20 text-blue-300' },
  { label: 'Ball End Mill',  border: 'border-l-purple-400',  badge: 'bg-purple-500/20 text-purple-300' },
  { label: 'Drill',          border: 'border-l-green-400',   badge: 'bg-green-500/20 text-green-300' },
  { label: 'Thread Mill',    border: 'border-l-amber-400',   badge: 'bg-amber-500/20 text-amber-300' },
  { label: 'Probe',          border: 'border-l-sky-400',     badge: 'bg-sky-500/20 text-sky-300' },
  { label: 'Laser Cutter',   border: 'border-l-red-400',     badge: 'bg-red-500/20 text-red-300' },
];

// ── Individual section heading ────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
      {children}
    </p>
  );
}

function Divider() {
  return <hr className="border-slate-700 my-3" />;
}

// ── Single-theme swatch ───────────────────────────────────────────────────────

function ThemeSwatch({ id, label, subtitle }: typeof THEMES[number]) {
  const [dropOpen, setDropOpen] = useState(false);

  // data-theme must be on an OUTER element; bg/text classes go on an inner
  // child so that [data-theme="X"] .bg-slate-900 (descendant combinator) fires.
  return (
    <div data-theme={id} className="flex flex-col shrink-0 w-[300px]">
      <div className="bg-slate-900 text-slate-100 flex flex-col h-full">

        {/* Column header */}
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
          <div className="text-sm font-semibold text-slate-100">{label}</div>
          <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
        </div>

        {/* Scrollable content — must be <main> so [data-theme] main button/input rules apply */}
        <main className="flex-1 overflow-y-auto bg-slate-900 p-4 space-y-1">

        {/* ── Buttons ─────────────────────────────────────────────── */}
        <SectionLabel>Buttons</SectionLabel>
        <div className="flex flex-wrap gap-2 mb-1">
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Primary
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Secondary
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
          >
            Ghost
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
          >
            Destructive
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white"
          >
            Small
          </button>
          <button
            type="button"
            disabled
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-500 cursor-not-allowed"
          >
            Disabled
          </button>
        </div>

        <Divider />

        {/* ── Inputs ──────────────────────────────────────────────── */}
        <SectionLabel>Inputs</SectionLabel>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Text input…"
            className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
          />
          <select aria-label="Example select" className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>Option A</option>
            <option>Option B</option>
            <option>Option C</option>
          </select>
          <textarea
            rows={2}
            placeholder="Textarea…"
            className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500 resize-none"
          />
        </div>

        <Divider />

        {/* ── Dropdown button ──────────────────────────────────────── */}
        <SectionLabel>Dropdown</SectionLabel>
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600 transition-colors"
          >
            <span>Actions ▾</span>
            <ChevronDown size={14} className={`transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropOpen && (
            <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 overflow-hidden">
              {['Duplicate', 'Copy to Group', 'Export', 'Delete'].map(item => (
                <button
                  key={item}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors ${item === 'Delete' ? 'text-red-400' : 'text-slate-200'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* ── Toggle ──────────────────────────────────────────────── */}
        <SectionLabel>Toggle / Switch</SectionLabel>
        <div className="flex items-center gap-4">
          <button
            type="button"
            role="switch"
            aria-checked="true"
            aria-label="Toggle on"
            className="relative inline-flex h-5 w-9 items-center rounded-full bg-blue-600"
          >
            <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white translate-x-4" />
          </button>
          <span className="text-sm text-slate-300">On</span>
          <button
            type="button"
            role="switch"
            aria-checked="false"
            aria-label="Toggle off"
            className="relative inline-flex h-5 w-9 items-center rounded-full bg-slate-600"
          >
            <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white translate-x-0.5" />
          </button>
          <span className="text-sm text-slate-400">Off</span>
        </div>

        <Divider />

        {/* ── Type badges ─────────────────────────────────────────── */}
        <SectionLabel>Type Badges</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_BADGES.map(({ label: bl, cls }) => (
            <span
              key={bl}
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}
            >
              {bl}
            </span>
          ))}
        </div>

        <Divider />

        {/* ── Row type accents ─────────────────────────────────────── */}
        <SectionLabel>Row Type Accents</SectionLabel>
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <tbody>
              {ROW_ACCENTS.map(({ label: rl, border, badge }, i) => (
                <tr key={rl} className="border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors">
                  <td className={`px-2 py-1.5 border-l-2 ${border}`}>
                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge}`}>
                      {rl}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-400">T{i + 1}</td>
                  <td className="px-2 py-1.5 text-slate-300">12.0 mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Divider />

        {/* ── Panel / card ─────────────────────────────────────────── */}
        <SectionLabel>Panel / Card</SectionLabel>
        <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100">Panel Title</span>
            <span className="text-xs text-slate-400">subtitle</span>
          </div>
          <div className="p-4 text-sm text-slate-300 space-y-2">
            <p>Panel body content with <span className="text-blue-400">a link</span> inside.</p>
            <p className="text-slate-500">Secondary line of muted text.</p>
          </div>
          <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-end gap-3">
            <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700">
              Cancel
            </button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white">
              Save
            </button>
          </div>
        </div>

        <Divider />

        {/* ── Warning / info box ───────────────────────────────────── */}
        <SectionLabel>Warning Box</SectionLabel>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Low stock: 2 tools below threshold.</span>
        </div>

        <Divider />

        {/* ── Tags / chips ─────────────────────────────────────────── */}
        <SectionLabel>Tags / Chips</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {['aluminium', 'roughing', '4-flute', 'coated'].map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
            >
              <Tag size={9} />
              {tag}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/30">
            <Star size={9} />
            starred
          </span>
        </div>

        <Divider />

        {/* ── Star / favourite ─────────────────────────────────────── */}
        <SectionLabel>Star Favourite</SectionLabel>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Starred" className="p-1 rounded text-amber-400 hover:bg-slate-600 transition-colors">
            <Star size={16} fill="currentColor" />
          </button>
          <span className="text-xs text-slate-400">starred</span>
          <button type="button" aria-label="Unstarred" className="p-1 rounded text-slate-600 hover:text-amber-300 hover:bg-slate-600 transition-colors">
            <Star size={16} />
          </button>
          <span className="text-xs text-slate-400">unstarred</span>
        </div>

        <Divider />

        {/* ── Drop zone ────────────────────────────────────────────── */}
        <SectionLabel>Drop Zone</SectionLabel>
        <div className="border-2 border-dashed border-slate-600 rounded-xl p-4 text-center text-sm text-slate-400 bg-slate-800/50">
          Drop files here or click to browse
        </div>

        {/* ── Tooltip ─────────────────────────────────────────────── */}
        <Divider />
        <SectionLabel>Tooltip</SectionLabel>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300">Hover target</span>
          <div role="tooltip" className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-100 border border-slate-600 shadow-lg">
            Tooltip text
          </div>
        </div>

        {/* ── Section label style itself ───────────────────────────── */}
        <Divider />
        <SectionLabel>Section Label Style</SectionLabel>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          This is a section header
        </p>
        <p className="text-base text-slate-100 font-semibold mt-1">text-base semibold</p>
        <p className="text-sm text-slate-200 mt-0.5">text-sm body copy</p>
        <p className="text-xs text-slate-400 mt-0.5">text-xs muted</p>

        {/* Spacer so last item isn't flush against the bottom */}
        <div className="h-4" />
        </main>
      </div>
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────

function ThemeShowcaseOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950">
      {/* Header — uses raw Tailwind; portal is outside [data-theme] so no bleed */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0 bg-slate-800 border-b border-slate-700">
        <div className="flex items-baseline gap-3">
          <span className="text-base font-semibold text-slate-100">Theme Showcase</span>
          <span className="text-xs text-slate-500">
            All themes rendered in isolation — portal escapes the active theme wrapper
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Return to App
        </button>
      </div>

      {/* Theme columns */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex flex-1 overflow-x-auto overflow-y-hidden divide-x divide-slate-700/60">
          {THEMES.map(theme => (
            <ThemeSwatch key={theme.id} {...theme} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page component (portal wrapper) ──────────────────────────────────────────

export default function ThemeShowcasePage({ onClose }: { onClose: () => void }) {
  return createPortal(
    <ThemeShowcaseOverlay onClose={onClose} />,
    document.body,
  );
}
