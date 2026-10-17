-- Additive replacement for adult cards. Preserve original leader_contacts entries.
create table public.leader_contact_cards (
 pack_id uuid not null references public.packs(id) on delete cascade,
 id uuid not null default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 name text not null check(length(name) between 1 and 120),
 den text not null default '' check(length(den)<=120),
 roles text[] not null default '{}',
 phone text not null default '' check(length(phone)<=40),
 email text not null check(length(email) between 3 and 254),
 updated_at timestamptz not null default now(),
 primary key(pack_id,id),
 constraint card_roles_size check(cardinality(roles)<=12)
);
create unique index leader_contact_cards_user on public.leader_contact_cards(pack_id,user_id) where user_id is not null;
insert into public.leader_contact_cards(pack_id,user_id,name,den,phone,email)
 select pack_id,user_id,name,den,phone,email from public.leader_contacts;
alter table public.leader_contact_cards enable row level security;
revoke all on public.leader_contact_cards from anon,authenticated;
grant select,insert,update on public.leader_contact_cards to authenticated;
create policy cards_read on public.leader_contact_cards for select to authenticated
 using(public.pack_role(pack_id) is not null);
create policy cards_insert on public.leader_contact_cards for insert to authenticated
 with check(public.pack_is_admin(pack_id) or (public.pack_role(pack_id) is not null and user_id=(select auth.uid())));
create policy cards_update on public.leader_contact_cards for update to authenticated
 using(public.pack_is_admin(pack_id) or (public.pack_role(pack_id) is not null and user_id=(select auth.uid())))
 with check(public.pack_is_admin(pack_id) or (public.pack_role(pack_id) is not null and user_id=(select auth.uid())));

create table public.pack_ui_preferences (
 pack_id uuid not null references public.packs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object' and octet_length(payload::text)<10000),
 primary key(pack_id,user_id)
);
alter table public.pack_ui_preferences enable row level security;
revoke all on public.pack_ui_preferences from anon,authenticated;
grant select,insert,update on public.pack_ui_preferences to authenticated;
create policy prefs_read on public.pack_ui_preferences for select to authenticated
 using(public.pack_role(pack_id) is not null and user_id=(select auth.uid()));
create policy prefs_insert on public.pack_ui_preferences for insert to authenticated
 with check(public.pack_role(pack_id) is not null and user_id=(select auth.uid()));
create policy prefs_update on public.pack_ui_preferences for update to authenticated
 using(public.pack_role(pack_id) is not null and user_id=(select auth.uid()))
 with check(public.pack_role(pack_id) is not null and user_id=(select auth.uid()));

create table public.adventure_catalog (
 pack_id uuid not null references public.packs(id) on delete cascade,
 id uuid not null default gen_random_uuid(),
 den text not null check(length(den) between 1 and 120),
 title text not null check(length(title) between 1 and 140),
 kind text not null default 'elective' check(kind in ('required','elective')),
 source_url text not null default '' check(length(source_url)<500),
 primary key(pack_id,id),
 unique(pack_id,den,title)
);
alter table public.adventure_catalog enable row level security;
revoke all on public.adventure_catalog from anon,authenticated;
grant select,insert,update on public.adventure_catalog to authenticated;
create policy adventures_read on public.adventure_catalog for select to authenticated
 using(public.pack_is_admin(pack_id) or public.pack_has_den(pack_id,den));
create policy adventures_insert on public.adventure_catalog for insert to authenticated
 with check(public.pack_is_admin(pack_id) or public.pack_has_den(pack_id,den));
create policy adventures_update on public.adventure_catalog for update to authenticated
 using(public.pack_is_admin(pack_id) or public.pack_has_den(pack_id,den))
 with check(public.pack_is_admin(pack_id) or public.pack_has_den(pack_id,den));
