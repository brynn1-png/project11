create function public.get_sales_report(p_start_date date, p_end_date date)
returns table (
  sale_number bigint,
  sold_at timestamptz,
  cashier_name text,
  product_code text,
  product_name text,
  barcode text,
  category_name text,
  quantity integer,
  returned_quantity bigint,
  unit_price numeric,
  line_total numeric,
  sale_total numeric,
  cash_received numeric,
  change_due numeric,
  sale_status public.sale_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sale.sale_number,
    sale.sold_at,
    profile.full_name,
    product.product_code,
    product.name,
    product.barcode,
    category.name,
    item.quantity,
    coalesce((
      select sum(return_item.quantity)
      from public.sales_return_items return_item
      join public.sales_returns sale_return on sale_return.id = return_item.return_id
      where return_item.sale_item_id = item.id
        and sale_return.status <> 'rejected'
    ), 0)::bigint,
    item.unit_price,
    item.line_total,
    sale.total_amount,
    sale.cash_received,
    sale.change_due,
    sale.status
  from public.sales sale
  join public.profiles profile on profile.id = sale.recorded_by
  join public.sale_items item on item.sale_id = sale.id
  join public.products product on product.id = item.product_id
  join public.categories category on category.id = product.category_id
  where public.current_app_role() is not null
    and p_end_date >= p_start_date
    and p_end_date - p_start_date <= 30
    and (sale.sold_at at time zone 'Asia/Manila')::date between p_start_date and p_end_date
    and (
      sale.recorded_by = (select auth.uid())
      or public.has_role(array[
        'administrator'::public.app_role,
        'manager'::public.app_role
      ])
    )
  order by sale.sold_at desc, sale.sale_number desc, product.name;
$$;

create function public.get_stock_movement_report(p_start_date date, p_end_date date)
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
      and public.has_role(array[
        'administrator'::public.app_role,
        'manager'::public.app_role,
        'inventory_staff'::public.app_role
      ])

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
      and (
        sale.recorded_by = (select auth.uid())
        or public.has_role(array[
          'administrator'::public.app_role,
          'manager'::public.app_role,
          'inventory_staff'::public.app_role
        ])
      )

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
      and public.has_role(array[
        'administrator'::public.app_role,
        'manager'::public.app_role,
        'inventory_staff'::public.app_role
      ])
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
  where p_end_date >= p_start_date
    and p_end_date - p_start_date <= 30
  order by movement.occurred_at desc, movement.movement_id;
$$;

create function public.get_expiring_inventory_report(p_as_of date, p_days_ahead integer default 30)
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
  where public.current_app_role() is not null
    and product.archived_at is null
    and batch.quantity_remaining > 0
    and batch.expires_at is not null
    and batch.expires_at <= p_as_of + least(greatest(coalesce(p_days_ahead, 30), 0), 3650)
  order by batch.expires_at, product.name, batch.received_at;
$$;

revoke execute on function public.get_sales_report(date, date) from public, anon;
revoke execute on function public.get_stock_movement_report(date, date) from public, anon;
revoke execute on function public.get_expiring_inventory_report(date, integer) from public, anon;

grant execute on function public.get_sales_report(date, date) to authenticated;
grant execute on function public.get_stock_movement_report(date, date) to authenticated;
grant execute on function public.get_expiring_inventory_report(date, integer) to authenticated;
