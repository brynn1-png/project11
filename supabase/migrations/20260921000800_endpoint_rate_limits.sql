create table public.endpoint_rate_limits (
  scope text not null,
  identifier_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  last_seen_at timestamptz not null,
  primary key (scope, identifier_hash)
);

create index endpoint_rate_limits_last_seen_idx on public.endpoint_rate_limits (last_seen_at);

alter table public.endpoint_rate_limits enable row level security;
revoke all on public.endpoint_rate_limits from public, anon, authenticated;

create function public.consume_endpoint_rate_limit(p_scope text, p_identifier text default null)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_window_seconds integer;
  v_identity text;
  v_identifier_hash text;
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  case p_scope
    when 'login' then v_limit := 5; v_window_seconds := 900;
    when 'login_ip' then v_limit := 30; v_window_seconds := 900;
    when 'sales_write' then v_limit := 30; v_window_seconds := 60;
    when 'returns_write' then v_limit := 20; v_window_seconds := 3600;
    when 'inventory_write' then v_limit := 60; v_window_seconds := 600;
    when 'destructive_write' then v_limit := 10; v_window_seconds := 3600;
    when 'verification_write' then v_limit := 60; v_window_seconds := 3600;
    when 'reports_read' then v_limit := 60; v_window_seconds := 60;
    when 'history_read' then v_limit := 60; v_window_seconds := 60;
    when 'sales_read' then v_limit := 120; v_window_seconds := 60;
    when 'inventory_read' then v_limit := 120; v_window_seconds := 60;
    else raise exception 'Unknown rate-limit scope.' using errcode = '22023';
  end case;

  if p_scope in ('login', 'login_ip') then
    v_identity := lower(trim(coalesce(p_identifier, '')));
    if char_length(v_identity) < 3 or char_length(v_identity) > 320 then
      raise exception 'Invalid rate-limit identifier.' using errcode = '22023';
    end if;
  else
    if (select auth.uid()) is null then
      raise exception 'An authenticated account is required.' using errcode = '42501';
    end if;
    v_identity := (select auth.uid())::text;
  end if;

  v_identifier_hash := encode(extensions.digest(p_scope || ':' || v_identity, 'sha256'), 'hex');

  insert into public.endpoint_rate_limits as rate_limit (
    scope,
    identifier_hash,
    window_started_at,
    request_count,
    last_seen_at
  ) values (
    p_scope,
    v_identifier_hash,
    v_now,
    1,
    v_now
  )
  on conflict (scope, identifier_hash) do update
  set
    request_count = case
      when rate_limit.window_started_at <= v_now - make_interval(secs => v_window_seconds) then 1
      else rate_limit.request_count + 1
    end,
    window_started_at = case
      when rate_limit.window_started_at <= v_now - make_interval(secs => v_window_seconds) then v_now
      else rate_limit.window_started_at
    end,
    last_seen_at = v_now
  returning rate_limit.request_count, rate_limit.window_started_at
  into v_request_count, v_window_started_at;

  if random() < 0.02 then
    delete from public.endpoint_rate_limits
    where last_seen_at < v_now - interval '7 days';
  end if;

  return query select
    v_request_count <= v_limit,
    greatest(v_limit - v_request_count, 0),
    case
      when v_request_count <= v_limit then 0
      else greatest(1, ceil(extract(epoch from (
        v_window_started_at + make_interval(secs => v_window_seconds) - v_now
      )))::integer)
    end;
end;
$$;

create function public.enforce_endpoint_rate_limit(p_scope text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result record;
begin
  if (select auth.uid()) is null then
    return;
  end if;

  select * into v_result
  from public.consume_endpoint_rate_limit(p_scope, null);

  if not v_result.allowed then
    raise exception 'RATE_LIMITED:%', v_result.retry_after_seconds using errcode = 'P0001';
  end if;
end;
$$;

create function public.rate_limit_sales_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_endpoint_rate_limit('sales_write');
  return new;
end;
$$;

create function public.rate_limit_return_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_endpoint_rate_limit('returns_write');
  return new;
end;
$$;

create function public.rate_limit_inventory_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_endpoint_rate_limit('inventory_write');
  return new;
end;
$$;

create function public.rate_limit_product_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enforce_endpoint_rate_limit('destructive_write');
    return old;
  end if;
  perform public.enforce_endpoint_rate_limit('inventory_write');
  return new;
end;
$$;

create function public.rate_limit_verification_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_endpoint_rate_limit('verification_write');
  return new;
end;
$$;

create trigger sales_rate_limit_before_insert
before insert on public.sales
for each row execute function public.rate_limit_sales_insert();

create trigger sales_returns_rate_limit_before_insert
before insert on public.sales_returns
for each row execute function public.rate_limit_return_insert();

create trigger products_rate_limit_before_write
before insert or update or delete on public.products
for each row execute function public.rate_limit_product_write();

create trigger categories_rate_limit_before_write
before insert or update on public.categories
for each row execute function public.rate_limit_inventory_write();

create trigger inventory_batches_rate_limit_before_insert
before insert on public.inventory_batches
for each row execute function public.rate_limit_inventory_write();

create trigger inventory_adjustments_rate_limit_before_insert
before insert on public.inventory_adjustments
for each row execute function public.rate_limit_inventory_write();

create trigger business_days_rate_limit_before_update
before update on public.business_days
for each row execute function public.rate_limit_verification_write();

create trigger sales_returns_rate_limit_before_update
before update on public.sales_returns
for each row execute function public.rate_limit_verification_write();

revoke execute on function public.consume_endpoint_rate_limit(text, text) from public;
revoke execute on function public.enforce_endpoint_rate_limit(text) from public, anon, authenticated;
revoke execute on function public.rate_limit_sales_insert() from public, anon, authenticated;
revoke execute on function public.rate_limit_return_insert() from public, anon, authenticated;
revoke execute on function public.rate_limit_inventory_write() from public, anon, authenticated;
revoke execute on function public.rate_limit_product_write() from public, anon, authenticated;
revoke execute on function public.rate_limit_verification_write() from public, anon, authenticated;

grant execute on function public.consume_endpoint_rate_limit(text, text) to anon, authenticated;
