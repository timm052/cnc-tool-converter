import type { ToolSet } from '../types/toolSet';

const KEY = 'cnc-tool-converter:toolSets';

export function loadSets(): ToolSet[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ToolSet[]) : [];
  } catch {
    return [];
  }
}

export function saveSets(sets: ToolSet[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sets));
  } catch { /* quota */ }
}

export function createSet(name: string, description?: string, toolIds: string[] = []): ToolSet {
  const now = Date.now();
  return { id: crypto.randomUUID(), name, description, toolIds, createdAt: now, updatedAt: now };
}

export function updateSet(sets: ToolSet[], id: string, patch: Partial<Omit<ToolSet, 'id' | 'createdAt'>>): ToolSet[] {
  return sets.map((s) => s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s);
}

export function deleteSet(sets: ToolSet[], id: string): ToolSet[] {
  return sets.filter((s) => s.id !== id);
}

export function restoreSets(incoming: ToolSet[]): void {
  const existing = loadSets();
  const existingIds = new Set(existing.map((s) => s.id));
  const merged = [...existing, ...incoming.filter((s) => !existingIds.has(s.id))];
  saveSets(merged);
}
