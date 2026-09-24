create or replace function public.get_business_day_sales(p_business_day_id uuid)
returns table (
  sale_number bigint,
  sold_at timestamptz,
  cashier_name text,
  total_amount numeric,
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
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', p.name,
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
  where s.business_day_id = p_business_day_id
    and s.status = 'completed'
    and public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role])
  order by s.sold_at, s.sale_number;
$$;

revoke execute on function public.get_business_day_sales(uuid) from public, anon;
grant execute on function public.get_business_day_sales(uuid) to authenticated;
