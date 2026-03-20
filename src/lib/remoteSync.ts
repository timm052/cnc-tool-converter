/**
 * Remote database sync
 *
 * Contract: the remote endpoint must support:
 *   GET  {url}  → SyncPayload  (200, with ETag header)
 *   PUT  {url}  → any 2xx      (with ETag response)
 *                               WebDAV servers return ETag on PUT automatically.
 *
 * Authentication:
 *   bearer → Authorization: Bearer <token>
 *   basic  → Authorization: Basic base64(username:password)  (WebDAV / Nextcloud)
 *
 * Multi-user concurrency:
 *   1. Before every push, the current remote is fetched and merged.
 *   2. PUT sends If-Match: <etag> so concurrent writes return 412.
 *   3. On 412 the merge+push is retried automatically (up to MAX_RETRIES).
 */

import type { LibraryTool }  from '../types/libraryTool';
import type { WorkMaterial } from '../types/material';
import type { ToolHolder }   from '../types/holder';
import type { ToolSet }      from '../types/toolSet';
import type { Job }          from '../types/job';
import { loadSets, saveSets } from './toolSetStore';
import { loadJobs }           from './jobStore';

// ── Payload ───────────────────────────────────────────────────────────────────

export interface SyncPayload {
  version:          2;
  syncVersion:      number;   // monotonically increasing; 0 = never pushed
  exportedAt:       string;   // ISO timestamp of this push
  lastModifiedBy?:  string;   // operatorName of the pusher
  tools:            LibraryTool[];
  materials:        WorkMaterial[];
  holders:          ToolHolder[];
  /** Tool sets (localStorage) — optional for backward compat with v2 payloads */
  toolSets?:        ToolSet[];
  /** Jobs / BOMs (localStorage) — optional for backward compat with v2 payloads */
  jobs?:            Job[];
}

export function buildPayload(
  tools:          LibraryTool[],
  materials:      WorkMaterial[],
  holders:        ToolHolder[],
  modifiedBy?:    string,
  syncVersion?:   number,
): SyncPayload {
  return {
    version:         2,
    syncVersion:     (syncVersion ?? 0) + 1,
    exportedAt:      new Date().toISOString(),
    lastModifiedBy:  modifiedBy || undefined,
    tools,
    materials,
    holders,
    toolSets:        loadSets(),
    jobs:            loadJobs(),
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type RemoteAuthType = 'bearer' | 'basic';

export interface RemoteAuth {
  type:     RemoteAuthType;
  username: string;
  token:    string;
}

// ── Error type ────────────────────────────────────────────────────────────────

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHeaders(auth: RemoteAuth, extra?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (auth.type === 'basic' && (auth.username || auth.token)) {
    h['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.token}`)}`;
  } else if (auth.type === 'bearer' && auth.token.trim()) {
    h['Authorization'] = `Bearer ${auth.token.trim()}`;
  }
  return h;
}

function validateUrl(url: string): void {
  if (!url.trim()) throw new SyncError('No remote URL configured.');
  try { new URL(url); } catch { throw new SyncError('Invalid URL.'); }
}

// ── Pull (with ETag) ──────────────────────────────────────────────────────────

export interface PullResult {
  payload: SyncPayload;
  etag:    string | null;
}

/** Download the library; returns payload + ETag for optimistic locking. */
export async function pullWithEtag(url: string, auth: RemoteAuth): Promise<PullResult> {
  validateUrl(url);
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', headers: makeHeaders(auth) });
  } catch (err) {
    throw new SyncError(`Network error: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new SyncError(`Server returned ${res.status} ${res.statusText}`, res.status);
  }
  let data: unknown;
  try { data = await res.json(); } catch {
    throw new SyncError('Remote response was not valid JSON.');
  }
  if (!isValidPayload(data)) {
    throw new SyncError('Remote data format not recognised (expected version 2 sync payload).');
  }
  return { payload: data, etag: res.headers.get('ETag') };
}

/** Convenience wrapper for callers that don't need the ETag. */
export async function pullLibrary(url: string, auth: RemoteAuth): Promise<SyncPayload> {
  return (await pullWithEtag(url, auth)).payload;
}

// ── Push (with If-Match) ──────────────────────────────────────────────────────

export interface PushResult {
  etag: string | null;
}

const MAX_RETRIES = 3;

/**
 * Upload the library to the remote endpoint.
 * If `ifMatchEtag` is provided, sends If-Match so the server can reject
 * concurrent writes (HTTP 412) — supported by WebDAV and most REST stores.
 */
export async function pushLibrary(
  url:          string,
  auth:         RemoteAuth,
  payload:      SyncPayload,
  ifMatchEtag?: string | null,
): Promise<PushResult> {
  validateUrl(url);

  const extraHeaders: Record<string, string> = {};
  if (ifMatchEtag) extraHeaders['If-Match'] = ifMatchEtag;

  let res: Response;
  try {
    res = await fetch(url, {
      method:  'PUT',
      headers: makeHeaders(auth, extraHeaders),
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    throw new SyncError(`Network error: ${(err as Error).message}`);
  }

  if (!res.ok) {
    throw new SyncError(
      res.status === 412
        ? 'Concurrent write detected (412). Retrying with merge…'
        : `Server returned ${res.status} ${res.statusText}`,
      res.status,
    );
  }

  return { etag: res.headers.get('ETag') };
}

// ── Merge ─────────────────────────────────────────────────────────────────────

export interface MergeStats {
  addedFromRemote:   number;   // tools/materials/holders new on remote, pulled in
  updatedFromRemote: number;   // existing records where remote had newer updatedAt
  conflicts:         number;   // both sides modified same record after last pull
  localOnly:         number;   // records kept because they exist only locally
}

interface Timestamped { id: string; updatedAt?: number; createdAt?: number }

function timestamp<T extends Timestamped>(r: T): number {
  return r.updatedAt ?? r.createdAt ?? 0;
}

/**
 * Merge two arrays of records by id.
 * - Remote-only  → add
 * - Local-only   → keep (treat as locally added, never delete based on remote absence)
 * - Both present → prefer newer `updatedAt`; if both modified after `lastPullAt`, count as conflict
 */
function mergeById<T extends Timestamped>(
  local:       T[],
  remote:      T[],
  lastPullAt:  number,
  stats:       MergeStats,
): T[] {
  const localMap  = new Map(local.map((r) => [r.id, r]));
  const remoteMap = new Map(remote.map((r) => [r.id, r]));
  const merged: T[] = [];

  for (const [id, remoteRec] of remoteMap) {
    const localRec = localMap.get(id);
    if (!localRec) {
      merged.push(remoteRec);
      stats.addedFromRemote++;
    } else {
      const rt = timestamp(remoteRec);
      const lt = timestamp(localRec);
      if (rt > lt) {
        merged.push(remoteRec);
        stats.updatedFromRemote++;
        if (lt > lastPullAt) stats.conflicts++;    // both were modified
      } else {
        merged.push(localRec);
        if (lt > lastPullAt && rt > lastPullAt && lt !== rt) stats.conflicts++;
      }
    }
  }

  for (const [id, localRec] of localMap) {
    if (!remoteMap.has(id)) {
      merged.push(localRec);
      stats.localOnly++;
    }
  }

  return merged;
}

export function mergePayloads(
  local:      { tools: LibraryTool[]; materials: WorkMaterial[]; holders: ToolHolder[] },
  remote:     SyncPayload,
  lastPullAt: number,
): { tools: LibraryTool[]; materials: WorkMaterial[]; holders: ToolHolder[]; toolSets: ToolSet[]; jobs: Job[]; stats: MergeStats } {
  const stats: MergeStats = { addedFromRemote: 0, updatedFromRemote: 0, conflicts: 0, localOnly: 0 };
  const localSets  = loadSets();
  const localJobs  = loadJobs() as (Job & Timestamped)[];
  return {
    tools:     mergeById(local.tools,     remote.tools,     lastPullAt, stats),
    materials: mergeById(local.materials, remote.materials, lastPullAt, stats),
    holders:   mergeById(local.holders,   remote.holders,   lastPullAt, stats),
    toolSets:  mergeById(localSets as (ToolSet & Timestamped)[], (remote.toolSets ?? []) as (ToolSet & Timestamped)[], lastPullAt, stats),
    jobs:      mergeById(localJobs,       (remote.jobs ?? []) as (Job & Timestamped)[],    lastPullAt, stats),
    stats,
  };
}

/** Persist the localStorage-stored parts of a merge result. */
export function applyLocalStorageMerge(toolSets: ToolSet[], jobs: Job[]): void {
  saveSets(toolSets);
  try { localStorage.setItem('cnc-tool-jobs', JSON.stringify(jobs)); } catch { /* quota */ }
}

// ── Type guard ────────────────────────────────────────────────────────────────

function isValidPayload(v: unknown): v is SyncPayload {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    p['version'] === 2 &&
    Array.isArray(p['tools']) &&
    Array.isArray(p['materials']) &&
    Array.isArray(p['holders'])
  );
}

// ── localStorage: last-sync metadata ─────────────────────────────────────────

const LS_SYNC_KEY = 'cnc-tool-converter:lastSync';

export interface LastSyncMeta {
  pushedAt?:    string;
  pulledAt?:    string;
  lastPullAt?:  number;   // epoch ms — used as merge baseline
  toolCount?:   number;
  etag?:        string | null;
  syncVersion?: number;
  pushedBy?:    string;
}

export function loadLastSync(): LastSyncMeta {
  try {
    const raw = localStorage.getItem(LS_SYNC_KEY);
    return raw ? (JSON.parse(raw) as LastSyncMeta) : {};
  } catch { return {}; }
}

export function saveLastSync(meta: LastSyncMeta): void {
  try {
    const current = loadLastSync();
    localStorage.setItem(LS_SYNC_KEY, JSON.stringify({ ...current, ...meta }));
  } catch { /* quota */ }
}

export { MAX_RETRIES };
