# PackOps — Pack 179 Leadership Dashboard (v0.1)

A functioning, responsive desktop/mobile Progressive Web App (PWA) for Cub Scout leadership, built as a dependency-free static website. PackOps does **not** replace Scoutbook Plus.

## Included right now

- Ten dashboard shortcuts: Pack Calendar, Budget, Upload Receipt, Pack Meeting, Volunteers, Event Status, Roster, Equipment, Cubmaster Assistant, and Pack Library.
- **Live links** to the verified Pack 179 master calendar PDF, authorized leadership Drive folder, treasurer ledger, and year-specific receipts folder.
- **Locally functioning** events, notes, attached files, checklists, volunteer roles, email drafts, budget planning entries, equipment, personal link shortcuts, and a weekly priorities/briefing view.
- Reusable, customizable Pack Meeting cue sheet with quick/full views and browser print support.
- Private **CSV roster import review** recognizing Scoutbook-like exports with a title row before the table headers; warns about missing fields, duplicate names, and invalid email, retaining uncertainty. No automatic merges. Scoutbook is still authoritative.
- Receipt capture from camera/file picker into IndexedDB, followed by optional manual upload to a Google Picker-selected Drive folder. **Requires your own Google OAuth configuration and explicit login.**
- Installable PWA with offline static shell cache.

## Not yet included

- No central user accounts, roles, shared database, background email service, or two-way multi-device synchronization.
- No official Scoutbook Plus API or write-back.
- No live financial balance reconciliation or automatic AI reports.
- No server-based safeguards for youth contact records: local roster data exists in the browser that imports it. Only use trusted, non-shared devices for this feature.

## Run locally

Recommended: use the included Node server or VS Code Live Server. Direct `file://` opening does not support IndexedDB/Service Workers correctly in all browsers.

```bash
npm install
npm test
npm run build
npm run serve
```

Open `http://localhost:4173` in your browser. Files are copied into `dist/` for deployment by `npm run build`.

## Deploy using GitHub Pages

1. Create a new GitHub repository, e.g. `packops`, with a standard `main` branch.
2. Upload all files/folders from this zip (including `.github/workflows/deploy.yml`, `tools/`, `tests/`, `package.json`, and `package-lock.json`). **Do not upload only `index.html`.**
3. In the repo Settings → Pages, choose **GitHub Actions** as the deploy source.
4. Push to `main`. The included workflow runs tests, copies the website to `dist/`, and deploys to Pages. The app URL should look like `https://YOURNAME.github.io/packops/`.
5. Open the site on your Android phone in Chrome; use the browser's **Install app** or **Add to Home Screen** action.

**Privacy:** GitHub Pages sites are publicly accessible even when individual Google Drive files are protected by their own permissions. Do not place family roster files, secrets, or unprotected financial records in the repository. Everything entered in PackOps itself is only in your browser's local storage in v0.1.

## Optional: Configure direct Google Drive receipt uploads

To do this, use a Google Cloud project controlled by an authorized Pack administrator:

1. Enable the **Google Drive API** and **Google Picker API**.
2. Configure the OAuth consent screen. Request the `https://www.googleapis.com/auth/drive.file` scope, not the broader full-Drive scope. Additional publishing/verification restrictions may apply depending on Google requirements and the users authorized.
3. Create an OAuth **Web application** client. Set authorized JavaScript origins to the exact Pages origin, e.g. `https://YOURNAME.github.io` (no path), and your `http://localhost:4173` testing origin.
4. Create a Google Picker browser API key and restrict it to your site's origin and appropriate API(s).
5. In PackOps Settings, enter the **OAuth client ID** and **Picker API key**; sign in to the authorized Google account, then explicitly select the Pack's **2026–27 receipts folder**.
6. Take a photo in PackOps → Upload Receipt, save it locally, and then press **Upload to Drive**. Confirm the file is visible in the chosen Drive folder.

A selected destination remains stored on your device; the OAuth access token stays in memory and will be requested again when needed. **Do not enter service account passwords, private keys, or OAuth client secrets into the website.**

For broad multi-leader access, shared sync, role-based privacy, delegated email delivery, and automated reminders, v2 should use a small authenticated backend and a purpose-built data model rather than treating Sheets alone as a multi-user application database.

## Notes on calendar links

The Pack calendar button points to the verified document `2026-2027 Pack 179 Calendar - Current.pdf`. Updating the *same Drive file* leaves the link valid. Replacing it with a new file ID requires updating the app link (`LINKS.calendar` in `data.js`) in this version.

## Source architecture

- `index.html`, `styles.css`, `app.js`: responsive UI and interaction handlers.
- `data.js`: Pack links, meeting template, helper functions.
- `db.js`: IndexedDB persistence.
- `roster-import.js`: CSV parser and review flags.
- `drive.js`: Google Picker/OAuth and explicit receipt upload.
- `sw.js`: offline PWA shell cache.
- `tests/`: unit tests.
- `tools/build.mjs`: static build with no bundler or dependency installation.

PackOps v0.1 is intentionally designed for immediate personal utility before adding shared record synchronization.
