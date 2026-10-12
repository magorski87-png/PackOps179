-- Run with Supabase CLI: supabase test db
-- This checks baseline privileges and policies. It does NOT replace two-account
-- end-to-end security tests for den restrictions and membership revocation.
begin;
select plan(12);
select ok((select relrowsecurity from pg_class where oid='public.pack_records'::regclass),'pack_records uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.pack_members'::regclass),'pack_members uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.family_forms'::regclass),'family_forms uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.family_invitations'::regclass),'family_invitations uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.family_responses'::regclass),'family_responses uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.pack_settings'::regclass),'pack_settings uses RLS');
select ok(not has_table_privilege('anon','public.pack_records','SELECT'),'anonymous visitors cannot read Pack records');
select ok(not has_table_privilege('anon','public.pack_members','SELECT'),'anonymous visitors cannot read leader memberships');
select ok(not has_table_privilege('anon','public.family_responses','SELECT'),'anonymous visitors cannot read responses');
select ok(not has_table_privilege('authenticated','public.family_responses','INSERT'),'browser users cannot forge family responses');
select ok(not has_table_privilege('authenticated','public.family_invitations','INSERT'),'browser users cannot issue capability links directly');
select ok(not has_table_privilege('anon','public.pack_settings','SELECT'),'anonymous visitors cannot view Pack finances');
select * from finish();
rollback;
