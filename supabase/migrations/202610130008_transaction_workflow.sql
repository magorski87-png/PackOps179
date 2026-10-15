-- Additive workflow. No edits to existing records, RLS policies or ledger data.
-- Browser users may SELECT permitted rows; every mutation uses a checked RPC.
create table if not exists public.finance_requests (
 id uuid primary key,
 pack_id uuid not null references public.packs(id),
 submitted_by uuid not null references auth.users(id),
 source_year text not null check(source_year ~ '^20[0-9]{2}-[0-9]{2}$'),
 kind text not null check(kind in ('expense','income','transfer','restricted')),
 amount numeric(12,2) not null check(amount>0 and amount<=1000000000),
 direction text not null check(direction in ('in','out')),
 description text not null check(length(description) between 1 and 240),
 category text not null check(length(category) between 1 and 100),
 event_id text,
 transaction_date date not null,
 receipt_url text not null default '' check(length(receipt_url)<=1000 and (receipt_url='' or receipt_url ~ '^https://(drive|docs)\.google\.com/')),
 notes text not null default '' check(length(notes)<=2000),
 status text not null default 'submitted' check(status in ('submitted','approved','declined','payment_verified','posted')),
 version integer not null default 1,
 reviewed_by uuid references auth.users(id),
 payment_reference text,
 verified_by uuid references auth.users(id),
 posted_row jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(pack_id,id)
);
create unique index if not exists finance_payment_unique on public.finance_requests(pack_id,lower(payment_reference)) where payment_reference is not null;
create table if not exists public.finance_request_audit (
 id bigint generated always as identity primary key,
 pack_id uuid not null,
 request_id uuid not null,
 actor uuid references auth.users(id),
 action text not null,
 note text not null default '',
 created_at timestamptz not null default now(),
 foreign key(pack_id,request_id) references public.finance_requests(pack_id,id)
);
create table if not exists public.finance_notifications (
 id uuid primary key default gen_random_uuid(),
 pack_id uuid not null,
 request_id uuid not null,
 user_id uuid not null references auth.users(id),
 seen_at timestamptz,
 email_state text not null default 'pending' check(email_state in ('pending','sending','accepted','failed')),
 created_at timestamptz not null default now(),
 unique(request_id,user_id),
 foreign key(pack_id,request_id) references public.finance_requests(pack_id,id)
);
create or replace function public.pack_is_finance_reviewer(p_pack uuid)
returns boolean language sql stable security definer set search_path=''
as $$select coalesce(public.pack_role(p_pack) in ('admin','cubmaster','treasurer'),false)$$;
-- The helper is used by signed-in RLS policies; it need not be callable anonymously.
revoke all on function public.pack_is_finance_reviewer(uuid) from public,anon;
grant execute on function public.pack_is_finance_reviewer(uuid) to authenticated;
alter table public.finance_requests enable row level security;
alter table public.finance_request_audit enable row level security;
alter table public.finance_notifications enable row level security;
revoke all on public.finance_requests,public.finance_request_audit,public.finance_notifications from anon,authenticated;
grant select on public.finance_requests,public.finance_request_audit,public.finance_notifications to authenticated;
grant select,insert,update on public.finance_requests,public.finance_request_audit,public.finance_notifications to service_role;
create policy finance_request_read on public.finance_requests for select to authenticated using(
 public.pack_is_finance_reviewer(pack_id) or (submitted_by=(select auth.uid()) and public.pack_role(pack_id) is not null)
);
create policy finance_audit_read on public.finance_request_audit for select to authenticated using(
 exists(select 1 from public.finance_requests r where r.id=request_id and r.pack_id=finance_request_audit.pack_id)
);
create policy finance_notice_read on public.finance_notifications for select to authenticated using(
 user_id=(select auth.uid()) and public.pack_is_finance_reviewer(pack_id)
);
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='finance_notifications') then
   alter publication supabase_realtime add table public.finance_notifications;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='finance_requests') then
   alter publication supabase_realtime add table public.finance_requests;
  end if;
 end if;
end $$;

create or replace function public.pack_submit_transaction(p_pack uuid,p_id uuid,p_data jsonb)
returns public.finance_requests language plpgsql security definer set search_path=''
as $$
declare r public.finance_requests; role_name text; ev public.pack_records;
begin
 role_name:=public.pack_role(p_pack);
 if role_name is null then raise exception 'Active Pack membership required'; end if;
 select * into r from public.finance_requests where id=p_id;
 if found then
  if r.pack_id<>p_pack or r.submitted_by<>(select auth.uid()) then raise exception 'Request identifier already used'; end if;
  return r; -- Same submission ID retries return the original, never a second request.
 end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>10000 then raise exception 'Invalid transaction'; end if;
 if nullif(p_data->>'eventId','') is not null then
  select * into ev from public.pack_records where pack_id=p_pack and table_name='events' and record_id=p_data->>'eventId';
  if not found or (role_name='den_leader' and ev.den_scope is not null and not public.pack_has_den(p_pack,ev.den_scope)) or role_name='volunteer' then raise exception 'Event is not available for your role'; end if;
 end if;
 if (p_data->>'kind'='expense' and p_data->>'direction'<>'out') or (p_data->>'kind'='income' and p_data->>'direction'<>'in') then raise exception 'Invalid cash direction'; end if;
 if p_data->>'kind'='income' and p_data->>'category' ilike '%popcorn%' then raise exception 'Scout popcorn credits are not Pack operating income'; end if;
 insert into public.finance_requests(id,pack_id,submitted_by,source_year,kind,amount,direction,description,category,event_id,transaction_date,receipt_url,notes)
 values(p_id,p_pack,(select auth.uid()),p_data->>'year',p_data->>'kind',(p_data->>'amount')::numeric,p_data->>'direction',trim(p_data->>'description'),trim(p_data->>'category'),nullif(p_data->>'eventId',''),(p_data->>'date')::date,coalesce(p_data->>'receiptUrl',''),coalesce(p_data->>'notes','')) returning * into r;
 insert into public.finance_request_audit(pack_id,request_id,actor,action) values(p_pack,r.id,(select auth.uid()),'submitted');
 insert into public.finance_notifications(pack_id,request_id,user_id)
 select p_pack,r.id,m.user_id from public.pack_members m where m.pack_id=p_pack and m.status='active' and m.role in ('admin','cubmaster','treasurer');
 return r;
end $$;
-- One transaction replaces the reviewed snapshot for this Scout year. Reconcile every
-- known official PackOps posting before touching the old snapshot.
create or replace function public.pack_replace_ledger_snapshot(p_pack uuid,p_year text,p_rows jsonb,p_imported_at text)
returns integer language plpgsql security definer set search_path=''
as $$
declare item jsonb; old_id text; ids text[]:='{}'; count_rows integer:=0;
begin
 if not public.pack_is_finance_reviewer(p_pack) then raise exception 'Finance reviewer required'; end if;
 if p_year !~ '^20[0-9]{2}-[0-9]{2}$' or p_imported_at::timestamptz>now()+interval '1 day' then raise exception 'Invalid Scout year or import time'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>10000 or octet_length(p_rows::text)>8000000 then raise exception 'Invalid ledger snapshot'; end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  old_id:=item->>'id';
  if jsonb_typeof(item)<>'object' or length(coalesce(old_id,'')) not between 1 and 300
   or (item->>'sourceYear') is distinct from p_year
   or old_id=any(ids) or octet_length(item::text)>=500000
   then raise exception 'Invalid, duplicate or wrong-year ledger row'; end if;
  ids:=array_append(ids,old_id); count_rows:=count_rows+1;
 end loop;
 if exists(select 1 from public.finance_requests r where r.pack_id=p_pack and r.source_year=p_year and r.status='posted'
   and not ('packops:'||r.id::text=any(ids))) then raise exception 'Official snapshot is missing a posted PackOps transaction'; end if;
 if exists(select 1 from public.pack_records pr where pr.pack_id=p_pack and pr.table_name='financeLedger'
   and pr.record_id=any(ids) and pr.payload->>'sourceYear' is distinct from p_year) then raise exception 'A ledger ID belongs to another Scout year'; end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  insert into public.pack_records(pack_id,table_name,record_id,payload)
  values(p_pack,'financeLedger',item->>'id',item)
  on conflict(pack_id,table_name,record_id) do update set payload=excluded.payload;
 end loop;
 delete from public.pack_records where pack_id=p_pack and table_name='financeLedger' and payload->>'sourceYear'=p_year
  and not (record_id=any(ids));
 insert into public.pack_settings(pack_id,setting_key,setting_value)
 values(p_pack,'financeLedgerImportedAt:'||p_year,p_imported_at)
 on conflict(pack_id,setting_key) do update set setting_value=excluded.setting_value;
 return count_rows;
end $$;
create or replace function public.pack_review_transaction(p_pack uuid,p_id uuid,p_version integer,p_action text,p_note text)
returns public.finance_requests language plpgsql security definer set search_path=''
as $$
declare r public.finance_requests;
begin
 if not public.pack_is_finance_reviewer(p_pack) then raise exception 'Finance reviewer required'; end if;
 select * into r from public.finance_requests where id=p_id and pack_id=p_pack for update;
 if not found then raise exception 'Request not found'; end if;
 if r.version<>p_version then raise exception 'This request changed. Refresh before reviewing.'; end if;
 if length(coalesce(p_note,''))>500 then raise exception 'Keep review notes under 500 characters'; end if;
 if p_action='approve' and r.status='submitted' then
  update public.finance_requests set status='approved',reviewed_by=(select auth.uid()) where id=r.id;
 elsif p_action='decline' and r.status in ('submitted','approved') and length(trim(coalesce(p_note,'')))>0 then
  update public.finance_requests set status='declined',reviewed_by=(select auth.uid()) where id=r.id;
 elsif p_action='verify_payment' and r.status='approved' and length(trim(coalesce(p_note,''))) between 3 and 200 then
  update public.finance_requests set status='payment_verified',verified_by=(select auth.uid()),payment_reference=trim(p_note) where id=r.id;
 else raise exception 'Invalid transition or missing reason/payment reference';
 end if;
 -- Self-approval is explicitly permitted. Auth actor, timestamp and action are recorded.
 update public.finance_requests set version=version+1,updated_at=now() where id=r.id returning * into r;
 insert into public.finance_request_audit(pack_id,request_id,actor,action,note) values(p_pack,r.id,(select auth.uid()),p_action,coalesce(p_note,''));
 return r;
end $$;
create or replace function public.pack_mark_finance_notifications_seen(p_pack uuid)
returns void language plpgsql security definer set search_path=''
as $$begin
 if not public.pack_is_finance_reviewer(p_pack) then raise exception 'Finance reviewer required'; end if;
 update public.finance_notifications set seen_at=now() where pack_id=p_pack and user_id=(select auth.uid()) and seen_at is null;
end $$;
-- Only the authenticated server posting function can complete a Google ledger posting.
create or replace function public.pack_finish_ledger_post(p_pack uuid,p_id uuid,p_actor uuid,p_row jsonb)
returns public.finance_requests language plpgsql security definer set search_path=''
as $$declare r public.finance_requests;
begin
 if not exists(select 1 from public.pack_members where pack_id=p_pack and user_id=p_actor and status='active' and role in ('admin','cubmaster','treasurer')) then raise exception 'Active reviewer required'; end if;
 select * into r from public.finance_requests where pack_id=p_pack and id=p_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status='posted' then return r; end if;
 if r.status<>'payment_verified' then raise exception 'Verify payment before posting'; end if;
 if (p_row->>'id') is distinct from ('packops:'||r.id::text)
 or (p_row->>'debit')::numeric is distinct from (case when r.direction='out' then r.amount else 0 end)
 or (p_row->>'credit')::numeric is distinct from (case when r.direction='in' then r.amount else 0 end)
 or (p_row->>'sourceYear') is distinct from r.source_year
 or (p_row->>'description') is distinct from r.description
 or (p_row->>'date') is distinct from r.transaction_date::text
 or nullif(p_row->>'sourceRow','')::integer is null
 or nullif(p_row->>'sourceRow','')::integer<2
 or nullif(p_row->>'balance','')::numeric is null
 then raise exception 'Posted row does not match request'; end if;
 update public.finance_requests set status='posted',posted_row=p_row,version=version+1,updated_at=now() where id=r.id returning * into r;
 insert into public.finance_request_audit(pack_id,request_id,actor,action,note) values(p_pack,r.id,p_actor,'posted','Official ledger accepted the unique PackOps transaction ID');
 return r;
end $$;
revoke all on function public.pack_submit_transaction(uuid,uuid,jsonb),public.pack_review_transaction(uuid,uuid,integer,text,text),public.pack_mark_finance_notifications_seen(uuid),public.pack_finish_ledger_post(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.pack_replace_ledger_snapshot(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.pack_submit_transaction(uuid,uuid,jsonb),public.pack_review_transaction(uuid,uuid,integer,text,text),public.pack_mark_finance_notifications_seen(uuid) to authenticated;
grant execute on function public.pack_replace_ledger_snapshot(uuid,text,jsonb,text) to authenticated;
grant execute on function public.pack_finish_ledger_post(uuid,uuid,uuid,jsonb) to service_role;
