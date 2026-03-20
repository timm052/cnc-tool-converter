import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getAdapter } from '../lib/db';
import type { IDbAdapter }  from '../lib/db';
import type { WorkMaterial } from '../types/material';

interface MaterialContextValue {
  materials:     WorkMaterial[];
  isLoading:     boolean;
  addMaterial:   (m: WorkMaterial) => Promise<void>;
  addMaterials:  (ms: WorkMaterial[]) => Promise<{ added: number; skipped: number }>;
  updateMaterial:(id: string, patch: Partial<WorkMaterial>) => Promise<void>;
  deleteMaterial:(id: string) => Promise<void>;
}

const MaterialContext = createContext<MaterialContextValue | null>(null);

export function MaterialProvider({ children }: { children: ReactNode }) {
  const [materials,  setMaterials]  = useState<WorkMaterial[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const adapterRef = useRef<IDbAdapter | null>(null);

  useEffect(() => {
    getAdapter().then(async (adapter) => {
      adapterRef.current = adapter;
      setMaterials(await adapter.materialsGetAll());
    }).catch(console.error).finally(() => setIsLoading(false));
  }, []);

  const addMaterial = useCallback(async (m: WorkMaterial) => {
    const adapter = adapterRef.current!;
    await adapter.materialsAdd(m);
    setMaterials(await adapter.materialsGetAll());
  }, []);

  const addMaterials = useCallback(async (ms: WorkMaterial[]): Promise<{ added: number; skipped: number }> => {
    const adapter = adapterRef.current!;
    const existing = await adapter.materialsGetAll();
    const existingNames = new Set(existing.map((m) => m.name.toLowerCase()));
    let added = 0; let skipped = 0;
    for (const m of ms) {
      if (existingNames.has(m.name.toLowerCase())) { skipped++; }
      else { await adapter.materialsAdd(m); added++; }
    }
    setMaterials(await adapter.materialsGetAll());
    return { added, skipped };
  }, []);

  const updateMaterial = useCallback(async (id: string, patch: Partial<WorkMaterial>) => {
    const adapter = adapterRef.current!;
    await adapter.materialsUpdate(id, { ...patch, updatedAt: Date.now() });
    setMaterials(await adapter.materialsGetAll());
  }, []);

  const deleteMaterial = useCallback(async (id: string) => {
    const adapter = adapterRef.current!;
    await adapter.materialsDelete(id);
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <MaterialContext.Provider value={{ materials, isLoading, addMaterial, addMaterials, updateMaterial, deleteMaterial }}>
      {children}
    </MaterialContext.Provider>
  );
}

export function useMaterials(): MaterialContextValue {
  const ctx = useContext(MaterialContext);
  if (!ctx) throw new Error('useMaterials must be used within MaterialProvider');
  return ctx;
}
