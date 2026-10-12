-- Follow-up hardening: canonical den for roster RLS and shared receipt metadata.
-- Receipts keep binary originals in the official restricted Google Drive folder.
alter table public.pack_records drop constraint if exists pack_records_table_name_check;
alter table public.pack_records add constraint pack_records_table_name_check
 check(table_name in ('events','tasks','equipment','roster','budget','financeLedger','financeAccounts',
  'financeAdjustments','financeReimbursements','financeTags','financeAudit',
  'denPlans','adventureProgress','attendance','receipts'));
alter table public.pack_records drop constraint if exists pack_records_record_id_check;
alter table public.pack_records add constraint pack_records_record_id_check
 check(length(record_id) between 1 and 3000);

create or replace function public.pack_record_guard()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if new.record_id<>(new.payload->>'id') then raise exception 'record ID mismatch';end if;
 if new.table_name='roster' then
  new.den_scope:=coalesce(nullif(trim(new.payload->>'denGroup'),''),'Unassigned');
 elsif new.table_name in ('denPlans','adventureProgress','attendance') then
  new.den_scope:=nullif(trim(coalesce(new.payload->>'den','')),'');
  if new.den_scope is null then raise exception 'Assigned den is required';end if;
 else
  new.den_scope:=nullif(trim(coalesce(new.payload->>'den','')),'');
 end if;
 new.updated_by:=(select auth.uid());new.updated_at=now();
 if TG_OP='INSERT' then new.created_by:=(select auth.uid());end if;
 return new;
end $$;
-- Replacement remains attached to the existing trigger.
drop policy if exists records_read on public.pack_records;
create policy records_read on public.pack_records for select to authenticated using (
 public.pack_is_admin(pack_id) or
 (public.pack_role(pack_id)='treasurer' and table_name in ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','events','tasks','equipment','receipts')) or
 (public.pack_role(pack_id)='den_leader' and
   (table_name in ('events','tasks','equipment') or
   (table_name in ('roster','denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope)))) or
 (public.pack_role(pack_id)='volunteer' and table_name='events')
);
drop policy if exists records_create on public.pack_records;
create policy records_create on public.pack_records for insert to authenticated with check(
 public.pack_is_admin(pack_id) or
 (public.pack_role(pack_id)='treasurer' and table_name in ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment','receipts')) or
 (public.pack_role(pack_id)='den_leader' and
  (table_name in ('tasks','equipment') or
  (table_name in ('denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope))))
);
drop policy if exists records_change on public.pack_records;
create policy records_change on public.pack_records for update to authenticated
 using(public.pack_is_admin(pack_id) or
  (public.pack_role(pack_id)='treasurer' and table_name in ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment','receipts')) or
  (public.pack_role(pack_id)='den_leader' and
   (table_name in ('tasks','equipment') or
    (table_name in ('denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope)))))
 with check(public.pack_is_admin(pack_id) or
  (public.pack_role(pack_id)='treasurer' and table_name in ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment','receipts')) or
  (public.pack_role(pack_id)='den_leader' and
   (table_name in ('tasks','equipment') or
    (table_name in ('denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope)))));
drop policy if exists records_remove on public.pack_records;
create policy records_remove on public.pack_records for delete to authenticated
 using(public.pack_is_admin(pack_id) or
  (public.pack_role(pack_id)='treasurer' and table_name in ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment','receipts')) or
  (public.pack_role(pack_id)='den_leader' and table_name in ('tasks','equipment','denPlans','adventureProgress','attendance') and
     (den_scope is null or public.pack_has_den(pack_id,den_scope))));
