/**
 * useRemoteSync
 *
 * Multi-user safe push / pull for the remote library endpoint.
 *
 * Push flow:
 *   1. GET current remote state + ETag
 *   2. Merge remote into local (prefer newer updatedAt per record)
 *   3. Apply merged state to local IndexedDB via replaceLibrary()
 *   4. PUT merged payload with If-Match: <etag>
 *   5. On 412 (concurrent write) → retry up to MAX_RETRIES times
 *
 * Pull flow:
 *   1. GET remote state
 *   2. Merge remote into local (same rules)
 *   3. Apply merged state to local IndexedDB
 *
 * Username: when a remote URL is configured, the operatorName from Settings
 * is embedded in every pushed payload as `lastModifiedBy`.
 */

import { useState, useCallback, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import {
  pushLibrary, pullWithEtag, buildPayload, mergePayloads,
  loadLastSync, saveLastSync, SyncError, MAX_RETRIES,
} from '../lib/remoteSync';
import type { LastSyncMeta, SyncPayload, MergeStats, RemoteAuth } from '../lib/remoteSync';
import type { LibraryTool }  from '../types/libraryTool';
import type { WorkMaterial } from '../types/material';
import type { ToolHolder }   from '../types/holder';

export type SyncStatus = 'idle' | 'pushing' | 'pulling' | 'ok' | 'error';

export interface RemoteSyncResult {
  status:      SyncStatus;
  lastSync:    LastSyncMeta;
  errorMsg:    string;
  mergeStats:  MergeStats | null;
  push:        (onApply: OnApply) => Promise<void>;
  pull:        (onApply: OnApply) => Promise<void>;
  testConn:    () => Promise<void>;
  clearError:  () => void;
}

/** Callback used to write merged data into local IndexedDB */
export type OnApply = (
  tools:     LibraryTool[],
  materials: WorkMaterial[],
  holders:   ToolHolder[],
) => Promise<void>;

export function useRemoteSync(
  tools:     LibraryTool[],
  materials: WorkMaterial[],
  holders:   ToolHolder[],
): RemoteSyncResult {
  const { settings } = useSettings();
  const [status,     setStatus]     = useState<SyncStatus>('idle');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [lastSync,   setLastSync]   = useState<LastSyncMeta>(loadLastSync);
  const [mergeStats, setMergeStats] = useState<MergeStats | null>(null);

  const auth = useMemo<RemoteAuth>(() => ({
    type:     settings.remoteDbAuthType ?? 'bearer',
    username: settings.remoteDbUsername ?? '',
    token:    settings.remoteDbToken,
  }), [settings.remoteDbAuthType, settings.remoteDbUsername, settings.remoteDbToken]);

  function refreshMeta(patch: LastSyncMeta) {
    saveLastSync(patch);
    setLastSync((prev) => ({ ...prev, ...patch }));
  }

  // ── Push ────────────────────────────────────────────────────────────────────
  const push = useCallback(async (onApply: OnApply) => {
    setStatus('pushing');
    setErrorMsg('');
    setMergeStats(null);

    const url       = settings.remoteDbUrl;
    const operator  = settings.operatorName;
    const lastPullAt = loadLastSync().lastPullAt ?? 0;

    let attempt = 0;
    let currentTools     = tools;
    let currentMaterials = materials;
    let currentHolders   = holders;

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        // 1. Fetch remote to check for concurrent changes + get ETag
        let remotePayload: SyncPayload | null = null;
        let etag: string | null = null;
        try {
          const result = await pullWithEtag(url, auth);
          remotePayload = result.payload;
          etag          = result.etag;
        } catch (err) {
          // 404 / file not yet created — that's fine, first push
          if (!(err instanceof SyncError && err.status === 404)) throw err;
        }

        // 2. Merge if the remote has changes
        let stats: MergeStats | null = null;
        if (remotePayload) {
          const merged = mergePayloads(
            { tools: currentTools, materials: currentMaterials, holders: currentHolders },
            remotePayload,
            lastPullAt,
          );
          if (merged.stats.addedFromRemote > 0 || merged.stats.updatedFromRemote > 0) {
            // Apply the merge to local DB before pushing
            await onApply(merged.tools, merged.materials, merged.holders);
          }
          currentTools     = merged.tools;
          currentMaterials = merged.materials;
          currentHolders   = merged.holders;
          stats = merged.stats;
        }

        // 3. Build and push merged payload
        const currentSyncVer = loadLastSync().syncVersion ?? remotePayload?.syncVersion ?? 0;
        const payload = buildPayload(currentTools, currentMaterials, currentHolders, operator, currentSyncVer);
        const pushResult = await pushLibrary(url, auth, payload, etag);

        // 4. Save meta
        const now = new Date().toISOString();
        refreshMeta({
          pushedAt:    now,
          lastPullAt:  Date.now(),
          toolCount:   currentTools.length,
          etag:        pushResult.etag,
          syncVersion: payload.syncVersion,
          pushedBy:    operator || undefined,
        });
        setMergeStats(stats);
        setStatus('ok');
        return;

      } catch (err) {
        if (err instanceof SyncError && err.status === 412 && attempt < MAX_RETRIES) {
          // Concurrent write — another user pushed between our GET and PUT; retry
          continue;
        }
        setErrorMsg(err instanceof SyncError ? err.message : String(err));
        setStatus('error');
        return;
      }
    }

    setErrorMsg(`Push failed after ${MAX_RETRIES} retries (persistent concurrent write conflict).`);
    setStatus('error');
  }, [settings.remoteDbUrl, settings.operatorName, auth, tools, materials, holders]);

  // ── Pull ────────────────────────────────────────────────────────────────────
  const pull = useCallback(async (onApply: OnApply) => {
    setStatus('pulling');
    setErrorMsg('');
    setMergeStats(null);

    const lastPullAt = loadLastSync().lastPullAt ?? 0;

    try {
      const { payload, etag } = await pullWithEtag(settings.remoteDbUrl, auth);
      const merged = mergePayloads(
        { tools, materials, holders },
        payload,
        lastPullAt,
      );
      await onApply(merged.tools, merged.materials, merged.holders);

      refreshMeta({
        pulledAt:    new Date().toISOString(),
        lastPullAt:  Date.now(),
        toolCount:   merged.tools.length,
        etag,
        syncVersion: payload.syncVersion,
        pushedBy:    payload.lastModifiedBy,
      });
      setMergeStats(merged.stats);
      setStatus('ok');
    } catch (err) {
      setErrorMsg(err instanceof SyncError ? err.message : String(err));
      setStatus('error');
    }
  }, [settings.remoteDbUrl, auth, tools, materials, holders]);

  // ── Test connection ──────────────────────────────────────────────────────────
  const testConn = useCallback(async () => {
    setStatus('pushing');
    setErrorMsg('');
    try {
      await pullWithEtag(settings.remoteDbUrl, auth);
      setStatus('ok');
    } catch (err) {
      setErrorMsg(err instanceof SyncError ? err.message : String(err));
      setStatus('error');
    }
  }, [settings.remoteDbUrl, auth]);

  const clearError = useCallback(() => {
    setErrorMsg('');
    setStatus('idle');
  }, []);

  return { status, lastSync, errorMsg, mergeStats, push, pull, testConn, clearError };
}
