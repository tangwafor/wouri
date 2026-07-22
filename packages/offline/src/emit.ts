// emitEvent(): the single write door for offline-critical paths.
//
// Capabilities never call supabase-js to write. They call this. It appends to the durable
// local queue and returns immediately, so the UI can update optimistically whether or not
// there is a network. flushOutbox() does the rest, whenever the network allows.

import { getOfflineDb } from './db';
import { newEventId, type QueuedEvent } from './outbox';

export interface EmitEventInput {
  organizationId: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  /** Override device time. Only tests should pass this. */
  occurredAt?: Date;
}

/**
 * Queue an event locally. Never throws on "offline"; being offline is the normal case.
 * Returns the client-minted event id, which is also the idempotency key the server will
 * dedupe on. Callers may store it to correlate optimistic UI with the eventual row.
 */
export async function emitEvent(input: EmitEventInput): Promise<string> {
  if (!input.organizationId) {
    // An event with no org can never satisfy the RLS insert policy (migration 0003), so
    // it would queue locally and then fail forever on every flush. Refuse it at the door.
    throw new Error('emitEvent requires an organizationId.');
  }
  if (!input.eventType) throw new Error('emitEvent requires an eventType.');

  const db = await getOfflineDb();
  const id = newEventId();

  const doc: QueuedEvent = {
    id,
    organization_id: input.organizationId,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    payload: input.payload ?? {},
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
    status: 'pending',
    attempts: 0,
    last_error: null,
  };

  await db.outbox.insert(doc);
  return id;
}

/** How many writes are waiting to reach the server. Drives the pending-sync indicator. */
export async function pendingCount(): Promise<number> {
  const db = await getOfflineDb();
  const docs = await db.outbox.find({ selector: { status: 'pending' } }).exec();
  return docs.length;
}

/** Writes that failed hard and will not be retried automatically. Must be surfaced. */
export async function failedCount(): Promise<number> {
  const db = await getOfflineDb();
  const docs = await db.outbox.find({ selector: { status: 'failed' } }).exec();
  return docs.length;
}
