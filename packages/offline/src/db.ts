// Local-first database. Browser only: IndexedDB via RxDB's Dexie storage.
//
// Deliberately lazy and memoized. Next.js renders these modules on the server too, where
// IndexedDB does not exist, so nothing may touch storage at import time. Call
// getOfflineDb() from a client component / effect, never from a server component.

import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { OUTBOX_SCHEMA, type OfflineDatabase, type OutboxCollection } from './outbox';
import { EVENTS_SCHEMA, type EventsCollection } from './events';
import { PRODUCTS_MIGRATIONS, PRODUCTS_SCHEMA, type ProductsCollection } from './products';
import {
  VARIANTS_SCHEMA,
  VARIANT_ATTRIBUTES_SCHEMA,
  type VariantsCollection,
  type VariantAttributesCollection,
} from './variants';
import { PRICE_RULES_SCHEMA, type PriceRulesCollection } from './price-rules';

let dbPromise: Promise<OfflineDatabase> | null = null;
let devModeAdded = false;
let migrationAdded = false;

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

/**
 * Open (or reuse) the local database. Memoized: RxDB throws DB6 if the same database name
 * is created twice in one process, and React strict mode will absolutely try.
 */
export async function getOfflineDb(): Promise<OfflineDatabase> {
  if (!isBrowser()) {
    throw new Error('getOfflineDb() is browser-only. Do not call it from a server component.');
  }
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    // UNCONDITIONAL, and it must stay that way. Without this plugin RxDB throws when a collection
    // is opened whose stored schema version is behind the code's, and the ONLY devices behind are
    // the ones that already have a catalog: real tills, in real pockets, in production.
    //
    // Registering it next to dev-mode and inheriting that `NODE_ENV !== 'production'` guard would
    // mean the migration works on every machine we test on and on no machine a customer owns.
    if (!migrationAdded) {
      addRxPlugin(RxDBMigrationSchemaPlugin);
      migrationAdded = true;
    }

    // Dev-mode adds schema validation and helpful errors. It is heavy, so it never ships
    // to production, and it may only be added once per process.
    if (process.env.NODE_ENV !== 'production' && !devModeAdded) {
      addRxPlugin(RxDBDevModePlugin);
      devModeAdded = true;
    }

    // Parameterize the database with its collection map so `db.outbox` is typed all the
    // way through, rather than casting an untyped RxDatabase at the end.
    const db = await createRxDatabase<{
      outbox: OutboxCollection;
      events: EventsCollection;
      products: ProductsCollection;
      variants: VariantsCollection;
      variant_attributes: VariantAttributesCollection;
      price_rules: PriceRulesCollection;
    }>({
      name: 'bazah',
      storage: getRxStorageDexie(),
      // We are the only writer per tab; multi-tab coordination costs a BroadcastChannel
      // and we do not need cross-tab leader election yet.
      multiInstance: true,
      // Never silently wipe a user's unsynced writes because a schema version moved.
      ignoreDuplicate: false,
      eventReduce: true,
    });

    await db.addCollections({
      outbox: { schema: OUTBOX_SCHEMA }, // local write queue, never replicated
      events: { schema: EVENTS_SCHEMA },     // replicated read model (pull-only)
      // migrationStrategies carry a device across a schema bump. Without them RxDB refuses to open
      // a database whose stored schema version is older than the code's, and the till will not start.
      products: { schema: PRODUCTS_SCHEMA, migrationStrategies: PRODUCTS_MIGRATIONS },
      // The till may not sell a variant-bearing product without naming a variant, and a rejected
      // event is a terminal outbox failure: cash in the drawer, nothing in the books. So the
      // device holds the sizes BEFORE it can sell one. (ADR-0047, replicated pull-only.)
      variants: { schema: VARIANTS_SCHEMA },
      variant_attributes: { schema: VARIANT_ATTRIBUTES_SCHEMA },
      // A dead zone during happy hour must still charge the happy-hour price (ADR-0049).
      price_rules: { schema: PRICE_RULES_SCHEMA },
    });
    return db;
  })();

  try {
    return await dbPromise;
  } catch (e) {
    dbPromise = null; // let a later call retry rather than caching the failure forever
    throw e;
  }
}

/** Test hook. Closes and forgets the database so a fresh one can be opened. */
export async function _resetOfflineDb(): Promise<void> {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    await db.close();
  } catch {
    // already closed or never opened; nothing to do
  }
  dbPromise = null;
}
