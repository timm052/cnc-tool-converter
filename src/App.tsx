import { useState, useEffect, useCallback, lazy, Suspense, type ReactNode } from 'react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { LibraryProvider, useLibrary } from './contexts/LibraryContext';
import { MaterialProvider } from './contexts/MaterialContext';
import { HolderProvider } from './contexts/HolderContext';
import { MachineProvider, useMachines } from './contexts/MachineContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChangelogModal, { shouldShowChangelog } from './components/ChangelogModal';
import CommandPalette from './components/CommandPalette';
import { scheduleStartupUpdateCheck } from './lib/tauri/updater';
import { getDueMachines } from './lib/maintenanceCheck';
import { isLowStock } from './lib/libraryStats';
import { daysSinceBackup } from './lib/backupNudge';
import { notifyMaintenanceDue, notifyLowStock, notifyBackupDue } from './lib/tauri/notifications';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { ToolManagerIntent } from './components/pages/ToolManagerPage';
import type { MachinesPageIntent } from './components/pages/MachinesPage';

const ConverterPage      = lazy(() => import('./components/pages/ConverterPage'));
const ToolManagerPage    = lazy(() => import('./components/pages/ToolManagerPage'));
const SettingsPage       = lazy(() => import('./components/pages/SettingsPage'));
const ToolDebugPage      = lazy(() => import('./components/pages/ToolDebugPage'));
const ThemeShowcasePage  = lazy(() => import('./components/pages/ThemeShowcasePage'));
const MachinesPage       = lazy(() => import('./components/pages/MachinesPage'));
const FormatMappingPage  = lazy(() => import('./components/pages/FormatMappingPage'));
const HelpPage           = lazy(() => import('./components/pages/HelpPage'));
const DashboardPage      = lazy(() => import('./components/pages/DashboardPage'));

export type Page = 'dashboard' | 'converter' | 'tools' | 'machines' | 'settings' | 'help' | 'debug' | 'themes' | 'format-map';

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const NOTIFIED_KEY = 'cnc-tool-converter:maintenanceNotified';
const MAINTENANCE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const BACKUP_DUE_DAYS = 7;

/** Periodically checks for machines due for maintenance, low-stock tools, and
 *  overdue backups, sending a native notification at most once per day per
 *  item/category. Renders nothing. */
function MaintenanceChecker() {
  const { machines } = useMachines();
  const { tools } = useLibrary();
  const { settings } = useSettings();
  const { notifyMaintenanceEnabled, notifyLowStockEnabled, notifyBackupEnabled, maintenanceLeadDays } = settings;

  useEffect(() => {
    function check() {
      let notified: Record<string, string> = {};
      try {
        notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '{}');
      } catch { /* ignore */ }

      const today = new Date().toISOString().slice(0, 10);
      let changed = false;

      if (notifyMaintenanceEnabled) {
        for (const m of getDueMachines(machines, maintenanceLeadDays)) {
          const key = `machine:${m.id}`;
          if (notified[key] !== today) {
            notifyMaintenanceDue(m.name);
            notified[key] = today;
            changed = true;
          }
        }
      }

      if (notifyLowStockEnabled) {
        const lowStockCount = tools.filter(isLowStock).length;
        if (lowStockCount > 0 && notified.lowStock !== today) {
          notifyLowStock(lowStockCount);
          notified.lowStock = today;
          changed = true;
        }
      }

      if (notifyBackupEnabled) {
        const days = daysSinceBackup();
        if ((days === null || days >= BACKUP_DUE_DAYS) && notified.backup !== today) {
          notifyBackupDue();
          notified.backup = today;
          changed = true;
        }
      }

      if (changed) {
        try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified)); } catch { /* quota */ }
      }
    }

    check();
    const id = setInterval(check, MAINTENANCE_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [machines, tools, notifyMaintenanceEnabled, notifyLowStockEnabled, notifyBackupEnabled, maintenanceLeadDays]);

  return null;
}

function ThemeWrapper({ children }: { children: ReactNode }) {
  const { settings } = useSettings();

  const [osPrefersDark, setOsPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    if (settings.theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setOsPrefersDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme]);

  const effectiveTheme = settings.theme === 'auto'
    ? (osPrefersDark ? 'dark' : 'light')
    : settings.theme;

  return (
    <div
      data-theme={effectiveTheme}
      className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden min-w-[320px]"
    >
      {children}
    </div>
  );
}

function AppShell() {
  const { settings } = useSettings();
  const [activePage, setActivePage] = useState<Page>(settings.defaultPage);
  const [showChangelog, setShowChangelog] = useState(() => shouldShowChangelog());
  const [tmIntent, setTmIntent] = useState<ToolManagerIntent | null>(null);
  const [mIntent,  setMIntent]  = useState<MachinesPageIntent | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const closeChangelog = useCallback(() => setShowChangelog(false), []);
  const closeThemes = useCallback(() => setActivePage('converter'), []);
  const openToolManager = useCallback((intent?: ToolManagerIntent) => setTmIntent(intent ?? null), []);
  const clearTmIntent = useCallback(() => setTmIntent(null), []);
  const clearMIntent = useCallback(() => setMIntent(null), []);
  const openToolFromPalette = useCallback((toolId: string) => {
    setTmIntent({ toolId });
    setActivePage('tools');
  }, []);
  const openMachineFromPalette = useCallback((machineId: string) => {
    setMIntent({ machineId });
    setActivePage('machines');
  }, []);

  useEffect(() => { scheduleStartupUpdateCheck(); }, []);

  useKeyboardShortcuts([
    { key: 'k', ctrl: true, allowInInput: true, callback: () => setPaletteOpen(true) },
  ]);

  return (
    <LibraryProvider>
      <MaterialProvider>
        <HolderProvider>
          <MachineProvider>
          <MaintenanceChecker />
          <ThemeWrapper>
            <Header />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar activePage={activePage} onNavigate={setActivePage} />
              <main className="flex-1 overflow-hidden min-w-0">
                <Suspense fallback={<PageFallback />}>
                  {activePage === 'dashboard' && <DashboardPage onNavigate={setActivePage} onOpenToolManager={openToolManager} />}
                  {activePage === 'converter' && <ConverterPage />}
                  {activePage === 'tools'     && <ToolManagerPage intent={tmIntent} onConsumeIntent={clearTmIntent} />}
                  {activePage === 'machines'  && <MachinesPage intent={mIntent} onConsumeIntent={clearMIntent} />}
                  {activePage === 'settings'  && <SettingsPage />}
                  {activePage === 'help'      && <HelpPage />}
                  {activePage === 'debug'      && <ToolDebugPage />}
                  {activePage === 'format-map' && <FormatMappingPage />}
                </Suspense>
                <Suspense fallback={null}>
                  {activePage === 'themes' && <ThemeShowcasePage onClose={closeThemes} />}
                </Suspense>
              </main>
            </div>
            {showChangelog && <ChangelogModal onClose={closeChangelog} />}
            {paletteOpen && (
              <CommandPalette
                onNavigate={setActivePage}
                onOpenTool={openToolFromPalette}
                onOpenMachine={openMachineFromPalette}
                onClose={() => setPaletteOpen(false)}
              />
            )}
          </ThemeWrapper>
          </MachineProvider>
        </HolderProvider>
      </MaterialProvider>
    </LibraryProvider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppShell />
    </SettingsProvider>
  );
}
