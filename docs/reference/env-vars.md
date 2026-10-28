# Environment variables

Every environment variable name that Hushwork's code reads, what it is for, whether it is secret, where to get it, and what breaks without it.

Up: [Reference index](README.md)

This page lists **names and descriptions only**. It never holds a value. If you ever see a real key written in a doc or a code file, treat it as leaked: replace it, do not copy it.

## What an environment variable is

An environment variable is a setting stored **outside** the source code, so a secret key is never written into a file that goes to GitHub. Locally the settings live in `hushwork-app/.env.local` (Git ignores that file; a test checks this). Online they live on the host: Vercel, project `hushwork`, Settings, Environment Variables.

Three rules the code follows (and tests enforce in `lib/secrets.test.js`):

1. A name that starts with `NEXT_PUBLIC_` is **copied into the browser**. Only put public values there. Never put `NEXT_PUBLIC_` in front of a secret.
2. Each secret is read in exactly one small `server-only` file, so the build fails if browser code imports it.
3. A secret is never logged, never returned to a page, never put in a prompt.

## The table

| Name | Secret? | Purpose | Where to get it | Restart needed? | What breaks without it |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Address of your Supabase project | Supabase, Project Settings, API | Yes (public values are copied in at build time, so on Vercel redeploy) | Nobody can sign in; sign-in pages say a setup step is missing; waitlist returns "not connected" |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Supabase publishable key (safe in the browser; privacy comes from row-level security) | Supabase, Project Settings, API Keys | Yes | Same as above |
| `NEXT_PUBLIC_SITE_URL` | public | The site's own address, for link previews, docs "Open Hushwork" link and the links in emails Hushwork sends | You choose it, for example `https://hushwork.in` | Yes (redeploy) | Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then `http://localhost:3100`. Emails would carry a wrong address |
| `VERCEL_PROJECT_PRODUCTION_URL` | public | Vercel fills this in itself | Automatic on Vercel. Do not set it | n/a | Only the fallback above |
| `GROQ_API_KEY` | **secret** | Lets the AI write plans and answer Ask the AI steps | Groq console. Set a monthly spending cap there | Yes | AI planning is off (a keyword preview is used) and AI steps do not work |
| `CONNECTIONS_KEY` | **secret** | Scrambles (AES-256-GCM) each saved connection before it goes into the database | `npm run secret` prints a line to copy | Yes | Connect buttons say setup is missing. If you **change** it, every saved connection becomes unreadable and everyone must reconnect |
| `LINEAR_CLIENT_ID` | public-ish | Hushwork's own app in Linear | Linear, Settings, API, OAuth applications | Yes | Connect Linear is not set up |
| `LINEAR_CLIENT_SECRET` | **secret** | The matching secret | Same place | Yes | Same |
| `GOOGLE_CLIENT_ID` | public-ish | Hushwork's own OAuth client in Google Cloud | Google Cloud, Credentials | Yes | Connect Google is not set up |
| `GOOGLE_CLIENT_SECRET` | **secret** | The matching secret | Same place | Yes | Same |
| `COMPOSIO_API_KEY` | **secret** | Switches on the "More apps" connections and the emails Hushwork sends through your own Gmail (send) | Composio platform, Project API key (starts with `ak_`) | Yes | No More apps, no Composio-based steps, no failure or watch emails |
| `CRON_SECRET` | **secret** | The password the clock sends to `/api/cron/tick` | `npm run secret cron` prints a line | Yes | The tick endpoint answers 503; scheduled runs never start |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret, the most powerful** | Supabase's all-access key. It ignores row-level security. Used only for scheduled runs and Delete my account | Supabase, Project Settings, API Keys, secret key | Yes | Tick answers 503; Delete my account says it is not switched on |
| `LINEAR_API_KEY` | **secret** | The owner's personal Linear key, for use on your own computer only | Linear personal API key | Yes | Nothing. **Do not add it on Vercel**: the app ignores it in production on purpose |
| `NODE_ENV` | public | Set by Node and Next (`development` or `production`). Switches on Secure cookies in production | Automatic. Do not set it | n/a | n/a |

Connect settings are built from each app's `envPrefix` in `lib/connectors/app-list.js` (`LINEAR`, `GOOGLE`) plus `_CLIENT_ID` and `_CLIENT_SECRET`, in `lib/connectors/oauth-env.js`. Adding a new connected app means adding two more names of this shape.

## Names used only by scripts

| Name | Used by | Notes |
| --- | --- | --- |
| `CRON_SECRET` | `scripts/clock.mjs` (`npm run clock`) | Loaded from `.env.local` by `node --env-file=.env.local` |
| `CHECK_A_EMAIL`, `CHECK_A_PASSWORD`, `CHECK_B_EMAIL`, `CHECK_B_PASSWORD` | `scripts/two-account-check.mjs` (`npm run check:privacy`) | Two throwaway accounts. Type them in your terminal for one command; never save the passwords in a file |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same script | The script stops with "Missing ..." if they are absent |

## Names that live on GitHub, not in the app

| Name | Kind | Used by |
| --- | --- | --- |
| `CRON_SECRET` | Actions **secret** | `.github/workflows/clock.yml` (backup clock). Must equal Vercel's value |
| `HUSHWORK_URL` | Actions **variable** (not secret) | Same file. Defaults to the Vercel address if unset; set it when the domain changes |

## Setting one

Locally:

1. Open `hushwork-app/.env.local` in your editor.
2. Add a line `NAME=value`, with no quotes needed.
3. Stop the dev server (Ctrl+C in its terminal) and run `npm run dev` again. Next.js reads the file when it starts.

On Vercel: Settings, Environment Variables, add the name for Production, then **Redeploy**. Vercel never shows a secret again after saving, so keep your own copy somewhere safe.

## Where in the code

- Readers: `lib/ai/key.js` (Groq), `lib/connectors/composio-env.js`, `lib/connectors/linear-env.js`, `lib/connectors/oauth-env.js`, `lib/schedule-env.js`, `lib/supabase/server.js`, `lib/supabase/proxy.js`, `lib/supabase/admin.js`, `lib/actions/waitlist.js`, `app/layout.js`, `lib/docs/site.js`, `lib/schedule-notify.js`
- Guards: `lib/secrets.test.js` (the only files allowed to read each secret; a scan for `process.env`)
- Helpers: `scripts/make-secret.mjs` (`npm run secret`, `npm run secret cron`), `.env.example` (a template of names; this reference did not open it)
