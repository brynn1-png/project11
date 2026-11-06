create table public.cashier_remittances (
  business_day_id uuid not null references public.business_days (id),
  cashier_id uuid not null references public.profiles (id),
  remitted_at timestamptz,
  primary key (business_day_id, cashier_id)
);

-- Existing submitted days remain closed; open days require the cashier to remit.
insert into public.cashier_remittances (business_day_id, cashier_id, remitted_at)
select distinct s.business_day_id, s.recorded_by,
  case when d.status = 'open' then null else coalesce(d.submitted_at, d.verified_at, now()) end
from public.sales s
join public.profiles p on p.id = s.recorded_by
join public.business_days d on d.id = s.business_day_id
where s.status = 'completed' and p.role = 'cashier'::public.app_role;

alter table public.cashier_remittances enable row level security;
revoke all on public.cashier_remittances from anon, authenticated;
grant select on public.cashier_remittances to authenticated;

create policy cashier_remittances_select on public.cashier_remittances for select to authenticated
using (
  (cashier_id = (select auth.uid()) and public.current_app_role() = 'cashier'::public.app_role)
  or public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role])
);

create function public.get_cashier_remittance_summaries(p_limit integer default 14)
returns table (
  business_day_id uuid,
  business_date date,
  store_status public.business_day_status,
  cashier_id uuid,
  cashier_name text,
  sale_count bigint,
  item_count bigint,
  gross_total numeric,
  remitted_at timestamptz,
  can_reopen boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with recent_days as (
    select d.id, d.business_date, d.status
    from public.business_days d
    order by d.business_date desc
    limit least(greatest(coalesce(p_limit, 14), 1), 90)
  )
  select
    d.id, d.business_date, d.status, p.id, p.full_name,
    count(s.id)::bigint,
    coalesce(sum(items.item_count), 0)::bigint,
    coalesce(sum(s.total_amount), 0)::numeric,
    max(r.remitted_at),
    p.role = 'cashier'::public.app_role and p.status = 'active'::public.account_status
  from recent_days d
  join public.cashier_remittances r on r.business_day_id = d.id
  join public.profiles p on p.id = r.cashier_id
  join public.sales s on s.business_day_id = d.id and s.recorded_by = r.cashier_id and s.status = 'completed'
  left join lateral (
    select coalesce(sum(si.quantity), 0)::bigint as item_count
    from public.sale_items si
    where si.sale_id = s.id
  ) items on true
  where public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) or (
    public.current_app_role() = 'cashier'::public.app_role
    and p.id = (select auth.uid())
  )
  group by d.id, d.business_date, d.status, p.id, p.full_name, p.role, p.status
  order by d.business_date desc, p.full_name;
$$;

create function public.submit_cashier_remittance(p_business_day_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.business_day_status;
begin
  if public.current_app_role() is distinct from 'cashier'::public.app_role or (select auth.uid()) is null then
    raise exception 'Cashier access is required.' using errcode = '42501';
  end if;

  perform public.enforce_endpoint_rate_limit('verification_write');

  select status into v_status
  from public.business_days
  where id = p_business_day_id
  for update;

  if v_status is distinct from 'open'::public.business_day_status then
    raise exception 'Only an open business day can be remitted.' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.sales s
    where s.business_day_id = p_business_day_id
      and s.recorded_by = (select auth.uid())
      and s.status = 'completed'
  ) then
    raise exception 'There are no completed sales to remit.' using errcode = '55000';
  end if;

  update public.cashier_remittances
  set remitted_at = now()
  where business_day_id = p_business_day_id
    and cashier_id = (select auth.uid())
    and remitted_at is null;

  if not found then
    raise exception 'Your sales for this day have already been remitted.' using errcode = '55000';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values ((select auth.uid()), 'cashier_remittance.submitted', 'business_day', p_business_day_id::text);
end;
$$;

create function public.reopen_cashier_remittance(p_business_day_id uuid, p_cashier_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.business_day_status;
  v_cashier_active boolean;
begin
  if not public.has_role(array['administrator'::public.app_role]) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  perform public.enforce_endpoint_rate_limit('verification_write');

  select status into v_status
  from public.business_days
  where id = p_business_day_id
  for update;

  if v_status is distinct from 'open'::public.business_day_status then
    raise exception 'The store day must be open to reopen a remittance.' using errcode = '55000';
  end if;

  select true into v_cashier_active
  from public.profiles p
  where p.id = p_cashier_id and p.role = 'cashier'::public.app_role and p.status = 'active'::public.account_status
  for update;

  if v_cashier_active is distinct from true then
    raise exception 'Only an active cashier can have a remittance reopened.' using errcode = '55000';
  end if;

  update public.cashier_remittances
  set remitted_at = null
  where business_day_id = p_business_day_id and cashier_id = p_cashier_id and remitted_at is not null;

  if not found then
    raise exception 'No remittance was found for this cashier and day.' using errcode = '55000';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'cashier_remittance.reopened', 'business_day', p_business_day_id::text,
          jsonb_build_object('cashier_id', p_cashier_id));
end;
$$;

create function public.prevent_sale_after_cashier_remittance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_status public.account_status;
begin
  select p.role, p.status into v_role, v_status
  from public.profiles p where p.id = new.recorded_by for update;

  if v_status is distinct from 'active'::public.account_status then
    raise exception 'An active account is required.' using errcode = '42501';
  end if;

  if v_role = 'cashier'::public.app_role then
    if new.business_day_id is null then
      raise exception 'A cashier sale requires a business day.' using errcode = '22023';
    end if;

    insert into public.cashier_remittances (business_day_id, cashier_id)
    values (new.business_day_id, new.recorded_by)
    on conflict do nothing;

    if exists (
      select 1 from public.cashier_remittances r
      where r.business_day_id = new.business_day_id and r.cashier_id = new.recorded_by and r.remitted_at is not null
    ) then
      raise exception 'Your sales for today have already been remitted.' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create trigger sales_prevent_after_cashier_remittance
before insert on public.sales
for each row execute function public.prevent_sale_after_cashier_remittance();

create function public.prevent_unremitted_cashier_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and exists (
       select 1 from public.cashier_remittances r
       join public.business_days d on d.id = r.business_day_id
       where r.cashier_id = old.id and r.remitted_at is null and d.status = 'open'
         and exists (
           select 1 from public.sales s
           where s.business_day_id = r.business_day_id and s.recorded_by = r.cashier_id and s.status = 'completed'
         )
     ) then
    raise exception 'Remit this cashier''s open-day sales before changing their role or status.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_unremitted_cashier_change
before update of role, status on public.profiles
for each row execute function public.prevent_unremitted_cashier_change();

create or replace function public.submit_business_day(p_business_day_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.business_day_status;
begin
  if not public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role]) then
    raise exception 'Manager access is required.' using errcode = '42501';
  end if;

  select status into v_status
  from public.business_days
  where id = p_business_day_id
  for update;

  if v_status is distinct from 'open'::public.business_day_status then
    raise exception 'Only an open business day can be submitted.' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.cashier_remittances r
    where r.business_day_id = p_business_day_id
      and r.remitted_at is null
      and exists (
        select 1 from public.sales s
        where s.business_day_id = r.business_day_id and s.recorded_by = r.cashier_id and s.status = 'completed'
      )
  ) then
    raise exception 'Wait for every cashier with sales to remit before submitting the store day.' using errcode = '55000';
  end if;

  update public.business_days
  set status = 'pending_review', submitted_by = (select auth.uid()), submitted_at = now()
  where id = p_business_day_id;
end;
$$;

create or replace function public.get_business_day_sales(p_business_day_id uuid)
returns table (
  sale_number bigint,
  sold_at timestamptz,
  cashier_name text,
  total_amount numeric,
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
    cashier.full_name,
    s.total_amount,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', p.name,
        'quantity', si.quantity,
        'unit_price', si.unit_price,
        'line_total', si.line_total
      ) order by p.name)
      from public.sale_items si
      join public.products p on p.id = si.product_id
      where si.sale_id = s.id
    ), '[]'::jsonb)
  from public.sales s
  join public.profiles cashier on cashier.id = s.recorded_by
  where s.business_day_id = p_business_day_id
    and s.status = 'completed'
    and (
      public.has_role(array['administrator'::public.app_role, 'manager'::public.app_role])
      or (public.current_app_role() = 'cashier'::public.app_role and s.recorded_by = (select auth.uid()))
    )
  order by s.sold_at, s.sale_number;
$$;

revoke execute on function public.get_cashier_remittance_summaries(integer) from public, anon;
revoke execute on function public.submit_cashier_remittance(uuid) from public, anon;
revoke execute on function public.reopen_cashier_remittance(uuid, uuid) from public, anon;
revoke execute on function public.prevent_sale_after_cashier_remittance() from public, anon, authenticated;
revoke execute on function public.prevent_unremitted_cashier_change() from public, anon, authenticated;
grant execute on function public.get_cashier_remittance_summaries(integer) to authenticated;
grant execute on function public.submit_cashier_remittance(uuid) to authenticated;
grant execute on function public.reopen_cashier_remittance(uuid, uuid) to authenticated;
