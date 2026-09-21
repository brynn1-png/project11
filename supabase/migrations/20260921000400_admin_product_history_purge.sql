alter table public.return_batch_allocations
  drop constraint if exists return_batch_allocations_return_item_id_fkey,
  add constraint return_batch_allocations_return_item_id_fkey
    foreign key (return_item_id) references public.sales_return_items (id) on delete cascade;

alter table public.sales_return_items
  drop constraint if exists sales_return_items_return_id_fkey,
  drop constraint if exists sales_return_items_sale_item_id_fkey,
  add constraint sales_return_items_return_id_fkey
    foreign key (return_id) references public.sales_returns (id) on delete cascade,
  add constraint sales_return_items_sale_item_id_fkey
    foreign key (sale_item_id) references public.sale_items (id) on delete cascade;

alter table public.sales_returns
  drop constraint if exists sales_returns_sale_id_fkey,
  add constraint sales_returns_sale_id_fkey
    foreign key (sale_id) references public.sales (id) on delete cascade;

alter table public.sale_item_costs
  drop constraint if exists sale_item_costs_sale_item_id_fkey,
  add constraint sale_item_costs_sale_item_id_fkey
    foreign key (sale_item_id) references public.sale_items (id) on delete cascade;

alter table public.batch_allocations
  drop constraint if exists batch_allocations_sale_item_id_fkey,
  add constraint batch_allocations_sale_item_id_fkey
    foreign key (sale_item_id) references public.sale_items (id) on delete cascade;

alter table public.sale_items
  drop constraint if exists sale_items_sale_id_fkey,
  add constraint sale_items_sale_id_fkey
    foreign key (sale_id) references public.sales (id) on delete cascade;

drop function if exists public.delete_archived_inventory_product(uuid, text);

create function public.delete_archived_inventory_product(
  p_product_id uuid,
  p_confirmation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_sale_ids uuid[];
  v_sale_line_count bigint;
  v_return_item_count bigint;
  v_batch_count bigint;
  v_adjustment_count bigint;
begin
  if not public.has_role(array['administrator'::public.app_role]) then
    raise exception 'Administrator access is required to permanently delete products.' using errcode = '42501';
  end if;

  select p.* into v_product
  from public.products p
  where p.id = p_product_id and p.archived_at is not null
  for update;

  if v_product.id is null then
    raise exception 'Archived product was not found.' using errcode = 'P0002';
  end if;
  if trim(coalesce(p_confirmation, '')) <> v_product.product_code then
    raise exception 'Enter the product code exactly to confirm permanent deletion.' using errcode = '22023';
  end if;

  perform si.id
  from public.sale_items si
  where si.product_id = p_product_id
  for update;

  select
    coalesce(array_agg(distinct si.sale_id), array[]::uuid[]),
    count(*)
  into v_sale_ids, v_sale_line_count
  from public.sale_items si
  where si.product_id = p_product_id;

  select count(*) into v_return_item_count
  from public.sales_return_items sri
  join public.sale_items si on si.id = sri.sale_item_id
  where si.product_id = p_product_id;

  select count(*) into v_batch_count
  from public.inventory_batches b
  where b.product_id = p_product_id;

  select count(*) into v_adjustment_count
  from public.inventory_adjustments ia
  where ia.product_id = p_product_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    'product.deleted',
    'product',
    p_product_id::text,
    jsonb_build_object(
      'product_code', v_product.product_code,
      'barcode', v_product.barcode,
      'name', v_product.name,
      'archive_reason', v_product.archive_reason,
      'deleted_sale_line_count', v_sale_line_count,
      'deleted_return_item_count', v_return_item_count,
      'deleted_batch_count', v_batch_count,
      'deleted_adjustment_count', v_adjustment_count
    )
  );

  delete from public.return_batch_allocations rba
  using public.sales_return_items sri, public.sale_items si
  where rba.return_item_id = sri.id
    and sri.sale_item_id = si.id
    and si.product_id = p_product_id;

  delete from public.sales_return_items sri
  using public.sale_items si
  where sri.sale_item_id = si.id
    and si.product_id = p_product_id;

  delete from public.sales_returns sr
  where sr.sale_id = any(v_sale_ids)
    and not exists (
      select 1 from public.sales_return_items sri where sri.return_id = sr.id
    );

  delete from public.sale_item_costs sic
  using public.sale_items si
  where sic.sale_item_id = si.id
    and si.product_id = p_product_id;

  delete from public.batch_allocations ba
  using public.sale_items si
  where ba.sale_item_id = si.id
    and si.product_id = p_product_id;

  delete from public.sale_items
  where product_id = p_product_id;

  update public.sales s
  set
    total_amount = coalesce((
      select sum(si.line_total) from public.sale_items si where si.sale_id = s.id
    ), 0),
    change_due = case
      when s.cash_received is null then null
      else greatest(s.cash_received - coalesce((
        select sum(si.line_total) from public.sale_items si where si.sale_id = s.id
      ), 0), 0)
    end
  where s.id = any(v_sale_ids);

  delete from public.sales s
  where s.id = any(v_sale_ids)
    and not exists (select 1 from public.sale_items si where si.sale_id = s.id);

  delete from public.inventory_adjustments
  where product_id = p_product_id;

  delete from public.inventory_batches
  where product_id = p_product_id;

  delete from public.products
  where id = p_product_id;
end;
$$;

revoke execute on function public.delete_archived_inventory_product(uuid, text) from public, anon;
grant execute on function public.delete_archived_inventory_product(uuid, text) to authenticated;

notify pgrst, 'reload schema';
