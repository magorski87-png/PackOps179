-- Prevent Den Leaders from recording progress or attendance against a Scout outside
-- their permitted den. AFTER trigger sees server-derived den_scope from pack_record_guard.
create or replace function public.validate_den_scout()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if new.table_name in ('adventureProgress','attendance') and not exists (
  select 1 from public.pack_records scout
   where scout.pack_id=new.pack_id and scout.table_name='roster'
    and scout.record_id=new.payload->>'scoutId'
    and scout.den_scope=new.den_scope
 ) then
  raise exception 'Scout must belong to this den';
 end if;
 return new;
end $$;
drop trigger if exists validate_den_scout_trigger on public.pack_records;
create trigger validate_den_scout_trigger after insert or update on public.pack_records
for each row execute function public.validate_den_scout();
