# Platform: offline architecture

Traces to ADR-0003, ADR-0004, ADR-0026, lifted from Bazah (ADR-0025). No em-dashes.

## Doctrine
- **Writes never touch the sync engine.** `emitEvent()` mints a client-side UUID, writes to a durable local queue, and flushes through an idempotent `append_event` RPC. Replay collapses on the primary key; exactly-once comes free.
- **Reads are pull-only replication under the user JWT**, so RLS is the single isolation gate. No second copy of tenant-scoping logic. The sync cursor is a monotonic server sequence that RLS lets through, and it is tombstone-aware so a row that becomes invisible is removed on the device.
- **occurred_at is separate from created_at.** A felling recorded at 09:00 in a concession and synced at 17:00 has both facts. Business and compliance reporting use occurred_at; sync diagnostics use created_at.
- **Media syncs on a separate queue** from rows: compressed at capture, deferred, resumable, wifi-only option. A stump photo never blocks a felling record. The original is hashed before any processing (ADR-0021).

## Why native, not PWA
iOS Safari evicts IndexedDB after roughly seven days without use and has no background sync. The requirement is fourteen consecutive days of field operation without sync, plus Bluetooth peripherals, sustained camera, and large local media queues. Expo gives both stores from one codebase, real filesystem access, real background tasks, and a genuine fourteen-day offline guarantee (ADR-0026).

## The hash chain across offline
The chain is per lot or device stream, not global (offline devices cannot agree on one predecessor). The client chain proves the device's own order; the server counter-signs at ingest and periodically publishes a signed Merkle checkpoint for third-party verifiability (ADR-0004). Clock delta is recorded provenance, never a trust root.

## Non-negotiable
Never lose an offline write. The record button is never disabled by connectivity. Sync state is always visible and always honest: a count of pending items and the age of the oldest, never a spinner implying progress it cannot see.
