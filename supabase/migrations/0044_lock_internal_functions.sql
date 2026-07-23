-- Wouri 0044: lock the internal SECURITY DEFINER functions from client execution
-- A SECURITY DEFINER function keeps Postgres's default PUBLIC execute grant unless
-- it is revoked, and revoking from anon/authenticated does NOT remove the PUBLIC
-- grant. So notify() (which inserts a notification for any org, with no membership
-- check because it is meant to be called only by triggers) was client-callable: a
-- signed-in user could inject notifications into another org. The trigger functions
-- were likewise exposed. None of these need a client grant; the triggers call them
-- in the table-owner context. Revoke PUBLIC on all of them. The unchecked document
-- resolvers were already locked in 0043. No em-dashes.

revoke all on function notify(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function lot_events_seal() from public, anon, authenticated;
revoke all on function trg_notify_document() from public, anon, authenticated;
revoke all on function trg_notify_discrepancy() from public, anon, authenticated;
revoke all on function trg_notify_settlement() from public, anon, authenticated;
revoke all on function trg_notify_shipment() from public, anon, authenticated;
