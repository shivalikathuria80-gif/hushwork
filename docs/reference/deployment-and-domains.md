# Deployment and domains

How Hushwork gets online: Vercel and GitHub, the Supabase setup order, the settings to add on Vercel, the schedule clock, the two domains (hushwork.in and docs.hushwork.in), what to update when the address changes, and a launch-day checklist.

Up: [Reference index](README.md)

## The picture

```
GitHub (main branch)  --push-->  Vercel builds and publishes the app
                                      |
                  Supabase (sign-in + database)   Groq (AI)   Composio (extra apps)
                                      |
        Supabase clock calls  /api/cron/tick  every minute
```

- **Hosting** means a company keeps your app running on the internet. Hushwork uses **Vercel**.
- The live copy today is `https://hushwork-six.vercel.app`. The planned main address is `hushwork.in`, and the documentation site is `docs.hushwork.in`.

## Vercel and GitHub

| Fact | Value |
| --- | --- |
| Code | GitHub repository `shivalikathuria80-gif/hushwork` (public, MIT licence) |
| Vercel project | `hushwork` |
| Root Directory | `hushwork-app` (the repo has other folders; the app is inside this one) |
| Production branch | `main`: every push to `main` is built and published by itself |
| Framework | Next.js (Vercel finds it) |
| Checks on push | `.github/workflows/ci.yml` runs `npm ci`, `npm test`, `npm run lint` (not `npm run build`) |

Because a push to `main` goes live, run `npm test`, `npm run lint` and `npm run build` first. See [testing.md](testing.md).

## Supabase setup order

Paste each file into Supabase: SQL Editor, New query, paste, Run. Order matters because later tables point at earlier ones (`runs` points at `workflows`; `schedules` points at both).

| # | File | Makes | Needed for |
| --- | --- | --- | --- |
| 1 | `waitlist.sql` | waitlist (insert only for the public) | home page waitlist |
| 2 | `workflows.sql` | saved workflows | sign-in and drafts |
| 3 | `runs.sql` | runs | Runs page |
| 4 | `connections.sql` | encrypted app connections | Connect Linear and Google |
| 5 | `schedules.sql` | schedules | scheduled runs |
| 6 | `usage.sql` | `usage_counters` and `take_usage()` | AI and action limits that hold on every server |
| 7 | `memory.sql` | memory facts | Settings, Memory (optional) |
| 8 | `skills.sql` | `enabled_bundles` | Skills page Turn on |
| 9 | `app-controls.sql` | the pause switch | recommended before launch |
| 10 | `clock.sql` | the minute-by-minute clock | online schedules (edit the password in first) |

Only if you need them: `connections-any-app.sql` (an older `connections` table), `schedules-index.sql` (a table made before its index), `policy-recursion-fix.sql` (only if `skills.sql` or `memory.sql` was pasted before 2026-10-25 and Turn on fails with 42P17).

Also in the Supabase dashboard, Authentication: keep **Allow anonymous sign-ins** off, decide on **Confirm email** (Supabase's own sender allows only a few emails an hour), and set the URL configuration below.

## Settings on Vercel

Add them under Settings, Environment Variables, before the first deploy. The full table, with where each comes from, is in [env-vars.md](env-vars.md). At least:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `GROQ_API_KEY`, `CONNECTIONS_KEY`
- For connections and the clock: `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `COMPOSIO_API_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- Do not add `LINEAR_API_KEY`.

Vercel never shows a secret again after saving. To change one, edit it and press **Redeploy**.

## The schedule clock

`supabase/clock.sql` makes Supabase call `https://<site>/api/cron/tick` every minute with `Authorization: Bearer <CRON_SECRET>`. The password in the SQL must equal the one on Vercel. The address is written **inside the SQL**, so after a domain change run its `cron.schedule(...)` command again with the new address (it replaces the job named `hushwork-clock`). The GitHub backup clock reads the Actions variable `HUSHWORK_URL`. Details: [schedules-and-watch.md](schedules-and-watch.md).

## Two domains, one app

| Address | What it serves |
| --- | --- |
| `hushwork.in` | the main site and the app |
| `docs.hushwork.in` | the documentation site |

It is **the same app and the same Vercel project**. `next.config.mjs` has a rewrite (a rule that quietly serves a different page for the same address) on the host header: any request whose host starts with `docs.` is served the `/docs` pages, while the address in the browser stays the same. `/_next`, `/api`, `/docs` itself, the icon and the link-preview images are left alone. The docs pages also work at `/docs` on any host, so you can test them before the domain exists.

To switch the docs site on:

1. In Vercel, project `hushwork`, Settings, Domains: add `hushwork.in` and add `docs.hushwork.in` to the **same** project.
2. At your domain registrar add the records Vercel shows. For the docs name that is normally a CNAME record: name `docs`, value `cname.vercel-dns.com` (use whatever Vercel displays for your project). For `hushwork.in` itself Vercel shows its own record or nameservers.
3. Wait until Vercel marks both domains valid.

No code change and no second project are needed. The docs site's "Open Hushwork" link uses `NEXT_PUBLIC_SITE_URL`. `Strict-Transport-Security` has no `includeSubDomains`, so a subdomain is not affected by it.

## When the domain changes: update these

The order matters (this follows `docs/deploy.md` section 13):

1. Add the domain in Vercel and wait until it works.
2. Set `NEXT_PUBLIC_SITE_URL` to `https://hushwork.in` and redeploy (public values are copied in at build time).
3. **Supabase**, Authentication, URL Configuration: set the Site URL to the new address and add `https://hushwork.in/**` to the redirect list. The sign-up call passes no redirect of its own, so confirmation links use the Site URL.
4. **Google Cloud** (your OAuth client): add `https://hushwork.in/api/connect/google/callback` under Authorized redirect URIs.
5. **Linear** (Settings, API, OAuth applications): add `https://hushwork.in/api/connect/linear/callback`.
6. These two callback addresses are built from the host of the request (`lib/connections/oauth-flow.js`), not from `NEXT_PUBLIC_SITE_URL`, so **every host people connect from must be registered**. Keep the old `hushwork-six.vercel.app` ones for a while.
7. **Composio**: the return address `<host>/app/connections?composio=done` is sent with each connect request (`lib/connections/composio-flow.js`). `docs/launch.md` lists Composio among the redirect addresses to update; whether your Composio project has an allow-list is not verified here, so check its dashboard.
8. GitHub: set the Actions variable `HUSHWORK_URL`.
9. Re-run the `cron.schedule(...)` command from `supabase/clock.sql`.
10. Change the old address in `README.md`, `PROJECT.md` and the Terms and Privacy pages.


## Launch-day checklist

From `docs/launch.md` plus the steps above.

1. `npm test`, `npm run lint`, `npm run build` all pass.
2. Privacy: `npm run check:privacy` with two throwaway accounts; every line PASS.
3. Pause switch: set `paused` to true, press Approve on a writing step (it must refuse), set it back to false.
4. Connections page, **Test all my connections**: all green. Turn on each bundle, run each workflow once with an email to yourself.
5. Disconnect an app mid-run: the Runs page says where it stopped, and "Continue from where it stopped" repeats nothing.
6. Costs: a monthly spending cap in Groq; check the Composio allowance.
7. Google verification: until Google verifies the app, only listed test users can connect Google (and must reconnect every 7 days). Plan a small pilot.
8. Vercel's free plan is for personal, non-commercial projects: check its terms if you will charge money.
9. Backups: check what your Supabase plan includes. Download my data is a personal copy, not a backup.
10. Logs and errors: Vercel keeps runtime logs about an hour on the free plan. Look daily the first week, or add an error service.
11. Replace the old clock password if it was ever printed in a chat (`npm run secret cron`, update Vercel, redeploy, re-run `clock.sql`).
12. Put a real contact address on the Privacy and Terms pages.
13. Both domains show the right site.

## Where in the code and files

`next.config.mjs` (docs rewrite, security headers), `lib/docs/site.js`, `app/docs/`, `lib/connections/oauth-flow.js`, `lib/connections/composio-flow.js`, `lib/schedule-tick.js`, `supabase/*.sql`, `.github/workflows/ci.yml`, `.github/workflows/clock.yml`, `docs/deploy.md`, `docs/launch.md`.
