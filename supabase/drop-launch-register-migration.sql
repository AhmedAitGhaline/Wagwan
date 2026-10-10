-- WAGWAN Next Drop / Register feature. Additive and safe to rerun.
alter table public.wagwan_store_settings
  add column if not exists drop_mode_enabled boolean not null default false,
  add column if not exists drop_name text not null default 'DROP 002',
  add column if not exists drop_launch_at timestamptz,
  add column if not exists drop_timezone text not null default 'Africa/Casablanca',
  add column if not exists drop_registration_open boolean not null default true,
  add column if not exists drop_auto_close_registrations boolean not null default true,
  add column if not exists active_drop_id uuid;

create table if not exists public.wagwan_drops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  launch_at timestamptz not null,
  timezone text not null default 'Africa/Casablanca',
  registration_open boolean not null default true,
  auto_close_registrations boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.wagwan_drop_registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  phone text not null check (phone ~ '^\+212[67][0-9]{8}$'),
  drop_id uuid not null references public.wagwan_drops(id) on delete restrict,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  unique(drop_id, phone)
);

alter table public.wagwan_drops enable row level security;
alter table public.wagwan_drop_registrations enable row level security;

drop policy if exists "public can read active drop" on public.wagwan_drops;
create policy "public can read active drop" on public.wagwan_drops
  for select to anon, authenticated using (
    exists (
      select 1 from public.wagwan_store_settings s
      where s.id=1 and s.active_drop_id=wagwan_drops.id and s.drop_mode_enabled=true
    )
  );

drop policy if exists "admins can manage drops" on public.wagwan_drops;
create policy "admins can manage drops" on public.wagwan_drops
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins can read drop registrations" on public.wagwan_drop_registrations;
create policy "admins can read drop registrations" on public.wagwan_drop_registrations
  for select to authenticated using (public.is_admin());

drop policy if exists "admins can update drop registrations" on public.wagwan_drop_registrations;
create policy "admins can update drop registrations" on public.wagwan_drop_registrations
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins can delete drop registrations" on public.wagwan_drop_registrations;
create policy "admins can delete drop registrations" on public.wagwan_drop_registrations
  for delete to authenticated using (public.is_admin());


grant select on public.wagwan_drops to anon, authenticated;
grant insert, update, delete on public.wagwan_drops to authenticated;
grant select, update, delete on public.wagwan_drop_registrations to authenticated;

-- Public users can only submit through this validated RPC; there is no public SELECT policy.
create or replace function public.wagwan_register_for_drop(p_full_name text, p_phone text, p_drop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_full_name, ''));
  v_digits text := regexp_replace(translate(trim(coalesce(p_phone,'')), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g');
  v_phone text;
  v_drop public.wagwan_drops%rowtype;
  v_settings public.wagwan_store_settings%rowtype;
  v_id uuid;
begin
  if length(v_name) < 2 or length(v_name) > 120 then
    return jsonb_build_object('status','invalid_name');
  end if;
  if left(v_digits,2)='00' then v_digits := substring(v_digits from 3); end if;
  if left(v_digits,3)='212' then v_digits := substring(v_digits from 4); end if;
  if left(v_digits,1)='0' then v_digits := substring(v_digits from 2); end if;
  if v_digits !~ '^[67][0-9]{8}$' then
    return jsonb_build_object('status','invalid_phone');
  end if;
  v_phone := '+212' || v_digits;

  select * into v_settings from public.wagwan_store_settings where id=1;
  if not found or not coalesce(v_settings.drop_mode_enabled,false)
     or v_settings.active_drop_id is distinct from p_drop_id then
    return jsonb_build_object('status','registrations_closed');
  end if;

  select * into v_drop from public.wagwan_drops where id=p_drop_id;
  if not found then return jsonb_build_object('status','registrations_closed'); end if;
  if not v_drop.registration_open then return jsonb_build_object('status','registrations_closed'); end if;
  if now() >= v_drop.launch_at and v_drop.auto_close_registrations then
    update public.wagwan_drops set registration_open=false where id=p_drop_id;
    update public.wagwan_store_settings set drop_registration_open=false where id=1 and active_drop_id=p_drop_id;
    return jsonb_build_object('status','registrations_closed');
  end if;

  insert into public.wagwan_drop_registrations(full_name,phone,drop_id)
  values(v_name,v_phone,p_drop_id)
  on conflict(drop_id,phone) do nothing
  returning id into v_id;

  if v_id is null then return jsonb_build_object('status','already_registered'); end if;
  return jsonb_build_object('status','registered','id',v_id);
end;
$$;

revoke all on function public.wagwan_register_for_drop(text,text,uuid) from public;
grant execute on function public.wagwan_register_for_drop(text,text,uuid) to anon, authenticated;

-- Ensure the settings singleton exists, without overwriting existing values.
insert into public.wagwan_store_settings(id) values (1) on conflict(id) do nothing;

-- Enable realtime INSERT notifications when Supabase Realtime is available.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='wagwan_drop_registrations') then
    execute 'alter publication supabase_realtime add table public.wagwan_drop_registrations';
  end if;
end $$;
