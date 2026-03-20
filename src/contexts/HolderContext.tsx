import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getAdapter } from '../lib/db';
import type { IDbAdapter } from '../lib/db';
import type { ToolHolder } from '../types/holder';

interface HolderContextValue {
  holders:      ToolHolder[];
  isLoading:    boolean;
  addHolder:    (h: ToolHolder) => Promise<void>;
  addHolders:   (hs: ToolHolder[]) => Promise<{ added: number; skipped: number }>;
  updateHolder: (id: string, patch: Partial<ToolHolder>) => Promise<void>;
  deleteHolder: (id: string) => Promise<void>;
}

const HolderContext = createContext<HolderContextValue | null>(null);

export function HolderProvider({ children }: { children: ReactNode }) {
  const [holders,   setHolders]   = useState<ToolHolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const adapterRef = useRef<IDbAdapter | null>(null);

  function requireAdapter() {
    if (!adapterRef.current) throw new Error('Database not ready — please wait a moment and try again.');
    return adapterRef.current;
  }

  useEffect(() => {
    getAdapter().then(async (adapter) => {
      adapterRef.current = adapter;
      setHolders(await adapter.holdersGetAll());
    }).catch(console.error).finally(() => setIsLoading(false));
  }, []);

  const addHolder = useCallback(async (h: ToolHolder) => {
    const adapter = requireAdapter();
    await adapter.holdersAdd(h);
    setHolders(await adapter.holdersGetAll());
  }, []);

  const addHolders = useCallback(async (hs: ToolHolder[]): Promise<{ added: number; skipped: number }> => {
    const adapter = requireAdapter();
    const existing = new Set((await adapter.holdersGetAll()).map((h) => h.id));
    let added = 0; let skipped = 0;
    for (const h of hs) {
      if (existing.has(h.id)) { skipped++; continue; }
      await adapter.holdersAdd(h);
      added++;
    }
    setHolders(await adapter.holdersGetAll());
    return { added, skipped };
  }, []);

  const updateHolder = useCallback(async (id: string, patch: Partial<ToolHolder>) => {
    const adapter = requireAdapter();
    await adapter.holdersUpdate(id, { ...patch, updatedAt: Date.now() });
    setHolders(await adapter.holdersGetAll());
  }, []);

  const deleteHolder = useCallback(async (id: string) => {
    const adapter = requireAdapter();
    await adapter.holdersDelete(id);
    setHolders((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return (
    <HolderContext.Provider value={{ holders, isLoading, addHolder, addHolders, updateHolder, deleteHolder }}>
      {children}
    </HolderContext.Provider>
  );
}

export function useHolders(): HolderContextValue {
  const ctx = useContext(HolderContext);
  if (!ctx) throw new Error('useHolders must be used within HolderProvider');
  return ctx;
}
