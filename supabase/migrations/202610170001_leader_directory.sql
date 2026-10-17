-- Separate adult leader contacts from the youth roster. Only active Pack members may read.
create table public.leader_contacts (
 pack_id uuid not null references public.packs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 120),
 den text not null default '' check(length(den)<=120),
 phone text not null default '' check(length(phone)<=40),
 email text not null check(length(email) between 3 and 254),
 updated_at timestamptz not null default now(),
 primary key(pack_id,user_id)
);
alter table public.leader_contacts enable row level security;
revoke all on public.leader_contacts from anon,authenticated;
grant select,insert,update on public.leader_contacts to authenticated;
create policy leader_contacts_read on public.leader_contacts for select to authenticated
 using(public.pack_role(pack_id) is not null);
create policy leader_contacts_insert on public.leader_contacts for insert to authenticated
 with check(public.pack_role(pack_id) is not null and user_id=(select auth.uid()));
create policy leader_contacts_update on public.leader_contacts for update to authenticated
 using(public.pack_role(pack_id) is not null and user_id=(select auth.uid()))
 with check(public.pack_role(pack_id) is not null and user_id=(select auth.uid()));

create table public.pack_role_names (
 pack_id uuid not null references public.packs(id) on delete cascade,
 role_key text not null check(role_key in ('treasurer','cubmaster','activities_director')),
 display_name text not null check(length(display_name)<=120),
 primary key(pack_id,role_key)
);
alter table public.pack_role_names enable row level security;
revoke all on public.pack_role_names from anon,authenticated;
grant select,insert,update on public.pack_role_names to authenticated;
create policy role_names_read on public.pack_role_names for select to authenticated
 using(public.pack_role(pack_id) is not null);
create policy role_names_insert on public.pack_role_names for insert to authenticated
 with check(public.pack_is_admin(pack_id));
create policy role_names_update on public.pack_role_names for update to authenticated
 using(public.pack_is_admin(pack_id)) with check(public.pack_is_admin(pack_id));
