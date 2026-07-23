-- Wouri 0037: transformation inputs and outputs, so mass balance can be computed
-- transformations and lineage existed, but without explicit input and output
-- quantities there was no way to check that a processing step did not create mass.
-- That check is the control that stops laundering through a sawmill: you cannot get
-- more processed timber out than the logs that went in. record_transformation
-- records the inputs and outputs, writes the lineage edges, and refuses at write if
-- the outputs exceed the inputs (the max yield is registry data). A backstop
-- auto_check catches any mass gain written around the RPC. No em-dashes.

create table if not exists transformation_inputs (
  transformation_id uuid not null references transformations(id) on delete cascade,
  lot_id uuid not null references lots(id) on delete cascade,
  quantity_kg numeric(14,3) not null check (quantity_kg > 0),
  organization_id uuid not null references organizations(id) on delete cascade,
  primary key (transformation_id, lot_id)
);
create table if not exists transformation_outputs (
  transformation_id uuid not null references transformations(id) on delete cascade,
  lot_id uuid not null references lots(id) on delete cascade,
  quantity_kg numeric(14,3) not null check (quantity_kg > 0),
  organization_id uuid not null references organizations(id) on delete cascade,
  primary key (transformation_id, lot_id)
);
create index if not exists tin_org on transformation_inputs (organization_id);
create index if not exists tout_org on transformation_outputs (organization_id);

insert into registry_config (key, value_numeric, description, source)
select 'transformation_max_yield', 1.0, 'Max ratio of output mass to input mass for a processing step (mass cannot be created)', 'Wouri physical-conservation policy'
where not exists (select 1 from registry_config rc where rc.key = 'transformation_max_yield' and rc.valid_at @> now());

-- Record a transformation with its inputs and outputs. Refuses if the outputs weigh
-- more than the inputs allow (mass cannot be created). Writes nothing on refusal.
create or replace function record_transformation(
  p_id uuid, p_org uuid, p_kind text, p_inputs jsonb, p_outputs jsonb,
  p_occurred_at timestamptz default now(), p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_in numeric; v_out numeric; v_cap numeric;
begin
  if not is_org_member(p_org) then raise exception 'not a member of this org'; end if;
  if jsonb_array_length(coalesce(p_inputs, '[]'::jsonb)) = 0 or jsonb_array_length(coalesce(p_outputs, '[]'::jsonb)) = 0 then
    raise exception 'a transformation needs at least one input and one output';
  end if;

  select coalesce(sum((e->>'quantity_kg')::numeric), 0) into v_in from jsonb_array_elements(p_inputs) e;
  select coalesce(sum((e->>'quantity_kg')::numeric), 0) into v_out from jsonb_array_elements(p_outputs) e;
  v_cap := cfg_num('transformation_max_yield', 1.0);
  if v_out > v_in * v_cap then
    raise exception 'mass balance violated: outputs % kg exceed inputs % kg (mass cannot be created)', v_out, v_in;
  end if;

  insert into transformations (id, organization_id, kind, occurred_at, notes)
    values (p_id, p_org, p_kind, coalesce(p_occurred_at, now()), p_notes)
  on conflict (id) do nothing;

  insert into transformation_inputs (transformation_id, lot_id, quantity_kg, organization_id)
    select p_id, (e->>'lot_id')::uuid, (e->>'quantity_kg')::numeric, p_org from jsonb_array_elements(p_inputs) e
  on conflict (transformation_id, lot_id) do nothing;
  insert into transformation_outputs (transformation_id, lot_id, quantity_kg, organization_id)
    select p_id, (e->>'lot_id')::uuid, (e->>'quantity_kg')::numeric, p_org from jsonb_array_elements(p_outputs) e
  on conflict (transformation_id, lot_id) do nothing;

  insert into lineage (parent_lot_id, child_lot_id, transformation_id, organization_id)
    select (i->>'lot_id')::uuid, (o->>'lot_id')::uuid, p_id, p_org
    from jsonb_array_elements(p_inputs) i, jsonb_array_elements(p_outputs) o
  on conflict (parent_lot_id, child_lot_id) do nothing;
  return p_id;
end $$;
grant execute on function record_transformation(uuid, uuid, text, jsonb, jsonb, timestamptz, text) to authenticated;

-- Backstop: flag any transformation whose recorded outputs exceed its inputs, in case
-- rows were written around the RPC.
insert into auto_checks (key, title, description, severity, query) values
  ('transformation_mass_gain', 'Transformation gained mass',
   'A processing step recorded more output mass than input mass, a laundering signal.', 'critical',
   $q$ select t.organization_id as organization_id, 'transformation'::text as entity_type, t.id as entity_id,
         'Transformation ' || t.kind || ' outputs more mass than it took in (mass gain)' as detail
       from transformations t
       where exists (select 1 from transformation_outputs o where o.transformation_id = t.id)
         and (select coalesce(sum(quantity_kg),0) from transformation_outputs o where o.transformation_id = t.id)
           > (select coalesce(sum(quantity_kg),0) from transformation_inputs i where i.transformation_id = t.id) * cfg_num('transformation_max_yield', 1.0) $q$)
on conflict (key) do nothing;

-- RLS: inputs and outputs are the owning org's data.
alter table transformation_inputs enable row level security;
revoke all on transformation_inputs from anon, authenticated;
grant select on transformation_inputs to authenticated;
create policy tin_read on transformation_inputs for select to authenticated using (is_org_member(organization_id));

alter table transformation_outputs enable row level security;
revoke all on transformation_outputs from anon, authenticated;
grant select on transformation_outputs to authenticated;
create policy tout_read on transformation_outputs for select to authenticated using (is_org_member(organization_id));
