-- Only admin-issued, email-matched invitations can activate PackOps membership.
create table if not exists public.member_invites(
 pack_id uuid not null references public.packs(id) on delete cascade,
 email text not null check(email=lower(email) and length(email) between 5 and 254),
 role text not null check(role in ('admin','cubmaster','treasurer','den_leader','volunteer')),
 den_scopes text[] not null default '{}',
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 consumed_at timestamptz,
 primary key(pack_id,email)
);
alter table public.member_invites enable row level security;
revoke all on public.member_invites from anon;
revoke all on public.member_invites from authenticated;
grant select,insert,update,delete on public.member_invites to authenticated;
create policy admin_read_invites on public.member_invites for select to authenticated
 using(public.pack_is_admin(pack_id));
create policy admin_create_invites on public.member_invites for insert to authenticated
 with check(public.pack_is_admin(pack_id));
create policy admin_update_invites on public.member_invites for update to authenticated
 using(public.pack_is_admin(pack_id)) with check(public.pack_is_admin(pack_id));
create policy admin_remove_invites on public.member_invites for delete to authenticated
 using(public.pack_is_admin(pack_id));
create or replace function public.pack_accept_invite(target_pack uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_email text; v_invite public.member_invites%rowtype;
begin
 if (select auth.uid()) is null then return false; end if;
 select lower(email) into v_email from auth.users
 where id=(select auth.uid()) and email_confirmed_at is not null;
 if v_email is null then return false; end if;
 select * into v_invite from public.member_invites
 where pack_id=target_pack and email=v_email and consumed_at is null for update;
 if not found then return false; end if;
 -- Existing membership is never automatically escalated by a stale invitation.
 insert into public.pack_members(pack_id,user_id,role,den_scopes,status)
 values(target_pack,(select auth.uid()),v_invite.role,v_invite.den_scopes,'active')
 on conflict(pack_id,user_id) do nothing;
 update public.member_invites set consumed_at=now() where pack_id=target_pack and email=v_email;
 return true;
end $$;
revoke all on function public.pack_accept_invite(uuid) from public;
grant execute on function public.pack_accept_invite(uuid) to authenticated;
-- Escalation-proof bootstrap: initial admin inserted only by privileged SQL editor
-- after their Google account exists in auth.users; see SETUP.md.
