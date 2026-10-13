# Automatic PackOps Google sign-in

Implementation is on a separate branch with the owner's public configuration supplied.
Do not merge/deploy without production approval and passing release checks.
No database migration or data import is needed for this change.

## One-time configuration (Pack administrator)

Edit cloud-config.js with the existing project's Project URL, publishable key
(preferred: sb_publishable_...), and Pack UUID. Legacy anon keys remain supported.
Do not create a new Pack or substitute an Authentication user UUID.

Confirm the Pack in the existing Supabase project's SQL Editor with this read-only query:

```sql
select id, name from public.packs order by name;
```

Choose the row for Pack 179. If multiple rows match, confirm the one containing your
existing records and membership before publishing. The owner confirmed Pack UUID
`bcf48631-8f33-4c66-b1ca-1573c769fd1b` on October 13, 2026. The public project URL
and publishable key supplied by the owner are now in cloud-config.js. The URL uses
the project origin, without the `/rest/v1/` API path. This confirmation is from the
owner; no privileged database lookup was performed.

Only public connection identifiers belong in cloud-config.js. Google OAuth Client
Secret stays in Supabase Authentication's Google provider. Never put secret/service-role
keys or database passwords in source, Actions variables, browser forms, or this file.
The validator checks key format/type; Supabase verifies keys and RLS authorizes access.

This source file is deliberate: current GitHub Pages runs use branch-based deployment,
which serves repository files without running tools/build.mjs. Merely adding Actions
environment variables would NOT configure that site. The same source configuration
also works in dist when built. No Pages settings or production deployment workflow
are changed by this PR.

## Behavior

- New phones and PCs use the shared configuration automatically.
- Shared configuration takes priority as a complete unit over old device values.
  Saved device settings and local records are left intact.
- With shared config present, Settings displays Google sign-in, not backend fields.
- Blank shared config preserves current local/manual behavior; legacy connection
  controls are collapsed under Administrator setup.
- Partial/invalid config fails clearly without mixing in old device values.
- Supabase still activates only administrator-created, email-matched invitations.
  Unapproved/suspended accounts gain no membership through this change.
- Calendar/Drive authorization is separate from PackOps sign-in.
- The shell cache version changes so installed apps can receive the new code.
  Reopen/reload the app after an approved deployment; do not clear site data.

## Validate before release

```sh
npm ci
npm test
npm run build
npm run build:production
```

build validates nonempty configuration and produces the existing static dist output.
build:production additionally requires all three values; it intentionally fails
until the real public values are supplied. CI runs tests/build, checks the new
module exists in dist, and runs the strict build when configuration is supplied.
CI only validates: it does not deploy this branch.

The existing SQL test suite requires a configured disposable/local Supabase stack:
supabase test db. This PR leaves SQL/RLS policies and role logic unchanged.
Do not run migrations/reset against production to test this frontend change.

## New Den Leader acceptance check after approved deployment

1. In your existing admin account, open Settings > Users & permissions.
2. Approve/invite the exact Google email, role Den Leader, and the appropriate den.
   This records authorization; this existing control does not send a leader email.
3. Open the normal PackOps URL in a fresh browser profile or another device.
4. Open security settings and choose Continue with Google. No URL/key/Pack UUID
   entry should appear or be required.
5. Sign in using the invited Google account. Confirm Approved / den_leader and the
   expected den access; finance/admin functions must remain restricted.
6. Test an uninvited Google account: it must remain awaiting approval with no Pack
   workspace access. Check suspended membership and out-of-den access as well.
7. Confirm the existing Treasurer still has the assigned finance role and access.

Use the existing Google provider and allowed redirect URL
https://magorski87-png.github.io/PackOps179/ in Supabase Auth.
Live Google redirect, membership, and RLS behavior must be checked on your configured
project; unit tests do not prove your live dashboard settings.

Merge to main may automatically deploy the current branch-based Pages site.
Get deployment approval first. Reverting this PR restores the previous frontend;
no user data is migrated, overwritten, or erased.
