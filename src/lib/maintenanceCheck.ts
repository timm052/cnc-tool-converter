import type { Machine } from '../types/machine';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns machines whose maintenance interval has elapsed since the last
 * logged maintenance (or since creation, if never serviced).
 *
 * @param leadDays Flag machines as due this many days before the interval
 *                 actually elapses (early warning).
 */
export function getDueMachines(machines: Machine[], leadDays = 0): Machine[] {
  const now = Date.now();
  return machines.filter((m) => {
    if (!m.maintenanceIntervalDays || m.maintenanceIntervalDays <= 0) return false;
    const last = m.lastMaintenanceAt ?? m.createdAt;
    return now - last >= (m.maintenanceIntervalDays - leadDays) * DAY_MS;
  });
}
