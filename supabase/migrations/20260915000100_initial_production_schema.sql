create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('administrator', 'manager', 'inventory_staff', 'cashier');
create type public.account_status as enum ('active', 'inactive');
create type public.expiry_tracking as enum ('required', 'not_applicable');
create type public.sale_status as enum ('completed', 'voided');
create type public.adjustment_type as enum ('damage', 'expiration', 'internal_use', 'correction', 'return');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  role public.app_role not null default 'cashier',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 500),
  default_expiry_tracking public.expiry_tracking not null default 'not_applicable',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint categories_name_unique unique nulls not distinct (name, archived_at)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique check (product_code ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
  barcode text not null unique check (char_length(barcode) between 4 and 64),
  name text not null check (char_length(name) between 2 and 160),
  description text check (description is null or char_length(description) <= 1000),
  category_id uuid not null references public.categories (id),
  package_size numeric(10, 3) not null check (package_size > 0),
  package_unit text not null check (char_length(package_unit) between 1 and 24),
  stock_unit text not null check (char_length(stock_unit) between 1 and 24),
  selling_price numeric(12, 2) not null check (selling_price >= 0),
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  expiry_tracking public.expiry_tracking not null default 'not_applicable',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  latest_purchase_price numeric(12, 2) not null default 0 check (latest_purchase_price >= 0),
  average_cost numeric(12, 4) not null default 0 check (average_cost >= 0),
  updated_at timestamptz not null default now()
);

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  batch_number text check (batch_number is null or char_length(batch_number) <= 80),
  quantity_received integer not null check (quantity_received > 0),
  quantity_remaining integer not null check (quantity_remaining >= 0 and quantity_remaining <= quantity_received),
  unit_cost numeric(12, 4) not null check (unit_cost >= 0),
  manufactured_at date,
  expires_at date,
  received_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_batches_date_order check (
    manufactured_at is null or expires_at is null or manufactured_at <= expires_at
  )
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number bigint generated always as identity unique,
  recorded_by uuid not null references public.profiles (id),
  sold_at timestamptz not null default now(),
  notes text check (notes is null or char_length(notes) <= 500),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  status public.sale_status not null default 'completed',
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete restrict,
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored
);

create table public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items (id) on delete restrict,
  unit_cost numeric(12, 4) not null check (unit_cost >= 0)
);

create table public.batch_allocations (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items (id) on delete restrict,
  inventory_batch_id uuid not null references public.inventory_batches (id),
  quantity integer not null check (quantity > 0),
  unique (sale_item_id, inventory_batch_id)
);

create table public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  inventory_batch_id uuid references public.inventory_batches (id),
  type public.adjustment_type not null,
  quantity integer not null check (quantity > 0),
  previous_quantity integer not null check (previous_quantity >= 0),
  resulting_quantity integer not null check (resulting_quantity >= 0),
  reason text not null check (char_length(reason) between 2 and 160),
  notes text check (notes is null or char_length(notes) <= 500),
  performed_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) between 2 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id) where archived_at is null;
create index products_name_search_idx on public.products using gin (to_tsvector('simple', name));
create index inventory_batches_product_fefo_idx on public.inventory_batches (product_id, expires_at, received_at) where quantity_remaining > 0;
create index sales_recorded_by_sold_at_idx on public.sales (recorded_by, sold_at desc);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index inventory_adjustments_product_created_idx on public.inventory_adjustments (product_id, created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger product_costs_set_updated_at before update on public.product_costs
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid()) and status = 'active'
$$;

create function public.has_role(allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = any(allowed_roles), false)
$$;

create function public.validate_batch_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  policy public.expiry_tracking;
begin
  select expiry_tracking into policy from public.products where id = new.product_id;
  if policy = 'required' and new.expires_at is null then
    raise exception 'An expiry date is required for this product.' using errcode = '23514';
  end if;
  if policy = 'not_applicable' and new.expires_at is not null then
    raise exception 'This product does not track expiry dates.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger inventory_batches_validate_expiry
before insert or update of product_id, expires_at on public.inventory_batches
for each row execute function public.validate_batch_expiry();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_item_costs enable row level security;
alter table public.batch_allocations enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.categories, public.products to authenticated;
grant insert, update on public.categories, public.products to authenticated;
grant select on public.product_costs, public.inventory_batches to authenticated;
grant select on public.sales, public.sale_items, public.sale_item_costs, public.batch_allocations, public.inventory_adjustments to authenticated;
grant update on public.profiles to authenticated;
grant select on public.audit_logs to authenticated;

create policy profiles_select on public.profiles for select to authenticated
using ((select auth.uid()) = id or public.has_role(array['administrator'::public.app_role]));
create policy profiles_update on public.profiles for update to authenticated
using (public.has_role(array['administrator'::public.app_role]))
with check (public.has_role(array['administrator'::public.app_role]));

create policy categories_select on public.categories for select to authenticated
using (public.current_app_role() is not null);
create policy categories_insert on public.categories for insert to authenticated
with check (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]));
create policy categories_update on public.categories for update to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]));

create policy products_select on public.products for select to authenticated
using (public.current_app_role() is not null);
create policy products_insert on public.products for insert to authenticated
with check (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role, 'inventory_staff'::public.app_role]));
create policy products_update on public.products for update to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role, 'inventory_staff'::public.app_role]))
with check (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role, 'inventory_staff'::public.app_role]));

create policy product_costs_select on public.product_costs for select to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]));
create policy product_costs_insert on public.product_costs for insert to authenticated
with check (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]));
create policy product_costs_update on public.product_costs for update to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]));

create policy inventory_batches_select on public.inventory_batches for select to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role, 'inventory_staff'::public.app_role]));
create policy inventory_batches_insert on public.inventory_batches for insert to authenticated
with check (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role, 'inventory_staff'::public.app_role]));
create policy inventory_batches_update on public.inventory_batches for update to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role, 'inventory_staff'::public.app_role]))
with check (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role, 'inventory_staff'::public.app_role]));

create policy sales_select on public.sales for select to authenticated
using (
  recorded_by = (select auth.uid())
  or public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role, 'inventory_staff'::public.app_role])
);
create policy sales_insert on public.sales for insert to authenticated
with check (recorded_by = (select auth.uid()) and public.current_app_role() is not null);
create policy sales_update on public.sales for update to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]));

create policy sale_items_select on public.sale_items for select to authenticated
using (exists (select 1 from public.sales where sales.id = sale_items.sale_id));
create policy sale_items_insert on public.sale_items for insert to authenticated
with check (exists (select 1 from public.sales where sales.id = sale_items.sale_id and sales.recorded_by = (select auth.uid())));

create policy sale_item_costs_select on public.sale_item_costs for select to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]));
create policy sale_item_costs_insert on public.sale_item_costs for insert to authenticated
with check (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]));

create policy batch_allocations_select on public.batch_allocations for select to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role, 'inventory_staff'::public.app_role]));
create policy batch_allocations_insert on public.batch_allocations for insert to authenticated
with check (public.current_app_role() is not null);

create policy inventory_adjustments_select on public.inventory_adjustments for select to authenticated
using (public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role, 'inventory_staff'::public.app_role]));
create policy inventory_adjustments_insert on public.inventory_adjustments for insert to authenticated
with check (
  performed_by = (select auth.uid())
  and public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role])
);

create policy audit_logs_select on public.audit_logs for select to authenticated
using (public.has_role(array['administrator'::public.app_role]));

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.validate_batch_expiry() from public, anon, authenticated;
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.has_role(public.app_role[]) from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
