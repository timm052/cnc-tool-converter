import { useState, type ReactNode } from 'react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { MaterialProvider } from './contexts/MaterialContext';
import { HolderProvider } from './contexts/HolderContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ConverterPage from './components/pages/ConverterPage';
import ToolManagerPage from './components/pages/ToolManagerPage';
import SettingsPage from './components/pages/SettingsPage';

export type Page = 'converter' | 'tools' | 'settings';

function ThemeWrapper({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  return (
    <div
      data-theme={settings.theme}
      className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden"
    >
      {children}
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>('converter');

  return (
    <SettingsProvider>
      <LibraryProvider>
        <MaterialProvider>
          <HolderProvider>
            <ThemeWrapper>
              <Header />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar activePage={activePage} onNavigate={setActivePage} />
                <main className="flex-1 overflow-hidden">
                  {activePage === 'converter' && <ConverterPage />}
                  {activePage === 'tools'     && <ToolManagerPage />}
                  {activePage === 'settings'  && <SettingsPage />}
                </main>
              </div>
            </ThemeWrapper>
          </HolderProvider>
        </MaterialProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}
