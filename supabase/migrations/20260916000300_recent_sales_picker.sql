create or replace function public.get_recent_sales(p_limit integer default 50)
returns table (
  sale_number bigint,
  sold_at timestamptz,
  cashier_name text,
  item_count bigint,
  total_amount numeric,
  returnable_quantity bigint,
  has_pending_return boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.sale_number,
    s.sold_at,
    profile.full_name as cashier_name,
    coalesce(sum(item.quantity), 0)::bigint as item_count,
    s.total_amount,
    greatest(
      coalesce(sum(item.quantity), 0)::bigint - coalesce(max(returned.returned_quantity), 0)::bigint,
      0
    )::bigint as returnable_quantity,
    coalesce(max(returned.has_pending_return::integer), 0) > 0 as has_pending_return
  from public.sales s
  join public.profiles profile on profile.id = s.recorded_by
  join public.sale_items item on item.sale_id = s.id
  left join lateral (
    select
      coalesce(sum(return_item.quantity) filter (where sale_return.status <> 'rejected'), 0)::bigint as returned_quantity,
      coalesce(bool_or(sale_return.status = 'pending_review'), false) as has_pending_return
    from public.sales_return_items return_item
    join public.sales_returns sale_return on sale_return.id = return_item.return_id
    where return_item.sale_item_id in (
      select sale_item.id from public.sale_items sale_item where sale_item.sale_id = s.id
    )
  ) returned on true
  where
    s.status = 'completed'
    and public.current_app_role() is not null
    and (
      public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role])
      or s.recorded_by = (select auth.uid())
    )
  group by s.id, profile.full_name
  order by s.sold_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke execute on function public.get_recent_sales(integer) from public, anon;
grant execute on function public.get_recent_sales(integer) to authenticated;
