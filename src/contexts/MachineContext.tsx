import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db } from '../db/library';
import type { Machine } from '../types/machine';

interface MachineContextValue {
  machines:         Machine[];
  isLoading:        boolean;
  addMachine:       (m: Machine) => Promise<void>;
  updateMachine:    (id: string, patch: Partial<Machine>) => Promise<void>;
  deleteMachine:    (id: string) => Promise<void>;
  getMachineByName: (name: string) => Machine | undefined;
}

const MachineContext = createContext<MachineContextValue | null>(null);

async function loadAll(): Promise<Machine[]> {
  return db.machines.orderBy('createdAt').toArray();
}

export function MachineProvider({ children }: { children: ReactNode }) {
  const [machines,  setMachines]  = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAll()
      .then(setMachines)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const addMachine = useCallback(async (m: Machine) => {
    await db.machines.add(m);
    setMachines(await loadAll());
  }, []);

  const updateMachine = useCallback(async (id: string, patch: Partial<Machine>) => {
    await db.machines.update(id, { ...patch, updatedAt: Date.now() });
    setMachines(await loadAll());
  }, []);

  const deleteMachine = useCallback(async (id: string) => {
    await db.machines.delete(id);
    setMachines((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const getMachineByName = useCallback(
    (name: string) => machines.find((m) => m.name === name),
    [machines],
  );

  return (
    <MachineContext.Provider value={{ machines, isLoading, addMachine, updateMachine, deleteMachine, getMachineByName }}>
      {children}
    </MachineContext.Provider>
  );
}

export function useMachines(): MachineContextValue {
  const ctx = useContext(MachineContext);
  if (!ctx) throw new Error('useMachines must be used within MachineProvider');
  return ctx;
}
