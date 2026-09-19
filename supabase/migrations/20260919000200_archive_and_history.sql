alter table public.products
  add column if not exists archive_reason text,
  add column if not exists archived_by uuid references public.profiles (id) on delete set null;

create index if not exists products_archived_at_idx
  on public.products (archived_at desc)
  where archived_at is not null;

drop function if exists public.archive_inventory_product(uuid);

create function public.archive_inventory_product(p_product_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_quantity bigint;
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 2 or char_length(trim(p_reason)) > 160 then
    raise exception 'Enter an archive reason between 2 and 160 characters.' using errcode = '22023';
  end if;

  select p.product_code into v_code
  from public.products p
  where p.id = p_product_id and p.archived_at is null
  for update;

  if v_code is null then
    raise exception 'Active product not found.' using errcode = 'P0002';
  end if;
  select coalesce(sum(b.quantity_remaining), 0)::bigint into v_quantity
  from public.inventory_batches b
  where b.product_id = p_product_id;
  if v_quantity > 0 then
    raise exception 'Reduce this product to zero stock before archiving it.' using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.sales_returns r
    join public.sales_return_items ri on ri.return_id = r.id
    join public.sale_items si on si.id = ri.sale_item_id
    where si.product_id = p_product_id
      and r.status = 'pending_review'
      and ri.disposition = 'restock'
  ) then
    raise exception 'Review this product''s pending resellable returns before archiving it.' using errcode = '55000';
  end if;

  update public.products
  set archived_at = now(), archived_by = (select auth.uid()), archive_reason = trim(p_reason)
  where id = p_product_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'product.archived', 'product', p_product_id::text,
    jsonb_build_object('product_code', v_code, 'reason', trim(p_reason)));
end;
$$;

create function public.prevent_archived_product_restock_return()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.disposition = 'restock' and exists (
    select 1
    from public.sale_items si
    join public.products p on p.id = si.product_id
    where si.id = new.sale_item_id and p.archived_at is not null
  ) then
    raise exception 'Archived products cannot be returned to sellable stock. Choose damaged or expired.' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_return_items_active_product_restock on public.sales_return_items;
create trigger sales_return_items_active_product_restock
before insert or update of disposition, sale_item_id on public.sales_return_items
for each row execute function public.prevent_archived_product_restock_return();

create function public.restore_inventory_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;

  update public.products p
  set archived_at = null, archived_by = null, archive_reason = null
  from public.categories c
  where p.id = p_product_id
    and p.archived_at is not null
    and c.id = p.category_id
    and c.archived_at is null
  returning p.product_code into v_code;

  if v_code is null then
    raise exception 'Archived product was not found or its category is unavailable.' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'product.restored', 'product', p_product_id::text,
    jsonb_build_object('product_code', v_code));
end;
$$;

create function public.get_archived_inventory_products()
returns table (
  id uuid,
  product_code text,
  barcode text,
  name text,
  description text,
  category_name text,
  stock_unit text,
  quantity bigint,
  archived_at timestamptz,
  archive_reason text,
  archived_by_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.product_code,
    p.barcode,
    p.name,
    p.description,
    c.name,
    p.stock_unit,
    coalesce(sum(b.quantity_remaining), 0)::bigint,
    p.archived_at,
    p.archive_reason,
    profile.full_name
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.inventory_batches b on b.product_id = p.id
  left join public.profiles profile on profile.id = p.archived_by
  where p.archived_at is not null and public.current_app_role() is not null
  group by p.id, c.name, profile.full_name
  order by p.archived_at desc;
$$;

create function public.get_sales_receipt_history(p_limit integer default 100)
returns table (
  sale_number bigint,
  sold_at timestamptz,
  cashier_name text,
  total_amount numeric,
  status public.sale_status,
  item_count bigint,
  returned_quantity bigint,
  notes text,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.sale_number,
    s.sold_at,
    profile.full_name,
    s.total_amount,
    s.status,
    coalesce((select sum(si.quantity) from public.sale_items si where si.sale_id = s.id), 0)::bigint,
    coalesce((
      select sum(sri.quantity)
      from public.sales_return_items sri
      join public.sales_returns sr on sr.id = sri.return_id
      join public.sale_items returned_item on returned_item.id = sri.sale_item_id
      where returned_item.sale_id = s.id and sr.status <> 'rejected'
    ), 0)::bigint,
    s.notes,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', p.name,
        'barcode', p.barcode,
        'quantity', si.quantity,
        'unit_price', si.unit_price,
        'line_total', si.line_total
      ) order by p.name)
      from public.sale_items si
      join public.products p on p.id = si.product_id
      where si.sale_id = s.id
    ), '[]'::jsonb)
  from public.sales s
  join public.profiles profile on profile.id = s.recorded_by
  where public.current_app_role() is not null
    and (
      s.recorded_by = (select auth.uid())
      or public.has_role(array[
        'administrator'::public.app_role,
        'manager'::public.app_role,
        'inventory_staff'::public.app_role
      ])
    )
  order by s.sold_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

create function public.get_sales_return_history(p_limit integer default 100)
returns table (
  return_number bigint,
  sale_number bigint,
  status public.return_status,
  reason text,
  notes text,
  requested_by_name text,
  requested_at timestamptz,
  reviewed_by_name text,
  reviewed_at timestamptz,
  item_count bigint,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.return_number,
    s.sale_number,
    r.status,
    r.reason,
    r.notes,
    requester.full_name,
    r.requested_at,
    reviewer.full_name,
    r.reviewed_at,
    coalesce(sum(ri.quantity), 0)::bigint,
    jsonb_agg(jsonb_build_object(
      'product_name', p.name,
      'quantity', ri.quantity,
      'disposition', ri.disposition
    ) order by p.name)
  from public.sales_returns r
  join public.sales s on s.id = r.sale_id
  join public.profiles requester on requester.id = r.requested_by
  left join public.profiles reviewer on reviewer.id = r.reviewed_by
  join public.sales_return_items ri on ri.return_id = r.id
  join public.sale_items si on si.id = ri.sale_item_id
  join public.products p on p.id = si.product_id
  where public.current_app_role() is not null
    and (
      r.requested_by = (select auth.uid())
      or public.has_role(array[
        'administrator'::public.app_role,
        'manager'::public.app_role,
        'inventory_staff'::public.app_role
      ])
    )
  group by r.id, s.sale_number, requester.full_name, reviewer.full_name
  order by r.requested_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke execute on function public.archive_inventory_product(uuid, text) from public, anon;
revoke execute on function public.restore_inventory_product(uuid) from public, anon;
revoke execute on function public.get_archived_inventory_products() from public, anon;
revoke execute on function public.get_sales_receipt_history(integer) from public, anon;
revoke execute on function public.get_sales_return_history(integer) from public, anon;
revoke execute on function public.prevent_archived_product_restock_return() from public, anon, authenticated;

grant execute on function public.archive_inventory_product(uuid, text) to authenticated;
grant execute on function public.restore_inventory_product(uuid) to authenticated;
grant execute on function public.get_archived_inventory_products() to authenticated;
grant execute on function public.get_sales_receipt_history(integer) to authenticated;
grant execute on function public.get_sales_return_history(integer) to authenticated;
