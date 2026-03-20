import { useState, useEffect, useCallback, lazy, Suspense, type ReactNode } from 'react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { MaterialProvider } from './contexts/MaterialContext';
import { HolderProvider } from './contexts/HolderContext';
import { MachineProvider } from './contexts/MachineContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChangelogModal, { shouldShowChangelog } from './components/ChangelogModal';
import { scheduleStartupUpdateCheck } from './lib/tauri/updater';

const ConverterPage      = lazy(() => import('./components/pages/ConverterPage'));
const ToolManagerPage    = lazy(() => import('./components/pages/ToolManagerPage'));
const SettingsPage       = lazy(() => import('./components/pages/SettingsPage'));
const ToolDebugPage      = lazy(() => import('./components/pages/ToolDebugPage'));
const ThemeShowcasePage  = lazy(() => import('./components/pages/ThemeShowcasePage'));
const MachinesPage       = lazy(() => import('./components/pages/MachinesPage'));
const FormatMappingPage  = lazy(() => import('./components/pages/FormatMappingPage'));

export type Page = 'converter' | 'tools' | 'machines' | 'settings' | 'debug' | 'themes' | 'format-map';

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
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

export default function App() {
  const [activePage, setActivePage] = useState<Page>('converter');
  const [showChangelog, setShowChangelog] = useState(() => shouldShowChangelog());
  const closeChangelog = useCallback(() => setShowChangelog(false), []);
  const closeThemes = useCallback(() => setActivePage('converter'), []);

  useEffect(() => { scheduleStartupUpdateCheck(); }, []);

  return (
    <SettingsProvider>
      <LibraryProvider>
        <MaterialProvider>
          <HolderProvider>
            <MachineProvider>
            <ThemeWrapper>
              <Header />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar activePage={activePage} onNavigate={setActivePage} />
                <main className="flex-1 overflow-hidden min-w-0">
                  <Suspense fallback={<PageFallback />}>
                    {activePage === 'converter' && <ConverterPage />}
                    {activePage === 'tools'     && <ToolManagerPage />}
                    {activePage === 'machines'  && <MachinesPage />}
                    {activePage === 'settings'  && <SettingsPage />}
                    {activePage === 'debug'      && <ToolDebugPage />}
                    {activePage === 'format-map' && <FormatMappingPage />}
                  </Suspense>
                  <Suspense fallback={null}>
                    {activePage === 'themes' && <ThemeShowcasePage onClose={closeThemes} />}
                  </Suspense>
                </main>
              </div>
              {showChangelog && <ChangelogModal onClose={closeChangelog} />}
            </ThemeWrapper>
            </MachineProvider>
          </HolderProvider>
        </MaterialProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}
