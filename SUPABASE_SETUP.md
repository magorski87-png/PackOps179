# PackOps 179 v0.6 — Secure shared workspace setup

**Existing installations:** use [AUTOMATIC_SETUP.md](AUTOMATIC_SETUP.md) to publish
your existing public connection settings once. Do not recreate the Pack or repeat
the admin bootstrap. Leaders then only use **Continue with Google**. Leader
approval does not send email unless the optional server email sender is configured
and the administrator explicitly selects it.

The GitHub Pages frontend is deployable without access to secrets. Shared Pack records remain **disabled until you finish this setup**. Existing v0.5 records are left in their original local IndexedDB and are NOT automatically uploaded.

## 1. Create a Pack-controlled Supabase project

- Create a Supabase project in an appropriate **US hosting region**, owned by a Pack-controlled administrative account with a second trusted Pack administrator.
- Use the **SQL Editor** to run, IN FILENAME ORDER, every SQL file under `supabase/migrations/` (001 through 007).
- Note the project's URL and its **publishable key** from Supabase Project Settings. These identifiers are intended for a browser with RLS enabled. **Never** paste or commit a `service_role` key, `sb_secret_` key, Google OAuth client secret, or Resend API key.
- In the SQL Editor create the Pack itself (this is an example, not executed automatically):

```sql
insert into public.packs(name) values ('Pack 179') returning id;
```

Save the returned **Pack UUID**.

## 2. Set up Supabase Google sign-in

1. In Google Cloud Console → Google Auth Platform, create a **Web application OAuth client** for PackOps sign-in. This can be separate from your EXISTING Calendar/Drive browser OAuth client.
2. Under the OAuth client's **Authorized redirect URIs**, enter your exact Supabase callback, typically `https://<your-project-ref>.supabase.co/auth/v1/callback`. Copy this from Supabase → Authentication → Providers → Google.
3. In Supabase → Authentication → Providers → Google, enable Google and enter its OAuth **Client ID and Client Secret** into the protected Supabase dashboard, never the GitHub repository.
4. In Supabase → Authentication → URL Configuration, set the Site URL to `https://magorski87-png.github.io/PackOps179/` and add it to **Redirect URLs**.
5. In PackOps **Settings**, enter the **Supabase Project URL**, **Supabase publishable/anon key**, and **Pack UUID**. Click **Connect to Pack backend**, then **Continue with Google**.
6. Your first login will be authenticated but unapproved. This is intentional. Go to Supabase → Authentication → Users and locate YOUR newly created user UUID.
7. **One-time privileged admin bootstrap** in the Supabase SQL Editor only:

```sql
insert into public.pack_members(pack_id,user_id,role,den_scopes,status)
values (
 'YOUR-PACK-UUID'::uuid,
 'YOUR-GOOGLE-AUTH-USER-UUID'::uuid,
 'admin',
 '{}',
 'active'
);
```

8. Return to PackOps Settings and refresh. As the administrator, you can invite other leaders by Google email, assign roles, and limit Den Leaders to their rank/den. Uninvited users do not gain access simply by signing in with Google.

**Do not make an automatically signed-up user an admin from the browser.** The first administrator is established through the privileged database setup above.

## 3. Configure all phones and family invitation links

After RLS and roles have been verified, update the PUBLIC identifiers in `cloud-config.js` in the GitHub repository:

```js
export const PACK_CLOUD_CONFIG={
  projectUrl:'https://YOUR-PROJECT.supabase.co',
  publishableKey:'YOUR_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  packId:'YOUR-PACK-UUID'
};
```

Commit/deploy this file. The public key is NOT a secret; it is safe in a browser **only if the migration's table privileges and Row Level Security have been applied**. Never use a privileged Supabase key here. After this commit, authorized leaders on new devices and parents with private `#family/<token>` links can reach the same backend without manually entering connection information.

## 4. Deploy the family RSVP/email Edge Function

The `supabase/functions/family-rsvp/index.ts` Edge Function uses secure SHA-256 invitation token hashes in the database. The **original token is only in the private link**, not stored as plaintext. The endpoint intentionally accepts unauthenticated family requests; public requests cannot read the protected Pack database tables.

With the Supabase CLI connected to this project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy family-rsvp --no-verify-jwt
```

Set Edge Function secrets in Supabase → Edge Function Secrets:

- `PUBLIC_SITE_ORIGIN=https://magorski87-png.github.io`
- `PUBLIC_SITE_PATH=/PackOps179/`
- Optional to send email: `RESEND_API_KEY` and `RSVP_FROM_EMAIL` (an address on a verified sending domain).

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are server-side Supabase-provided variables and must never be copied into browser code. Sending RSVP emails through Resend requires its own account, verified domain, and secure API key.

Without email secrets, leaders can still generate **private family invitation links** and share them manually.

**Current RSVP support:** Yes/Maybe/No and adults/children; one-choice polls; volunteer-position choices; responses can be edited from the same invitation link. The system supports result search, totals, and CSV export. Capacity enforcement, waitlists, bulk campaign management, SMS, and web push are not in this release.

## 5. Migrate your existing device records

Before migration, use PackOps Settings to download an encrypted local backup.

1. Sign in to PackOps as the approved admin.
2. Open **Settings → Users & Permissions → Copy existing local records to Pack cloud**.
3. Review the migration confirmation. Records from the original device are copied; existing cloud records with the same IDs are **not overwritten**.
4. On your PC and phone, sign in with Google and choose **Refresh shared records**.
5. For the Scoutbook roster, a later CSV upload preserves matched Scout identities; Scouts absent from the new CSV are **flagged**, not silently deleted. Validate guardian details and den assignments with authorized leaders.

Uploaded receipt files remain in restricted **Google Drive**; only financial metadata is copied into Supabase. The photo/file blob from an unuploaded local receipt stays on that local device until uploaded. Other local attachments are not automatically transferred.

**Warning:** The legacy local backup restore restores only that device's IndexedDB. It does not replace cloud data. A cloud backup captures the approved administrator's current authorized snapshot, and recovering cloud data requires a reviewed restoration process. Configure independent Supabase database backups and disaster recovery.

## 6. Google Drive and official finance sources

Existing Google Calendar and Google Drive integrations remain separate from Supabase Google **sign-in**.

- Official treasurer ledger and Scout credit spreadsheet remain on Google Drive / Sheets.
- Users can import reviewed ledger CSVs into shared Pack finance. They are still snapshots, **not live bank or automatic Excel synchronization**.
- Pack income assumes dues and optional donations; Pack popcorn proceeds are zero. Individual popcorn credits remain separate.
- After authorized Google Drive upload, receipt metadata can be indexed for authorized leaders in Supabase. Google Drive permissions continue to control access to the original receipt file.
- Meeting reports, event references and existing Pack Drive shortcuts remain available. Saving automatic Drive exports for all data is not yet configured.

## 7. Security verification checklist — use fictional Scouts first

Do not import real youth details until these checks pass on the DEPLOYED Supabase project:

1. Uninvited Google user: sign-in succeeds but **Pack data requests are denied**.
2. Approved Den Leader assigned Webelos: Webelos roster is readable; Wolf roster and all treasurer finance rows are **not retrievable through direct API requests**.
3. Treasurer: finance records and private receipt references work; Pack roster has no general access.
4. Suspended user: membership revocation immediately stops new server reads/writes.
5. Family link: retrieves only that family's form, not Pack data; expired/malformed links fail; no public RLS access to `family_responses`.
6. Direct requests using only the publishable/anon key must not read or write protected `pack_records`, `family_invitations`, `family_responses` or private Storage objects.
7. Two approved devices can exchange equipment and roster updates, refresh/reconnect, and see the same records. Verify Supabase Realtime is enabled for `pack_records`.
8. Import/reconcile a fictional roster twice, confirming stable IDs and safe handling of missing Scouts.
9. Check encrypted backup creation and decrypt/restore compatibility in a safe test environment.
10. Verify nothing sensitive is added to the public GitHub repo, logs, email link previews, or Storage public URLs.

These tests MUST be done with a real project; passing the repository's Node tests does not establish production RLS security.

## Current limitations and next hardening

- Offline access to approved cloud records is **not** a production-grade queued sync mechanism. Do not assume offline writes are sent later.
- Cloud budget/ledger bulk replacement currently uses individual protected operations, not one all-or-nothing database transaction. Import/export backup first and verify results after interruptions.
- Google Drive/Calendar authorizations are per Google account/device and continue to use their existing authorization flows.
- Individual volunteer capacity enforcement, multi-question surveys, live Scoutbook advancement writes, automatic ledger fetch, SMS, push notifications, and automatic archival/retention jobs require later work.
- Cloud youth records are not stored in public assets; however previously imported v0.5 local copies still reside in that browser until expressly cleared. Use a trusted device and established retention policy.

The v0.6 frontend can be deployed immediately; **the real cloud service is not live until Supabase is provisioned and the SQL migrations, Google provider, key configuration, and Edge Function are deployed and verified**.
