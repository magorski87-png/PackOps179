# PackOps Calendar Setup — Pack 179

## Best approach: reuse Scoutbook's official events

Scoutbook Plus is the authority for event dates, invitations and RSVPs. Instead of separately entering every Pack event into Google Calendar:

1. In Scoutbook Plus (`https://advancements.scouting.org/`), switch to Pack 179 and open **Calendar**.
2. At the bottom of the Scoutbook calendar page, find the Pack calendar's **.ics subscription URL**. Copy it. If you need specific den events too, subscribe to those den calendars separately.
3. On a **computer**, open Google Calendar. Next to **Other calendars**, click **+** → **From URL**. Paste the Scoutbook subscription URL and add it.
4. Verify the subscribed calendar appears under **Other calendars**. Google may take hours to refresh subscribed calendar entries.
5. Open PackOps → **Settings** and provide a Google Cloud OAuth *Web client ID*. The OAuth web app must authorize your GitHub Pages origin (and the local test origin, when used). Enable **Google Calendar API** and configure the OAuth consent screen for the `https://www.googleapis.com/auth/calendar.readonly` scope.
6. In PackOps → **Pack Calendar**, choose **Connect Google Calendar**, choose the Pack/Scoutbook subscribed calendar, and refresh events. The dashboard will show upcoming events, but only after that authorization and refresh.

**Important:** A Scoutbook .ics subscription URL can reveal calendar information. Do not paste it into a public GitHub source file or an unauthorized website. Only share it with people intended to read the Pack calendar.

## If you only have the Pack calendar PDF

PackOps has a shortcut to the official PDF, but cannot transform the visual PDF automatically into verified Google events. Reconcile the dates and times first, then enter them into Scoutbook, or prepare a reviewed `.ics` file and import it into Google Calendar using Google's import function. Avoid creating duplicate entries if Scoutbook already contains those events.

## Alternative: a manual .ics snapshot

For testing or offline working use, PackOps can import an `.ics` file directly into its own local browser database. These events show on the upcoming list, but they **do not sync automatically**. Reimport the file when it changes. For recurring events, the Google Calendar connection is recommended because the lightweight `.ics` snapshot parser does not expand recurrence rules.

## Google access and safety

- Google OAuth access tokens stay in browser memory and are not committed to GitHub or persisted to the database.
- Google Calendar access is **read-only** and the app only loads the chosen calendar's upcoming event dates, title and location (not attendee lists).
- Google Calendar OAuth scopes may require Google's app verification for multi-user public deployment. Test using an authorized Google Cloud test user before expanding access.
- PackOps v0.2 does not automatically refresh Google events while closed or write events back to Google Calendar.
