-- Publish only protected Pack records for Realtime. Row-level security still applies.
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pack_records') then
   alter publication supabase_realtime add table public.pack_records;
 end if;
end $$;
-- Subscriptions are a re-fetch signal; clients must still perform normal RLS-protected queries.
