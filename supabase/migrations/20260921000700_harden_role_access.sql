drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;

create policy products_insert on public.products for insert to authenticated
with check (public.has_role(array[
  'administrator'::public.app_role,
  'manager'::public.app_role
]));

create policy products_update on public.products for update to authenticated
using (public.has_role(array[
  'administrator'::public.app_role,
  'manager'::public.app_role
]))
with check (public.has_role(array[
  'administrator'::public.app_role,
  'manager'::public.app_role
]));

create or replace function public.get_archived_inventory_products()
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
    product.id,
    product.product_code,
    product.barcode,
    product.name,
    product.description,
    category.name,
    product.stock_unit,
    coalesce(sum(batch.quantity_remaining), 0)::bigint,
    product.archived_at,
    product.archive_reason,
    profile.full_name
  from public.products product
  join public.categories category on category.id = product.category_id
  left join public.inventory_batches batch on batch.product_id = product.id
  left join public.profiles profile on profile.id = product.archived_by
  where product.archived_at is not null
    and public.has_role(array[
      'administrator'::public.app_role,
      'manager'::public.app_role
    ])
  group by product.id, category.name, profile.full_name
  order by product.archived_at desc;
$$;

create or replace function public.get_stock_movement_report(p_start_date date, p_end_date date)
returns table (
  movement_id text,
  reference_number text,
  product_code text,
  product_name text,
  barcode text,
  movement_type text,
  quantity_change integer,
  actor_name text,
  occurred_at timestamptz,
  notes text
)
language sql
stable
security definer
set search_path = ''
as $$
  select movement.*
  from (
    select
      'RCV-' || batch.id::text,
      case when batch.receiving_number is null then 'Stock receipt' else 'Receiving #' || batch.receiving_number::text end,
      product.product_code,
      product.name,
      product.barcode,
      'Stock received'::text,
      batch.quantity_received,
      coalesce(profile.full_name, 'System'),
      batch.received_at,
      case when batch.batch_number is null then 'Inventory received' else 'Batch ' || batch.batch_number end
    from public.inventory_batches batch
    join public.products product on product.id = batch.product_id
    left join public.profiles profile on profile.id = batch.created_by
    where (batch.received_at at time zone 'Asia/Manila')::date between p_start_date and p_end_date

    union all

    select
      'SAL-' || item.id::text,
      'Sale #' || sale.sale_number::text,
      product.product_code,
      product.name,
      product.barcode,
      'Stock sold'::text,
      -item.quantity,
      profile.full_name,
      sale.sold_at,
      sale.notes
    from public.sale_items item
    join public.sales sale on sale.id = item.sale_id
    join public.products product on product.id = item.product_id
    join public.profiles profile on profile.id = sale.recorded_by
    where sale.status = 'completed'
      and (sale.sold_at at time zone 'Asia/Manila')::date between p_start_date and p_end_date

    union all

    select
      'ADJ-' || adjustment.id::text,
      'Adjustment'::text,
      product.product_code,
      product.name,
      product.barcode,
      case
        when adjustment.resulting_quantity >= adjustment.previous_quantity then 'Stock restored'
        else 'Stock adjusted'
      end,
      adjustment.resulting_quantity - adjustment.previous_quantity,
      profile.full_name,
      adjustment.created_at,
      adjustment.reason
    from public.inventory_adjustments adjustment
    join public.products product on product.id = adjustment.product_id
    join public.profiles profile on profile.id = adjustment.performed_by
    where (adjustment.created_at at time zone 'Asia/Manila')::date between p_start_date and p_end_date
  ) movement (
    movement_id,
    reference_number,
    product_code,
    product_name,
    barcode,
    movement_type,
    quantity_change,
    actor_name,
    occurred_at,
    notes
  )
  where public.has_role(array[
      'administrator'::public.app_role,
      'manager'::public.app_role,
      'inventory_staff'::public.app_role
    ])
    and p_end_date >= p_start_date
    and p_end_date - p_start_date <= 30
  order by movement.occurred_at desc, movement.movement_id;
$$;

create or replace function public.get_expiring_inventory_report(p_as_of date, p_days_ahead integer default 30)
returns table (
  batch_id uuid,
  product_code text,
  product_name text,
  barcode text,
  category_name text,
  stock_unit text,
  batch_number text,
  quantity_remaining integer,
  expires_at date,
  received_at timestamptz,
  days_until_expiry integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    batch.id,
    product.product_code,
    product.name,
    product.barcode,
    category.name,
    product.stock_unit,
    batch.batch_number,
    batch.quantity_remaining,
    batch.expires_at,
    batch.received_at,
    (batch.expires_at - p_as_of)::integer
  from public.inventory_batches batch
  join public.products product on product.id = batch.product_id
  join public.categories category on category.id = product.category_id
  where public.has_role(array[
      'administrator'::public.app_role,
      'manager'::public.app_role,
      'inventory_staff'::public.app_role
    ])
    and product.archived_at is null
    and batch.quantity_remaining > 0
    and batch.expires_at is not null
    and batch.expires_at <= p_as_of + least(greatest(coalesce(p_days_ahead, 30), 0), 3650)
  order by batch.expires_at, product.name, batch.received_at;
$$;
