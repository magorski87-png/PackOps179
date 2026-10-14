-- Add a private note per family invitation. Existing invitations remain unchanged.
-- RLS and the Edge Function's token check continue to control access.
alter table public.family_invitations
 add column if not exists personal_note text not null default '';

alter table public.family_invitations
 drop constraint if exists family_invitation_note_length;
alter table public.family_invitations
 add constraint family_invitation_note_length check (length(personal_note)<=1000);
