# Keeping PackOps available

The **Keep PackOps active** GitHub Action queries a small Supabase database
function at 02:23, 08:23, 14:23, and 20:23 UTC daily. It runs independently of
phones, browser tabs, and sign-in sessions. No secrets need to be configured:
it uses the existing public deployment configuration.

`public.packops_heartbeat()` returns only database time and an OK flag. It is
read-only, runs with caller permissions, and does not read or modify roster,
finance, or other Pack records. The check requires HTTP success and the expected
JSON response; authentication errors and missing endpoints are failures. Each
request times out after 15 seconds, with up to three attempts.

## Installation and verification

1. Apply `supabase/migrations/20261026020757_packops_heartbeat.sql` to the Pack
   Supabase project (already applied if installed by Codex).
2. Keep `.github/workflows/heartbeat.yml` on the default `main` branch with
   GitHub Actions enabled. The initial workflow change triggers a verification run.
3. Open **Actions → Keep PackOps active** for results or **Run workflow** to check
   manually. Locally, use `npm run check:heartbeat` with Node 22 or newer.
4. GitHub's normal failed-workflow notifications follow your GitHub notification
   settings. This does not create a separate email service or guarantee delivery.

## Preventing the scheduler itself from stopping

GitHub disables scheduled workflows in public repositories after 60 days without
repository activity. A separate job updates `.github/heartbeat-schedule.timestamp`
every 25 days and commits only that file. This job has `contents: write`; the
database check has read-only repository access. The timestamp records schedule
maintenance, **not** the last successful database check. See Actions for database
results. The maintenance job still runs when the database check fails.

The maintenance commit uses GitHub's built-in token, does not force-push, and does
not trigger another workflow run. If repository rules later block automated
commits, the maintenance job fails visibly and those rules need to be addressed.

## Limits and recovery

This is a best-effort free-plan keepalive, not a guarantee against pausing.
Supabase assesses database activity over a week; a few daily database requests
are typically sufficient. GitHub can delay or drop scheduled runs. Only a paid
Supabase plan removes inactivity pausing by policy.

An already paused project must be resumed in the Supabase dashboard; the probe
cannot resume it. After it is healthy, run the workflow once to verify recovery.
Disable this workflow in Actions to stop both the probes and activity commits.

References:
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow
