create sequence if not exists public.product_code_seq start with 1;
create sequence if not exists public.internal_barcode_seq start with 1;
create sequence if not exists public.receiving_number_seq start with 1;

create table public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  barcode text not null check (char_length(barcode) between 4 and 64),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create unique index product_barcodes_barcode_ci_uidx
on public.product_barcodes (lower(barcode));

create unique index product_barcodes_one_active_per_product_uidx
on public.product_barcodes (product_id)
where is_active;

insert into public.product_barcodes (product_id, barcode, is_active, created_by, created_at)
select id, barcode, true, created_by, created_at
from public.products
on conflict do nothing;

alter table public.inventory_batches
  add column receiving_number bigint,
  add column delivery_reference text check (delivery_reference is null or char_length(delivery_reference) <= 120),
  add column notes text check (notes is null or char_length(notes) <= 500);

create unique index inventory_batches_receiving_number_uidx
on public.inventory_batches (receiving_number)
where receiving_number is not null;

alter table public.product_barcodes enable row level security;
revoke all on public.product_barcodes from anon, authenticated;
grant select on public.product_barcodes to authenticated;

create policy product_barcodes_select on public.product_barcodes for select to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]));

revoke insert, update, delete on public.categories, public.products, public.inventory_batches, public.product_costs from authenticated;
drop policy if exists categories_insert on public.categories;
drop policy if exists categories_update on public.categories;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
drop policy if exists inventory_batches_insert on public.inventory_batches;
drop policy if exists inventory_batches_update on public.inventory_batches;
drop policy if exists product_costs_insert on public.product_costs;
drop policy if exists product_costs_update on public.product_costs;

create function public.create_inventory_category(
  p_name text,
  p_description text default null,
  p_default_expiry_tracking public.expiry_tracking default 'not_applicable'
)
returns table (
  id uuid,
  name text,
  description text,
  default_expiry_tracking public.expiry_tracking
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'Category name must contain 2 to 80 characters.' using errcode = '22023';
  end if;

  insert into public.categories (name, description, default_expiry_tracking)
  values (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    p_default_expiry_tracking
  )
  returning categories.id into v_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'category.created', 'category', v_id::text, jsonb_build_object('name', trim(p_name)));

  return query
  select c.id, c.name, c.description, c.default_expiry_tracking
  from public.categories c
  where c.id = v_id;
end;
$$;

create function public.create_inventory_product(
  p_name text,
  p_description text,
  p_category_id uuid,
  p_package_size numeric,
  p_package_unit text,
  p_stock_unit text,
  p_selling_price numeric,
  p_minimum_stock integer,
  p_expiry_tracking public.expiry_tracking,
  p_barcode text default null,
  p_generate_barcode boolean default false
)
returns table (
  id uuid,
  product_code text,
  barcode text,
  name text,
  description text,
  category_id uuid,
  package_size numeric,
  package_unit text,
  stock_unit text,
  selling_price numeric,
  minimum_stock integer,
  expiry_tracking public.expiry_tracking
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_product_code text;
  v_barcode text;
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.categories c where c.id = p_category_id and c.archived_at is null) then
    raise exception 'Select an active category.' using errcode = '22023';
  end if;

  v_product_code := 'PRD-' || lpad(nextval('public.product_code_seq')::text, 6, '0');
  if p_generate_barcode then
    v_barcode := 'INV-' || lpad(nextval('public.internal_barcode_seq')::text, 6, '0');
  else
    v_barcode := trim(coalesce(p_barcode, ''));
  end if;

  if char_length(v_barcode) not between 4 and 64 then
    raise exception 'Barcode must contain 4 to 64 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.product_barcodes pb where lower(pb.barcode) = lower(v_barcode)) then
    raise exception 'That barcode is already registered or retired.' using errcode = '23505';
  end if;

  insert into public.products (
    id, product_code, barcode, name, description, category_id, package_size,
    package_unit, stock_unit, selling_price, minimum_stock, expiry_tracking, created_by
  ) values (
    v_id, v_product_code, v_barcode, trim(p_name), nullif(trim(coalesce(p_description, '')), ''),
    p_category_id, p_package_size, trim(p_package_unit), trim(p_stock_unit),
    p_selling_price, p_minimum_stock, p_expiry_tracking, (select auth.uid())
  );

  insert into public.product_barcodes (product_id, barcode, is_active, created_by)
  values (v_id, v_barcode, true, (select auth.uid()));

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()), 'product.created', 'product', v_id::text,
    jsonb_build_object('product_code', v_product_code, 'barcode', v_barcode)
  );

  return query
  select p.id, p.product_code, p.barcode, p.name, p.description, p.category_id,
    p.package_size, p.package_unit, p.stock_unit, p.selling_price,
    p.minimum_stock, p.expiry_tracking
  from public.products p where p.id = v_id;
end;
$$;

create function public.update_inventory_category(
  p_category_id uuid,
  p_name text,
  p_description text default null,
  p_default_expiry_tracking public.expiry_tracking default 'not_applicable'
)
returns table (
  id uuid,
  name text,
  description text,
  default_expiry_tracking public.expiry_tracking
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'Category name must contain 2 to 80 characters.' using errcode = '22023';
  end if;

  update public.categories c
  set name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      default_expiry_tracking = p_default_expiry_tracking
  where c.id = p_category_id and c.archived_at is null;

  if not found then
    raise exception 'Active category not found.' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'category.updated', 'category', p_category_id::text, jsonb_build_object('name', trim(p_name)));

  return query
  select c.id, c.name, c.description, c.default_expiry_tracking
  from public.categories c
  where c.id = p_category_id;
end;
$$;

create function public.update_inventory_product(
  p_product_id uuid,
  p_name text,
  p_description text,
  p_category_id uuid,
  p_package_size numeric,
  p_package_unit text,
  p_stock_unit text,
  p_selling_price numeric,
  p_minimum_stock integer,
  p_expiry_tracking public.expiry_tracking,
  p_barcode text default null,
  p_generate_barcode boolean default false
)
returns table (
  id uuid,
  product_code text,
  barcode text,
  name text,
  description text,
  category_id uuid,
  package_size numeric,
  package_unit text,
  stock_unit text,
  selling_price numeric,
  minimum_stock integer,
  expiry_tracking public.expiry_tracking
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.products%rowtype;
  v_barcode text;
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;

  select * into v_old from public.products where products.id = p_product_id for update;
  if v_old.id is null or v_old.archived_at is not null then
    raise exception 'Active product not found.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.archived_at is null) then
    raise exception 'Select an active category.' using errcode = '22023';
  end if;

  if p_generate_barcode then
    v_barcode := 'INV-' || lpad(nextval('public.internal_barcode_seq')::text, 6, '0');
  else
    v_barcode := trim(coalesce(p_barcode, ''));
  end if;
  if char_length(v_barcode) not between 4 and 64 then
    raise exception 'Barcode must contain 4 to 64 characters.' using errcode = '22023';
  end if;

  if lower(v_barcode) <> lower(v_old.barcode) then
    if exists (select 1 from public.product_barcodes pb where lower(pb.barcode) = lower(v_barcode)) then
      raise exception 'That barcode is already registered or retired.' using errcode = '23505';
    end if;

    update public.product_barcodes
    set is_active = false, retired_at = now()
    where product_id = p_product_id and is_active;

    insert into public.product_barcodes (product_id, barcode, is_active, created_by)
    values (p_product_id, v_barcode, true, (select auth.uid()));
  else
    v_barcode := v_old.barcode;
  end if;

  update public.products p
  set name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      category_id = p_category_id,
      package_size = p_package_size,
      package_unit = trim(p_package_unit),
      stock_unit = trim(p_stock_unit),
      selling_price = p_selling_price,
      minimum_stock = p_minimum_stock,
      expiry_tracking = p_expiry_tracking,
      barcode = v_barcode
  where p.id = p_product_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()), 'product.updated', 'product', p_product_id::text,
    jsonb_build_object('old_barcode', v_old.barcode, 'new_barcode', v_barcode)
  );

  return query
  select p.id, p.product_code, p.barcode, p.name, p.description, p.category_id,
    p.package_size, p.package_unit, p.stock_unit, p.selling_price,
    p.minimum_stock, p.expiry_tracking
  from public.products p where p.id = p_product_id;
end;
$$;

create function public.archive_inventory_product(p_product_id uuid)
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

  update public.products
  set archived_at = now()
  where id = p_product_id and archived_at is null
  returning product_code into v_code;

  if v_code is null then
    raise exception 'Active product not found.' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'product.archived', 'product', p_product_id::text, jsonb_build_object('product_code', v_code));
end;
$$;

create function public.receive_inventory_stock(
  p_product_id uuid,
  p_quantity integer,
  p_unit_cost numeric,
  p_batch_number text default null,
  p_manufactured_at date default null,
  p_expires_at date default null,
  p_delivery_reference text default null,
  p_notes text default null
)
returns table (
  receiving_number bigint,
  batch_number text,
  previous_quantity bigint,
  resulting_quantity bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_receiving_number bigint;
  v_batch_number text;
  v_previous_quantity bigint;
  v_average_cost numeric(12,4);
  v_new_average numeric(12,4);
begin
  if not public.has_role(array[
    'administrator'::public.app_role,
    'manager'::public.app_role,
    'inventory_staff'::public.app_role
  ]) then
    raise exception 'Your account is not allowed to receive stock.' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then
    raise exception 'Quantity must be between 1 and 1,000,000.' using errcode = '22023';
  end if;
  if p_unit_cost is null or p_unit_cost <= 0 or p_unit_cost > 100000000 then
    raise exception 'Purchase price must be greater than zero.' using errcode = '22023';
  end if;

  select * into v_product
  from public.products
  where products.id = p_product_id
  for update;

  if v_product.id is null or v_product.archived_at is not null then
    raise exception 'Active product not found.' using errcode = 'P0002';
  end if;
  if v_product.expiry_tracking = 'required' and p_expires_at is null then
    raise exception 'An expiry date is required for this product.' using errcode = '23514';
  end if;
  if v_product.expiry_tracking = 'not_applicable' and p_expires_at is not null then
    raise exception 'This product does not track expiry dates.' using errcode = '23514';
  end if;
  if p_expires_at is not null and p_expires_at < (now() at time zone 'Asia/Manila')::date then
    raise exception 'Expired stock cannot be received.' using errcode = '22023';
  end if;
  if p_manufactured_at is not null and p_manufactured_at > coalesce(p_expires_at, (now() at time zone 'Asia/Manila')::date) then
    raise exception 'Manufactured date cannot be after the expiry or receiving date.' using errcode = '22023';
  end if;

  perform 1 from public.inventory_batches b where b.product_id = p_product_id for update;

  select coalesce(sum(b.quantity_remaining), 0)::bigint
  into v_previous_quantity
  from public.inventory_batches b
  where b.product_id = p_product_id;

  select coalesce(pc.average_cost, 0)
  into v_average_cost
  from public.product_costs pc
  where pc.product_id = p_product_id;
  v_average_cost := coalesce(v_average_cost, 0);

  v_receiving_number := nextval('public.receiving_number_seq');
  v_batch_number := nullif(trim(coalesce(p_batch_number, '')), '');
  if v_batch_number is null then
    v_batch_number := 'RCV-' || to_char(now() at time zone 'Asia/Manila', 'YYYYMMDD') || '-' || lpad(v_receiving_number::text, 4, '0');
  end if;

  insert into public.inventory_batches (
    product_id, batch_number, receiving_number, quantity_received, quantity_remaining,
    unit_cost, manufactured_at, expires_at, delivery_reference, notes, created_by
  ) values (
    p_product_id, v_batch_number, v_receiving_number, p_quantity, p_quantity,
    round(p_unit_cost, 4), p_manufactured_at, p_expires_at,
    nullif(trim(coalesce(p_delivery_reference, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''), (select auth.uid())
  );

  v_new_average := round(
    ((v_previous_quantity * v_average_cost) + (p_quantity * p_unit_cost)) /
    (v_previous_quantity + p_quantity),
    4
  );

  insert into public.product_costs (product_id, latest_purchase_price, average_cost)
  values (p_product_id, round(p_unit_cost, 2), v_new_average)
  on conflict (product_id) do update
  set latest_purchase_price = excluded.latest_purchase_price,
      average_cost = excluded.average_cost;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()), 'stock.received', 'product', p_product_id::text,
    jsonb_build_object(
      'receiving_number', v_receiving_number,
      'batch_number', v_batch_number,
      'quantity', p_quantity,
      'unit_cost', round(p_unit_cost, 4),
      'previous_quantity', v_previous_quantity,
      'resulting_quantity', v_previous_quantity + p_quantity
    )
  );

  return query select v_receiving_number, v_batch_number, v_previous_quantity, v_previous_quantity + p_quantity;
end;
$$;

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
  updated_at timestamptz
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
    p.category_id,
    c.name as category,
    p.package_size,
    p.package_unit,
    p.stock_unit,
    p.selling_price,
    p.minimum_stock,
    p.expiry_tracking,
    coalesce(sum(b.quantity_remaining), 0)::bigint as quantity_on_hand,
    greatest(p.updated_at, max(b.received_at)) as updated_at
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.inventory_batches b on b.product_id = p.id
  where
    public.current_app_role() is not null
    and p.archived_at is null
    and c.archived_at is null
  group by p.id, c.name
  order by p.name;
$$;

revoke execute on function public.create_inventory_category(text, text, public.expiry_tracking) from public, anon;
revoke execute on function public.update_inventory_category(uuid, text, text, public.expiry_tracking) from public, anon;
revoke execute on function public.create_inventory_product(text, text, uuid, numeric, text, text, numeric, integer, public.expiry_tracking, text, boolean) from public, anon;
revoke execute on function public.update_inventory_product(uuid, text, text, uuid, numeric, text, text, numeric, integer, public.expiry_tracking, text, boolean) from public, anon;
revoke execute on function public.archive_inventory_product(uuid) from public, anon;
revoke execute on function public.receive_inventory_stock(uuid, integer, numeric, text, date, date, text, text) from public, anon;
revoke execute on function public.get_inventory_catalog() from public, anon;

grant execute on function public.create_inventory_category(text, text, public.expiry_tracking) to authenticated;
grant execute on function public.update_inventory_category(uuid, text, text, public.expiry_tracking) to authenticated;
grant execute on function public.create_inventory_product(text, text, uuid, numeric, text, text, numeric, integer, public.expiry_tracking, text, boolean) to authenticated;
grant execute on function public.update_inventory_product(uuid, text, text, uuid, numeric, text, text, numeric, integer, public.expiry_tracking, text, boolean) to authenticated;
grant execute on function public.archive_inventory_product(uuid) to authenticated;
grant execute on function public.receive_inventory_stock(uuid, integer, numeric, text, date, date, text, text) to authenticated;
grant execute on function public.get_inventory_catalog() to authenticated;
