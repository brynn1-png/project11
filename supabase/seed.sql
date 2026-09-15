-- Development seed data. Do not run this file against a production database.
-- Fixed identifiers and conflict handlers make local resets repeatable.

insert into public.categories (id, name, description, default_expiry_tracking)
values
  ('10000000-0000-4000-8000-000000000001', 'Beverages', 'Packaged drinks and powdered beverages.', 'required'),
  ('10000000-0000-4000-8000-000000000002', 'Canned Goods', 'Shelf-stable food sold in cans.', 'required'),
  ('10000000-0000-4000-8000-000000000003', 'Instant Noodles', 'Packaged instant noodle products.', 'required'),
  ('10000000-0000-4000-8000-000000000004', 'Household Supplies', 'Non-food household products.', 'not_applicable'),
  ('10000000-0000-4000-8000-000000000005', 'Rice', 'Packaged rice products.', 'required'),
  ('10000000-0000-4000-8000-000000000006', 'Repacked Goods', 'Store-packed grocery staples.', 'required'),
  ('10000000-0000-4000-8000-000000000007', 'Condiments', 'Sauces, seasonings, and cooking ingredients.', 'required'),
  ('10000000-0000-4000-8000-000000000008', 'Snacks', 'Packaged chips, crackers, and snack foods.', 'required')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  default_expiry_tracking = excluded.default_expiry_tracking,
  archived_at = null;

insert into public.products (
  id, product_code, barcode, name, category_id, package_size, package_unit,
  stock_unit, selling_price, minimum_stock, expiry_tracking
)
values
  ('20000000-0000-4000-8000-000000000001', 'PRD-1001', '4807770270142', 'Lucky Me Pancit Canton Original 60g', '10000000-0000-4000-8000-000000000003', 60, 'g', 'pack', 16.50, 24, 'required'),
  ('20000000-0000-4000-8000-000000000002', 'PRD-1002', '748485801021', 'Argentina Corned Beef 175g', '10000000-0000-4000-8000-000000000002', 175, 'g', 'can', 46.75, 18, 'required'),
  ('20000000-0000-4000-8000-000000000003', 'PRD-1003', '4800361418336', 'Bear Brand Powdered Milk 320g', '10000000-0000-4000-8000-000000000001', 320, 'g', 'pack', 126.50, 10, 'required'),
  ('20000000-0000-4000-8000-000000000004', 'PRD-1004', '2000000001058', 'White Sugar Repacked 1kg', '10000000-0000-4000-8000-000000000006', 1, 'kg', 'bag', 78.00, 12, 'required'),
  ('20000000-0000-4000-8000-000000000005', 'PRD-1005', '4902430861398', 'Safeguard Pure White 135g', '10000000-0000-4000-8000-000000000004', 135, 'g', 'bar', 59.75, 12, 'not_applicable'),
  ('20000000-0000-4000-8000-000000000006', 'PRD-1006', '4801668501028', 'Datu Puti Vinegar 1L', '10000000-0000-4000-8000-000000000007', 1, 'L', 'bottle', 42.00, 15, 'required'),
  ('20000000-0000-4000-8000-000000000007', 'PRD-1007', '2000000001065', 'Sinandomeng Rice 1kg', '10000000-0000-4000-8000-000000000005', 1, 'kg', 'bag', 58.00, 40, 'required'),
  ('20000000-0000-4000-8000-000000000008', 'PRD-1008', '4800016023588', 'Piattos Cheese 85g', '10000000-0000-4000-8000-000000000008', 85, 'g', 'pack', 38.50, 20, 'required'),
  ('20000000-0000-4000-8000-000000000009', 'PRD-1009', '4800575120063', 'Alaska Evaporated Milk 370ml', '10000000-0000-4000-8000-000000000002', 370, 'ml', 'can', 39.25, 12, 'required'),
  ('20000000-0000-4000-8000-000000000010', 'PRD-1010', '5449000054227', 'Coca-Cola Original 1.5L', '10000000-0000-4000-8000-000000000001', 1.5, 'L', 'bottle', 76.00, 18, 'required')
on conflict (id) do update set
  product_code = excluded.product_code,
  barcode = excluded.barcode,
  name = excluded.name,
  category_id = excluded.category_id,
  package_size = excluded.package_size,
  package_unit = excluded.package_unit,
  stock_unit = excluded.stock_unit,
  selling_price = excluded.selling_price,
  minimum_stock = excluded.minimum_stock,
  expiry_tracking = excluded.expiry_tracking,
  archived_at = null;

insert into public.product_costs (product_id, latest_purchase_price, average_cost)
values
  ('20000000-0000-4000-8000-000000000001', 12.25, 12.25),
  ('20000000-0000-4000-8000-000000000002', 38.50, 38.50),
  ('20000000-0000-4000-8000-000000000003', 105.00, 105.00),
  ('20000000-0000-4000-8000-000000000004', 64.00, 64.00),
  ('20000000-0000-4000-8000-000000000005', 48.00, 48.00),
  ('20000000-0000-4000-8000-000000000006', 34.00, 34.00),
  ('20000000-0000-4000-8000-000000000007', 49.50, 49.50),
  ('20000000-0000-4000-8000-000000000008', 30.25, 30.25),
  ('20000000-0000-4000-8000-000000000009', 31.00, 31.00),
  ('20000000-0000-4000-8000-000000000010', 61.50, 61.50)
on conflict (product_id) do update set
  latest_purchase_price = excluded.latest_purchase_price,
  average_cost = excluded.average_cost;

insert into public.inventory_batches (
  id, product_id, batch_number, quantity_received, quantity_remaining, unit_cost, expires_at, received_at
)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'SEED-NDL-01', 84, 84, 12.25, current_date + 180, now() - interval '2 days'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'SEED-CAN-01', 42, 42, 38.50, current_date + 360, now() - interval '2 days'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'SEED-MILK-01', 10, 10, 105.00, current_date + 90, now() - interval '3 days'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'SEED-SUGAR-01', 36, 36, 64.00, current_date + 150, now() - interval '2 days'),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'SEED-HOUSE-01', 31, 31, 48.00, null, now() - interval '4 days'),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', 'SEED-COND-01', 12, 12, 34.00, current_date + 240, now() - interval '3 days'),
  ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000007', 'SEED-RICE-01', 128, 128, 49.50, current_date + 120, now() - interval '2 days'),
  ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000008', 'SEED-SNACK-01', 18, 18, 30.25, current_date + 75, now() - interval '3 days'),
  ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000009', 'SEED-EVAP-01', 9, 9, 31.00, current_date + 25, now() - interval '1 day'),
  ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000010', 'SEED-SODA-01', 27, 27, 61.50, current_date + 120, now() - interval '1 day')
on conflict (product_id, batch_number) where batch_number is not null do update set
  quantity_received = excluded.quantity_received,
  quantity_remaining = excluded.quantity_remaining,
  unit_cost = excluded.unit_cost,
  expires_at = excluded.expires_at,
  received_at = excluded.received_at;
