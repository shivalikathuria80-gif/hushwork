# App events: start a workflow when a new email or calendar event arrives

Gap 3 from the Start links QA (commit ce24129). The Builder offered "When an email arrives", but nothing ever fired it.

## Informal draft

People already get a start link for forms. Most of their work does not arrive through a form, it arrives in their inbox and their calendar.
So the Start step "When an email arrives" should really fire, and a new one, "When a calendar event is added", should exist. Both should take a
small filter (which emails, which events), start the workflow by itself, hand the email or event to the AI as `{incoming}` (the same tag a start
link uses), and still never send anything without the person's Approve. Gmail push needs Google Pub/Sub, which is heavy to set up, and the clock
already calls Hushwork every minute, so Hushwork simply looks every 2 minutes. Stripe is not connected (owner's choice), so no payment events.

## Formal draft

**What the person does.** In the Builder, set Start to "When an email arrives" (optional: which emails, in Gmail's own search words such as
`from:ana@example.com` or `subject:invoice`) or "When a calendar event is added" (optional: words in the title). Publish. The save message says
what is now being watched. The Start links page shows a "From your apps" section: one card per watch, with on/off, "Check now", when it last
looked, a 14-day strip and the arrivals list.

**Data** (`supabase/app-events.sql`, run once):
- `app_watches`: one row per workflow (source `gmail` or `calendar`, filter, on/off, `cursor_at` = only things after this count, `seen` = the
  last 50 ids it started for, so nothing starts twice, `next_check_at`, last status and error, counters). The person may read their rows and
  switch them on and off; only the server writes the rest.
- `app_watch_events`: what started (or was held back), with a short preview, the run it started. Read only for the person.

**The check** (`lib/app-event-runner.js`, called by the clock after schedules and agents, inside the same 45 s budget):
1. Load due watches (enabled, `next_check_at` <= now), at most 20.
2. CLAIM each one by moving `next_check_at` forward in one conditional update (two clock calls never check the same watch twice).
3. READ through Hushwork's own Google connection (read-only permission) when the person has it, else Composio's Gmail or Google Calendar.
   Gmail: `in:inbox -from:me after:<cursor>` plus the filter (never the person's own mail, so a workflow cannot start itself). Calendar: events
   CREATED after the cursor (edits do not count), cancelled ones left out, title filter applied.
4. NEW = not in `seen` and not older than `cursor_at`. Oldest first, at most 3 runs per check; more than that waits for the next check.
5. Each new item: written down, counted against a per-person limit (5 a minute, 40 a day, held in the database too), then the workflow starts
   as its owner in Auto mode with writing OFF, exactly like a start link. The email or event is cut to a few short fields and handed to the AI
   as information only. If a step is left waiting, one nudge email (never at night, at most 3 a day).
6. Save the new cursor, `seen`, status. A problem backs off: not connected 30 min, Google busy 5 min.

**First check never floods**: a new watch starts with `cursor_at` = the moment it was saved, so old mail never starts anything.

**Safety**: the run never writes by itself; what arrived is data, never instructions; secrets and card numbers are dropped (the start-link
rules in `lib/hooks.js`); the paused switch stops every check; the Google gate (`GOOGLE_ONLY_FOR`) is respected (Composio is used instead).

**Not in this change**: Stripe events (not connected), Slack or other app events (no read access by time yet), Gmail push.
