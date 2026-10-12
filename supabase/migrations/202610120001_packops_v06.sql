-- PackOps 179 v0.6: secure multi-leader cloud records and family response engine.
-- IMPORTANT: Run manually in the Pack-controlled Supabase project, not in GitHub Pages.
-- Bootstrap the first admin by inserting a known auth.users UUID into pack_members AFTER OAuth sign-in.
create extension if not exists pgcrypto;

create table if not exists public.packs (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 1 and 150),
 created_at timestamptz not null default now()
);
create table if not exists public.pack_members (
 pack_id uuid not null references public.packs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','cubmaster','treasurer','den_leader','volunteer')),
 den_scopes text[] not null default '{}',
 status text not null default 'active' check(status in ('active','suspended')),
 created_at timestamptz not null default now(),
 primary key (pack_id,user_id)
);
create index if not exists pack_members_user_idx on public.pack_members(user_id,status);

-- Security definer functions consult the protected membership table without policy recursion.
create or replace function public.pack_role(p_pack uuid)
returns text language sql stable security definer set search_path=''
as $$select role from public.pack_members where pack_id=p_pack and user_id=(select auth.uid()) and status='active' limit 1$$;
create or replace function public.pack_is_admin(p_pack uuid)
returns boolean language sql stable security definer set search_path=''
as $$select coalesce(public.pack_role(p_pack) in ('admin','cubmaster'),false)$$;
create or replace function public.pack_has_den(p_pack uuid,p_den text)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.pack_members where pack_id=p_pack and user_id=(select auth.uid()) and status='active'
 and (role in ('admin','cubmaster') or (role='den_leader' and p_den=any(den_scopes))))$$;

create table if not exists public.pack_records (
 pack_id uuid not null references public.packs(id) on delete cascade,
 table_name text not null check(table_name in (
  'events','tasks','equipment','roster','budget','financeLedger','financeAccounts','financeAdjustments',
  'financeReimbursements','financeTags','financeAudit','denPlans','adventureProgress','attendance'
 )),
 record_id text not null check(length(record_id) between 1 and 300),
 den_scope text,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<500000),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(pack_id,table_name,record_id)
);
create index if not exists pack_records_den_idx on public.pack_records(pack_id,table_name,den_scope);
create index if not exists pack_records_updated_idx on public.pack_records(pack_id,updated_at desc);
-- Don't trust the caller to define the metadata controlling authorization.
create or replace function public.pack_record_guard()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if new.record_id <> (new.payload->>'id') then raise exception 'record_id must match payload.id'; end if;
 if new.table_name in ('roster','adventureProgress','attendance','denPlans') then
   new.den_scope:=nullif(trim(coalesce(new.payload->>'den','')),'');
   if new.den_scope is null then raise exception 'Den is required for this type'; end if;
 else
   new.den_scope:=nullif(trim(coalesce(new.payload->>'den','')),'');
 end if;
 new.updated_by:=(select auth.uid());
 new.updated_at:=now();
 if TG_OP='INSERT' then new.created_by:=(select auth.uid()); end if;
 return new;
end $$;
drop trigger if exists pack_record_guard_trigger on public.pack_records;
create trigger pack_record_guard_trigger before insert or update on public.pack_records
for each row execute function public.pack_record_guard();

create table if not exists public.family_forms (
 id uuid primary key default gen_random_uuid(),
 pack_id uuid not null references public.packs(id) on delete cascade,
 event_id text,
 den_scope text,
 kind text not null check(kind in ('rsvp','poll','volunteer')),
 title text not null check(length(title) between 3 and 150),
 description text not null default '',
 questions jsonb not null default '[]'::jsonb check(jsonb_typeof(questions)='array'),
 status text not null default 'draft' check(status in ('draft','open','closed')),
 closes_at timestamptz,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists family_forms_pack_event on public.family_forms(pack_id,event_id);
create table if not exists public.family_invitations (
 id uuid primary key default gen_random_uuid(),
 pack_id uuid not null references public.packs(id) on delete cascade,
 form_id uuid not null references public.family_forms(id) on delete cascade,
 recipient_label text not null check(length(recipient_label) between 1 and 120),
 recipient_email text,
 token_hash text not null unique check(length(token_hash)=64),
 expires_at timestamptz not null default (now()+interval '30 days'),
 last_submitted_at timestamptz,
 delivery_status text not null default 'link-created',
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists family_invitations_form on public.family_invitations(form_id);
create table if not exists public.family_responses (
 id uuid primary key default gen_random_uuid(),
 pack_id uuid not null references public.packs(id) on delete cascade,
 form_id uuid not null references public.family_forms(id) on delete cascade,
 invitation_id uuid not null unique references public.family_invitations(id) on delete cascade,
 answer jsonb not null check(jsonb_typeof(answer)='object' and octet_length(answer::text)<15000),
 submitted_at timestamptz not null default now()
);
create index if not exists family_responses_form on public.family_responses(form_id);

-- Lightweight audit trails: no sensitive youth record body is duplicated.
create table if not exists public.pack_audit (
 id bigint generated always as identity primary key,
 pack_id uuid not null references public.packs(id) on delete cascade,
 actor uuid,
 subject text not null,
 record_id text not null,
 operation text not null,
 occurred_at timestamptz not null default now()
);
create or replace function public.pack_record_audit()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.pack_audit(pack_id,actor,subject,record_id,operation)
 values(coalesce(new.pack_id,old.pack_id),(select auth.uid()),coalesce(new.table_name,old.table_name),
 coalesce(new.record_id,old.record_id),TG_OP);
 return coalesce(new,old);
end $$;
drop trigger if exists pack_record_audit_trigger on public.pack_records;
create trigger pack_record_audit_trigger after insert or update or delete on public.pack_records
for each row execute function public.pack_record_audit();

alter table public.packs enable row level security;
alter table public.pack_members enable row level security;
alter table public.pack_records enable row level security;
alter table public.family_forms enable row level security;
alter table public.family_invitations enable row level security;
alter table public.family_responses enable row level security;
alter table public.pack_audit enable row level security;

revoke all on public.packs,public.pack_members,public.pack_records,public.family_forms,public.family_invitations,public.family_responses,public.pack_audit from anon;
revoke all on public.packs,public.pack_members,public.pack_records,public.family_forms,public.family_invitations,public.family_responses,public.pack_audit from authenticated;
grant select on public.packs,public.pack_members,public.pack_records,public.family_forms,public.family_invitations,public.family_responses,public.pack_audit to authenticated;
grant insert,update,delete on public.pack_members,public.pack_records,public.family_forms to authenticated;
-- Invitations / responses are created/updated by the protected Edge Function only.

create policy packs_view on public.packs for select to authenticated
 using(public.pack_role(id) is not null);
create policy members_view on public.pack_members for select to authenticated
 using(user_id=(select auth.uid()) or public.pack_is_admin(pack_id));
create policy members_create on public.pack_members for insert to authenticated
 with check(public.pack_is_admin(pack_id));
create policy members_change on public.pack_members for update to authenticated
 using(public.pack_is_admin(pack_id)) with check(public.pack_is_admin(pack_id));
-- No self-serve role escalation. Only an admin can manage members.
create policy members_remove on public.pack_members for delete to authenticated
 using(public.pack_is_admin(pack_id));

-- Read rules: entire roster restricted to admins, assigned den leader gets that den only.
create policy records_read on public.pack_records for select to authenticated using (
 public.pack_is_admin(pack_id) or
 (public.pack_role(pack_id)='treasurer' and table_name in ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','events','tasks','equipment')) or
 (public.pack_role(pack_id)='den_leader' and
   (table_name in ('events','tasks','equipment') or
    (table_name in ('roster','denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope)))) or
 (public.pack_role(pack_id)='volunteer' and table_name='events')
);
create policy records_create on public.pack_records for insert to authenticated with check (
 public.pack_is_admin(pack_id) or
 (public.pack_role(pack_id)='treasurer' and table_name in ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment')) or
 (public.pack_role(pack_id)='den_leader' and
   (table_name in ('tasks','equipment') or
    (table_name in ('denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope))))
);
create policy records_change on public.pack_records for update to authenticated
 using(public.pack_is_admin(pack_id) or
   (public.pack_role(pack_id)='treasurer' and table_name in ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment')) or
   (public.pack_role(pack_id)='den_leader' and
     (table_name in ('tasks','equipment') or (table_name in ('denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope)))))
 with check(public.pack_is_admin(pack_id) or
   (public.pack_role(pack_id)='treasurer' and table_name in ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment')) or
   (public.pack_role(pack_id)='den_leader' and
     (table_name in ('tasks','equipment') or (table_name in ('denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope)))));
create policy records_remove on public.pack_records for delete to authenticated
 using(public.pack_is_admin(pack_id) or
  (public.pack_role(pack_id)='treasurer' and table_name in ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment')) or
  (public.pack_role(pack_id)='den_leader' and table_name in ('tasks','equipment','denPlans','adventureProgress','attendance') and
     (den_scope is null or public.pack_has_den(pack_id,den_scope))));
-- Family form builders: admins plus authorized den leaders only.
create policy form_read on public.family_forms for select to authenticated using(
 public.pack_is_admin(pack_id) or public.pack_role(pack_id)='treasurer' or
 (public.pack_role(pack_id)='den_leader' and (den_scope is null or public.pack_has_den(pack_id,den_scope))));
create policy form_create on public.family_forms for insert to authenticated with check(
 public.pack_is_admin(pack_id) or
 (public.pack_role(pack_id)='den_leader' and den_scope is not null and public.pack_has_den(pack_id,den_scope)));
create policy form_change on public.family_forms for update to authenticated
 using(public.pack_is_admin(pack_id) or (public.pack_role(pack_id)='den_leader' and public.pack_has_den(pack_id,den_scope)))
 with check(public.pack_is_admin(pack_id) or (public.pack_role(pack_id)='den_leader' and public.pack_has_den(pack_id,den_scope)));
create policy form_remove on public.family_forms for delete to authenticated using(public.pack_is_admin(pack_id));
create policy invites_read on public.family_invitations for select to authenticated
 using(public.pack_is_admin(pack_id) or exists(select 1 from public.family_forms f where f.id=form_id and
   public.pack_role(pack_id)='den_leader' and public.pack_has_den(pack_id,f.den_scope)));
create policy responses_read on public.family_responses for select to authenticated
 using(public.pack_is_admin(pack_id) or public.pack_role(pack_id)='treasurer' or exists(
   select 1 from public.family_forms f where f.id=form_id and
   public.pack_role(pack_id)='den_leader' and public.pack_has_den(pack_id,f.den_scope)));
create policy audit_read on public.pack_audit for select to authenticated using(public.pack_is_admin(pack_id));

-- Private user uploads: place files under <pack-id>/... ; never expose public bucket URLs.
insert into storage.buckets(id,name,public) values('packops-private','packops-private',false)
 on conflict(id) do update set public=false;
create policy "packops private object read" on storage.objects for select to authenticated
 using(bucket_id='packops-private' and public.pack_role((split_part(name,'/',1))::uuid) in ('admin','cubmaster','treasurer'));
create policy "packops private object write" on storage.objects for insert to authenticated
 with check(bucket_id='packops-private' and public.pack_role((split_part(name,'/',1))::uuid) in ('admin','cubmaster','treasurer'));
create policy "packops private object delete" on storage.objects for delete to authenticated
 using(bucket_id='packops-private' and public.pack_role((split_part(name,'/',1))::uuid) in ('admin','cubmaster','treasurer'));

-- NO public/anon SELECT policies on youth, invitations, responses, files or finance tables.
-- Family response tokens are validated solely by the deployed Edge Function.
