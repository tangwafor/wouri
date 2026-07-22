// @wouri/offline: the local-first write path (lifted from Bazah, ADR-0025).
//
// Writes never touch the sync engine: emitEvent mints a client UUID, writes to a
// durable local outbox, and flushes through the idempotent append_event RPC. Reads
// are pull replication under the user JWT, so RLS stays the single isolation gate.
// The queue is the boundary; the engine only transports it. No em-dashes.
//
// NOTE for the read path: the plugin is rxdb/plugins/replication-supabase, shipped
// inside rxdb core. The npm package named rxdb-supabase is an UNRELATED third-party
// package pinned to rxdb v14. Do not install it.

export { getOfflineDb, isBrowser, _resetOfflineDb } from './db';
export { emitEvent, pendingCount, failedCount, type EmitEventInput } from './emit';
export { flushOutbox, pruneSynced, type FlushResult } from './flush';
export { newEventId, OUTBOX_SCHEMA, type QueuedEvent, type OfflineDatabase, type OutboxCollection } from './outbox';
export { watchConnection, type ConnectionState } from './connection';
export { startEventsReplication, EVENTS_SCHEMA, type SpineEvent, type EventsCollection } from './events';
export { watchFeed, type FeedItem } from './feed';
