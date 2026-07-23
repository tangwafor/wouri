-- Wouri 0014: the rest of the Cameroon export commodities
-- Commodity is a ROW not code (ADR-0002), so this is pure data. Adds coffee,
-- palm oil, rubber, cotton, banana as first-class commodities and capability menu
-- options. The EUDR-regulated ones (coffee, oil palm, rubber; cocoa and timber
-- already seeded) carry the eudr domain so Aza and the picker suggest the EUDR
-- rail; cotton and banana are outside EUDR. HS codes on the commodities table.
-- Ranges/scopes provisional under ADR-0030. No em-dashes.

insert into commodities (key, label_fr, label_en, hs_code) values
  ('coffee','Cafe','Coffee','0901'),
  ('palm_oil','Huile de palme','Palm oil','1511'),
  ('rubber','Caoutchouc','Rubber','4001'),
  ('cotton','Coton','Cotton','5201'),
  ('banana','Banane','Banana','0803')
on conflict (key) do nothing;

-- capability_catalog is effective-dated (GiST exclude, no plain unique key), so
-- guard with NOT EXISTS to stay idempotent instead of ON CONFLICT.
insert into capability_catalog
  (capability_key, label_fr, label_en, category, requires_capability_key, default_for_vertical, registry_scope, description_fr, description_en)
select v.* from (values
  ('commodity.coffee','Cafe','Coffee','commodity',null::text,'{coffee}'::text[],'{"domains":["eudr","docs.coffee","levies.coffee"]}'::jsonb,
    'Vous exportez du cafe, arabica ou robusta. Concerne par l''EUDR.','You export coffee, arabica or robusta. In scope for EUDR.'),
  ('commodity.palm_oil','Huile de palme','Palm oil','commodity',null,'{palm_oil}','{"domains":["eudr","docs.palm","levies.palm"]}'::jsonb,
    'Vous exportez de l''huile de palme. Concerne par l''EUDR.','You export palm oil. In scope for EUDR.'),
  ('commodity.rubber','Caoutchouc','Rubber','commodity',null,'{rubber}','{"domains":["eudr","docs.rubber","levies.rubber"]}'::jsonb,
    'Vous exportez du caoutchouc naturel. Concerne par l''EUDR.','You export natural rubber. In scope for EUDR.'),
  ('commodity.cotton','Coton','Cotton','commodity',null,'{cotton}','{"domains":["docs.cotton","levies.cotton"]}'::jsonb,
    'Vous exportez du coton. Hors EUDR.','You export cotton. Outside EUDR.'),
  ('commodity.banana','Banane','Banana','commodity',null,'{banana}','{"domains":["docs.banana","levies.banana"]}'::jsonb,
    'Vous exportez des bananes. Hors EUDR.','You export bananas. Outside EUDR.')
) as v(capability_key, label_fr, label_en, category, requires_capability_key, default_for_vertical, registry_scope, description_fr, description_en)
where not exists (select 1 from capability_catalog c where c.capability_key = v.capability_key);
