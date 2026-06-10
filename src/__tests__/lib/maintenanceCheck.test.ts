import { describe, it, expect } from 'vitest';
import type { Machine } from '../../types/machine';
import { getDueMachines } from '../../lib/maintenanceCheck';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeMachine(overrides: Partial<Machine> = {}): Machine {
  return {
    id:        crypto.randomUUID(),
    name:      'VF-2',
    type:      'mill',
    axes:      3,
    unit:      'mm',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('getDueMachines', () => {
  it('ignores machines without a maintenance interval', () => {
    const m = makeMachine({ createdAt: Date.now() - 1000 * DAY_MS });
    expect(getDueMachines([m])).toEqual([]);
  });

  it('flags machines overdue based on lastMaintenanceAt', () => {
    const due    = makeMachine({ maintenanceIntervalDays: 30, lastMaintenanceAt: Date.now() - 31 * DAY_MS });
    const notDue = makeMachine({ maintenanceIntervalDays: 30, lastMaintenanceAt: Date.now() - 10 * DAY_MS });
    expect(getDueMachines([due, notDue])).toEqual([due]);
  });

  it('falls back to createdAt when never serviced', () => {
    const due    = makeMachine({ maintenanceIntervalDays: 30, createdAt: Date.now() - 31 * DAY_MS });
    const notDue = makeMachine({ maintenanceIntervalDays: 30, createdAt: Date.now() - 10 * DAY_MS });
    expect(getDueMachines([due, notDue])).toEqual([due]);
  });

  it('ignores a zero or negative interval', () => {
    const m = makeMachine({ maintenanceIntervalDays: 0, createdAt: Date.now() - 1000 * DAY_MS });
    expect(getDueMachines([m])).toEqual([]);
  });

  it('flags machines within leadDays of their interval elapsing', () => {
    // 25 days since service, 30-day interval — 5 days remaining
    const m = makeMachine({ maintenanceIntervalDays: 30, lastMaintenanceAt: Date.now() - 25 * DAY_MS });
    expect(getDueMachines([m], 0)).toEqual([]);
    expect(getDueMachines([m], 5)).toEqual([m]);
    expect(getDueMachines([m], 10)).toEqual([m]);
  });

  it('does not affect machines without an interval set', () => {
    const m = makeMachine({ createdAt: Date.now() - 1000 * DAY_MS });
    expect(getDueMachines([m], 30)).toEqual([]);
  });
});
