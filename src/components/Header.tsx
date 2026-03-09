import { Wrench, Github } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export default function Header() {
  const { settings } = useSettings();

  if (settings.theme === 'macos9') {
    return (
      <header className="macos9-titlebar shrink-0">
        <div className="macos9-titlebar__controls">
          <button type="button" className="macos9-winbtn" title="Close" aria-label="Close">×</button>
        </div>
        <div className="macos9-titlebar__title">
          CNC Tool Converter
        </div>
        <div className="macos9-titlebar__controls macos9-titlebar__controls--right">
          <button type="button" className="macos9-winbtn" title="Collapse" aria-label="Collapse" />
          <button type="button" className="macos9-winbtn" title="Zoom" aria-label="Zoom">+</button>
        </div>
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
      {/* Logo + title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
          <Wrench size={16} className="text-white" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-white font-semibold text-base tracking-tight">
            CNC Tool Converter
          </span>
          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-600/30">
            v0.1
          </span>
        </div>
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-4">
        <span className="text-slate-400 text-xs hidden sm:block">
          Convert · Manage · Export
        </span>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-slate-200 transition-colors"
          title="View on GitHub"
        >
          <Github size={18} />
        </a>
      </div>
    </header>
  );
}
