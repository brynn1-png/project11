-- Supabase projects commonly run PostgreSQL in UTC. These function-local
-- settings ensure CURRENT_DATE follows the store's Philippine calendar date
-- without changing the timezone for the rest of the database.

alter function public.record_sale(uuid, jsonb, text)
  set timezone to 'Asia/Manila';

alter function public.review_sale_return(uuid, boolean)
  set timezone to 'Asia/Manila';
