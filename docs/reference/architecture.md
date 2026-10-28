# Architecture

This file explains the tools Hushwork is built from, where each kind of file lives, and the path one click takes from the browser to the database and back.

Up: [Reference index](README.md)

## The stack and why

| Layer | Tool | Why (decision) |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, plain JavaScript | Needs server code for sign-in, secrets and AI calls that a plain HTML page cannot do safely (D-003) |
| Styling | Tailwind 4, Geist fonts, `motion`, Phosphor icons | D-004, D-005 |
| Database and sign-in | Supabase (Postgres plus Auth) | One service gives a database, sign-in and row-level security (D-002) |
| AI | Groq, model `openai/gpt-oss-20b` | Free plan, fast (D-010). The model name is one constant, `GROQ_MODEL` in `lib/ai/groq.js` |
| Other apps | Own sign-in for Linear and Google, Composio for the rest, MCP servers | D-012, D-013, D-014 |
| Hosting | Vercel, which redeploys on every push to `main` | D-017 |
| Clock | Supabase `pg_cron` plus `pg_net` | D-031 |

Local development runs on port 3100 (`npm run dev` is `next dev -p 3100`), never 3000 (D-007).

Jargon: a **Server Action** is a function the page can call that runs on the server. **Row-level security (RLS)** is a rule inside the database saying "a person may only touch their own rows". A **proxy** (called "middleware" in older Next.js) is code that runs before a page.

## Folder map

Parent folder: `README.md`, `PROJECT.md`, `DECISIONS.md`, `supabase/` (the SQL), `docs/`, `.github/workflows/` (`ci.yml` runs tests and lint, `clock.yml` is an optional backup clock), and `hushwork/` (the old prototype). The app itself is `hushwork-app/`.

| Folder | What is in it |
|---|---|
| `app/` | Pages and API routes. `app/page.js` is the landing page, `app/login`, `app/privacy`, `app/terms`. The signed-in area is `app/app/` (`page.js`, `builder`, `workflows`, `runs`, `templates`, `skills`, `connections`, `settings`). Routes: `app/api/cron/tick`, `app/api/connect/[provider]` (and `/callback`), `app/api/composio/[app]`, `app/api/export` |
| `components/` | Screen pieces. `components/app/` is the signed-in workspace (Builder, RunsViewer, ApproveSend, StepEditor and so on). The rest are landing and login parts |
| `lib/` | All the logic. `lib/actions/` Server Actions; `lib/run-*.js` and `lib/schedule-*.js` runs and the clock; `lib/ai/` the planner; `lib/connectors/` talking to other services; `lib/connections/` saving sign-in tokens; `lib/supabase/` database clients; `lib/skills/` and `lib/studio/` bundles and step cards. Tests sit next to the code as `*.test.js` |
| `scripts/` | `clock.mjs` (a clock for your own computer), `make-secret.mjs`, `two-account-check.mjs`, `make-sculpture.mjs`, and the test loader `test-hooks.mjs` plus `test-resolve.mjs` |
| `public/` | Static images (the login sculpture) |

There is no `content/` folder. `lib/docs/pages.js` (new, not committed at the time of writing) mentions `content/docs/<slug>.md` for a future docs site, but that folder does not exist yet.

Tests: `npm test` runs `node --import ./scripts/test-hooks.mjs --test "lib/**/*.test.js"`. The loader lets tests run the real server code with a pretend database (`lib/test-server-support.js`).

## How a request flows

```
 Browser
    |  click or page visit
    v
 proxy.js  (only /app/* and /login)
    |  lib/supabase/proxy.js: getClaims(); signed out -> /login; refreshes the cookie
    v
 Page (Server Component, behind <Suspense>)
    |  requireUser() (lib/auth.js)  <- second check
    v
 Server Action (lib/actions/*.js)  -> core logic (lib/run-core.js etc.)
    |            |             |              |
    v            v             v              v
 Supabase     Groq AI      Composio     Google / Linear / web / MCP
 (RLS = third check)

 Supabase pg_cron --every minute--> /api/cron/tick --> lib/schedule-tick.js
```

1. **Proxy.** `proxy.js` has `matcher: ["/app/:path*", "/login"]`. It calls `updateSession` in `lib/supabase/proxy.js`, which asks Supabase whether the sign-in cookie is genuine (`getClaims`), refreshes it, sends signed-out visitors from `/app` to `/login` and signed-in visitors from `/login` to `/app`. If Supabase cannot be reached it treats the visitor as signed out.
2. **Page.** Pages build a static shell and stream the personal parts behind `<Suspense>`. `next.config.mjs` turns on `cacheComponents` and `partialPrefetching`, and sends safety headers (no framing, no sniffing, HTTPS only, and so on). `app/app/layout.js` is only a frame; its own comment says it is not a security gate.
3. **requireUser.** Every Server Action and personal component calls `requireUser()` first. It uses `getClaims()` (never `getSession()` on the server).
4. **Server Action.** For runs, `lib/actions/runs.js` is a thin wrapper: it works out who is asking from the session and hands `{ user, supabase }` to `lib/run-core.js`. The browser can send only small input such as a run id and a step number, never "who".
5. **Database client.** `lib/supabase/server.js` makes a client that carries the person's own cookie, so RLS applies. The cookie is `HttpOnly`, and `Secure` in production.
6. **Outside services.** Groq (`lib/ai/`), Composio (`lib/connectors/composio.js`), Google and Linear (`lib/connectors/`).

Three checks protect data: the proxy (the doorman), `requireUser()` next to the data, and RLS in the database.

## The two database clients

- `lib/supabase/server.js`: the person's own client. Used almost everywhere.
- `lib/supabase/admin.js`: the all-access client using `SUPABASE_SERVICE_ROLE_KEY`, which ignores RLS. It is used only by the clock (`lib/schedule-tick.js`) and Delete my account (`lib/actions/account.js`). A test lists exactly which files may import it (D-019). Every query made with it names the person's `user_id`.

## Where the clock lives

Scheduled runs need something to wake the app. `supabase/clock.sql` creates a `pg_cron` job named `hushwork-clock` that makes a web request to `/api/cron/tick` every minute. The route (`app/api/cron/tick/route.js`) accepts GET and POST, and `lib/schedule-tick.js` refuses anything without the `CRON_SECRET` password (503 if scheduling is not set up, 401 if the password is wrong). Backups: `.github/workflows/clock.yml` (about every 5 minutes, often late) and `npm run clock` (`scripts/clock.mjs`) on your own computer. Details of what a tick does are in [run-model.md](run-model.md).

## Settings (names only)

Server-only: `GROQ_API_KEY`, `COMPOSIO_API_KEY`, `CONNECTIONS_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `LINEAR_API_KEY` (a personal key, ignored in production), `<APP>_CLIENT_ID` and `<APP>_CLIENT_SECRET` for Linear and Google. Browser-safe: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Each secret is read in exactly one small file that starts with `import "server-only"`, so the build fails if browser code imports it.

## Where in the code

- `hushwork-app/next.config.mjs`, `hushwork-app/proxy.js`, `hushwork-app/app/layout.js`, `hushwork-app/app/app/layout.js`
- `hushwork-app/lib/supabase/proxy.js`, `server.js`, `admin.js`; `hushwork-app/lib/auth.js`
- `hushwork-app/lib/actions/` (runs, plan, drafts, schedules, skills, memory, account, auth, composio, connections, waitlist)
- `hushwork-app/lib/run-core.js`, `lib/schedule-tick.js`, `lib/schedule-runner.js`
- `hushwork-app/app/api/cron/tick/route.js`, `supabase/clock.sql`, `.github/workflows/clock.yml`, `hushwork-app/scripts/clock.mjs`
- `hushwork-app/package.json` (scripts and versions)
