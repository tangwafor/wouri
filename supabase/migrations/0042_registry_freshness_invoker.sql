-- Wouri 0042: make registry_freshness a security_invoker view
-- registry_freshness reads only registry_review (platform reference, world-readable),
-- so definer vs invoker gives the same result, but a definer view is the ADR-0033
-- leak class we do not want as a habit. Setting security_invoker=true lets the
-- security-check gate enforce a clean rule: no non-invoker view in public except the
-- ones an extension owns. No em-dashes.
alter view registry_freshness set (security_invoker = true);
