/**
 * Adapter factory
 *
 * Returns a DexieAdapter in the browser / PWA build and a TauriAdapter when
 * running inside the Tauri desktop shell.  The Tauri check uses
 * `window.__TAURI_INTERNALS__` which is injected by the Tauri runtime before
 * any JS executes.
 *
 * The singleton is created once and reused for the lifetime of the page.
 */

import type { IDbAdapter } from './adapter';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

let _adapter: IDbAdapter | null = null;

export async function getAdapter(): Promise<IDbAdapter> {
  if (_adapter) return _adapter;

  if (isTauri()) {
    const { TauriAdapter } = await import('./tauri-adapter');
    _adapter = new TauriAdapter();
  } else {
    const { DexieAdapter } = await import('./dexie-adapter');
    _adapter = new DexieAdapter();
  }

  return _adapter;
}

/**
 * Synchronous variant — safe to call only after the first `await getAdapter()`
 * has resolved.  Used in contexts where the adapter is guaranteed to be
 * initialised (e.g. inside event handlers after the initial load).
 */
export function getAdapterSync(): IDbAdapter {
  if (!_adapter) {
    throw new Error('getAdapterSync called before adapter is initialised');
  }
  return _adapter;
}

export type { IDbAdapter } from './adapter';
