# PackOps 179 — Finance and leader workflow update (review branch)

This branch adds editable budget allocations, filtered Scout-account proposals, individual-family invitation preview, direct event-lead editing, and more reliable phone attachments. Finance now has a protected transaction screen with submit, reviewer approval, payment verification, audit history and an optional verified ledger bridge. The entry fields match Courtney's live working ledger. Its current Drive storage format is `.xlsx` even though Courtney edits it in Google Sheets. Automatic posting requires her to approve a Google Sheets format ledger as the authoritative file; the existing working file is never changed or replaced silently. See [Finance workflow setup](FINANCE_WORKFLOW_SETUP.md) for the release checks and needed information. The published website remains on its current version until this branch is deliberately merged.

`npm ci`, `npm test` and `npm run build:production` validate this code. Backend migration 008 and the Edge Functions must be installed before the secure transaction screen can accept entries. No privileged key is bundled with GitHub Pages.

---

# PackOps v0.6 — Secure Shared Workspace & Family Responses

This release adds **equipment search, category filters, editing, quantities and CSV export**, a **Den Leader meeting/adventure workspace**, a **family RSVP, poll and volunteer response portal**, plus source code for **Supabase Google login, approved users, den-restricted database records, shared finances, Real-time update signals, audit history, private receipts metadata and encrypted administrator backups**.

**SECURITY / DEPLOYMENT STATUS:** GitHub Pages serves the frontend, but the Supabase cloud service is **NOT automatically provisioned**. Do not import real youth records to the cloud until you complete `SUPABASE_SETUP.md`, apply and test the SQL policies, configure Google OAuth and deploy the Family RSVP Edge Function. Without a configured cloud, PackOps remains a device-local workspace, and no family invitations can be sent.

The Pack's official treasurer ledger, individual Scout credits, receipts, and source documents remain in Google Drive; Google Calendar and Drive permissions remain separate. Neither SignUpGenius nor Scoutbook Plus has a live API connector. SMS/push, multi-question surveys, enforced volunteer slot limits and offline queued synchronization are not included in this iteration.

[Read the secure PackOps v0.6 setup instructions](SUPABASE_SETUP.md).

---

# PackOps 179 · v0.5 Cub Scout Theme & Ledger-Based Finance

**Pack 179 income policy:** Pack operations are primarily supported by annual dues. A VFW or another community organization may make occasional donations, but the budget assumes **$0 donations** until explicitly planned. The Pack currently receives **$0 operating fundraising income from popcorn sales**. Scout popcorn earnings belong in individual Scout-credit accounting, not Pack revenue.

## What's new

- **Cub Scouts colors:** The interface uses blue **#003F87** and yellow **#FCD116**, with higher-contrast typography and a lighter mobile dashboard. PWA metadata and SVG icon match the theme.
- **Start Finance with the ledger:** Open **Pack Finance → Overview → Import treasurer ledger CSV**. Export the relevant tab from Courtney's official ledger workbook as CSV in Google Sheets or Excel. The app previews cash deposits, withdrawals and the last listed running balance, highlights balance discrepancies, then asks permission before replacing only that Scout year's **local snapshot**.
- **Safe cash accounting:** Raw deposits/withdrawals are displayed separately from **classified Pack income and actual expenses**. Transfers, reimbursements, restricted Scout credits, and popcorn proceeds are not automatically recognized as Pack income. Review classification manually under Ledger Review; a user-confirmed suggestion option recognizes obvious annual-dues or VFW-donation descriptions.
- **Year-specific budget planning:** The Budget Wizard forecasts annual dues and optional VFW/community donations. Popcorn Pack proceeds default to zero, without affecting personal Scout popcorn credits. The legacy $3,000 popcorn-income line in prior budgets is retained for audit but excluded from Pack operating-income totals, with a visible warning to review that obsolete draft.
- **Backups:** Local budget records and ledger snapshots can be encrypted and recovered using Settings. This is not live multi-user synchronization.

**Current limitation:** The treasurer ledger import accepts **CSV**, not direct XLSX. The original Drive workbook is never edited. For current figures, export and reimport an updated CSV whenever Courtney revises the ledger. The reported balance is the **last balance listed in the imported ledger**, not a direct banking connection. Do not treat unclassified deposits as earned income or a forecast as available cash. Do not place Scout financial records on public GitHub Pages or a shared device.

---

# PackOps 179 · v0.4 Calendar Workspaces & Budget Wizard

This is a mobile-first, installable PWA. Its GitHub Pages code is public. **Never put private Scout or finance data in the GitHub repository.**

## Calendar → Event Workspace

From **Pack Calendar**, authorize Google Calendar, select Pack 179, and refresh. Clicking **Plan this event** creates one local workspace for the Google event; **Open workspace** reopens it. Later refreshes update its title, date, time, location, description and original link without erasing checklists, notes, event budget lines, receipt links, reimbursements, assignments or attachments. Google Calendar and Scoutbook are never written to by this integration. A ChatGPT Google connection does not automatically authorize the deployed PWA.

## Guided budget planning

Use **Pack Finance → Budget Builder → Guided Budget Wizard**. Choose the 2026–27 template, prior-year PackOps budget or a blank draft. Enter Scout/adult counts, active-year dues and fundraising assumptions; edit all proposed annual expenses; then review income, expenses, fundraising gross-sales target and funding difference. Save explicitly as a **DRAFT**. The app atomically archives and replaces only the active year's budget. The treasurer ledger and other Scout years remain untouched. This is not a committee approval.

## Year-specific records and reporting

**Settings & Drive → Authoritative Google Drive sources** accepts separate Scout-credit sheet, treasurer ledger workbook, approved budget document and receipts folder links for every Scout year. Authorized native Google Sheets account refresh is read-only. Treasurer XLSX ledger actuals still require a CSV import. Reimbursements now link to persistent event workspace IDs; receipt intake and budget lines also attach to events. Financial alerts flag ledger classification gaps, budget overruns, older snapshots, pending reimbursements and Scout-account discrepancies. Reports export Scout-name-free category summaries, with print isolation. Forecasts offer baseline and downside estimates.

## Safe recovery

Create and upload an encrypted backup to a restricted Drive folder in Settings to recover local records on another device. Restore is a point-in-time **replacement**, not shared synchronization; it does not alter official Google sources. Read [DATA_RECOVERY.md](DATA_RECOVERY.md).

**Not yet production-ready:** No enforced multi-user backend or real-time cross-device sync, automatic Excel ledger updates, parent self-service submission, Google Calendar writes, or production-ready receipt OCR. These need a secure backend and account setup. Keep private Scout data off shared devices.

---
# PackOps 179 · v0.3 Finance Expansion

A mobile-first, installable leadership PWA for Pack 179. Public app code; **Pack documents and Scout financial data must remain private**.

## What's working in this build

- The original ten-button PackOps dashboard, events and checklists, volunteers, printable meeting cue sheet, roster importer, equipment, library, and calendar connection.
- **Pack Finance** with six connected screens: Overview, Budget Builder, Scout Accounts, Reimbursements, Ledger Review, and Reports & Forecasting.
- **Budget Builder:** Annual income/expense allocations, optional PackOps event assignment, a locally recorded planning baseline. Includes one-click **seed from your uploaded 2026–27 Budget Planner** with $7,116 in proposed expenses, $4,305 planned dues, and a separately identified $3,000 popcorn proceeds goal. The $2,500 beginning-balance assumption is NOT recorded as income. Older local planning lines are preserved when upgrading.
- **Official ledger snapshots:** CSV import (not editing Courtney's Excel workbook); classification as expense, income, transfer, or restricted allocation; optional category and PackOps event tags. Transfers are never automatically counted as spending.
- **Scout accounts:** Either import the 2026–27 individual-credits sheet as CSV or explicitly authorize the app to read the Pack's existing Google Sheet via `spreadsheets.readonly`. Sort and filter by den, search, review mismatches, and export restricted views. The Google Sheets request deliberately excludes guardian contacts.
- **Scout account adjustments:** Proposed credit/charge corrections with reason and export for treasurer review. They **do not change** the official sheet or the imported official balances.
- **Reimbursements:** Submit a local request tied to a PackOps/Google Calendar event title, optionally attach an existing locally queued receipt; mark locally reviewed or declined; mark paid only after matching an imported categorized ledger expense of the same amount. **No payments are initiated.**
- **Receipt uploads:** Capture photo/PDF to local IndexedDB, edit line-item descriptions, quantities, unit prices and expense categories; manually upload to a Google Picker-selected Pack Drive folder when authorized. Receipt line items are **not** additional ledger transactions.
- **Forecasting and reports:** Local estimate using imported cash balance plus forecast future inflows/outflows, reserve and designated funds; printable committee category summary and CSV export without personal Scout finance data.
- **Installable Android PWA:** Standalone manifest, icon, scope, service worker, install action and phone-friendly Finance tabs. Cached shell works offline after first load.
- **Pack calendar:** One-button selector for the verified `Pack 179 Calendar (26–27)` and read-only event refresh after authorization.

## Source-of-truth policy

1. **Official treasurer ledger**: https://docs.google.com/spreadsheets/d/1tETtLSogYC3RFvHj_uDbAxgyGu9QcqXO/edit
2. **Individual Scout credits**: https://docs.google.com/spreadsheets/d/1ttivHLcq0bopzuKJrlUM1farkG287dM1Krts3Q-NZYQ/edit
3. **Budget Planner template**: Planning structure, *not* an authoritative balance.
4. **PackOps**: Locally saved planning, categorization, receipt intake, reimbursement queue, and reports based on imported snapshots. Never writes to the official ledger or Scout-credit sheet.
5. **Scoutbook Plus**: Official member/advancement/RSVP system. Google Calendar is the selected schedule feed; PackOps organizes event preparation separately.

## Very important: not production-secure for shared youth data

This version **does not have centrally enforced app authentication, backend roles, or cross-device synchronization**. It uses browser IndexedDB for working data. Authentication with Google establishes only which files Google allows that signed-in person to read or write. It is **not** a substitute for app-wide role enforcement or protection of locally cached Scout data.

**Do not** import real Scout rosters or Scout credits on a shared device. Never commit CSV exports, scanned receipts, local browser backups, Firebase service-account keys, or access tokens to GitHub. For use by multiple leaders, first deploy an authenticated backend and enforce role permissions server-side. See `docs/PRODUCTION_SECURITY.md`.

### What isn't fully connected yet

- No automatic read of the `.xlsx` treasurer ledger. Open it in Drive and export the current sheet to CSV to import. The source workbook remains untouched.
- No automatic two-way sync of budgets, reimbursements, adjustments, or notes between phones/computers.
- No centrally verified committee approval or treasurer role enforcement. "Reviewed" and "paid" are local tracking indicators that need verification.
- No real OCR engine yet; receipt itemization is entered manually. A secured, consented OCR service can be added later, with human reconciliation required.
- No automatic Scoutbook RSVP API integration. An event may be linked by its event title and PackOps workspace, regardless of attendance.
- No notification backend or payment processor; nothing sends money, sends email, or modifies authoritative files without deliberate action.

## Run and test

Node 22+ is recommended. No runtime npm dependencies.

```bash
npm ci
npm test
npm run build
npm run serve
```

The server starts on `http://localhost:4173` (or `PORT=4193 npm run serve`). The GitHub Pages workflow deploys the static `dist/` directory after tests pass.

## Deploy to the existing GitHub project

Repository: https://github.com/magorski87-png/PackOps179

**Backup first**: If you have locally saved plans/receipts on any device, keep that browser profile intact; do not clear site storage or uninstall the existing PWA until the upgrade is verified. IndexedDB schema migrations preserve current local stores, but private browsing, clearing site data, or switching origins can delete local data.

1. Extract the ZIP on your computer, retaining hidden `.github` and the `tests/`, `tools/` directories.
2. Copy/commit the ZIP contents into the **root** of the existing `PackOps179` repository, replacing older source files. Do **not** commit `dist/` (GitHub Actions builds it).
3. In GitHub → Actions verify that **Deploy PackOps** ran successfully after the commit.
4. Open https://magorski87-png.github.io/PackOps179/ and hard-refresh if you see stale content. Look for the `Pack Finance` button and six Finance tabs.
5. On Android Chrome, open the site → menu `⋮` → **Install app** (not just a webpage bookmark). Launch via the PackOps icon. Some browser/Android combinations display different installation wording.

## Connect Google services (you set this up once per device)

1. Create an OAuth **Web application client** in your Google Cloud project and authorize the JavaScript origin `https://magorski87-png.github.io` (origin only, no path). Configure the OAuth consent screen and test users appropriate to your organization.
2. Enable the **Google Calendar API**, **Google Sheets API**, and, for manual receipt uploads, **Google Drive API and Google Picker API**.
3. Open PackOps → Settings, enter the public OAuth **Client ID** (not client secret) and Picker API key. Restrict the API key to your site and enabled Picker API per Google Cloud guidance.
4. In **Pack Calendar**, click **Use Pack 179 Calendar (26–27)**. Authorize `calendar.readonly` when prompted.
5. In **Pack Finance → Scout Accounts**, click **Refresh Scout accounts from Google Drive** on a private device. Approve `spreadsheets.readonly`. It only reads the existing authorized sheet; Google still enforces file sharing.
6. In **Receipt Upload**, click sign-in and explicitly select your Pack's correct receipt destination folder using Google Picker. `drive.file` access is requested for user-selected files; no upload happens until you click Upload.

A Google Cloud consent screen may require configuration/verification for third-party users. The free Google APIs may have quotas; any enhanced OCR backend could incur usage costs.

## Finance review workflow

1. **Plan:** Add expense/income allocations in Budget Builder; do not copy old sample actuals as authoritative.
2. **Ledger:** Download the active `.xlsx` treasurer worksheet as CSV and import a read-only snapshot under Ledger Review.
3. **Classify:** Label transactions as expense/income/transfer/restricted; assign category and linked PackOps event. No source workbook writes.
4. **Accounts:** Refresh Scout credits using authorized Google Sheets read-only access; review discrepancies rather than auto-correcting.
5. **Receipts:** Capture receipt, enter line items, and upload to the chosen Pack Drive folder when authorized.
6. **Reimburse:** Create request; attach queued receipt; treasurer reconciles in the official ledger, then locally matches the expense.
7. **Report:** Build a forecast based on explicit assumptions; print or export the committee category-only summary.

## Versioned code

- `finance.js`: Ledger/credit parsing, aggregation, export and reimbursement rules.
- `finance-ui.js`: Finance screens built from the shared PackOps state.
- `finance-google.js`: User-consented read-only Google Sheet access, tokens in memory only.
- `db.js`: IndexedDB schema version 3; existing local data migration.
- `app.js`: Integration with buttons, forms, receipt itemization, PWA install and calendar shortcut.
- `styles.css`: Mobile/desktop Finance layout.
- `tests/`: 23+ automated tests using fictional data.
- `.github/workflows/deploy.yml`: test/build/deploy on push to main.
