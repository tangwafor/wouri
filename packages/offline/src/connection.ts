// Connection state, and the auto-flush that rides on it.
//
// Law 4 (nothing hiding): the UI always shows whether we are online and how many changes
// are waiting. Never a silent spinner, never a lie.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getOfflineDb } from './db';
import { flushOutbox } from './flush';

export interface ConnectionState {
  online: boolean;
  pending: number;
  failed: number;
  /** True while a flush is in progress, so the UI can say "syncing" rather than "3 waiting". */
  syncing: boolean;
}

/**
 * Subscribe to connection + queue state, and flush automatically when we come back online.
 * Returns an unsubscribe function.
 *
 * navigator.onLine only tells us the browser has *a* network interface, not that Supabase
 * is reachable. We therefore treat "online" as permission to TRY, never as proof, and let
 * flushOutbox's error handling be the real arbiter. That is why a failed flush leaves rows
 * pending rather than marking the app offline.
 */
export function watchConnection(
  supabase: SupabaseClient,
  onChange: (s: ConnectionState) => void,
): () => void {
  let stopped = false;
  let syncing = false;
  let unsubOutbox: (() => void) | undefined;

  const state = (): ConnectionState => ({
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    pending: 0,
    failed: 0,
    syncing,
  });

  const emit = async () => {
    if (stopped) return;
    const db = await getOfflineDb();
    const [pending, failed] = await Promise.all([
      db.outbox.find({ selector: { status: 'pending' } }).exec(),
      db.outbox.find({ selector: { status: 'failed' } }).exec(),
    ]);
    if (stopped) return;
    onChange({ ...state(), pending: pending.length, failed: failed.length, syncing });
  };

  const tryFlush = async () => {
    if (stopped || syncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    syncing = true;
    await emit();
    try {
      await flushOutbox(supabase);
    } catch {
      // flushOutbox already recorded per-row errors; a throw here is a programming fault
      // or a closed DB. Do not crash the page over it.
    } finally {
      syncing = false;
      await emit();
    }
  };

  void (async () => {
    const db = await getOfflineDb();
    if (stopped) return;
    // React to any local write, so the pending badge is live without polling.
    const sub = db.outbox.$.subscribe(() => {
      void emit();
      void tryFlush();
    });
    unsubOutbox = () => sub.unsubscribe();
    await emit();
    void tryFlush();
  })();

  const onOnline = () => void tryFlush();
  const onOffline = () => void emit();

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }

  return () => {
    stopped = true;
    unsubOutbox?.();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    }
  };
}
