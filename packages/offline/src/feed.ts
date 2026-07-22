// The local-first activity feed: what the business sees, online or off.
//
// Two local sources, one list:
//
//   events   rows replicated DOWN from the spine (things the server knows about)
//   outbox   rows queued UP and not yet acknowledged (things only this device knows)
//
// A write that was made offline appears from the outbox immediately. Once it syncs, the
// SAME row arrives back through replication. For a moment it is in both collections, and
// naively concatenating them would show the owner their sale twice, then silently collapse
// it to one when the outbox row is pruned. A flicker like that in a sales ledger destroys
// trust faster than an outage does.
//
// It cannot happen here, and not because we are careful: the outbox id IS the event id
// (the client mints it, append_event dedupes on it). Deduplication is therefore a Map keyed
// by id, and the replicated copy wins because it is the one the server has confirmed.
//
// This is the second dividend of client-minted ids. The first was exactly-once sync.

import { getOfflineDb } from './db';
import type { SpineEvent } from './events';
import type { QueuedEvent } from './outbox';

export interface FeedItem {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  /** 'synced' rows are confirmed by the server. 'pending' rows exist only on this device. */
  status: 'synced' | 'pending' | 'failed';
}

/**
 * Spine events that are real audit records but not human activity.
 *
 * The event log is a ledger of everything; the activity feed is what a non-technical owner
 * should see on their home screen (Law: tenants are non-savvy). Showing them
 * `role_assignments.created` is not transparency, it is noise wearing transparency's coat.
 * Nothing is hidden: these rows still exist, still replicate, and belong in an audit view.
 */
const INTERNAL_EVENT_TYPES = new Set(['people.created', 'role_assignments.created']);

function fromEvent(e: SpineEvent): FeedItem {
  return {
    id: e.id,
    event_type: e.event_type,
    payload: e.payload ?? {},
    occurred_at: e.occurred_at,
    status: 'synced',
  };
}

function fromQueued(q: QueuedEvent): FeedItem {
  return {
    id: q.id,
    event_type: q.event_type,
    payload: q.payload ?? {},
    occurred_at: q.occurred_at,
    status: q.status === 'failed' ? 'failed' : 'pending',
  };
}

/**
 * Subscribe to the merged feed for one organization. Returns an unsubscribe function.
 *
 * Ordered by occurred_at (device time), newest first. NOT by created_at: a sale recorded
 * at 09:00 offline and synced at 17:00 belongs at 09:00 in the owner's ledger, not at the
 * moment they walked back into signal. See migration 0003.
 */
export async function watchFeed(
  organizationId: string,
  onChange: (items: FeedItem[]) => void,
  limit = 50,
): Promise<() => void> {
  const db = await getOfflineDb();

  const eventsQuery = db.events.find({
    selector: { organization_id: organizationId },
  });
  const outboxQuery = db.outbox.find({
    selector: { organization_id: organizationId, status: { $in: ['pending', 'failed'] } },
  });

  let latestEvents: SpineEvent[] = [];
  let latestQueued: QueuedEvent[] = [];

  const emit = () => {
    const byId = new Map<string, FeedItem>();
    // Queued first, then replicated. Same id => the server-confirmed copy overwrites the
    // local one, so a row in flight is never counted twice and never flickers.
    for (const q of latestQueued) byId.set(q.id, fromQueued(q));
    for (const e of latestEvents) byId.set(e.id, fromEvent(e));

    const items = [...byId.values()]
      .filter((i) => !INTERNAL_EVENT_TYPES.has(i.event_type))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, limit);
    onChange(items);
  };

  const subEvents = eventsQuery.$.subscribe((docs) => {
    latestEvents = docs.map((d) => d.toJSON() as SpineEvent);
    emit();
  });
  const subOutbox = outboxQuery.$.subscribe((docs) => {
    latestQueued = docs.map((d) => d.toJSON() as QueuedEvent);
    emit();
  });

  return () => {
    subEvents.unsubscribe();
    subOutbox.unsubscribe();
  };
}
