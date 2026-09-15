create table public.return_batch_allocations (
  id uuid primary key default gen_random_uuid(),
  return_item_id uuid not null references public.sales_return_items (id) on delete restrict,
  inventory_batch_id uuid not null references public.inventory_batches (id),
  quantity integer not null check (quantity > 0),
  unique (return_item_id, inventory_batch_id)
);

alter table public.return_batch_allocations enable row level security;
revoke all on public.return_batch_allocations from anon, authenticated;
grant select on public.return_batch_allocations to authenticated;

create policy return_batch_allocations_select on public.return_batch_allocations for select to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]));

create or replace function public.get_business_day_summaries(p_limit integer default 14)
returns table (
  id uuid,
  business_date date,
  status public.business_day_status,
  sale_count bigint,
  item_count bigint,
  gross_total numeric,
  return_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id,
    d.business_date,
    d.status,
    count(distinct s.id)::bigint as sale_count,
    coalesce(sum(si.quantity), 0)::bigint as item_count,
    coalesce(max(totals.gross_total), 0)::numeric as gross_total,
    coalesce(max(returns.return_count), 0)::bigint as return_count
  from public.business_days d
  left join public.sales s on s.business_day_id = d.id and s.status = 'completed'
  left join public.sale_items si on si.sale_id = s.id
  left join lateral (
    select coalesce(sum(inner_sale.total_amount), 0) as gross_total
    from public.sales inner_sale
    where inner_sale.business_day_id = d.id and inner_sale.status = 'completed'
  ) totals on true
  left join lateral (
    select count(*)::bigint as return_count
    from public.sales_returns r
    join public.sales return_sale on return_sale.id = r.sale_id
    where return_sale.business_day_id = d.id and r.status <> 'rejected'
  ) returns on true
  where public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role])
  group by d.id
  order by d.business_date desc
  limit least(greatest(p_limit, 1), 90);
$$;

create or replace function public.submit_business_day(p_business_day_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;

  update public.business_days
  set status = 'pending_review', submitted_by = (select auth.uid()), submitted_at = now()
  where id = p_business_day_id and status = 'open';

  if not found then raise exception 'Only an open business day can be submitted.' using errcode = '55000'; end if;
end;
$$;

create or replace function public.verify_business_day(p_business_day_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.sales_returns r
    join public.sales s on s.id = r.sale_id
    where s.business_day_id = p_business_day_id
      and r.status = 'pending_review'
  ) then
    raise exception 'Review this business day''s pending returns before verification.' using errcode = '55000';
  end if;

  update public.business_days
  set status = 'verified', verified_by = (select auth.uid()), verified_at = now()
  where id = p_business_day_id and status = 'pending_review';

  if not found then raise exception 'Submit the business day before verifying it.' using errcode = '55000'; end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values ((select auth.uid()), 'business_day.verified', 'business_day', p_business_day_id::text);
end;
$$;

create or replace function public.get_sale_for_return(p_sale_number bigint)
returns table (
  sale_id uuid,
  sale_item_id uuid,
  product_name text,
  barcode text,
  quantity_sold integer,
  quantity_returned bigint,
  unit_price numeric,
  sold_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    si.id,
    p.name,
    p.barcode,
    si.quantity,
    coalesce(sum(sri.quantity) filter (where r.status <> 'rejected'), 0)::bigint,
    si.unit_price,
    s.sold_at
  from public.sales s
  join public.sale_items si on si.sale_id = s.id
  join public.products p on p.id = si.product_id
  left join public.sales_return_items sri on sri.sale_item_id = si.id
  left join public.sales_returns r on r.id = sri.return_id
  where public.current_app_role() is not null and s.sale_number = p_sale_number and s.status = 'completed'
  group by s.id, si.id, p.name, p.barcode
  order by p.name;
$$;

create or replace function public.request_sale_return(
  p_sale_number bigint,
  p_items jsonb,
  p_reason text,
  p_notes text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_sale_id uuid;
  v_return_id uuid;
  v_return_number bigint;
  v_line record;
  v_sold integer;
  v_already_returned bigint;
begin
  if v_user_id is null or public.current_app_role() is null then raise exception 'An active account is required.' using errcode = '42501'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 2 then raise exception 'A return reason is required.' using errcode = '22023'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Select at least one returned item.' using errcode = '22023'; end if;

  select id into v_sale_id from public.sales where sale_number = p_sale_number and status = 'completed';
  if not found then raise exception 'Sale number was not found.' using errcode = 'P0002'; end if;

  insert into public.sales_returns (sale_id, reason, requested_by, notes)
  values (v_sale_id, trim(p_reason), v_user_id, nullif(trim(p_notes), ''))
  returning id, return_number into v_return_id, v_return_number;

  for v_line in
    select
      (entry ->> 'sale_item_id')::uuid as sale_item_id,
      (entry ->> 'quantity')::integer as quantity,
      (entry ->> 'disposition')::public.return_disposition as disposition
    from jsonb_array_elements(p_items) entry
    order by (entry ->> 'sale_item_id')::uuid
  loop
    select quantity into v_sold
    from public.sale_items
    where id = v_line.sale_item_id and sale_id = v_sale_id
    for update;
    if not found or v_line.quantity <= 0 then raise exception 'A returned item is invalid.' using errcode = '22023'; end if;

    select coalesce(sum(sri.quantity), 0) into v_already_returned
    from public.sales_return_items sri
    join public.sales_returns r on r.id = sri.return_id
    where sri.sale_item_id = v_line.sale_item_id and r.status <> 'rejected';

    if v_already_returned + v_line.quantity > v_sold then raise exception 'Returned quantity exceeds the quantity sold.' using errcode = '22023'; end if;

    insert into public.sales_return_items (return_id, sale_item_id, quantity, disposition)
    values (v_return_id, v_line.sale_item_id, v_line.quantity, v_line.disposition);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_user_id, 'return.requested', 'sales_return', v_return_id::text, jsonb_build_object('return_number', v_return_number));
  return v_return_number;
end;
$$;

create or replace function public.review_sale_return(p_return_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_allocation record;
  v_remaining integer;
  v_take integer;
  v_restored bigint;
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then raise exception 'Manager access is required.' using errcode = '42501'; end if;

  perform 1 from public.sales_returns where id = p_return_id and status = 'pending_review' for update;
  if not found then raise exception 'This return is no longer pending.' using errcode = '55000'; end if;

  if p_approve then
    for v_item in select * from public.sales_return_items where return_id = p_return_id loop
      if v_item.disposition = 'restock' then
        v_remaining := v_item.quantity;
        for v_allocation in
          select ba.inventory_batch_id, ba.quantity, b.expires_at
          from public.batch_allocations ba
          join public.inventory_batches b on b.id = ba.inventory_batch_id
          where ba.sale_item_id = v_item.sale_item_id
          order by b.expires_at asc nulls last, b.received_at asc
          for update of b
        loop
          if v_allocation.expires_at is not null and v_allocation.expires_at < current_date then
            raise exception 'An expired returned item cannot be restocked.' using errcode = '22023';
          end if;
          select coalesce(sum(rba.quantity), 0) into v_restored
          from public.return_batch_allocations rba
          join public.sales_return_items previous_item on previous_item.id = rba.return_item_id
          join public.sales_returns previous_return on previous_return.id = previous_item.return_id
          where previous_item.sale_item_id = v_item.sale_item_id
            and rba.inventory_batch_id = v_allocation.inventory_batch_id
            and previous_return.status = 'approved';
          v_take := least(v_remaining, v_allocation.quantity - v_restored);
          if v_take > 0 then
            update public.inventory_batches set quantity_remaining = quantity_remaining + v_take where id = v_allocation.inventory_batch_id;
            insert into public.return_batch_allocations (return_item_id, inventory_batch_id, quantity) values (v_item.id, v_allocation.inventory_batch_id, v_take);
            v_remaining := v_remaining - v_take;
          end if;
          exit when v_remaining = 0;
        end loop;
        if v_remaining <> 0 then raise exception 'The returned quantity could not be restored safely.' using errcode = '40001'; end if;
      end if;
    end loop;
  end if;

  update public.sales_returns
  set status = case when p_approve then 'approved'::public.return_status else 'rejected'::public.return_status end,
      reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = p_return_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values ((select auth.uid()), case when p_approve then 'return.approved' else 'return.rejected' end, 'sales_return', p_return_id::text);
end;
$$;

create or replace function public.get_pending_return_summaries()
returns table (
  id uuid,
  business_day_id uuid,
  return_number bigint,
  sale_number bigint,
  reason text,
  requested_by_name text,
  requested_at timestamptz,
  item_count bigint,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    s.business_day_id,
    r.return_number,
    s.sale_number,
    r.reason,
    profile.full_name,
    r.requested_at,
    coalesce(sum(item.quantity), 0)::bigint,
    jsonb_agg(jsonb_build_object(
      'product_name', product.name,
      'quantity', item.quantity,
      'disposition', item.disposition
    ) order by product.name)
  from public.sales_returns r
  join public.sales s on s.id = r.sale_id
  join public.profiles profile on profile.id = r.requested_by
  join public.sales_return_items item on item.return_id = r.id
  join public.sale_items sold_item on sold_item.id = item.sale_item_id
  join public.products product on product.id = sold_item.product_id
  where
    r.status = 'pending_review'
    and public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role])
  group by r.id, s.business_day_id, s.sale_number, profile.full_name
  order by r.requested_at asc;
$$;

revoke execute on function public.get_business_day_summaries(integer) from public, anon;
revoke execute on function public.submit_business_day(uuid) from public, anon;
revoke execute on function public.verify_business_day(uuid) from public, anon;
revoke execute on function public.get_sale_for_return(bigint) from public, anon;
revoke execute on function public.request_sale_return(bigint, jsonb, text, text) from public, anon;
revoke execute on function public.review_sale_return(uuid, boolean) from public, anon;
revoke execute on function public.get_pending_return_summaries() from public, anon;
grant execute on function public.get_business_day_summaries(integer) to authenticated;
grant execute on function public.submit_business_day(uuid) to authenticated;
grant execute on function public.verify_business_day(uuid) to authenticated;
grant execute on function public.get_sale_for_return(bigint) to authenticated;
grant execute on function public.request_sale_return(bigint, jsonb, text, text) to authenticated;
grant execute on function public.review_sale_return(uuid, boolean) to authenticated;
grant execute on function public.get_pending_return_summaries() to authenticated;
