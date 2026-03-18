import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db } from '../db/library';
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

async function loadAll(): Promise<WorkMaterial[]> {
  return db.materials.orderBy('createdAt').toArray();
}

export function MaterialProvider({ children }: { children: ReactNode }) {
  const [materials,  setMaterials]  = useState<WorkMaterial[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);

  useEffect(() => {
    loadAll()
      .then(setMaterials)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const addMaterial = useCallback(async (m: WorkMaterial) => {
    await db.materials.add(m);
    setMaterials(await loadAll());
  }, []);

  const addMaterials = useCallback(async (ms: WorkMaterial[]): Promise<{ added: number; skipped: number }> => {
    const existingNames = new Set((await loadAll()).map((m) => m.name.toLowerCase()));
    let added = 0;
    let skipped = 0;
    await db.transaction('rw', db.materials, async () => {
      for (const m of ms) {
        if (existingNames.has(m.name.toLowerCase())) { skipped++; }
        else { await db.materials.add(m); added++; }
      }
    });
    setMaterials(await loadAll());
    return { added, skipped };
  }, []);

  const updateMaterial = useCallback(async (id: string, patch: Partial<WorkMaterial>) => {
    await db.materials.update(id, { ...patch, updatedAt: Date.now() });
    setMaterials(await loadAll());
  }, []);

  const deleteMaterial = useCallback(async (id: string) => {
    await db.materials.delete(id);
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
