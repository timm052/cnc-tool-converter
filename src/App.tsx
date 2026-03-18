import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { MaterialProvider } from './contexts/MaterialContext';
import { HolderProvider } from './contexts/HolderContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ConverterPage from './components/pages/ConverterPage';
import ToolManagerPage from './components/pages/ToolManagerPage';
import SettingsPage from './components/pages/SettingsPage';
import ToolDebugPage from './components/pages/ToolDebugPage';
import ChangelogModal, { shouldShowChangelog } from './components/ChangelogModal';

export type Page = 'converter' | 'tools' | 'settings' | 'debug';

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

  return (
    <SettingsProvider>
      <LibraryProvider>
        <MaterialProvider>
          <HolderProvider>
            <ThemeWrapper>
              <Header />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar activePage={activePage} onNavigate={setActivePage} />
                <main className="flex-1 overflow-hidden min-w-0">
                  {activePage === 'converter' && <ConverterPage />}
                  {activePage === 'tools'     && <ToolManagerPage />}
                  {activePage === 'settings'  && <SettingsPage />}
                  {activePage === 'debug'     && <ToolDebugPage />}
                </main>
              </div>
              {showChangelog && <ChangelogModal onClose={closeChangelog} />}
            </ThemeWrapper>
          </HolderProvider>
        </MaterialProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}
