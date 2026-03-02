import { ArrowLeftRight, Library, Settings, ChevronRight, type LucideIcon } from 'lucide-react';
import type { Page } from '../App';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

interface NavItem {
  id: Page;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id:    'converter',
    label: 'Converter',
    icon:  ArrowLeftRight,
  },
  {
    id:    'tools',
    label: 'Tool Manager',
    icon:  Library,
    badge: 'Soon',
  },
  {
    id:    'settings',
    label: 'Settings',
    icon:  Settings,
  },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-52 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon, badge }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={[
                'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white',
              ].join(' ')}
            >
              <span className="flex items-center gap-3">
                <Icon size={16} className={active ? 'text-white' : 'text-slate-400'} />
                {label}
              </span>
              {badge ? (
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-slate-300 font-normal">
                  {badge}
                </span>
              ) : active ? (
                <ChevronRight size={14} className="text-blue-200" />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          Supports HSMLib · Fusion 360 · LinuxCNC
        </p>
      </div>
    </aside>
  );
}
