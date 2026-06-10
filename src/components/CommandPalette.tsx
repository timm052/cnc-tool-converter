import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ArrowLeftRight, Library, Settings, Cpu, HelpCircle, LayoutDashboard,
  Wrench, type LucideIcon,
} from 'lucide-react';
import { useLibrary } from '../contexts/LibraryContext';
import { useMachines } from '../contexts/MachineContext';
import { MACHINE_TYPE_LABELS, type MachineType } from '../types/machine';
import type { Page } from '../App';

interface Props {
  onNavigate:    (page: Page) => void;
  onOpenTool:    (toolId: string) => void;
  onOpenMachine: (machineId: string) => void;
  onClose:       () => void;
}

interface NavCommand {
  id:    Page;
  label: string;
  icon:  LucideIcon;
}

const NAV_COMMANDS: NavCommand[] = [
  { id: 'dashboard', label: 'Go to Dashboard',    icon: LayoutDashboard },
  { id: 'converter', label: 'Go to Converter',    icon: ArrowLeftRight },
  { id: 'tools',     label: 'Go to Tool Library', icon: Library },
  { id: 'machines',  label: 'Go to Machines',     icon: Cpu },
  { id: 'help',      label: 'Go to Help',         icon: HelpCircle },
  { id: 'settings',  label: 'Go to Settings',     icon: Settings },
];

const MAX_TOOL_RESULTS    = 6;
const MAX_MACHINE_RESULTS = 4;

type ResultItem =
  | { kind: 'nav';     command: NavCommand }
  | { kind: 'tool';    id: string; toolNumber: number; description: string; manufacturer?: string; type: string }
  | { kind: 'machine'; id: string; name: string; type: MachineType; manufacturer?: string; model?: string };

export default function CommandPalette({ onNavigate, onOpenTool, onOpenMachine, onClose }: Props) {
  const { tools } = useLibrary();
  const { machines } = useMachines();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase();

    const navMatches = NAV_COMMANDS
      .filter((c) => !q || c.label.toLowerCase().includes(q))
      .map((command): ResultItem => ({ kind: 'nav', command }));

    if (!q) return navMatches;

    const toolMatches = tools
      .filter((t) =>
        t.description.toLowerCase().includes(q) ||
        t.manufacturer?.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        String(t.toolNumber) === q ||
        `t${t.toolNumber}`.toLowerCase() === q,
      )
      .slice(0, MAX_TOOL_RESULTS)
      .map((t): ResultItem => ({
        kind: 'tool', id: t.id, toolNumber: t.toolNumber,
        description: t.description, manufacturer: t.manufacturer, type: t.type,
      }));

    const machineMatches = machines
      .filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.manufacturer?.toLowerCase().includes(q) ||
        m.model?.toLowerCase().includes(q) ||
        MACHINE_TYPE_LABELS[m.type].toLowerCase().includes(q),
      )
      .slice(0, MAX_MACHINE_RESULTS)
      .map((m): ResultItem => ({
        kind: 'machine', id: m.id, name: m.name,
        type: m.type, manufacturer: m.manufacturer, model: m.model,
      }));

    return [...navMatches, ...toolMatches, ...machineMatches];
  }, [query, tools, machines]);

  // Clamp selection when results shrink
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(results.length - 1, 0)));
  }, [results.length]);

  function execute(item: ResultItem) {
    if (item.kind === 'nav') onNavigate(item.command.id);
    else if (item.kind === 'tool') onOpenTool(item.id);
    else onOpenMachine(item.id);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[selected];
      if (item) execute(item);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 pointer-events-none">
        <div className="w-[560px] max-h-[60vh] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-700 shrink-0">
            <Search size={16} className="text-slate-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages and tools…"
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600 shrink-0">Esc</kbd>
          </div>

          <div className="flex-1 overflow-y-auto py-1.5">
            {results.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-500">No matches found.</p>
            )}
            {results.map((item, i) => {
              const isSelected = i === selected;
              if (item.kind === 'nav') {
                const Icon = item.command.icon;
                return (
                  <button
                    key={`nav-${item.command.id}`}
                    type="button"
                    onClick={() => execute(item)}
                    onMouseEnter={() => setSelected(i)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
                      isSelected ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700/60',
                    ].join(' ')}
                  >
                    <Icon size={15} className={isSelected ? 'text-white' : 'text-slate-400'} />
                    {item.command.label}
                  </button>
                );
              }
              if (item.kind === 'tool') {
                return (
                  <button
                    key={`tool-${item.id}`}
                    type="button"
                    onClick={() => execute(item)}
                    onMouseEnter={() => setSelected(i)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
                      isSelected ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700/60',
                    ].join(' ')}
                  >
                    <Wrench size={15} className={isSelected ? 'text-white' : 'text-slate-400'} />
                    <span className="font-mono text-xs shrink-0">T{item.toolNumber}</span>
                    <span className="truncate flex-1">{item.description}</span>
                    {item.manufacturer && (
                      <span className={`text-xs shrink-0 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>{item.manufacturer}</span>
                    )}
                  </button>
                );
              }
              return (
                <button
                  key={`machine-${item.id}`}
                  type="button"
                  onClick={() => execute(item)}
                  onMouseEnter={() => setSelected(i)}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
                    isSelected ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700/60',
                  ].join(' ')}
                >
                  <Cpu size={15} className={isSelected ? 'text-white' : 'text-slate-400'} />
                  <span className="truncate flex-1">{item.name}</span>
                  <span className={`text-xs shrink-0 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    {[item.manufacturer, item.model].filter(Boolean).join(' ') || MACHINE_TYPE_LABELS[item.type]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
