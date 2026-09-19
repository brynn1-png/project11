create function public.register_inventory_product_with_initial_stock(
  p_name text,
  p_description text,
  p_category_id uuid,
  p_package_size numeric,
  p_package_unit text,
  p_stock_unit text,
  p_selling_price numeric,
  p_minimum_stock integer,
  p_expiry_tracking public.expiry_tracking,
  p_barcode text,
  p_generate_barcode boolean,
  p_initial_quantity integer,
  p_initial_unit_cost numeric,
  p_initial_expires_at date
)
returns table (
  id uuid,
  product_code text,
  barcode text,
  name text,
  receiving_number bigint,
  batch_number text,
  resulting_quantity bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product record;
  v_receipt record;
begin
  select * into strict v_product
  from public.create_inventory_product(
    p_name,
    p_description,
    p_category_id,
    p_package_size,
    p_package_unit,
    p_stock_unit,
    p_selling_price,
    p_minimum_stock,
    p_expiry_tracking,
    p_barcode,
    p_generate_barcode
  );

  select * into strict v_receipt
  from public.receive_inventory_stock(
    v_product.id,
    p_initial_quantity,
    p_initial_unit_cost,
    null,
    null,
    p_initial_expires_at,
    null,
    'Opening stock recorded during product registration'
  );

  return query
  select
    v_product.id::uuid,
    v_product.product_code::text,
    v_product.barcode::text,
    v_product.name::text,
    v_receipt.receiving_number::bigint,
    v_receipt.batch_number::text,
    v_receipt.resulting_quantity::bigint;
end;
$$;

revoke execute on function public.register_inventory_product_with_initial_stock(
  text, text, uuid, numeric, text, text, numeric, integer,
  public.expiry_tracking, text, boolean, integer, numeric, date
) from public, anon;

grant execute on function public.register_inventory_product_with_initial_stock(
  text, text, uuid, numeric, text, text, numeric, integer,
  public.expiry_tracking, text, boolean, integer, numeric, date
) to authenticated;
