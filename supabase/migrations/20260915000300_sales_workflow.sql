create type public.business_day_status as enum ('open', 'pending_review', 'verified');
create type public.return_status as enum ('pending_review', 'approved', 'rejected');
create type public.return_disposition as enum ('restock', 'damaged', 'expired');

create table public.business_days (
  id uuid primary key default gen_random_uuid(),
  business_date date not null unique,
  status public.business_day_status not null default 'open',
  opened_by uuid not null references public.profiles (id),
  opened_at timestamptz not null default now(),
  submitted_by uuid references public.profiles (id),
  submitted_at timestamptz,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 500)
);

alter table public.sales
  add column business_day_id uuid references public.business_days (id),
  add column idempotency_key uuid unique;

create table public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  return_number bigint generated always as identity unique,
  sale_id uuid not null references public.sales (id),
  status public.return_status not null default 'pending_review',
  reason text not null check (char_length(reason) between 2 and 160),
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 500)
);

create table public.sales_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sales_returns (id) on delete restrict,
  sale_item_id uuid not null references public.sale_items (id),
  quantity integer not null check (quantity > 0),
  disposition public.return_disposition not null,
  unique (return_id, sale_item_id)
);

create index sales_business_day_id_idx on public.sales (business_day_id, sold_at desc);
create index sales_returns_sale_id_idx on public.sales_returns (sale_id, requested_at desc);

alter table public.business_days enable row level security;
alter table public.sales_returns enable row level security;
alter table public.sales_return_items enable row level security;

revoke all on public.business_days, public.sales_returns, public.sales_return_items from anon, authenticated;
grant select on public.business_days, public.sales_returns, public.sales_return_items to authenticated;

create policy business_days_select on public.business_days for select to authenticated
using (public.current_app_role() is not null);

create policy sales_returns_select on public.sales_returns for select to authenticated
using (
  requested_by = (select auth.uid())
  or public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role])
);

create policy sales_return_items_select on public.sales_return_items for select to authenticated
using (
  exists (
    select 1 from public.sales_returns r
    where r.id = sales_return_items.return_id
      and (
        r.requested_by = (select auth.uid())
        or public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role])
      )
  )
);

create or replace function public.record_sale(
  p_idempotency_key uuid,
  p_items jsonb,
  p_notes text default null
)
returns table (sale_id uuid, sale_number bigint, total_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_business_day_id uuid;
  v_business_day_status public.business_day_status;
  v_sale_id uuid;
  v_sale_number bigint;
  v_total numeric(14, 2) := 0;
  v_available bigint;
  v_remaining integer;
  v_take integer;
  v_item_id uuid;
  v_line record;
  v_product record;
  v_batch record;
begin
  if v_user_id is null or public.current_app_role() is null then
    raise exception 'An active account is required.' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'A sale idempotency key is required.' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A sale must contain at least one item.' using errcode = '22023';
  end if;

  select s.id, s.sale_number, s.total_amount
  into v_sale_id, v_sale_number, v_total
  from public.sales s
  where s.idempotency_key = p_idempotency_key;

  if found then
    return query select v_sale_id, v_sale_number, v_total;
    return;
  end if;

  insert into public.business_days (business_date, opened_by)
  values (current_date, v_user_id)
  on conflict (business_date) do nothing;

  select d.id, d.status
  into v_business_day_id, v_business_day_status
  from public.business_days d
  where d.business_date = current_date
  for update;

  if v_business_day_status <> 'open' then
    raise exception 'Today''s business day is not open for sales.' using errcode = '55000';
  end if;

  insert into public.sales (recorded_by, business_day_id, idempotency_key, notes)
  values (v_user_id, v_business_day_id, p_idempotency_key, nullif(trim(p_notes), ''))
  returning id, public.sales.sale_number into v_sale_id, v_sale_number;

  for v_line in
    select
      (entry ->> 'product_id')::uuid as product_id,
      sum((entry ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) entry
    group by (entry ->> 'product_id')::uuid
    order by (entry ->> 'product_id')::uuid
  loop
    if v_line.quantity <= 0 then
      raise exception 'Sale quantities must be greater than zero.' using errcode = '22023';
    end if;

    select p.id, p.name, p.selling_price, coalesce(cost.average_cost, 0) as average_cost
    into v_product
    from public.products p
    left join public.product_costs cost on cost.product_id = p.id
    where p.id = v_line.product_id and p.archived_at is null;

    if not found then
      raise exception 'A product in the sale is unavailable.' using errcode = 'P0002';
    end if;

    select coalesce(sum(b.quantity_remaining), 0)
    into v_available
    from public.inventory_batches b
    where b.product_id = v_line.product_id
      and b.quantity_remaining > 0
      and (b.expires_at is null or b.expires_at >= current_date);

    if v_available < v_line.quantity then
      raise exception 'Insufficient sellable stock for %.', v_product.name using errcode = 'P0001';
    end if;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (v_sale_id, v_product.id, v_line.quantity, v_product.selling_price)
    returning id into v_item_id;

    insert into public.sale_item_costs (sale_item_id, unit_cost)
    values (v_item_id, v_product.average_cost);

    v_remaining := v_line.quantity;
    for v_batch in
      select b.id, b.quantity_remaining
      from public.inventory_batches b
      where b.product_id = v_line.product_id
        and b.quantity_remaining > 0
        and (b.expires_at is null or b.expires_at >= current_date)
      order by b.expires_at asc nulls last, b.received_at asc, b.id asc
      for update
    loop
      exit when v_remaining = 0;
      v_take := least(v_remaining, v_batch.quantity_remaining);

      update public.inventory_batches
      set quantity_remaining = quantity_remaining - v_take
      where id = v_batch.id;

      insert into public.batch_allocations (sale_item_id, inventory_batch_id, quantity)
      values (v_item_id, v_batch.id, v_take);

      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining <> 0 then
      raise exception 'Inventory changed while the sale was being confirmed.' using errcode = '40001';
    end if;

    v_total := v_total + round(v_line.quantity * v_product.selling_price, 2);
  end loop;

  update public.sales set total_amount = v_total where id = v_sale_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_user_id,
    'sale.recorded',
    'sale',
    v_sale_id::text,
    jsonb_build_object('sale_number', v_sale_number, 'total_amount', v_total)
  );

  return query select v_sale_id, v_sale_number, v_total;
end;
$$;

revoke execute on function public.record_sale(uuid, jsonb, text) from public, anon;
grant execute on function public.record_sale(uuid, jsonb, text) to authenticated;
