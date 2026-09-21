drop function if exists public.archive_inventory_product(uuid, text);
drop function if exists public.archive_inventory_product(uuid, text, boolean);

create function public.archive_inventory_product(
  p_product_id uuid,
  p_reason text,
  p_confirm_stock_removal boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_quantity bigint;
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 2 or char_length(trim(p_reason)) > 160 then
    raise exception 'Enter an archive reason between 2 and 160 characters.' using errcode = '22023';
  end if;

  select p.product_code into v_code
  from public.products p
  where p.id = p_product_id and p.archived_at is null
  for update;

  if v_code is null then
    raise exception 'Active product not found.' using errcode = 'P0002';
  end if;

  perform b.id
  from public.inventory_batches b
  where b.product_id = p_product_id
  for update;

  select coalesce(sum(b.quantity_remaining), 0)::bigint into v_quantity
  from public.inventory_batches b
  where b.product_id = p_product_id;

  if v_quantity > 0 and not coalesce(p_confirm_stock_removal, false) then
    raise exception 'Confirm removal of the remaining stock before archiving this product.' using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.sales_returns r
    join public.sales_return_items ri on ri.return_id = r.id
    join public.sale_items si on si.id = ri.sale_item_id
    where si.product_id = p_product_id
      and r.status = 'pending_review'
      and ri.disposition = 'restock'
  ) then
    raise exception 'Review this product''s pending resellable returns before archiving it.' using errcode = '55000';
  end if;

  if v_quantity > 0 then
    insert into public.inventory_adjustments (
      product_id,
      inventory_batch_id,
      type,
      quantity,
      previous_quantity,
      resulting_quantity,
      reason,
      notes,
      performed_by
    )
    select
      p_product_id,
      b.id,
      'correction'::public.adjustment_type,
      b.quantity_remaining,
      b.quantity_remaining,
      0,
      left('Archive write-off: ' || trim(p_reason), 160),
      'Remaining stock was removed during confirmed product archiving.',
      (select auth.uid())
    from public.inventory_batches b
    where b.product_id = p_product_id and b.quantity_remaining > 0;

    update public.inventory_batches
    set quantity_remaining = 0
    where product_id = p_product_id and quantity_remaining > 0;
  end if;

  update public.products
  set archived_at = now(), archived_by = (select auth.uid()), archive_reason = trim(p_reason)
  where id = p_product_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    'product.archived',
    'product',
    p_product_id::text,
    jsonb_build_object(
      'product_code', v_code,
      'reason', trim(p_reason),
      'quantity_written_off', v_quantity
    )
  );
end;
$$;

revoke execute on function public.archive_inventory_product(uuid, text, boolean) from public, anon;
grant execute on function public.archive_inventory_product(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
