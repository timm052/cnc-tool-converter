import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db } from '../db/library';
import type { ToolHolder } from '../types/holder';

interface HolderContextValue {
  holders:      ToolHolder[];
  isLoading:    boolean;
  addHolder:    (h: ToolHolder) => Promise<void>;
  updateHolder: (id: string, patch: Partial<ToolHolder>) => Promise<void>;
  deleteHolder: (id: string) => Promise<void>;
}

const HolderContext = createContext<HolderContextValue | null>(null);

async function loadAll(): Promise<ToolHolder[]> {
  return db.holders.orderBy('createdAt').toArray();
}

export function HolderProvider({ children }: { children: ReactNode }) {
  const [holders,   setHolders]   = useState<ToolHolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAll()
      .then(setHolders)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const addHolder = useCallback(async (h: ToolHolder) => {
    await db.holders.add(h);
    setHolders(await loadAll());
  }, []);

  const updateHolder = useCallback(async (id: string, patch: Partial<ToolHolder>) => {
    await db.holders.update(id, { ...patch, updatedAt: Date.now() });
    setHolders(await loadAll());
  }, []);

  const deleteHolder = useCallback(async (id: string) => {
    await db.holders.delete(id);
    setHolders((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return (
    <HolderContext.Provider value={{ holders, isLoading, addHolder, updateHolder, deleteHolder }}>
      {children}
    </HolderContext.Provider>
  );
}

export function useHolders(): HolderContextValue {
  const ctx = useContext(HolderContext);
  if (!ctx) throw new Error('useHolders must be used within HolderProvider');
  return ctx;
}
