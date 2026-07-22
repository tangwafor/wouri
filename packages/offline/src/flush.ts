// flushOutbox(): replay the durable queue into the event spine, exactly once.
//
// This is the function where "never lose an offline write" is either true or a slogan.
// The three cases that matter, and what each must do:
//
//   A. Send succeeds, ack arrives.       -> mark synced. Easy.
//   B. Send fails before reaching PG.    -> stay pending, retry later. Easy.
//   C. Send REACHES PG and commits, then the network dies before the ack.
//
// Case C is the one that eats data in naive implementations. We cannot distinguish it
// from case B: both look like a rejected fetch. So the queue keeps the row `pending` and
// retries. The retry sends the SAME client-minted id, and append_event() does
// `on conflict (id) do nothing`, so the second attempt is a no-op that returns success.
// Exactly-once is not achieved by being careful about acks. It is achieved by making the
// write idempotent and then being deliberately careless about acks.
//
// Corollary: never mint a new id on retry, and never delete a pending row "to be safe".

import type { SupabaseClient } from '@supabase/supabase-js';
import { getOfflineDb } from './db';
import type { QueuedEvent } from './outbox';

export interface FlushResult {
  attempted: number;
  synced: number;
  /** Still pending: a transient failure. Will be retried on the next flush. */
  retryable: number;
  /** Moved to `failed`: retrying cannot help. Must be surfaced to a human. */
  failed: number;
  skipped: boolean;
}

/**
 * Postgres error codes that mean "retrying will never work".
 * 42501 insufficient_privilege  - RLS refused. Wrong org, wrong person, or signed out.
 * 23514 check_violation         - e.g. events_occurred_at_sane, events_people_payload_no_pii.
 * 23503 foreign_key_violation   - the org was deleted while we were offline.
 * 22023 invalid_parameter_value - our own raise, e.g. a null id.
 * Anything else (network, 5xx, timeout, 429) is treated as transient and stays pending.
 */
const TERMINAL_CODES = new Set(['42501', '23514', '23503', '22023']);

let inFlight: Promise<FlushResult> | null = null;

/**
 * Replay every pending event, oldest first. Concurrency-safe: a second concurrent call
 * returns the first call's promise rather than double-sending. (Two tabs are a different
 * problem and are handled by idempotency, not by this mutex.)
 */
export async function flushOutbox(supabase: SupabaseClient): Promise<FlushResult> {
  if (inFlight) return inFlight;
  inFlight = doFlush(supabase).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doFlush(supabase: SupabaseClient): Promise<FlushResult> {
  const result: FlushResult = { attempted: 0, synced: 0, retryable: 0, failed: 0, skipped: false };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    // Cheap early exit. navigator.onLine is a liar in one direction only: it can say
    // "online" when there is no route. It rarely says "offline" when there is one.
    result.skipped = true;
    return result;
  }

  const db = await getOfflineDb();
  const pending = await db.outbox.find({ selector: { status: 'pending' } }).exec();

  // Oldest first. The spine is append-only and events are independent, but a business
  // reading its own activity feed mid-sync should see it fill in chronologically.
  pending.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  for (const doc of pending) {
    result.attempted += 1;
    const ev = doc.toJSON() as QueuedEvent;

    const { error } = await supabase.rpc('append_event', {
      p_id: ev.id, // same id on every retry. This is the whole design.
      p_organization_id: ev.organization_id,
      p_event_type: ev.event_type,
      p_entity_type: ev.entity_type,
      p_entity_id: ev.entity_id,
      p_payload: ev.payload,
      p_occurred_at: ev.occurred_at,
    });

    if (!error) {
      await doc.patch({ status: 'synced', last_error: null });
      result.synced += 1;
      continue;
    }

    const terminal = TERMINAL_CODES.has(error.code ?? '');
    await doc.patch({
      status: terminal ? 'failed' : 'pending',
      attempts: ev.attempts + 1,
      last_error: `${error.code ?? 'unknown'}: ${error.message}`,
    });

    if (terminal) {
      result.failed += 1;
    } else {
      result.retryable += 1;
      // A transient failure means the network or server is unhappy. Stop hammering it;
      // the remaining rows keep their place in the queue and go on the next flush.
      break;
    }
  }

  return result;
}

/**
 * Drop acknowledged rows. Kept out of flushOutbox on purpose: a synced row is the only
 * local proof that the write landed, so the UI gets to show it ("3 changes synced")
 * before we forget it. Call on a timer or on app start, never inside the flush loop.
 */
export async function pruneSynced(olderThanMs = 5 * 60_000): Promise<number> {
  const db = await getOfflineDb();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const docs = await db.outbox.find({ selector: { status: 'synced' } }).exec();
  const stale = docs.filter((d) => d.occurred_at < cutoff);
  await Promise.all(stale.map((d) => d.remove()));
  return stale.length;
}
