// The offline READ path: the org's event stream, replicated into local IndexedDB.
//
// Reads become local-first. The device serves them from RxDB and the replication keeps
// that copy fresh, pulling over PostgREST (checkpointed catch-up) and Supabase Realtime
// (live). Both channels run under the USER'S JWT, so RLS is the single gate for partial
// replication, in exactly the sense ADR-0023 chose RxDB to get. There is no second copy of
// org-scoping logic anywhere in this file. The `.eq('organization_id', ...)` below narrows
// what we bother to download; it is NOT what makes it safe. RLS is.
//
// Proven by scripts/regression/realtime-isolation.mjs, which subscribes as one tenant and
// writes as another over real websockets.
//
// PULL ONLY. Writes never go through the replication engine: they go through the outbox
// and the idempotent append_event RPC (see flush.ts). The engine transports reads; the
// queue is the write path. Passing `push` here would give us two write paths with two
// different idempotency stories, and the append-only spine would start receiving UPDATEs.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RxCollection, RxJsonSchema } from 'rxdb';
import { replicateSupabase } from 'rxdb/plugins/replication-supabase';
import { getOfflineDb } from './db';

export interface SpineEvent {
  id: string;
  organization_id: string;
  actor_person_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  /** Device time: when the thing HAPPENED. Business reporting uses this. */
  occurred_at: string;
  /** Server time: when the spine received it. Also the replication checkpoint field. */
  created_at: string;
}

export const EVENTS_SCHEMA: RxJsonSchema<SpineEvent> = {
  title: 'events',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    organization_id: { type: 'string', maxLength: 36 },
    actor_person_id: { type: ['string', 'null'], maxLength: 36 },
    event_type: { type: 'string', maxLength: 120 },
    entity_type: { type: ['string', 'null'], maxLength: 120 },
    entity_id: { type: ['string', 'null'], maxLength: 36 },
    payload: { type: 'object', additionalProperties: true },
    occurred_at: { type: 'string', maxLength: 40 },
    // Must stay in the schema: the plugin strips the modified field from the document
    // unless the schema declares it, and we need it to order the feed by server time.
    created_at: { type: 'string', maxLength: 40 },
  },
  required: ['id', 'organization_id', 'event_type', 'payload', 'occurred_at', 'created_at'],
  indexes: ['occurred_at'],
};

export type EventsCollection = RxCollection<SpineEvent>;

/**
 * Start replicating one organization's events down to this device.
 *
 * Returns a cancel function. Call it when the active org changes: a device that switches
 * orgs must stop pulling the old one, or the local replica accumulates a union of every
 * org the person has ever opened, which is not a leak (RLS allowed every row) but is a
 * privacy smell and an unbounded local database.
 */
export async function startEventsReplication(supabase: SupabaseClient, organizationId: string) {
  const db = await getOfflineDb();

  const state = replicateSupabase<SpineEvent>({
    // Unique per org: the plugin uses this as the Realtime channel topic, and two
    // replications sharing a topic collide (the plugin's own source warns about this).
    replicationIdentifier: `events-${organizationId}`,
    collection: db.events,
    client: supabase,
    tableName: 'events',
    // The spine is append-only, so created_at is immutable and monotonic per row: a
    // textbook checkpoint field. There is no `_modified` column and there must not be one.
    modifiedField: 'created_at',
    live: true,
    retryTime: 5000,
    pull: {
      batchSize: 200,
      // Narrows the download to the active org. RLS is what makes it SAFE; this is what
      // makes it SMALL. Never confuse the two.
      queryBuilder: ({ query }) => query.eq('organization_id', organizationId),
    },
    // push: deliberately absent. See the header.
  });

  // A replication error must be visible, not swallowed. An offline device errors here on
  // every retry, which is normal and not worth logging; a 42501 is not.
  const errorSub = state.error$.subscribe((err) => {
    const code = (err as unknown as { parameters?: { errors?: Array<{ code?: string }> } })
      ?.parameters?.errors?.[0]?.code;
    if (code === '42501') {
      // RLS refused the pull. Either the session expired or this person lost membership.
      // Retrying cannot help; stop rather than hammer.
      void state.cancel();
    }
  });

  return async () => {
    errorSub.unsubscribe();
    await state.cancel();
  };
}
