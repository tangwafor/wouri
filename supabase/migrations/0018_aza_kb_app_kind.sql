-- Wouri 0018: let the Aza KB hold app knowledge too
-- The KB should describe the whole product, not just commodities and regulations,
-- so an operator can curate how Aza explains every feature. Add the 'app' kind.
-- No em-dashes.

alter table aza_kb drop constraint if exists aza_kb_kind_check;
alter table aza_kb add constraint aza_kb_kind_check
  check (kind in ('commodity','rail','regulation','capability','app'));
