  alter table public.profiles add column if not exists email text;

  update public.profiles profile
  set email = coalesce(lower(trim(auth_user.email)), profile.id::text)
  from auth.users auth_user
  where auth_user.id = profile.id;

  alter table public.profiles alter column email set not null;

  alter table public.profiles drop constraint if exists profiles_email_length;
  alter table public.profiles
    add constraint profiles_email_length check (char_length(email) between 3 and 320);

  drop index if exists public.profiles_email_key;
  create unique index profiles_email_key on public.profiles (email);

  create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
  begin
    insert into public.profiles (id, full_name, email)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
      lower(trim(new.email))
    );
    return new;
  end;
  $$;

  revoke execute on function public.handle_new_user() from public, anon, authenticated;

  create or replace function public.consume_endpoint_rate_limit(p_scope text, p_identifier text default null)
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
      when 'staff_write' then v_limit := 20; v_window_seconds := 3600;
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

  create function public.update_staff_account(
    p_profile_id uuid,
    p_role public.app_role,
    p_status public.account_status,
    p_created boolean default false
  )
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_actor uuid := (select auth.uid());
    v_target public.profiles%rowtype;
    v_active_administrators integer;
  begin
    if not public.has_role(array['administrator'::public.app_role]) then
      raise exception 'Administrator access is required to manage staff accounts.' using errcode = '42501';
    end if;

    perform public.enforce_endpoint_rate_limit('staff_write');

    if v_actor is null then
      raise exception 'An authenticated account is required.' using errcode = '42501';
    end if;

    if p_profile_id = v_actor then
      raise exception 'You cannot change your own role or status.' using errcode = '22023';
    end if;

    select profile.* into v_target
    from public.profiles profile
    where profile.id = p_profile_id
    for update;

    if v_target.id is null then
      raise exception 'That staff account was not found.' using errcode = 'P0002';
    end if;

    if p_created and v_target.created_at < now() - interval '5 minutes' then
      raise exception 'That account is no longer new. Change its role or status directly.' using errcode = '22023';
    end if;

    if not p_created and v_target.role = p_role and v_target.status = p_status then
      return;
    end if;

    if v_target.role = 'administrator'::public.app_role
      and (p_role <> 'administrator'::public.app_role or p_status <> 'active'::public.account_status) then
      select count(*) into v_active_administrators
      from public.profiles
      where role = 'administrator'::public.app_role
        and status = 'active'::public.account_status;

      if v_active_administrators <= 1 then
        raise exception 'The last active administrator cannot be demoted or deactivated.' using errcode = '55000';
      end if;
    end if;

    update public.profiles
    set role = p_role,
        status = p_status
    where id = p_profile_id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (
      v_actor,
      case
        when p_created then 'staff.created'
        when v_target.role <> p_role and v_target.status <> p_status then 'staff.updated'
        when v_target.role <> p_role then 'staff.role_changed'
        else 'staff.status_changed'
      end,
      'profile',
      p_profile_id::text,
      jsonb_build_object(
        'email', v_target.email,
        'full_name', v_target.full_name,
        'previous_role', v_target.role,
        'role', p_role,
        'previous_status', v_target.status,
        'status', p_status
      )
    );
  end;
  $$;

  revoke execute on function public.update_staff_account(uuid, public.app_role, public.account_status, boolean) from public, anon;
  grant execute on function public.update_staff_account(uuid, public.app_role, public.account_status, boolean) to authenticated;

  drop policy if exists profiles_update on public.profiles;
  revoke update on public.profiles from authenticated;

  notify pgrst, 'reload schema';
