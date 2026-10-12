# PackOps 179 — Sources, Annual Dues, and Disaster Recovery

## Principles

1. **Official Google Drive files remain the source of truth.** PackOps never rewrites the treasurer's financial ledger or individual Scout credit Google Sheet without an explicitly authorized future sync/write feature.
2. **Every mutable local record can be preserved in an encrypted restore point.** In Settings → Encrypted Backup & Rebuild, choose Download or an explicitly selected Drive backup folder. No background sync exists yet.
3. **Store encrypted backups in a restricted Pack Drive folder.** The application cannot verify folder sharing restrictions and cannot recover a lost passphrase. Never commit Scout data, ledger exports, backups, or private receipts to GitHub.
4. **Different devices are not live-synchronized.** Restore is a point-in-time replacement, not a merge. Back up before clearing storage, installing on another device, or changing browsers. Don't make simultaneous edits to two unsynchronized copies.

## Live authority and imports

| Information | Official source | PackOps behavior today | Rebuild action |
|---|---|---|---|
| Upcoming events | Pack 179 Google Calendar | Read-only authorized Google Calendar session or an imported ICS snapshot | Reconnect Calendar, or restore imported ICS events |
| Membership and guardian contacts | Scoutbook Plus / exported roster | Local CSV import, filter, export; no Scoutbook write access | Reimport authorized roster CSV or encrypted PackOps backup |
| Treasurer transactions / cash | 2026–27 treasurer ledger XLSX in Pack Drive | Read-only CSV import; classification tags stored locally | Reimport current ledger CSV and restore local category/event tags from encrypted backup |
| Scout credits and dues owed | 2026–27 Individual Scout Credits Google Sheet | Read-only authorized refresh or CSV import; calculations compare to PackOps dues | Refresh authorized Google Sheet or import its current CSV, then restore any separate local proposals from encrypted backup |
| Individual dues amount | Per-year PackOps setting (from reviewed Pack decision) | Stored separately as `financeDues:YYYY-YY`, included in encrypted backup | Restore encrypted backup or re-enter dues for the selected year |
| Draft budgets, targets, categories, projections | PackOps working records based on approved source documents | Stored locally, distinguish plans from actual ledger transactions | Restore encrypted backup |
| Reimbursements, proposed adjustments, notes, task assignments | PackOps working records; payment confirmed only by ledger | Local workflow, must be matched to official ledger before marked paid | Restore encrypted backup |
| Receipt originals | Pack Drive receipts folders after explicitly authorized uploads | Queued locally before upload; official Drive files are not deleted on local clear | Restore local queued receipts from backup and open existing Drive folders |
| Equipment and meeting outlines | Local PackOps working records | Saved locally | Restore encrypted backup |

## Scout-year dues

Go to **Settings & Drive → Scout year & Pack dues**, enter a year such as `2027-28` and its dues amount, then save. Each year has a distinct setting; changing the 2027–28 rate does **not** change 2026–27. The 2026–27 template currently provides an initial planning assumption of $105; future years are **not** assigned a rate automatically. A zero-dollar dues rate is allowed when deliberately selected.

**Important:** The official 2026–27 Google Sheet presently has a formula deducting $105. Changing dues in PackOps does not change that formula. Imported balances remain authoritative, and any difference from the configured dues is flagged for review rather than silently corrected.

## Make a restore point in Drive

1. Open PackOps on a trusted device and go to **Settings & Drive**.
2. Configure the Google OAuth client ID and Google Picker API key for the PackOps web origin (only public client configuration, **never** an OAuth client secret).
3. Choose **restricted Drive backup folder**, selecting a destination only authorized Pack leadership can access.
4. Under **Encrypted Backup & Rebuild**, enter a strong passphrase of at least 12 characters and choose **Upload encrypted backup to Drive**.
5. Save the passphrase separately in a trusted password manager. Confirm that the new `PackOps179-YYYY-MM-DD.encrypted.json` file appears in the selected folder.

Alternatively choose **Download encrypted backup** and manually place it in your restricted Pack Drive folder.

## Rebuild on a new phone or computer

1. Open the PackOps PWA on the new device in a trusted browser.
2. Download the latest encrypted backup file from restricted Pack Drive.
3. In Settings → **Restore PackOps from a backup**, choose the file and enter its passphrase.
4. Review the recorded categories/counts and explicitly authorize **replacement of all local data on that device**. A single IndexedDB transaction restores the records or fails without intentionally doing a partial restore.
5. Reconnect Google Calendar and Google Drive. These authorizations and API configuration are intentionally not backed up.
6. Refresh authoritative source data if the treasurer, Scout-credit Sheet, or calendar changed after the backup.

**Recovery limitations:** There is no automatic background backup, no multi-person authentication, no real-time cross-device editing, no Google Sheet two-way synchronization, and no automatic conflict resolution in this version. Full, secure multi-leader sync requires a protected backend with role-based authorization and an auditable sync protocol.

## Restore integrity and privacy

Encrypted backups use AES-256-GCM with a fresh random salt and nonce, with a key derived from the supplied passphrase using PBKDF2-SHA256 (250,000 iterations). Restore validates format, table names, record keys, and duplicates before performing a single atomic local replacement. The backup includes local blob attachments up to 30 MB each and up to 150 MB overall in plaintext. Larger receipts should reside in Drive. A lost passphrase cannot be reset.

PackOps's GitHub Pages site and repository are publicly accessible. Never store youth records or financial data in the repository, bundled JavaScript, or public Pages assets.
