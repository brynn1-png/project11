drop function if exists public.get_inventory_activity(integer);

create function public.get_inventory_activity(activity_limit integer default 100)
returns table (
  activity_id text,
  activity_group_id text,
  reference_number text,
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
      'RCV-' || b.id::text as activity_group_id,
      case
        when b.receiving_number is not null then 'Receiving #' || b.receiving_number::text
        else 'Stock receipt'
      end as reference_number,
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
      'SAL-' || sale.id::text,
      'Sale #' || sale.sale_number::text,
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

revoke execute on function public.get_inventory_activity(integer) from public, anon;
grant execute on function public.get_inventory_activity(integer) to authenticated;
