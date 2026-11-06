create table public.failure_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  source text not null check (source in ('server_action', 'next_server')),
  operation text not null check (char_length(operation) between 1 and 160),
  reason text not null check (char_length(reason) between 1 and 2000),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  stack text check (stack is null or char_length(stack) <= 4000),
  reference_id uuid not null unique,
  actor_id uuid references public.profiles (id) on delete set null
);

create index failure_logs_occurred_at_idx on public.failure_logs (occurred_at desc, id desc);
create index failure_logs_operation_idx on public.failure_logs (operation);

create function public.is_diagnostics_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = (select auth.uid())
      and lower(u.email) = 'admin@gmail.com'
      and p.role = 'administrator'::public.app_role
      and p.status = 'active'
  );
$$;

alter table public.failure_logs enable row level security;
revoke all on public.failure_logs from public, anon, authenticated;
grant select on public.failure_logs to authenticated;
create policy failure_logs_owner_select on public.failure_logs
for select to authenticated using ((select public.is_diagnostics_owner()));

revoke execute on function public.is_diagnostics_owner() from public, anon;
grant execute on function public.is_diagnostics_owner() to authenticated;

create function public.purge_failure_logs(p_before timestamptz)
returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  if p_before is null or p_before > now() - interval '30 days' then
    raise exception 'Only failure logs older than 30 days can be purged.';
  end if;
  delete from public.failure_logs where occurred_at < p_before;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.purge_failure_logs(timestamptz) from public, anon, authenticated;
grant execute on function public.purge_failure_logs(timestamptz) to service_role;
