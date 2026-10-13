-- Narrow Den Leader access and deny generic volunteer access to raw event JSON.
-- Pack-wide events have no den_scope; den-specific events are visible only to that den.
drop policy if exists records_read on public.pack_records;
create policy records_read on public.pack_records for select to authenticated using (
 public.pack_is_admin(pack_id) or
 (public.pack_role(pack_id)='treasurer' and table_name in
  ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','events','tasks','equipment','receipts')) or
 (public.pack_role(pack_id)='den_leader' and (
  table_name='equipment' or
  (table_name in ('events','tasks') and (den_scope is null or public.pack_has_den(pack_id,den_scope))) or
  (table_name in ('roster','denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope))
 ))
);
drop policy if exists records_create on public.pack_records;
create policy records_create on public.pack_records for insert to authenticated with check (
 public.pack_is_admin(pack_id) or
 (public.pack_role(pack_id)='treasurer' and table_name in
  ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment','receipts')) or
 (public.pack_role(pack_id)='den_leader' and (
   table_name='equipment' or (table_name in ('tasks','denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope))
 ))
);
drop policy if exists records_change on public.pack_records;
create policy records_change on public.pack_records for update to authenticated
 using(public.pack_is_admin(pack_id) or
  (public.pack_role(pack_id)='treasurer' and table_name in
   ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment','receipts')) or
  (public.pack_role(pack_id)='den_leader' and
   (table_name='equipment' or (table_name in ('tasks','denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope)))))
 with check(public.pack_is_admin(pack_id) or
  (public.pack_role(pack_id)='treasurer' and table_name in
   ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment','receipts')) or
  (public.pack_role(pack_id)='den_leader' and
   (table_name='equipment' or (table_name in ('tasks','denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope)))));
drop policy if exists records_remove on public.pack_records;
create policy records_remove on public.pack_records for delete to authenticated using(
 public.pack_is_admin(pack_id) or
 (public.pack_role(pack_id)='treasurer' and table_name in
  ('budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','equipment','receipts')) or
 (public.pack_role(pack_id)='den_leader' and
  (table_name='equipment' or (table_name in ('tasks','denPlans','adventureProgress','attendance') and public.pack_has_den(pack_id,den_scope))))
);
-- Future volunteer-specific views should expose only intentionally published fields.
