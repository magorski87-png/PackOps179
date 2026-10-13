# Automatic leader sign-in and invitation email

This change is staged for review. Do not merge or deploy until the three public
values below are confirmed. No SQL migrations, RLS policies, role definitions,
existing records, or browser data are changed by this update.

## One-time public configuration

The repository's original `cloud-config.js` has three empty values. No actual
Pack UUID was found in the source. An Auth user UUID is not a Pack UUID.
In the existing Supabase project, use Table Editor → `public.packs`, or run this
read-only SQL and identify the existing Pack 179 row:

```sql
select id, name from public.packs order by name;
```

Do not create another Pack or change existing IDs. Confirm the intended row
before using its ID. No database password or privileged key is needed here.

Set these GitHub repository **Actions variables**, under Settings → Secrets and
variables → Actions → Variables (not OAuth or database secrets):

| Variable | Value |
| --- | --- |
| `PACKOPS_SUPABASE_URL` | Existing project's HTTPS Supabase URL |
| `PACKOPS_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` or legacy JWT with `anon` role |
| `PACKOPS_PACK_ID` | Confirmed ID from `public.packs` |

Alternatively, put the same public values in `cloud-config.js` once and review
that commit. If any build variable is set, all three are required; partial
configuration never mixes values from different projects. Build errors never
print the supplied key. Google client secrets, Supabase secret/service-role
keys, database passwords and email-provider keys must remain server-side.

The published configuration takes precedence over old device settings as one
complete unit. Existing device settings are preserved and remain usable for
local development when no published configuration exists. On a configured
website, leaders see **Continue with Google**, not a backend setup form.

The Supabase Google provider and existing admin membership must already be set
up. Keep the site URL and redirect allowlist pointed at the actual PackOps URL.
Do not repeat the database/bootstrap setup if it has already been completed.

## Review and deliberate deployment

PR validation runs tests and builds a downloadable `packops-review-build`
artifact. It does not deploy. Without the public values, that artifact is for
code review/local setup, not ready for leader onboarding.

1. Review the PR and confirm the public values above.
2. Before merging, check GitHub Settings → Pages. If it currently publishes from
   `main`, merging is itself a deployment; obtain the owner's go-ahead first.
3. For build-variable configuration, change Pages **Source** to **GitHub Actions**
   when ready to release. Branch-based Pages publishing does not inject variables.
4. Merge only after review and approval, then manually run **Deploy PackOps
   (manual)** on `main`. The workflow rejects missing/invalid public config, runs
   tests, and publishes only `dist/`. It cannot deploy a feature branch and does
   not run automatically on a push or PR.
5. Confirm Settings says the connection is configured automatically. Installed
   PWAs use a cache version derived from the built assets, so config-only changes
   also refresh the application shell. No IndexedDB or login storage is cleared.

Rollback: revert the reviewed frontend commit and redeploy the known-good build.
This update requires no database rollback.

## Why invitation emails were missing

The original PackOps leader approval action only wrote `member_invites`; it did
not call any email service. The new form explicitly separates saving approval
from the optional **Also email the PackOps sign-in link** checkbox. Email failure
does not remove the saved approval. The leader can always use the normal website
link and sign in with the approved Google email.

If the missing email came from **Supabase Dashboard → Invite user**, that is a
different Auth email system. Supabase's default SMTP is restricted to project
team addresses; arbitrary leader emails require custom SMTP there. Google
sign-in plus PackOps approval does not require sending a Supabase Auth invite.
Adding someone to your Supabase organization is not how you grant PackOps access.

## Enable the optional invitation sender

Use the existing Resend setup if already configured. Otherwise a verified sender
domain and a server-side sending API key are required. Set these only in
Supabase Edge Function secrets:

- `RESEND_API_KEY`: the email provider key, never in GitHub/frontend code.
- `RSVP_FROM_EMAIL`: an address on your verified sending domain.
- `PUBLIC_SITE_ORIGIN`: `https://magorski87-png.github.io`
- `PUBLIC_SITE_PATH`: `/PackOps179/`

After reviewing the functions, deploy to the confirmed existing project:

```sh
supabase functions deploy leader-invite --no-verify-jwt
supabase functions deploy family-rsvp --no-verify-jwt
```

The new leader function explicitly verifies the caller with Supabase Auth,
checks active admin/cubmaster membership, and reads only an existing unconsumed
approval in that Pack. Its database client uses the caller's JWT and RLS; it
does not use a service-role key. Recipients, role, and website cannot be supplied
as arbitrary email content. Retried leader messages use a provider idempotency
key. No email is sent on app load, login, or refresh.

The UI reports **accepted by the provider**, not guaranteed inbox delivery. For
missing messages, inspect Resend delivery/bounce logs using the returned email
ID, verify sender-domain status and recipient restrictions, then check spam.
Provider rejection or missing configuration is displayed as a failure. Family
RSVP errors preserve the newly generated private link for manual sharing.

## Repeated Google security alerts

Calendar and Drive previously forced `prompt: 'consent'` each authorization.
They now use account selection without forcing repeated consent. Tokens still
remain in memory for those integrations, existing sessions are reused, and new
permissions still require consent. Supabase login keeps its existing PKCE and
persisted session behavior. We do not revoke grants or repeatedly log users out.

Google's account security notifications are controlled by Google, not PackOps.
The exact sender/subject is needed to distinguish those from Supabase security
emails, GitHub notifications, or app email. This change does not claim to turn
off those alerts or prove what caused them.

## Verify a new Den Leader

1. As an existing admin, approve a test leader's exact Google email as
   **Den Leader**, with their den (for example, Webelos). Optionally send email.
2. On a fresh browser profile/device with no PackOps settings, open the published
   app → Settings → **Continue with Google**. No URL, key, or UUID entry is needed.
3. Confirm the correct email, `den_leader` role, and assigned den. Refresh and
   reopen the app; the existing Supabase session should remain usable.
4. Check with fictional data: assigned-den access works; another den's roster,
   finance records and admin permission changes remain denied by the server.
5. Try an uninvited account: Google sign-in may succeed but Pack access remains
   awaiting approval. A suspended membership must remain denied.
6. Check the existing admin/treasurer device and existing records are intact.

Local tests mock external services. Production Google OAuth, actual email inbox
delivery, and database RLS require these live checks. The SQL smoke test at
`supabase/tests/packops_schema_rls.test.sql` must be run in a prepared test
database; it is not automatically run against production.

References:
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/auth/auth-smtp
- https://developers.google.com/identity/oauth2/web/reference/js-reference
- https://support.google.com/accounts/answer/2590353
