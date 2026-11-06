create table public.product_issue_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  flag_kind text not null check (flag_kind in ('damage', 'issue', 'custom')),
  custom_flag text check (custom_flag is null or char_length(custom_flag) between 2 and 80),
  description text not null check (char_length(description) between 5 and 500),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'released')),
  reported_by uuid references public.profiles (id) on delete set null,
  reported_at timestamptz not null default now(),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) between 2 and 500),
  constraint product_issue_custom_flag check (
    (flag_kind = 'custom' and custom_flag is not null)
    or (flag_kind <> 'custom' and custom_flag is null)
  )
);

create table public.product_issue_allocations (
  issue_id uuid not null references public.product_issue_reports (id) on delete cascade,
  inventory_batch_id uuid not null references public.inventory_batches (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  primary key (issue_id, inventory_batch_id)
);

create index product_issue_reports_reported_at_idx on public.product_issue_reports (reported_at desc);
create index product_issue_reports_product_idx on public.product_issue_reports (product_id, reported_at desc);

alter table public.product_issue_reports enable row level security;
alter table public.product_issue_allocations enable row level security;
revoke all on public.product_issue_reports, public.product_issue_allocations from anon, authenticated;
grant select on public.product_issue_reports, public.product_issue_allocations to authenticated;

create policy product_issue_reports_select on public.product_issue_reports for select to authenticated
using (public.current_app_role() is not null);
create policy product_issue_allocations_select on public.product_issue_allocations for select to authenticated
using (public.current_app_role() is not null);

create function public.get_product_issue_batches(p_product_id uuid)
returns table (id uuid, batch_number text, quantity_remaining integer, expires_at date)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, coalesce(b.batch_number, 'Unnumbered batch'), b.quantity_remaining, b.expires_at
  from public.inventory_batches b
  join public.products p on p.id = b.product_id
  where public.current_app_role() is not null
    and p.archived_at is null
    and b.product_id = p_product_id
    and b.quantity_remaining > 0
  order by b.expires_at asc nulls last, b.received_at asc, b.id asc;
$$;

create function public.get_product_issue_reports(p_limit integer default 51, p_offset integer default 0)
returns table (
  id uuid, product_id uuid, product_code text, product_name text,
  quantity integer, flag_kind text, custom_flag text, description text,
  status text, reporter_name text, reported_at timestamptz,
  resolver_name text, resolved_at timestamptz, resolution_note text, batches jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.product_id, p.product_code, p.name,
    r.quantity, r.flag_kind, r.custom_flag, r.description,
    r.status, coalesce(reporter.full_name, 'Former staff member'), r.reported_at,
    resolver.full_name, r.resolved_at, r.resolution_note,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'batch_number', coalesce(b.batch_number, 'Unnumbered batch'),
        'quantity', a.quantity
      ) order by b.expires_at asc nulls last, b.received_at asc, b.id asc)
      from public.product_issue_allocations a
      join public.inventory_batches b on b.id = a.inventory_batch_id
      where a.issue_id = r.id
    ), '[]'::jsonb)
  from public.product_issue_reports r
  join public.products p on p.id = r.product_id
  left join public.profiles reporter on reporter.id = r.reported_by
  left join public.profiles resolver on resolver.id = r.resolved_by
  where public.current_app_role() is not null
  order by (r.status = 'pending') desc, r.reported_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 51), 1), 200)
  offset least(greatest(coalesce(p_offset, 0), 0), 100000);
$$;

create function public.submit_product_issue(
  p_product_id uuid, p_batch_id uuid, p_quantity integer,
  p_flag_kind text, p_custom_flag text, p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issue_id uuid;
  v_batch record;
  v_remaining integer;
  v_take integer;
  v_label text;
  v_description text := trim(coalesce(p_description, ''));
  v_custom_flag text := nullif(trim(coalesce(p_custom_flag, '')), '');
begin
  if (select auth.uid()) is null or public.current_app_role() is null then
    raise exception 'An active staff account is required.' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then
    raise exception 'Enter a valid affected quantity.' using errcode = '22023';
  end if;
  if p_flag_kind is null or p_flag_kind not in ('damage', 'issue', 'custom') then
    raise exception 'Choose a valid issue flag.' using errcode = '22023';
  end if;
  if char_length(v_description) not between 5 and 500 then
    raise exception 'Describe the product issue in 5 to 500 characters.' using errcode = '22023';
  end if;
  if p_flag_kind = 'custom' and (v_custom_flag is null or char_length(v_custom_flag) not between 2 and 80) then
    raise exception 'Name the custom issue flag.' using errcode = '22023';
  end if;

  perform public.enforce_endpoint_rate_limit('inventory_write');

  perform 1 from public.products p where p.id = p_product_id and p.archived_at is null for update;
  if not found then raise exception 'Active product not found.' using errcode = 'P0002'; end if;

  if p_batch_id is not null and not exists (
    select 1 from public.inventory_batches b where b.id = p_batch_id and b.product_id = p_product_id
  ) then
    raise exception 'The selected batch does not belong to this product.' using errcode = '22023';
  end if;

  insert into public.product_issue_reports (
    product_id, quantity, flag_kind, custom_flag, description, reported_by
  ) values (
    p_product_id, p_quantity, p_flag_kind,
    case when p_flag_kind = 'custom' then v_custom_flag else null end,
    v_description, (select auth.uid())
  ) returning id into v_issue_id;

  v_label := case p_flag_kind when 'damage' then 'Damaged' when 'issue' then 'Other issue' else v_custom_flag end;
  v_remaining := p_quantity;
  for v_batch in
    select b.id, b.quantity_remaining, b.expires_at
    from public.inventory_batches b
    where b.product_id = p_product_id
      and b.quantity_remaining > 0
      and (p_batch_id is null or b.id = p_batch_id)
    order by b.expires_at asc nulls last, b.received_at asc, b.id asc
    for update
  loop
    exit when v_remaining = 0;
    v_take := least(v_remaining, v_batch.quantity_remaining);
    update public.inventory_batches
    set quantity_remaining = quantity_remaining - v_take
    where id = v_batch.id;

    insert into public.product_issue_allocations (issue_id, inventory_batch_id, quantity)
    values (v_issue_id, v_batch.id, v_take);

    insert into public.inventory_adjustments (
      product_id, inventory_batch_id, type, quantity,
      previous_quantity, resulting_quantity, reason, notes, performed_by
    ) values (
      p_product_id, v_batch.id,
      case when p_flag_kind = 'damage' then 'damage'::public.adjustment_type else 'correction'::public.adjustment_type end,
      v_take, v_batch.quantity_remaining, v_batch.quantity_remaining - v_take,
      left('Issue isolated: ' || v_label, 160),
      left('Issue ' || v_issue_id::text || ': ' || v_description, 500),
      (select auth.uid())
    );
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining <> 0 then
    raise exception 'Insufficient batch stock for the affected quantity.' using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'product_issue.reported', 'product_issue', v_issue_id::text,
    jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity, 'flag', v_label));
  return v_issue_id;
end;
$$;

create function public.resolve_product_issue(p_issue_id uuid, p_decision text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issue public.product_issue_reports%rowtype;
  v_product public.products%rowtype;
  v_allocation record;
  v_note text := trim(coalesce(p_note, ''));
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('confirm', 'release') then
    raise exception 'Choose a valid issue resolution.' using errcode = '22023';
  end if;
  if char_length(v_note) not between 2 and 500 then
    raise exception 'Explain the resolution in 2 to 500 characters.' using errcode = '22023';
  end if;

  perform public.enforce_endpoint_rate_limit('verification_write');

  select * into v_issue from public.product_issue_reports where id = p_issue_id for update;
  if v_issue.id is null or v_issue.status <> 'pending' then
    raise exception 'This issue report is no longer pending.' using errcode = '55000';
  end if;

  if p_decision = 'release' then
    select * into v_product from public.products where id = v_issue.product_id for update;
    if v_product.id is null or v_product.archived_at is not null then
      raise exception 'Archived products cannot be returned to sellable stock.' using errcode = '55000';
    end if;

    if (select coalesce(sum(a.quantity), 0) from public.product_issue_allocations a where a.issue_id = p_issue_id) <> v_issue.quantity then
      raise exception 'The issue allocation is incomplete and cannot be released.' using errcode = '55000';
    end if;

    for v_allocation in
      select a.quantity, b.id, b.product_id, b.quantity_remaining, b.quantity_received, b.expires_at
      from public.product_issue_allocations a
      join public.inventory_batches b on b.id = a.inventory_batch_id
      where a.issue_id = p_issue_id
      order by b.expires_at asc nulls last, b.received_at asc, b.id asc
      for update of b
    loop
      if v_allocation.product_id <> v_issue.product_id
         or (v_allocation.expires_at is not null and v_allocation.expires_at < (now() at time zone 'Asia/Manila')::date)
         or v_allocation.quantity_remaining + v_allocation.quantity > v_allocation.quantity_received then
        raise exception 'The affected batch cannot be returned to sellable stock.' using errcode = '55000';
      end if;

      update public.inventory_batches
      set quantity_remaining = quantity_remaining + v_allocation.quantity
      where id = v_allocation.id;

      insert into public.inventory_adjustments (
        product_id, inventory_batch_id, type, quantity,
        previous_quantity, resulting_quantity, reason, notes, performed_by
      ) values (
        v_issue.product_id, v_allocation.id, 'correction'::public.adjustment_type,
        v_allocation.quantity, v_allocation.quantity_remaining,
        v_allocation.quantity_remaining + v_allocation.quantity,
        'Issue released to stock', left('Issue ' || p_issue_id::text || ': ' || v_note, 500),
        (select auth.uid())
      );
    end loop;
  end if;

  update public.product_issue_reports
  set status = case when p_decision = 'confirm' then 'confirmed' else 'released' end,
      resolved_by = (select auth.uid()), resolved_at = now(), resolution_note = v_note
  where id = p_issue_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'product_issue.resolved', 'product_issue', p_issue_id::text,
    jsonb_build_object('decision', p_decision, 'note', v_note));
end;
$$;

revoke execute on function public.get_product_issue_batches(uuid) from public, anon;
revoke execute on function public.get_product_issue_reports(integer, integer) from public, anon;
revoke execute on function public.submit_product_issue(uuid, uuid, integer, text, text, text) from public, anon;
revoke execute on function public.resolve_product_issue(uuid, text, text) from public, anon;
grant execute on function public.get_product_issue_batches(uuid) to authenticated;
grant execute on function public.get_product_issue_reports(integer, integer) to authenticated;
grant execute on function public.submit_product_issue(uuid, uuid, integer, text, text, text) to authenticated;
grant execute on function public.resolve_product_issue(uuid, text, text) to authenticated;
