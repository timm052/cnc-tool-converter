import { Library, Plus, Search, Upload, Download, Layers } from 'lucide-react';

/**
 * Tool Manager Page
 *
 * This page is the foundation for the full tool library manager.
 * Planned features:
 *  - Persistent local tool library (IndexedDB or localStorage)
 *  - Create / edit / delete tool entries
 *  - Import tools from any supported format
 *  - Export selected tools to any supported format
 *  - Organise tools by category, material, manufacturer
 *  - Search and filter with advanced criteria
 *  - Compare tools side-by-side
 */
export default function ToolManagerPage() {
  return (
    <div className="flex flex-col h-full p-6 gap-6">

      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-white">Tool Manager</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage your persistent CNC tool library
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600"
          >
            <Download size={14} />
            Export
          </button>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600/40 text-blue-400 cursor-not-allowed"
          >
            <Plus size={14} />
            New Tool
          </button>
        </div>
      </div>

      {/* Search / filter bar stub */}
      <div className="shrink-0 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm opacity-50">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            disabled
            type="text"
            placeholder="Search tools…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-400 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Coming soon illustration */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center">
            <Library size={40} className="text-slate-600" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
            <Layers size={14} className="text-blue-400" />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">
            Tool Manager — Coming Soon
          </h2>
          <p className="text-slate-400 text-sm max-w-md leading-relaxed">
            The Tool Manager will let you build a persistent library of all your CNC
            tools, organise them by category and machine, and quickly export subsets
            to any supported format.
          </p>
        </div>

        {/* Roadmap */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mt-2">
          {[
            {
              icon: Library,
              title: 'Persistent Library',
              desc: 'Store tools locally in your browser with IndexedDB.',
            },
            {
              icon: Layers,
              title: 'Categories & Tags',
              desc: 'Organise by type, material, machine or custom tags.',
            },
            {
              icon: Upload,
              title: 'Multi-format Import',
              desc: 'Import from any supported CAM format and merge libraries.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex flex-col gap-2 p-4 rounded-xl bg-slate-800/60 border border-slate-700 text-left"
            >
              <div className="flex items-center gap-2 text-blue-400">
                <Icon size={16} />
                <span className="text-sm font-medium text-slate-200">{title}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
