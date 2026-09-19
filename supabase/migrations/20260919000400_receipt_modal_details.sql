drop function public.get_sales_receipt_history(integer);

create function public.get_sales_receipt_history(p_limit integer default 100)
returns table (
  sale_number bigint,
  sold_at timestamptz,
  cashier_name text,
  total_amount numeric,
  status public.sale_status,
  item_count bigint,
  returned_quantity bigint,
  payment_method text,
  cash_received numeric,
  change_due numeric,
  notes text,
  business_date date,
  business_day_status public.business_day_status,
  submitted_by_name text,
  submitted_at timestamptz,
  verified_by_name text,
  verified_at timestamptz,
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
    cashier.full_name,
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
    s.payment_method,
    s.cash_received,
    s.change_due,
    s.notes,
    business_day.business_date,
    business_day.status,
    submitter.full_name,
    business_day.submitted_at,
    verifier.full_name,
    business_day.verified_at,
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
  join public.profiles cashier on cashier.id = s.recorded_by
  left join public.business_days business_day on business_day.id = s.business_day_id
  left join public.profiles submitter on submitter.id = business_day.submitted_by
  left join public.profiles verifier on verifier.id = business_day.verified_by
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

revoke execute on function public.get_sales_receipt_history(integer) from public, anon;
grant execute on function public.get_sales_receipt_history(integer) to authenticated;
