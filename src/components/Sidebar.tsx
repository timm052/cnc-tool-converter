import { useState, useEffect } from 'react';
import { ArrowLeftRight, Library, Settings, ChevronRight, ChevronLeft, Bug, Download, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import type { Page } from '../App';
import { useSettings } from '../contexts/SettingsContext';
import { daysSinceBackup } from '../lib/backupNudge';

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
  },
  {
    id:    'settings',
    label: 'Settings',
    icon:  Settings,
  },
  {
    id:    'debug',
    label: 'Preview Debug',
    icon:  Bug,
    badge: 'DEV',
  },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { settings } = useSettings();
  const visibleItems = NAV_ITEMS.filter(item => item.id !== 'debug' || settings.devMode);

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const toggle = () => {
    setCollapsed(c => {
      const next = !c;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  // Backup nudge — re-evaluate each render (cheap localStorage read)
  const [daysSince, setDaysSince] = useState<number | null>(null);
  useEffect(() => {
    setDaysSince(daysSinceBackup());
  }, [activePage]); // refresh when user navigates (e.g. after doing a backup)

  const showNudge   = daysSince === null || daysSince >= 7;
  const nudgeLabel  = daysSince === null ? 'Never backed up' : `Backed up ${daysSince}d ago`;

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-2 gap-1">
        {/* Expand button */}
        <button
          type="button"
          onClick={toggle}
          title="Expand sidebar"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors mb-1"
        >
          <PanelLeftOpen size={16} />
        </button>

        {/* Nav icons */}
        {visibleItems.map(({ id, icon: Icon, label }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              title={label}
              className={[
                'w-8 h-8 flex items-center justify-center rounded-lg transition-all',
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white',
              ].join(' ')}
            >
              <Icon size={16} />
            </button>
          );
        })}

        {/* Backup nudge dot */}
        {showNudge && (
          <button
            type="button"
            onClick={() => onNavigate('tools')}
            title={nudgeLabel + ' — click to back up'}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors mt-auto mb-1"
          >
            <Download size={14} />
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-52 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Collapse button row */}
      <div className="flex items-center justify-end px-2 pt-2">
        <button
          type="button"
          onClick={toggle}
          title="Collapse sidebar"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      <nav className="flex-1 px-3 pb-3 space-y-0.5">
        {visibleItems.map(({ id, label, icon: Icon, badge }) => {
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
      <div className="p-3 border-t border-slate-700 space-y-2">
        {showNudge && (
          <button
            type="button"
            onClick={() => onNavigate('tools')}
            title="Go to Tool Manager to back up your library"
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            <Download size={11} />
            <span className="truncate">{nudgeLabel}</span>
          </button>
        )}
        <p className="text-xs text-slate-500 text-center">
          HSMLib · Fusion 360 · LinuxCNC
        </p>
      </div>
    </aside>
  );
}
