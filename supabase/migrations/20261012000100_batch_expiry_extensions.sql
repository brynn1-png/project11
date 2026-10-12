-- A new delivery carries the manufacturer's revised expiry for remaining stock
-- of the same product. Keep depleted batches unchanged for historical records.
create function public.extend_existing_batch_expiry_on_receive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.expires_at is null then
    return new;
  end if;

  if exists (
    select 1 from public.inventory_batches b
    where b.product_id = new.product_id and b.id <> new.id and b.quantity_remaining > 0
      and (b.expires_at > new.expires_at or b.manufactured_at > new.expires_at)
  ) then
    raise exception 'The new expiry must not be earlier than an existing batch expiry or manufacture date.' using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  select (select auth.uid()), 'batch.expiry_extended', 'inventory_batch', b.id::text,
    jsonb_build_object(
      'product_id', new.product_id, 'batch_number', b.batch_number,
      'previous_expiry', b.expires_at, 'new_expiry', new.expires_at,
      'receiving_number', new.receiving_number
    )
  from public.inventory_batches b
  where b.product_id = new.product_id and b.id <> new.id and b.quantity_remaining > 0
    and b.expires_at is distinct from new.expires_at;

  update public.inventory_batches b
  set expires_at = new.expires_at
  where b.product_id = new.product_id and b.id <> new.id and b.quantity_remaining > 0
    and b.expires_at is distinct from new.expires_at;

  return new;
end;
$$;

create trigger inventory_batches_extend_expiry_after_insert
after insert on public.inventory_batches
for each row execute function public.extend_existing_batch_expiry_on_receive();

create function public.update_inventory_product_expiry(p_product_id uuid, p_expires_at date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_changed integer;
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required to change expiry dates.' using errcode = '42501';
  end if;
  perform public.enforce_endpoint_rate_limit('inventory_write');

  select * into v_product from public.products p where p.id = p_product_id for update;
  if v_product.id is null or v_product.archived_at is not null then
    raise exception 'Active product not found.' using errcode = 'P0002';
  end if;
  if v_product.expiry_tracking <> 'required' or p_expires_at is null then
    raise exception 'Enter an expiry date for a product that tracks expiry.' using errcode = '22023';
  end if;

  perform 1 from public.inventory_batches b
  where b.product_id = p_product_id and b.quantity_remaining > 0 for update;
  if exists (
    select 1 from public.inventory_batches b
    where b.product_id = p_product_id and b.quantity_remaining > 0
      and b.manufactured_at > p_expires_at
  ) then
    raise exception 'Expiry cannot be before a batch manufacture date.' using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  select (select auth.uid()), 'batch.expiry_corrected', 'inventory_batch', b.id::text,
    jsonb_build_object(
      'product_id', p_product_id, 'batch_number', b.batch_number,
      'previous_expiry', b.expires_at, 'new_expiry', p_expires_at
    )
  from public.inventory_batches b
  where b.product_id = p_product_id and b.quantity_remaining > 0
    and b.expires_at is distinct from p_expires_at;

  update public.inventory_batches b
  set expires_at = p_expires_at
  where b.product_id = p_product_id and b.quantity_remaining > 0
    and b.expires_at is distinct from p_expires_at;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke execute on function public.update_inventory_product_expiry(uuid, date) from public, anon;
grant execute on function public.update_inventory_product_expiry(uuid, date) to authenticated;

drop function public.get_inventory_catalog();

create function public.get_inventory_catalog()
returns table (
  id uuid,
  product_code text,
  barcode text,
  name text,
  description text,
  category_id uuid,
  category text,
  package_size numeric,
  package_unit text,
  stock_unit text,
  selling_price numeric,
  minimum_stock integer,
  expiry_tracking public.expiry_tracking,
  quantity_on_hand bigint,
  sellable_quantity bigint,
  next_expiry date,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.product_code, p.barcode, p.name, p.description, p.category_id,
    c.name as category, p.package_size, p.package_unit, p.stock_unit,
    p.selling_price, p.minimum_stock, p.expiry_tracking,
    coalesce(sum(b.quantity_remaining), 0)::bigint as quantity_on_hand,
    coalesce(sum(b.quantity_remaining) filter (
      where b.expires_at is null or b.expires_at >= current_date
    ), 0)::bigint as sellable_quantity,
    min(b.expires_at) filter (where b.quantity_remaining > 0) as next_expiry,
    greatest(p.updated_at, max(b.received_at)) as updated_at
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.inventory_batches b on b.product_id = p.id
  where public.current_app_role() is not null
    and p.archived_at is null and c.archived_at is null
  group by p.id, c.name
  order by p.name;
$$;

revoke execute on function public.get_inventory_catalog() from public, anon;
grant execute on function public.get_inventory_catalog() to authenticated;
