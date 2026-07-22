// The durable offline write queue (Law 17, ADR-0021, ADR-0023).
//
// Every offline-critical write in Bazah is an event, and every event goes here first.
// Nothing calls supabase-js directly on a write path. The rules that make this safe:
//
//   1. The client mints the event id (uuid v4) at emit time, not the server. That id is
//      the idempotency key. append_event() does `on conflict (id) do nothing`, so a
//      flush that dies halfway and retries has exactly-once effect. See migration 0003.
//
//   2. occurred_at is stamped from the DEVICE clock at emit time and sent explicitly.
//      created_at stays server-assigned. A sale recorded at 09:00 offline and synced at
//      17:00 has both facts. Business reporting reads occurred_at; sync diagnostics read
//      created_at. Collapsing them would move a whole day's takings to the moment the
//      trader walked back into signal.
//
//   3. Rows are never deleted on failure and never mutated in place except to record an
//      attempt. "Never lose an offline write" (Law 17) means the queue is append-and-ack,
//      not a scratchpad.
//
// RxDB gives us the durable IndexedDB store, reactive counts for the pending-sync UI, and
// (later) the replication plugin for the read path. It does not own the write path: the
// spine does.

import type { RxCollection, RxDatabase, RxJsonSchema } from 'rxdb';

/** A write, minted on the device, waiting to reach the spine. */
export interface QueuedEvent {
  /** uuid v4, minted on the device. The idempotency key. Primary key. */
  id: string;
  organization_id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  /** Device time, ISO 8601. When the thing HAPPENED. */
  occurred_at: string;
  /** Lifecycle. `synced` rows are kept briefly so the UI can show "3 changes synced". */
  status: 'pending' | 'synced' | 'failed';
  /** How many flush attempts have been made. Drives backoff and surfaces stuck writes. */
  attempts: number;
  /** Last error, in plain text, for the "nothing hiding" status panel. */
  last_error: string | null;
}

export const OUTBOX_SCHEMA: RxJsonSchema<QueuedEvent> = {
  title: 'outbox',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    // RxDB requires a maxLength on the primary key so it can build its index.
    id: { type: 'string', maxLength: 36 },
    organization_id: { type: 'string', maxLength: 36 },
    event_type: { type: 'string', maxLength: 120 },
    entity_type: { type: ['string', 'null'], maxLength: 120 },
    entity_id: { type: ['string', 'null'], maxLength: 36 },
    payload: { type: 'object', additionalProperties: true },
    occurred_at: { type: 'string', maxLength: 40 },
    status: { type: 'string', maxLength: 10, enum: ['pending', 'synced', 'failed'] },
    attempts: { type: 'integer', minimum: 0, maximum: 1_000_000, multipleOf: 1 },
    last_error: { type: ['string', 'null'] },
  },
  required: ['id', 'organization_id', 'event_type', 'payload', 'occurred_at', 'status', 'attempts'],
  // Index by status so "how many are pending?" never scans the whole outbox.
  indexes: ['status'],
};

export type OutboxCollection = RxCollection<QueuedEvent>;
export type OfflineDatabase = RxDatabase<{
  outbox: OutboxCollection;
  events: import('./events').EventsCollection;
  products: import('./products').ProductsCollection;
  variants: import('./variants').VariantsCollection;
  variant_attributes: import('./variants').VariantAttributesCollection;
  price_rules: import('./price-rules').PriceRulesCollection;
}>;

/**
 * Mint a uuid v4. Uses crypto.randomUUID where available (all target browsers and Node
 * 19+), falling back to getRandomValues. Never Math.random: two devices that both fell
 * back to a weak generator could mint the same id, and the id IS the idempotency key, so
 * a collision would silently discard one business's write as a duplicate of another's.
 */
export function newEventId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    // Non-null assertions are safe: a Uint8Array(16) always has indices 6 and 8.
    b[6] = (b[6]! & 0x0f) | 0x40; // version 4
    b[8] = (b[8]! & 0x3f) | 0x80; // variant 10
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  throw new Error('No cryptographic random source; refusing to mint a weak event id.');
}
