import { useState } from 'react';
import { SettingsProvider } from './contexts/SettingsContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { MaterialProvider } from './contexts/MaterialContext';
import { HolderProvider } from './contexts/HolderContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ConverterPage from './components/pages/ConverterPage';
import ToolManagerPage from './components/pages/ToolManagerPage';
import SettingsPage from './components/pages/SettingsPage';

export type Page = 'converter' | 'tools' | 'settings';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('converter');

  return (
    <SettingsProvider>
      <LibraryProvider>
        <MaterialProvider>
          <HolderProvider>
            <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
              <Header />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar activePage={activePage} onNavigate={setActivePage} />
                <main className="flex-1 overflow-hidden">
                  {activePage === 'converter' && <ConverterPage />}
                  {activePage === 'tools'     && <ToolManagerPage />}
                  {activePage === 'settings'  && <SettingsPage />}
                </main>
              </div>
            </div>
          </HolderProvider>
        </MaterialProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}
