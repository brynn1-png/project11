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
  if exists (select 1 from public.sale_items si where si.product_id = p_product_id)
    or exists (
      select 1
      from public.batch_allocations ba
      join public.inventory_batches b on b.id = ba.inventory_batch_id
      where b.product_id = p_product_id
    )
  then
    raise exception 'This product is used in completed sales and cannot be permanently deleted. Keep it archived to preserve receipt history.' using errcode = '55000';
  end if;

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
      'deleted_batch_count', v_batch_count,
      'deleted_adjustment_count', v_adjustment_count
    )
  );

  delete from public.inventory_adjustments
  where product_id = p_product_id;

  delete from public.inventory_batches
  where product_id = p_product_id;

  delete from public.products where id = p_product_id;
end;
$$;

revoke execute on function public.delete_archived_inventory_product(uuid, text) from public, anon;
grant execute on function public.delete_archived_inventory_product(uuid, text) to authenticated;

notify pgrst, 'reload schema';
