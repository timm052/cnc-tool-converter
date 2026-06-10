import type { LibraryTool } from '../types/libraryTool';

/** True when a tool's stock quantity has reached its reorder point. */
export function isLowStock(t: LibraryTool): boolean {
  return t.reorderPoint != null && t.quantity != null && t.quantity <= t.reorderPoint;
}

/** True when a tool's use count has reached its regrind/replace threshold. */
export function isRegrindDue(t: LibraryTool): boolean {
  return t.useCount != null && t.regrindThreshold != null && t.useCount >= t.regrindThreshold;
}

/** Counts tools per `type`, sorted descending by count. */
export function countByType(tools: LibraryTool[]): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of tools) {
    counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
