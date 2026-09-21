-- DEVELOPMENT / TEST DATABASE ONLY.
-- This permanently removes all inventory and transaction data while preserving
-- Supabase Auth users and public.profiles, including their assigned roles.
-- Do not run this script against a production database.

begin;

truncate table
  public.return_batch_allocations,
  public.sales_return_items,
  public.sales_returns,
  public.batch_allocations,
  public.sale_item_costs,
  public.sale_items,
  public.sales,
  public.inventory_adjustments,
  public.inventory_batches,
  public.product_barcodes,
  public.product_costs,
  public.products,
  public.categories,
  public.business_days,
  public.audit_logs
restart identity cascade;

alter sequence public.product_code_seq restart with 1;
alter sequence public.internal_barcode_seq restart with 1;
alter sequence public.receiving_number_seq restart with 1;

commit;

notify pgrst, 'reload schema';
