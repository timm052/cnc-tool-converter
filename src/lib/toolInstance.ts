import type { LibraryTool, ToolInstance } from '../types/libraryTool';

// ── Letter generation ─────────────────────────────────────────────────────────

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Returns the instance letter for a zero-based index: 0→A, 25→Z, 26→AA, 27→AB … */
export function instanceLetter(index: number): string {
  if (index < 26) return ALPHA[index];
  return ALPHA[Math.floor(index / 26) - 1] + ALPHA[index % 26];
}

// ── Sync ──────────────────────────────────────────────────────────────────────

/**
 * Sync the instances array to the given quantity.
 * - Adds new instances (next letter, not active by default)
 * - Removes trailing instances when qty decreases
 * - Ensures exactly one instance is marked active
 * - Never exceeds `maxInstances` (default 10)
 * Does NOT mutate the input array.
 */
export function syncInstancesToQuantity(
  instances: ToolInstance[],
  qty: number,
  maxInstances = 10,
): ToolInstance[] {
  const count = Math.min(Math.max(0, Math.round(qty)), Math.max(1, maxInstances));
  const result: ToolInstance[] = instances.slice(0, count);

  // Add new instances for any missing slots
  while (result.length < count) {
    result.push({
      letter:   instanceLetter(result.length),
      isActive: result.length === 0 && instances.length === 0,
    });
  }

  // Re-letter all (handles cases where letters drifted out of sync)
  for (let i = 0; i < result.length; i++) {
    result[i] = { ...result[i], letter: instanceLetter(i) };
  }

  // Ensure exactly one active
  const activeCount = result.filter((i) => i.isActive).length;
  if (activeCount === 0 && result.length > 0) {
    result[0] = { ...result[0], isActive: true };
  } else if (activeCount > 1) {
    let first = true;
    for (let i = 0; i < result.length; i++) {
      if (result[i].isActive) {
        if (!first) result[i] = { ...result[i], isActive: false };
        first = false;
      }
    }
  }

  return result;
}

/** Set a single instance as active and all others inactive. */
export function setActiveInstance(instances: ToolInstance[], letter: string): ToolInstance[] {
  return instances.map((inst) => ({ ...inst, isActive: inst.letter === letter }));
}

// ── Getters ───────────────────────────────────────────────────────────────────

/** Returns the active instance, or undefined if there are none. */
export function getActiveInstance(tool: LibraryTool): ToolInstance | undefined {
  return tool.instances?.find((i) => i.isActive);
}

// ── Export resolution ─────────────────────────────────────────────────────────

/**
 * Return a tool with active-instance data overlaid, ready for export or print.
 * - Active instance's offsets override the tool-level offsets.
 * - If `useActualDiameter` is true and the active instance has `actualDiameter`,
 *   it replaces `geometry.diameter`.
 * Does NOT mutate the original tool.
 */
export function resolveToolForExport(
  tool: LibraryTool,
  useActualDiameter: boolean,
): LibraryTool {
  const active = getActiveInstance(tool);
  if (!active) return tool;

  let resolved = tool;

  // Overlay per-instance offsets
  if (active.offsets && Object.keys(active.offsets).length > 0) {
    resolved = { ...resolved, offsets: { ...(tool.offsets ?? {}), ...active.offsets } };
  }

  // Overlay actual diameter
  if (useActualDiameter && active.actualDiameter != null) {
    resolved = { ...resolved, geometry: { ...tool.geometry, diameter: active.actualDiameter } };
  }

  return resolved;
}
