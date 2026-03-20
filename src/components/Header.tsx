import { Wrench, Github } from 'lucide-react';
import { version as VERSION } from '../../package.json';

export default function Header() {
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
            v{VERSION}
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
