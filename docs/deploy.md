# Putting Hushwork online (checklist)

Hushwork is online at https://hushwork-six.vercel.app (see section 10 for what is live) and the free clock for scheduled runs works (section 11). This file is the checklist it was put online with; use it again for your own copy.

## 1. Before you start

- Run `npm test`, `npm run lint` and `npm run build` inside `hushwork-app`. All three must pass.
- Pick a host. Vercel works well with Next.js. Netlify and Hostinger also work.
- Decide the website address (for example `https://hushwork.example.com`). It is used in steps 3 and 4.

## 2. Settings (environment variables) to add on the host

Type them in the host's "Environment variables" page. Never put them in the code and never use `NEXT_PUBLIC_` in front of a secret.

| Name | Secret? | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | no | your Supabase project address |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no | the Supabase publishable key |
| `NEXT_PUBLIC_SITE_URL` | no | your website address |
| `GROQ_API_KEY` | **yes** | lets the AI write plans and answer steps |
| `CONNECTIONS_KEY` | **yes** | locks every saved connection. Use the **same** one you use on your computer only if you want to keep the connections you already made; otherwise make a new one with `npm run secret` and everyone reconnects |
| `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` | secret is **yes** | Hushwork's own app in Linear |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | secret is **yes** | Hushwork's own app in Google Cloud |
| `COMPOSIO_API_KEY` | **yes** | the Project API key (starts with `ak_`) from Composio's PLATFORM view; switches on the "More apps" connections |
| `CRON_SECRET` | **yes** | the clock's password for scheduled runs (make one with `npm run secret cron`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes, the most powerful one** | Supabase's all-access SECRET key. Used only for scheduled runs. Never share it, never put `NEXT_PUBLIC_` in front of it |

Do **not** add `LINEAR_API_KEY` online. It is your personal key for your own computer, and Hushwork ignores it on a real server on purpose.

## 3. Tell the other websites about the new address

- **Linear** (Settings, API, OAuth applications): add `https://<your address>/api/connect/linear/callback` as a callback address.
- **Google Cloud** (Credentials, your OAuth client): add `https://<your address>/api/connect/google/callback` under Authorized redirect URIs.
- **Supabase** (Authentication, URL Configuration): set the Site URL to your address and add `https://<your address>/**` to the redirect list, so sign-in links come back to the right place.

## 4. Google "not verified" warning

While the Google app is in **Testing**, only the test users you listed can connect, and Google asks them to connect again every 7 days. To let anybody connect, the app must go through Google's verification, and the Gmail and Drive permissions are "sensitive/restricted", so that review is real work (a privacy page, a demo video, sometimes a security review). Do this only when you are ready to open Hushwork to other people.

## 5. Known limits to fix before many people use it

- **Usage limits live in the server's memory.** Online, each server copy counts on its own and a restart forgets everything, so a person could get more than the limit. Move the counters into the database first (`lib/ai/limits.js` and `limiters` in `lib/run-core.js`).
- **Scheduled runs need the clock in section 7.** Without it, a saved schedule is only a note. Scheduled runs act as the person, with the permissions they already gave, and writing steps only run if that person ticked the box for that schedule.
- **Backups and email.** Check Supabase backups and the email provider limits (Supabase's own mail sender is very limited).

## 6. After it is online, test these

1. Sign up and sign in with a fresh email.
2. Connections: Connect Linear, Connect Google, and Disconnect each.
3. A practice run, then one Approve of each kind you use.
4. The `/privacy` page still matches what the app really does.

## 7. The clock for scheduled runs (how a workflow runs by itself)

A schedule saved on the Workflows page is only a note until something **calls Hushwork every minute** and asks "is anything due?". That something is a "clock". Hushwork has a safe address for it: `https://<your address>/api/cron/tick`. It does nothing unless the call carries the password in the header `Authorization: Bearer <CRON_SECRET>`.

**Before it can work:**
1. Paste `supabase/schedules.sql` into Supabase (SQL Editor, New query, paste, Run).
2. Add `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` to the host's settings (section 2).
3. Hushwork has to be **online**. On your own laptop it only works while `npm run dev` is running AND something calls the address.

**Pick one clock:**
- **Vercel Cron** (easiest if you host on Vercel). Add a file `hushwork-app/vercel.json` with `{ "crons": [{ "path": "/api/cron/tick", "schedule": "* * * * *" }] }`. Vercel sends the password for you when `CRON_SECRET` is set. A free (Hobby) Vercel plan allows a cron only once a day, so every-minute needs a paid plan; with once a day, only "daily" schedules work.
- **GitHub Actions** (free, about every 5 minutes at best). A workflow file in your repository runs `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<your address>/api/cron/tick` on a schedule; store the password in the repository's Secrets.
- **cron-job.org** (free pinger). Make a job that calls the address every minute with the header above.
- **On your own computer** (to try it): while the app runs, in PowerShell: `Invoke-RestMethod -Method Post -Uri http://localhost:3100/api/cron/tick -Headers @{ Authorization = "Bearer <CRON_SECRET>" }`. A reply like `ok: True, due: 1, ran: 1` means it worked. Windows Task Scheduler can repeat that every minute.

**Good to know:** a run starts within about a minute of its time (as late as the clock's rhythm); a schedule that was missed because the server was off runs once when it comes back; at most 20 schedules run per call and 10 schedules per person; daylight-saving changes can shift a schedule by an hour twice a year.


## 8. Vercel, in order (the short version)

Done for the live copy (see section 10). Steps 1 to 4 need your own accounts, so for your own copy only you can do them.

1. **Put the code on GitHub.** Make a new empty private repository on github.com, then in the project folder run `git remote add origin <the address GitHub shows>` and `git push -u origin main`. (`.env.local` is never pushed: it is in `.gitignore`.)
2. **Import it in Vercel.** vercel.com, Add New, Project, pick the repository. Set **Root Directory** to `hushwork-app`. Framework: Next.js (it finds it by itself).
3. **Add the settings from section 2** under Settings, Environment Variables, before the first deploy. At least `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `GROQ_API_KEY` and `CONNECTIONS_KEY`. Without the Supabase ones nobody can sign in.
4. **Deploy**, copy the address Vercel gives you, put it in `NEXT_PUBLIC_SITE_URL`, then do section 3 (tell Linear, Google and Supabase the new address) and redeploy.
5. **Sections 6 and 7** (test it, set up the clock).

## 9. Try scheduling on your own computer (no hosting)

1. Paste `supabase/schedules.sql` into Supabase (SQL Editor, New query, paste, Run).
2. In a terminal run `npm run secret cron`, copy the line it prints into `hushwork-app/.env.local`.
3. Add `SUPABASE_SERVICE_ROLE_KEY=...` to the same file (Supabase, Project Settings, API Keys, the secret key). It is the all-access key: never share it.
4. Restart the app (`npm run dev`).
5. Open a **second** terminal in `hushwork-app` and run `npm run clock`. It asks the app "is anything due?" once a minute and prints one line each time. Leave it open. `npm run clock -- --once` asks one time and stops.
6. On the Workflows page save a schedule a few minutes ahead (tick "Allow writing" only for a workflow you trust), and watch the Runs page.

The clock only works while the app and the clock terminal are both running. For a clock that runs by itself you need hosting (section 8) and section 7.

## 10. What is live right now (2026-10-23)

- Code: https://github.com/shivalikathuria80-gif/hushwork (public, MIT license). Vercel project `hushwork`, root folder `hushwork-app`, production branch `main`: every push to `main` deploys by itself.
- Address: https://hushwork-six.vercel.app
- Settings already added on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (both public values) and `NEXT_PUBLIC_SITE_URL`.
- **Still to add by hand** (Vercel project, Settings, Environment Variables; mark secrets "Sensitive"): `GROQ_API_KEY`, `CONNECTIONS_KEY`, `COMPOSIO_API_KEY`, `LINEAR_CLIENT_ID`/`LINEAR_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, and for scheduling `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY`. Redeploy after adding them.
- **Still to do by hand:** section 3 (tell Supabase, Linear and Google the new address) and section 6 (test it).

## 11. The free clock on GitHub (already in the repository)

`.github/workflows/clock.yml` asks `https://hushwork-six.vercel.app/api/cron/tick` about every 5 minutes (GitHub can be a few minutes late; Vercel's own free timer can only run once a day). To switch it on:

1. Do section 7 steps 1 and 2 (paste `supabase/schedules.sql`; add `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` on Vercel, then redeploy).
2. On GitHub open the repository, Settings, Secrets and variables, Actions, New repository secret. Name `CRON_SECRET`, value the same as on Vercel.
3. Actions tab, **clock**, Run workflow, to try it once. It should say `Hushwork answered 200`.

Because of the 5-minute rhythm, a schedule set to "every minute" will run at most every 5 minutes online.

## 12. AI limits in the database (do this once the site is public)

Until now every server counted AI use in its own memory, so on Vercel a person could get past the limit by landing on different servers. `supabase/usage.sql` adds a small counter table and a function, `take_usage`, that counts per signed-in person in the database. The app uses it for "Preview plan", AI steps and AI summaries (2 a minute and 20 a day for plans, 3 a minute and 15 a day for steps).

1. Paste `supabase/usage.sql` into Supabase (SQL Editor, New query, paste, Run).
2. Nothing else. Until it is pasted the app still works and falls back to the old in-memory count. The whole-site limit (60 AI plans a day for everybody) is still in memory only.

## 13. Moving to your own web address (when you buy one)

Nothing here can be done for you: buying the address is your job. The order matters.

1. **Buy the address** from a registrar and add it in Vercel (project hushwork, Settings, Domains). Vercel shows the DNS records to add at the registrar.
2. When Vercel says the address works, change `NEXT_PUBLIC_SITE_URL` on Vercel to it and redeploy.
3. Tell the other sites the new address, exactly as in section 3: Supabase (Site URL and the redirect list), Google Cloud (redirect URI `https://<your address>/api/connect/google/callback`), Linear (callback `.../api/connect/linear/callback`).
4. On GitHub add a repository **variable** (not a secret) named `HUSHWORK_URL` with the new address, so the clock keeps working (Settings, Secrets and variables, Actions, Variables tab).
5. Change the address in `README.md`, `PROJECT.md` and the Terms and Privacy pages if they name the old one.

Keep the old `hushwork-six.vercel.app` address in Google and Linear for a while: Vercel keeps answering on it.

## 14. Limits, in one place

| What | Where it is counted |
| --- | --- |
| AI plans, AI steps, AI summaries | the database (`supabase/usage.sql`) and memory |
| Sent actions (emails, Slack, GitHub, Todoist, Calendar, Notion), Linear tasks, sheet rows | the database (same table) and memory |
| Lookups (Linear, Calendar, Gmail, Drive, apps), web calls | memory only |
| Waitlist, sign-in, sign-up | memory only (friction, not a wall) |
| Everybody-together AI cap | memory only: set a **spending cap in your Groq account** instead |

"Memory only" means each server counts alone and forgets on a restart.

## 15. A reliable clock inside Supabase (use this one)

GitHub's free timer (section 11) turned out to fire only about every 3 to 4 hours, so "every morning at 9" could run hours late. Supabase can call Hushwork itself every minute, for free, using `pg_cron` and `pg_net`:

1. Open `supabase/clock.sql`. Replace `PASTE_YOUR_CRON_SECRET_HERE` with the same `CRON_SECRET` you set on Vercel (keep the quotes).
2. Paste the whole file into Supabase (SQL Editor, New query, Run). It stores the password in Supabase's Vault and starts a job called `hushwork-clock`.
3. After a couple of minutes check it: `select * from cron.job_run_details order by start_time desc limit 5;` should show `succeeded` rows. Then save a schedule a few minutes ahead and watch the Runs page.

Leave the GitHub clock running as a backup: two clocks never run a schedule twice, because each due schedule is claimed first. To stop the Supabase clock: `select cron.unschedule('hushwork-clock');`.

