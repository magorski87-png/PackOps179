-- Shared financial configuration is Pack-owned. Personal Google OAuth settings remain device-only.
create table if not exists public.pack_settings(
 pack_id uuid not null references public.packs(id) on delete cascade,
 setting_key text not null check(length(setting_key) between 1 and 180),
 setting_value text not null check(length(setting_value)<8000),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(pack_id,setting_key),
 constraint pack_settings_allowed_key check(setting_key='activeScoutYear' or setting_key like 'finance%')
);
create or replace function public.pack_setting_guard()
returns trigger language plpgsql security invoker set search_path=''
as $$begin new.updated_by:=(select auth.uid());new.updated_at:=now();return new;end$$;
drop trigger if exists pack_settings_guard_trigger on public.pack_settings;
create trigger pack_settings_guard_trigger before insert or update on public.pack_settings
 for each row execute function public.pack_setting_guard();
alter table public.pack_settings enable row level security;
revoke all on public.pack_settings from anon,authenticated;
grant select,insert,update on public.pack_settings to authenticated;
create policy pack_settings_view on public.pack_settings for select to authenticated
 using(public.pack_is_admin(pack_id) or public.pack_role(pack_id)='treasurer');
create policy pack_settings_create on public.pack_settings for insert to authenticated
 with check(public.pack_is_admin(pack_id) or public.pack_role(pack_id)='treasurer');
create policy pack_settings_change on public.pack_settings for update to authenticated
 using(public.pack_is_admin(pack_id) or public.pack_role(pack_id)='treasurer')
 with check(public.pack_is_admin(pack_id) or public.pack_role(pack_id)='treasurer');
