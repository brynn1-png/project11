alter table public.sales
  add column if not exists payment_method text,
  add column if not exists cash_received numeric(14, 2),
  add column if not exists change_due numeric(14, 2);

alter table public.sales
  add constraint sales_payment_method_check check (payment_method is null or payment_method = 'cash'),
  add constraint sales_cash_received_check check (cash_received is null or cash_received >= total_amount),
  add constraint sales_change_due_check check (change_due is null or change_due >= 0),
  add constraint sales_payment_completeness_check check (
    (payment_method is null and cash_received is null and change_due is null)
    or (payment_method is not null and cash_received is not null and change_due is not null)
  );

create function public.record_sale(
  p_idempotency_key uuid,
  p_items jsonb,
  p_notes text,
  p_cash_received numeric
)
returns table (
  sale_id uuid,
  sale_number bigint,
  total_amount numeric,
  payment_method text,
  cash_received numeric,
  change_due numeric,
  sold_at timestamptz,
  cashier_name text,
  notes text,
  items jsonb
)
language plpgsql
security definer
set search_path = ''
set timezone = 'Asia/Manila'
as $$
declare
  v_sale record;
  v_payment_method text;
  v_cash_received numeric(14, 2);
  v_change_due numeric(14, 2);
  v_sold_at timestamptz;
  v_cashier_name text;
  v_notes text;
  v_items jsonb;
begin
  if p_cash_received is null or p_cash_received <= 0 or p_cash_received > 100000000 then
    raise exception 'Enter a valid cash amount.' using errcode = '22023';
  end if;
  v_cash_received := round(p_cash_received, 2);

  select * into strict v_sale
  from public.record_sale(p_idempotency_key, p_items, p_notes);

  select s.payment_method, s.cash_received, s.change_due
  into v_payment_method, v_cash_received, v_change_due
  from public.sales s
  where s.id = v_sale.sale_id
  for update;

  if v_payment_method is null then
    v_cash_received := round(p_cash_received, 2);
    if v_cash_received < v_sale.total_amount then
      raise exception 'Cash received is less than the sale total.' using errcode = '22023';
    end if;
    v_change_due := round(v_cash_received - v_sale.total_amount, 2);
    v_payment_method := 'cash';

    update public.sales
    set payment_method = v_payment_method,
        cash_received = v_cash_received,
        change_due = v_change_due
    where id = v_sale.sale_id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), 'sale.payment_recorded', 'sale', v_sale.sale_id::text,
      jsonb_build_object('payment_method', v_payment_method, 'cash_received', v_cash_received, 'change_due', v_change_due));
  end if;

  select
    s.sold_at,
    profile.full_name,
    s.notes,
    coalesce(jsonb_agg(jsonb_build_object(
      'product_name', product.name,
      'barcode', product.barcode,
      'quantity', item.quantity,
      'unit_price', item.unit_price,
      'line_total', item.line_total
    ) order by product.name), '[]'::jsonb)
  into v_sold_at, v_cashier_name, v_notes, v_items
  from public.sales s
  join public.profiles profile on profile.id = s.recorded_by
  join public.sale_items item on item.sale_id = s.id
  join public.products product on product.id = item.product_id
  where s.id = v_sale.sale_id
  group by s.id, profile.full_name;

  return query select
    v_sale.sale_id::uuid,
    v_sale.sale_number::bigint,
    v_sale.total_amount::numeric,
    v_payment_method,
    v_cash_received,
    v_change_due,
    v_sold_at,
    v_cashier_name,
    v_notes,
    v_items;
end;
$$;

revoke execute on function public.record_sale(uuid, jsonb, text) from authenticated;
revoke execute on function public.record_sale(uuid, jsonb, text, numeric) from public, anon;
grant execute on function public.record_sale(uuid, jsonb, text, numeric) to authenticated;

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
    profile.full_name,
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
  join public.profiles profile on profile.id = s.recorded_by
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
