import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getAdapter } from '../lib/db';
import type { IDbAdapter } from '../lib/db';
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

export function MachineProvider({ children }: { children: ReactNode }) {
  const [machines,  setMachines]  = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const adapterRef = useRef<IDbAdapter | null>(null);

  function requireAdapter() {
    if (!adapterRef.current) throw new Error('Database not ready — please wait a moment and try again.');
    return adapterRef.current;
  }

  useEffect(() => {
    getAdapter().then(async (adapter) => {
      adapterRef.current = adapter;
      setMachines(await adapter.machinesGetAll());
    }).catch(console.error).finally(() => setIsLoading(false));
  }, []);

  const addMachine = useCallback(async (m: Machine) => {
    const adapter = requireAdapter();
    await adapter.machinesAdd(m);
    setMachines(await adapter.machinesGetAll());
  }, []);

  const updateMachine = useCallback(async (id: string, patch: Partial<Machine>) => {
    const adapter = requireAdapter();
    await adapter.machinesUpdate(id, { ...patch, updatedAt: Date.now() });
    setMachines(await adapter.machinesGetAll());
  }, []);

  const deleteMachine = useCallback(async (id: string) => {
    const adapter = requireAdapter();
    await adapter.machinesDelete(id);
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
