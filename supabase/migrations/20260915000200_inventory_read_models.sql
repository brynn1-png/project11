create unique index if not exists inventory_batches_product_batch_number_uidx
on public.inventory_batches (product_id, batch_number)
where batch_number is not null;

update public.inventory_batches
set batch_number = replace(batch_number, 'DEMO-', 'SEED-')
where batch_number like 'DEMO-%';

create or replace function public.get_inventory_catalog()
returns table (
  id uuid,
  product_code text,
  barcode text,
  name text,
  category text,
  stock_unit text,
  selling_price numeric,
  minimum_stock integer,
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
    c.name as category,
    p.stock_unit,
    p.selling_price,
    p.minimum_stock,
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

create or replace function public.get_inventory_activity(activity_limit integer default 100)
returns table (
  activity_id text,
  product_id uuid,
  product_code text,
  product_name text,
  barcode text,
  activity_type text,
  quantity integer,
  actor_name text,
  occurred_at timestamptz,
  notes text
)
language sql
stable
security definer
set search_path = ''
as $$
  select activity.*
  from (
    select
      'RCV-' || b.id::text as activity_id,
      p.id as product_id,
      p.product_code,
      p.name as product_name,
      p.barcode,
      'Stock In'::text as activity_type,
      b.quantity_received as quantity,
      coalesce(profile.full_name, 'System') as actor_name,
      b.received_at as occurred_at,
      case when b.batch_number is null then 'Inventory received' else 'Batch ' || b.batch_number end as notes
    from public.inventory_batches b
    join public.products p on p.id = b.product_id
    left join public.profiles profile on profile.id = b.created_by
    where public.has_role(array[
      'administrator'::public.app_role,
      'manager'::public.app_role,
      'inventory_staff'::public.app_role
    ])

    union all

    select
      'SAL-' || item.id::text,
      p.id,
      p.product_code,
      p.name,
      p.barcode,
      'Stock Out'::text,
      item.quantity,
      profile.full_name,
      sale.sold_at,
      sale.notes
    from public.sale_items item
    join public.sales sale on sale.id = item.sale_id
    join public.products p on p.id = item.product_id
    join public.profiles profile on profile.id = sale.recorded_by
    where
      sale.status = 'completed'
      and (
        sale.recorded_by = (select auth.uid())
        or public.has_role(array[
          'administrator'::public.app_role,
          'manager'::public.app_role,
          'inventory_staff'::public.app_role
        ])
      )
  ) activity
  order by activity.occurred_at desc
  limit least(greatest(activity_limit, 1), 500);
$$;

revoke execute on function public.get_inventory_catalog() from public, anon;
revoke execute on function public.get_inventory_activity(integer) from public, anon;
grant execute on function public.get_inventory_catalog() to authenticated;
grant execute on function public.get_inventory_activity(integer) to authenticated;
