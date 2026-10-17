# Plan: sign-in, saved drafts and the sculpture login (first app slice)

Written 2026-10-15 from the approved `docs/spec.md`. Local only (http://localhost:3100), never deployed. Port 3000 is never touched.
Visual details (spacing, colours, copy tone) live in `docs/design.md`. This plan covers structure, behaviour, safety and order. If the two disagree about file names, this plan wins; about looks, `design.md` wins.

**What the owner approved:** (1) real sign-in with Supabase Auth (email + password) and real saved drafts; the plan from the composer stays a labelled "Preview plan" (no AI call, no Anthropic key). (2) The liquid sculpture lives in the left panel of `/login`, desktop only. (3) The four sculpture images are placeholders already in `hushwork-app/public/sculpture/`. (4) `/app/runs` ships as an empty state plus one labelled "Sample" run (screen only, no `runs` table).

## Words used in this plan (one plain line each)

| Word | Meaning |
|---|---|
| API | A way for two programs to talk. Here: our server talks to Supabase's sign-in and database services. |
| Environment variable | A setting stored outside the code, in `.env.local`. |
| Publishable key | Supabase's public key (`sb_publishable_...`). It identifies the project; it grants no power by itself. The database rules decide what it may do. It is safe in the browser. |
| Secret / service_role key | A key that bypasses all database rules. This app never needs one and must never contain one. |
| Supabase Auth | Supabase's built-in sign-in service. It stores users and password hashes, so we store no passwords. |
| Session and cookie | After sign-in, Supabase gives a signed pass (a JWT, valid about an hour, renewable). The browser keeps it in a cookie and sends it with every request. |
| Claims | The facts inside that pass: who you are (`sub` = your user id) and your email. `getClaims()` checks the pass is genuine. |
| Proxy | A function (`proxy.js`) that runs on the server before a page, to redirect or refresh the pass. Next.js 16 renamed what used to be called "middleware". |
| Server Component / Client Component | Server Components run only on the server and send finished HTML. Client Components (marked `"use client"`) also run in the browser, for clicks and typing. |
| Server Action | A server function that a form can call directly. The browser sends the form as a POST; the function runs on the server. Treat it as a public door: check who is calling every time. |
| Suspense | A React wrapper that shows a placeholder while its content loads. The project's `cacheComponents` setting makes it mandatory around anything that reads cookies. |
| RLS (Row Level Security) | Rules inside the database about which rows each person may touch. Our third line of defence. |
| Migration | A recorded change to the database structure. |
| Lockfile / pinning | `package-lock.json` records the exact version of every package; pinning writes exact versions (no `^`) in `package.json`. Together they stop surprise upgrades. |

## 1. Architecture in 10 lines

1. **Public:** `/` (landing + waitlist) and `/privacy` need no login and are not touched by any new check. **Signed-out only:** `/login` (a signed-in visitor is sent on to `/app`). **Signed-in only:** `/app` (workspace) and `/app/runs`.
2. **Check 1, the doorman (`proxy.js`):** runs on the server before the page, but only for `/app/*` and `/login` (its `matcher`), so `/` is never slowed or changed. It calls `supabase.auth.getClaims()`, which verifies the pass and refreshes it when it is about to expire, writes the fresh cookie to the request and the response, and redirects signed-out visitors to `/login`.
3. **Check 2, next to the data (`lib/auth.js`):** `requireUser()` is called by every component that reads drafts and by every Server Action. The proxy alone is not enough (the Next.js docs say it must not be the only line of defence, and layouts are not re-run on navigation).
4. **Check 3, the database (RLS):** even if checks 1 and 2 had a bug, Postgres refuses other people's rows.
5. **Supabase clients:** created in exactly one place per context: `lib/supabase/server.js` (Server Components and Server Actions) and `lib/supabase/proxy.js` (inside the proxy). There is **no browser client**: the browser never talks to Supabase, so no Supabase code or session logic ships to the browser, and the cookie is only ever written by the server.
6. **Server vs browser.** Server: proxy, page shells, the drafts list, all Supabase calls, all Server Actions. Browser (`"use client"`): typing and the preview animation, theme toggle, sidebar highlight, rename/delete confirm UI, runs selection, the sculpture.
7. **Forms:** `<form action={...}>` plus React's `useActionState`. The Server Action validates, calls Supabase, sets cookies and either returns a small `{ error }` object or `redirect()`s. A failed login never reveals whether the email exists.
8. **Cache Components rule (this project has `cacheComponents: true`):** anything that reads cookies must sit inside `<Suspense>`. Layouts, headings, composer, suggestion cards and tiles are static and appear instantly; the user badge and the drafts list stream in behind placeholders.
9. **Preview plan:** the keyword matcher `planFor()` stays in the browser and is labelled "Preview plan. Nothing will run." Saving sends only text to a Server Action; nothing is ever executed.
10. **Landing and waitlist:** unchanged. The waitlist keeps using `lib/waitlist.js` with the publishable key as the anonymous role; the new `workflows` table is a separate table with its own rules.

### Route map

| URL | Who | What | File | Built in |
|---|---|---|---|---|
| `/` | everyone | landing, waitlist | `app/page.js` (unchanged) | exists |
| `/privacy` | everyone | privacy page, updated copy | `app/privacy/page.js` | T10 |
| `/login` | signed-out | sign in / create account, sculpture on desktop | `app/login/page.js` | T4, T6 |
| `/app` | signed-in | workspace: composer, cards, tiles, drafts | `app/app/page.js` | T4 (placeholder), T7, T8 |
| `/app/runs` | signed-in | runs viewer: empty state + Sample | `app/app/runs/page.js` | T9 |
| `/demo` | (scratch) | **deleted**: it hotlinks the component's default images | `app/demo/page.tsx` | T6 |

`app/app/` looks odd (a folder `app` inside `app`), but the folder name is the URL, and the spec fixes `/app`.

### Rules from the Next.js 16 docs that this plan depends on (read in `node_modules/next/dist/docs/`)

- `middleware` is now **`proxy`**: file `proxy.js` next to `app/`, exports `proxy`; `matcher` values must be constant strings. Supabase's own current guide uses the same name.
- `cookies()` is async. With Cache Components, calling it outside `<Suspense>` is a build error ("blocking-prerender-runtime"). So the code that reads the session always lives in a component wrapped in `<Suspense>`; do not `await` the session at the top of a layout. `export const instant = false` exists as an escape hatch, but prefer Suspense.
- `redirect()` works by throwing, so never call it inside `try/catch`. In an `error.js` file the retry prop is `retry` (the old `reset` only clears without refetching).
- After a Server Action changes data, call `revalidatePath("/app")` so the page re-renders in the same round trip; without it the list stays stale.
- Server Actions are sequential per browser tab and are public POST endpoints: authenticate and validate inside each one, return small objects (never database rows).
- On the Supabase side: use `getClaims()` to protect pages and data; **never trust `getSession()` on the server**. `@supabase/ssr` needs the proxy to refresh the pass, because Server Components cannot write cookies.

## 2. Folders and files

**Rule for new code: JavaScript (`.js`), like the other 20 files of this app.** Reason: one language for a beginner to read, and the existing helpers (`Btn`, `Icon`, `StepRow`) are untyped JavaScript, so TypeScript files that import them would fight the compiler. The component `liquid-sculpture-hero.tsx` stays TypeScript (a `.js` file can import it) and `npx tsc --noEmit` keeps checking it. The database's constraints and RLS protect the data regardless of types. Converting files to TypeScript is out of scope (spec section 4).

```text
hushwork-app/
├── proxy.js                        NEW  .js   runs before /app/* and /login (the doorman)
├── package.json, package-lock.json CHANGED    +2 pinned packages
├── .npmrc                          NEW        one line: min-release-age=7
├── .env.example                    CHANGED    comment text only (the key now does more than add waitlist emails)
├── README.md                       CHANGED    settings table, "Where things are", new commands
├── lib/
│   ├── supabase/server.js          NEW  .js   createClient() for Server Components and Server Actions
│   ├── supabase/proxy.js           NEW  .js   updateSession(request) used by proxy.js
│   ├── auth.js                     NEW  .js   getUser() and requireUser(): the one place that asks "who is this?"
│   ├── validate.js                 NEW  .js   LIMITS plus pure checks: email, password, draft input
│   ├── validate.test.js            NEW  .js   the one automated check (run with node --test)
│   └── actions/
│       ├── auth.js                 NEW  .js   "use server": signIn, signUp, signOut
│       └── drafts.js               NEW  .js   "use server": saveDraft, renameDraft, deleteDraft
├── app/
│   ├── login/page.js               NEW  .js   split layout, metadata (static, no cookies)
│   ├── app/
│   │   ├── layout.js               NEW  .js   shell: sidebar, theme toggle, sign out; user badge in Suspense
│   │   ├── page.js                 NEW  .js   workspace (T4 placeholder, T7 real, T8 adds drafts)
│   │   ├── error.js                NEW  .js   plain error screen with a "Try again" button (client)
│   │   └── runs/page.js            NEW  .js   runs viewer page
│   ├── privacy/page.js             CHANGED    new copy (T10)
│   └── demo/page.tsx               DELETED    (T6)
└── components/
    ├── AgentBox.js                 CHANGED    one word: `function planFor` becomes `export function planFor` (landing behaviour identical)
    ├── icons.js                    CHANGED    add icon names the design needs (SignOut, Trash, Plus, Eye, EyeSlash ...). Names only.
    ├── login/LoginForm.js          NEW  .js   client: sign in / create account, useActionState
    ├── login/SculpturePanel.js     NEW  .js   client: still image or live sculpture, plus Pause motion
    ├── app/AppNav.js               NEW  .js   client: sidebar links (usePathname), theme toggle
    ├── app/ThemeToggle.js          NEW  .js   client: reuses the existing useTheme hook (Nav.js is not edited)
    ├── app/UserBadge.js            NEW  .js   server, async: shows the signed-in email (inside Suspense)
    ├── app/Composer.js             NEW  .js   client: textarea, arrow, Preview plan, Save as draft
    ├── app/Drafts.js               NEW  .js   server, async: loads "Your drafts" (inside Suspense)
    ├── app/DraftCard.js            NEW  .js   client: view steps, rename, delete with confirm
    └── app/RunsViewer.js           NEW  .js   client: list left, detail right, stacked on phones
supabase/workflows.sql              NEW        the table, rules and grants (written, not applied)
docs/sculpture-assets.md            CHANGED    only if the component's <h1> is retagged in T6
```

Existing pieces reused as they are: `Btn`, `Icon`, `StepRow`, `EASE` (`components/ui.js`, `icons.js`), `useTheme`, `MotionProvider` + `useMotionPause`, `usePrefersReducedMotion`, the colour tokens in `globals.css`.
Not reused: `Logo` (it links to `#top`, which is wrong inside the app; use a plain brand link to `/app`) and the landing `Nav`.

## 3. Dependencies to install

| Package | Pinned version | What it does |
|---|---|---|
| `@supabase/supabase-js` | `2.117.2` | Supabase's official JavaScript library: sign in, sign out, read and write tables. |
| `@supabase/ssr` | `0.12.7` | Small helper that stores the Supabase session in cookies, so server code can see who is signed in. Needs `supabase-js` `^2.114.0` (satisfied). |

Looked up read-only with `npm view` on 2026-10-15: `ssr 0.12.7` was published 2026-09-08; `supabase-js 2.117.3` is newer but only 8 days old, so `2.117.2` (2026-09-25) is the choice. Re-run `npm view` at install time and keep the 7-day rule.

Nothing else. Not added on purpose: a validation library (a 40-line `lib/validate.js` is enough), a form library, a state library, an ORM, a test runner (Node's built-in `node --test` is used), `three`, or a CSS library.

**Pinning policy:**
1. Install with exact versions: `npm install --save-exact @supabase/supabase-js@2.117.2 @supabase/ssr@0.12.7` (`--save-exact` writes `2.117.2`, not `^2.117.2`).
2. Commit `package-lock.json` together with `package.json`. `git diff package-lock.json` should show only these two packages and their small dependency tree.
3. `.npmrc` with `min-release-age=7` makes npm refuse versions newer than 7 days (Supabase's own supply-chain advice). If npm 11.19 reports an unknown setting, drop the file and keep the manual 7-day check.
4. After installing, run `npm audit signatures` (checks the packages really came from Supabase's build) and expect no failures.
5. Fresh installs use `npm ci` (installs exactly the lockfile). Never run `npx something@latest`.

## 4. Supabase setup the owner does in the dashboard (about 5 minutes)

Labels may have moved slightly; the three links go straight to the pages. Before changing anything, **write down the current values** so they can be put back.

1. **Site URL.** Open https://supabase.com/dashboard/project/mgvaqoishxsqecpjfnuo/auth/url-configuration . In **Site URL**, replace the current value (probably `http://localhost:3000`) with `http://localhost:3100` and click **Save changes**. This is the address Supabase uses in emails it sends and as its default "go back to the app" address. Port 3000 belongs to your other app; if that app also uses this Supabase project, tell the architect before saving (it should not, this project only holds the waitlist).
2. **Redirect URLs.** On the same page, under **Redirect URLs**, click **Add URL**, type `http://localhost:3100/**`, then **Save**. This is an allow-list: Supabase only sends people back to addresses on it. `**` means "any path" and is acceptable only because this is local; before any real deployment, replace it with the exact address.
3. **Confirm email: turn it OFF for local testing.** Open https://supabase.com/dashboard/project/mgvaqoishxsqecpjfnuo/auth/providers , open the **Email** provider, switch **Confirm email** off, **Save**. Why:
   - With it on, every sign-up makes Supabase send a real email, and the built-in sender allows only a very small number of emails per hour for the whole project (sign-ups and password resets share it). The exact number is shown at https://supabase.com/dashboard/project/mgvaqoishxsqecpjfnuo/auth/rate-limits . Testing with two accounts would hit the limit quickly (error `over_email_send_rate_limit`).
   - The built-in sender may also refuse addresses that are not members of your Supabase team (`email_address_not_authorized`).
   - The confirmation link would land on a route this slice deliberately does not build (`/auth/confirm`), so the sign-up could not finish.
   - If someone turns it back on later, the sign-up form must say so plainly ("This project requires email confirmation, which this build cannot finish yet") instead of pretending it worked. T4 builds that message.
4. Nothing else. Leave Google/GitHub providers off, leave anonymous sign-ins off (T12 re-checks), leave "Allow new users to sign up" on until your accounts exist.

## 5. Database

```text
auth.users                        (managed by Supabase Auth; we never write to it)
 ├── id, email, encrypted_password (a bcrypt hash, never the password), created_at, last_sign_in_at ...
 └── 1 user ──< many workflows

public.workflows                  (new; the drafts)
 ├── id          uuid, primary key, default gen_random_uuid()
 ├── user_id     uuid, not null, default auth.uid()  -> auth.users(id), ON DELETE CASCADE
 ├── name        text, not null, 1 to 120 characters after trimming
 ├── prompt      text, not null, 1 to 2000 characters after trimming
 ├── plan        jsonb, not null, default [], must be a JSON array, at most 20,000 bytes
 ├── created_at  timestamptz, not null, default now()
 └── updated_at  timestamptz, not null, default now(), refreshed by a trigger
index: workflows_user_id_updated_at_idx on (user_id, updated_at desc)
```

The SQL is in `supabase/workflows.sql` (written, **not applied**). What it enforces:

| Question | Answer |
|---|---|
| Who may touch the table at all? | Only the `authenticated` role (signed-in people). `anon` (not signed in) has no permission of any kind: all grants are revoked first, then only these are granted back. |
| What can a signed-in person do? | `select` and `delete` on their rows; `insert` and `update` limited to the three columns `name`, `prompt`, `plan`. They cannot set `id`, `user_id`, `created_at` or `updated_at`. |
| Which rows? | Four policies (select, insert, update with both USING and WITH CHECK, delete), each `TO authenticated` and each requiring `(select auth.uid()) = user_id`. No `user_metadata`, no `SECURITY DEFINER`. |
| How does `user_id` get filled in? | By the database default `auth.uid()`. The app never sends it, so it cannot be forged. |
| `updated_at` | **A trigger** (`set_updated_at`, 6 lines, `SECURITY INVOKER`, empty `search_path`). App code would be fewer lines today, but the app would have to remember it on every future update, and the browser could forge it. The trigger is one place that cannot be forgotten. |
| What is a plan? | A JSON list of steps, one object per step: `{"icon":"Clock","title":"Run every morning","detail":"8:00 am, weekdays"}` (the on-screen tuples `[icon, title, sub]` become objects when saved). |
| What is not limited? | There is no cap on drafts per person. Fine for a local app; add a count check before any public launch. |

**How to apply (one of, with the owner's go-ahead because it changes the hosted project):**
- The builder applies the file's contents as a single migration named `create_workflows_table` with the Supabase connector (`apply_migration`), the same way `waitlist.sql` was applied; or
- the owner pastes the file into Supabase dashboard > SQL Editor and clicks Run.

Right after: run the three read-only checks written at the bottom of the SQL file, then the Supabase security and performance advisors (both were clean on 2026-10-15; they must stay clean).

## 6. Ordered build tasks

Follow `CLAUDE.md`: explain each concept in one plain line, make the smallest change, check it, report in the Done / How it works / Test it format. Work on a branch (`git switch -c accounts-slice`) so rollback is "switch back"; commit only when the owner asks.

**Build status (2026-10-15, stage 4).** Checked off by the builder. "Owner" means it needs a real account, the dashboard or the `workflows` table, none of which the builder may touch.
- [ ] T0 Owner dashboard setup: owner (not done by the builder)
- [x] T1 Packages (`supabase-js 2.117.2`, `ssr 0.12.7`, exact, `.npmrc` kept), `lib/supabase/server.js`, `lib/validate.js` + test (9 pass), `.env.example`
- [ ] T2 Create the `workflows` table: owner. Read-only `list_tables` on 2026-10-15 shows only `waitlist`
- [x] T3 `proxy.js`, `lib/supabase/proxy.js`, `lib/auth.js` (curl: `/app`, `/app/runs` -> 307 `/login`; `/`, `/privacy`, `/login` -> 200; `/` sets no cookie)
- [x] T4 Login form + `lib/actions/auth.js` + placeholder `/app` (server-side validation checked in a real browser; real sign-in is the owner's check)
- [x] T5 App shell, sign out, user badge, `error.js` (checked with fake data; real sign-out is the owner's check)
- [x] T6 Sculpture panel on `/login`, design CSS, `useMediaQuery`, `app/demo/page.tsx` deleted (`/demo` -> 404)
- [x] T7 Composer, cards, recipe tiles, planner fix in `AgentBox.js`
- [x] T8 Drafts actions, list, rename, delete, Save button (UI states checked with simulated server replies; live save needs T2)
- [x] T9 Runs page with the labelled Sample
- [x] T10 Privacy page and README
- [x] T11 Polish pass (matrix: 5 widths x 2 themes, contrast, keyboard, reduced motion, Pause, WebGL off, 390px)
- [ ] T12 Verification and wrap-up: done as far as possible without an account (production build passes in a throwaway copy; scratch route deleted, `/scratch-preview` -> 404). Remaining owner steps are listed in the builder's report.

**Order and parallel work**

| Task | Needs | Can run in parallel with |
|---|---|---|
| T0 Owner dashboard setup | nothing | T1, T2 |
| T1 Packages and Supabase server client | nothing | T0, T2 |
| T2 Create the `workflows` table | owner OK | T0, T1, T3, T4, T5 |
| T3 Doorman and `requireUser` | T1 | T2 |
| T4 Login form logic (no sculpture) | T0, T1, T3 | T2 |
| T5 App shell and sign out | T4 | T6, T10 |
| T6 Sculpture panel on `/login` | T4 | T5, T7, T9, T10 |
| T7 Workspace and composer (preview only) | T5 | T6, T9 |
| T8 Drafts: save, list, rename, delete | T2, T5, T7 | T6, T9 |
| T9 Runs page with the Sample | T5 | T6, T7, T8 |
| T10 Privacy page and docs | T4 | T5 to T9 |
| T11 Polish pass | T6 to T10 | none |
| T12 Verification, cleanup, wrap-up | T11 | none |

Files do not collide between parallel tasks except `app/app/page.js` (T4 creates a placeholder, T7 replaces it, T8 adds one line) and `components/app/Composer.js` (T7 creates it, T8 wires the Save button): do T4 to T7 to T8 in that order.

### T0. Owner dashboard setup
Section 4. **Check:** the Auth settings page shows Site URL `http://localhost:3100`, the redirect list contains `http://localhost:3100/**`, and Confirm email is off. **Risk:** forgetting to write down the old values.

### T1. Packages, Supabase server client, input checks
**Change:** install the two pinned packages (section 3). Add `lib/supabase/server.js` (reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; throws a plain message naming the missing variable; builds the client with `getAll`/`setAll` cookie handlers; the `setAll` try/catch is required because Server Components cannot write cookies, and the proxy does that job). Add `lib/validate.js` with `LIMITS` (password 10 to 64 characters, name 120, prompt 2000, plan 12 steps, each step text 200) and pure functions `checkEmail`, `checkPassword`, `cleanDraft`, `cleanName`, plus `lib/validate.test.js`. Update comment text in `.env.example`. Copy the cookie handler from the **current** Supabase SSR guide for the pinned version, do not write it from memory.
**Files:** `package.json`, `package-lock.json`, `.npmrc`, `lib/supabase/server.js`, `lib/validate.js`, `lib/validate.test.js`, `.env.example`.
**Check:** `npm ls --depth=0` shows exactly `2.117.2` and `0.12.7`; `node --test lib/validate.test.js` passes; `npm run lint` passes; http://localhost:3100/ still loads (restart `npm run dev` if it complains about a missing module).
**Risks:** a `^` slips into `package.json`; lockfile churn; installing while the dev server runs.

### T2. Create the table (parallel)
**Change:** apply `supabase/workflows.sql` (section 5) after the owner agrees. **Files:** none in the app.
**Check:** `list_tables` (or Table Editor) shows `workflows` with RLS on; the advisors report nothing new. Then prove the front door is locked, using only the public key (never print it): `curl -i "<SUPABASE_URL>/rest/v1/workflows?select=*" -H "apikey: <publishable key>"` must answer with a permission error (`42501`, "permission denied"), **not** `[]`.
**Risks:** a typo in SQL (nothing half-applies in one migration; fix and re-run); forgetting that the waitlist must still work (T12 re-tests it).

### T3. Doorman and `requireUser`
**Change:** `lib/supabase/proxy.js` (`updateSession`: copy the structure of Supabase's current proxy example: build the server client over the request cookies, call `getClaims()` immediately, copy refreshed cookies and cache headers onto the response, return **that** response object). `proxy.js`: `matcher: ["/app/:path*", "/login"]` (checked against Next's own matcher library: it matches `/app`, `/app/runs`, `/login`; it does not match `/`, `/privacy`, `/application`). Rules inside: no claims and path starts with `/app` -> redirect to `/login`; claims and path is `/login` -> redirect to `/app`. `lib/auth.js`: `getUser()` (wrapped in React `cache()` so it runs once per request; returns `{ id, email }` from the claims or `null`) and `requireUser()` (redirects to `/login` when null). Nothing may run between creating the client and `getClaims()`.
**Files:** `proxy.js`, `lib/supabase/proxy.js`, `lib/auth.js`.
**Check (no browser needed):** `curl -i http://localhost:3100/app` answers `307` with `location: /login`; same for `/app/runs`; `curl -i http://localhost:3100/` answers `200` with no `set-cookie`; `/privacy` is `200`; landing page and waitlist behave as before.
**Risks:** a wrong matcher breaks the landing page (the check above catches it); code between client creation and `getClaims()` or returning a different response object randomly signs people out; no `next=` redirect parameter on purpose (no open-redirect risk, always land on `/app`).

### T4. Login form logic (no sculpture yet)
**Change:** `app/login/page.js` (static; metadata `Sign in | Hushwork`, `robots: noindex`), `components/login/LoginForm.js` (two small forms, one visible at a time: "Sign in" and "Create account"; email, password with show/hide, `autoComplete` `current-password` / `new-password`, `useActionState`, button shows loading, errors in a `role="alert"` line), `lib/actions/auth.js` (`signIn`, `signUp`, `signOut`), and a placeholder `app/app/page.js` that prints "Signed in as <email>" inside `<Suspense>`.
- `signIn`: validate with `checkEmail`/`checkPassword`, `signInWithPassword`, on success `redirect("/app")` (outside any try/catch). Every failure that is about credentials shows one sentence: "Email or password is not right." Never print `error.message`; map `error.code`: `over_request_rate_limit` and `over_email_send_rate_limit` -> "Too many attempts. Wait a few minutes and try again."; `email_not_confirmed` -> "Confirm your email first."; anything unknown -> "Something went wrong. Try again." Log only `error.code` on the server, never the password.
- `signUp`: password 10 to 64 characters (also a plain hint under the field). If Supabase answers with a session, `redirect("/app")`. If it answers without one (Confirm email is on), show the honest sentence from section 4. `user_already_exists` / `email_exists` -> "We could not create that account. If you already have one, sign in instead." (does not confirm the address exists). `weak_password` -> show the password rule.
- React 19 clears uncontrolled fields after a form action; return the submitted **email** (never the password) in the action state and use it as `defaultValue`.
- `signOut`: `supabase.auth.signOut()` then `redirect("/login")`, even if signOut errors.
- Under the form: one line "We store your email and your drafts. Privacy" linking to `/privacy`.
**Files:** the four above plus the placeholder.
**Check (owner can do it):** open http://localhost:3100/login . (1) Create an account with a throwaway address you own, e.g. `you+hw-a@gmail.com`, and a 10+ character password: you land on `/app` and it prints that email. (2) Dashboard > Authentication > Users lists it. (3) Reload `/app`: still signed in. (4) A private window opening `/app` goes to `/login`. (5) Sign in with a wrong password: one plain error, fields keep the email. (6) A 6-character password is refused with the rule shown. In the browser dev tools > Application > Cookies you see `sb-mgvaqoishxsqecpjfnuo-auth-token` (possibly split into `.0`, `.1`).
**Risks:** `redirect` inside `try/catch` swallows the redirect; cookies not read inside `<Suspense>` -> Cache Components error in the dev overlay (fix by moving the read into the child component); the browser address must be `http://localhost:3100` (cookies are per host; `127.0.0.1` is a different site).

### T5. App shell and sign out
**Change:** `app/app/layout.js` (static markup: sidebar with the brand link to `/app`, **New workflow** -> `/app`, **Runs** -> `/app/runs`, theme toggle, sign-out form; `robots: noindex`), `components/app/AppNav.js` (`usePathname` for the active link, `aria-current="page"`), `ThemeToggle.js`, `UserBadge.js` (async, shows the email, wrapped in `<Suspense>` with a small placeholder), `app/app/error.js`. The sign-out button is `<form action={signOut}>`. Add any new icon names to `icons.js`. On phones the sidebar becomes a top bar or compact menu per `docs/design.md`.
**Files:** `app/app/layout.js`, `app/app/error.js`, `components/app/AppNav.js`, `ThemeToggle.js`, `UserBadge.js`, `components/icons.js`.
**Check:** the shell shows on `/app`; the email appears after a blink; **Sign out** lands on `/login` and the `sb-...` cookie is gone; pressing the browser Back button shows no draft data (the shell may flash, the data must not); the theme toggle works and is remembered; the dev overlay shows no Cache Components or hydration errors; Tab reaches every control with a visible focus ring.
**Risks:** reading the session at the top of the layout (blocks the whole page; put it only in `UserBadge`); `useTheme` returns `null` on first render by design (do not "fix" that); the layout is not a security boundary.

### T6. Sculpture panel on `/login` (parallel with T5, T7, T9, T10)
**Change:** `components/login/SculpturePanel.js` and the two-column layout in `app/login/page.js`; delete `app/demo/page.tsx` (check nothing imports it first: only the file itself exists; `grep -r "demo" app components`). What shows when:

| Situation | The panel shows |
|---|---|
| Below the `lg` breakpoint (1024px): phones and tablets | Nothing. Form only, no image downloaded. (`mobile-*.webp` stay unused; a phone still image is a one-line addition if wanted.) |
| Desktop, first paint | A still image: two `<img loading="lazy">` (light and dark) swapped by the `dark:` class inside a `hidden lg:block` panel, so a phone never fetches them and a desktop fetches only the active theme's image. |
| Desktop, reduced motion on (`usePrefersReducedMotion`) | The still image only. **The component's own reduced-motion option only halves the effect; it does not stop it,** so the wrapper must not load it at all. |
| Desktop, **Pause motion** pressed (`useMotionPause`, the same saved `hw-motion` setting as the landing page) | The still image only, and it stays that way after a reload. |
| Desktop, WebGL2 missing | The component's built-in fallback shows its image. No blank box, no error. |
| Otherwise | The live sculpture, loaded with `next/dynamic` (`ssr: false`) after the form is usable. |

Props for the component: `showNav={false}`, `themeToggle={false}`, `theme` taken from the site theme, `loadFonts={false}` (otherwise it fetches Google Fonts; use the site's Geist through its CSS variables), `eyebrow=""`, `body=""`, `backdropText=""`, `primaryCta={{label:"",href:""}}`, `secondaryCta={{label:"",href:""}}`, `headline="Quiet work, done."`, `headlineAccent=""`, `hint="Move your cursor across the sculpture"` (its default says "the form", which is confusing next to a sign-in form), `background` / `darkBackground` set to the site's own `--bg` colours or the nearest values that keep the image edges invisible (judge by screenshot; the placeholder images are beige and brass, off-brand), `height="100%"` inside a panel with a fixed height (`h-dvh`, sticky), `showCredit` left on (courtesy to the author; MIT only requires the notice already in the file header). **Heading problem:** the component always renders its headline as an `<h1>`, which would be a second `<h1>` next to "Welcome back". Fix: change that single tag to `<p>` in the component and add the change to the "repaired" list in `docs/sculpture-assets.md`. Add a small **Pause motion** toggle (`aria-pressed`) on the panel. Check the headline's contrast against the lightest and darkest part of the image behind it in both themes; add a soft scrim behind the text if any area fails.
**Files:** `components/login/SculpturePanel.js`, `app/login/page.js`, `docs/sculpture-assets.md` (if retagged), `app/demo/page.tsx` (deleted).
**Check:** spec acceptance 1 to 5 (dark and light readable; mouse flows then settles; reduced motion -> still; Pause persists after reload; graphics acceleration off -> still image). At a 390px-wide window the Network tab shows no `/sculpture/*.webp` request and no WebGL context; the form works without waiting for the sculpture. `/demo` now answers 404.
**Risks:** 100,000 particles redrawn per frame (it stops itself when offscreen, hidden or paused; measure fps and lower `particleDensity` if under about 50); the images are placeholders with no stated licence (local use only, see `docs/sculpture-assets.md`); a `height="100%"` with no parent height collapses the panel.

### T7. Workspace and composer (preview only)
**Change:** replace the placeholder in `app/app/page.js`: small violet mark, "What should Hushwork take off your plate?", `components/app/Composer.js`, 3 suggestion cards, 5 recipe tiles (2 large, 3 small: invoices, client report, inbox, lead follow-up, admin), then a "Your drafts" heading with a `<Suspense>` placeholder (T8 fills it). Composer: a textarea with a label, `maxLength` from `LIMITS`, Enter submits and Shift+Enter adds a line (same as the landing box), the arrow button runs `planFor(text, [])` and reveals the steps with `StepRow`, headed **"Preview plan. Nothing will run."** Cards and tiles fill the textarea (they do not auto-run). **Left out on purpose:** the Search / Deep research / Reason chips, Attach files, mic, glass blur. Add a hint under the box: "Do not put passwords or card numbers in a task." Use new text, not the screenshots' text. `planFor` has branches only for invoices, reports and inbox; lead follow-up and admin get the generic plan, which is acceptable because it is labelled a preview (do not edit the landing matcher).
**Files:** `app/app/page.js`, `components/app/Composer.js`, `components/AgentBox.js` (add `export`).
**Check:** type a task, press the arrow: steps appear under "Preview plan. Nothing will run."; clicking a tile fills the box; empty text focuses the box instead of running; Tab/Enter reach everything; **the landing page agent box still builds a plan exactly as before**.
**Risks:** importing from a `"use client"` file into server code does not work (`planFor` is only used from client components here, so it is fine); do not copy Search/Reason chips back in.

### T8. Drafts: save, list, rename, delete
**Change:** `lib/actions/drafts.js` with `saveDraft`, `renameDraft`, `deleteDraft`. Each action starts with `requireUser()`, validates through `lib/validate.js` (trim; prompt 1 to 2000; name optional and defaults to the first 60 characters of the prompt; plan sent as a JSON string, parsed in `try/catch`, must be an array of at most 12 objects whose `icon`, `title`, `detail` are strings, then rebuilt as clean objects), calls Supabase (`insert({ name, prompt, plan })`, never `user_id`), then `revalidatePath("/app")` and returns `{ ok: true }` or `{ error: "plain sentence" }`. For rename and delete use `.select("id")` and treat 0 rows as "That draft no longer exists" (RLS makes someone else's row look absent, with no error). `components/app/Drafts.js` (async server component inside `<Suspense>`: newest 50 by `updated_at`), `components/app/DraftCard.js` (name, date, "Preview plan" label, expandable steps with `StepRow`, rename inline, delete with "Delete this draft? Yes / Cancel"), and the **Save as draft** button in `Composer.js` (hidden fields `prompt`, `plan`; optional name field; button shows Saving..., then "Saved to Your drafts" in a `role="status"` line; errors in `role="alert"`). Empty state: "No drafts yet. Save a preview plan and it will show up here." Say clearly on the card and on the page that **a draft never runs**.
**Files:** `lib/actions/drafts.js`, `components/app/Drafts.js`, `components/app/DraftCard.js`, `components/app/Composer.js`, `app/app/page.js`.
**Check:** save -> it appears; refresh -> still there; rename -> new name and it moves to the top; delete -> gone after "Yes"; an over-long name (121 characters) shows the plain error instead of a crash; stop the dev server briefly or block the network -> the Save button returns to normal with an error sentence, no blank screen; in the Supabase Table Editor the row's `user_id` equals the user's id from Authentication > Users.
**Risks:** forgetting `revalidatePath` (list looks stale); trusting the client's plan (hence the rebuild and the database constraints); returning raw database errors to the browser.

### T9. Runs page with the Sample (parallel)
**Change:** `app/app/runs/page.js` (static) and `components/app/RunsViewer.js`: list on the left, detail on the right, stacked on phones. The list says "Nothing has run yet. Hushwork does not run workflows yet." and contains exactly one item labelled **Sample**. Selecting it shows a clearly marked sample (a Sample badge in the list row and at the top of the detail; placeholder values only such as "Client A", "Invoice 0001"; nothing that looks like a real person, company or amount; no Approve/Pause buttons that appear to act). The sample is a constant in the file, not stored anywhere.
**Files:** `app/app/runs/page.js`, `components/app/RunsViewer.js`.
**Check:** `/app/runs` shows the empty message and one "Sample" row; selecting it shows the detail; at 375px the two panes stack with no sideways scroll; keyboard: Tab to the Sample row, Enter selects it.
**Risk:** anything that implies a real run. If a value could be mistaken for real data, change it.

### T10. Privacy page and docs (parallel)
**Change:** rewrite `app/privacy/page.js` per section 7 (the facts listed there, nothing more, nothing promised that is not true); new "Last updated" date. Update `README.md` (settings table row for the publishable key, "Where things are", the new commands including `node --test lib/validate.test.js`, "always use http://localhost:3100"). Fix the stale comment lines in `.env.example` (and tell the owner the same two comment lines at the top of their private `.env.local` are now out of date; they hold no secrets, but the file is the owner's).
**Files:** `app/privacy/page.js`, `README.md`, `.env.example`.
**Check:** open `/privacy`; every sentence is something the app really does; `/login` links to it.

### T11. Polish pass (one bounded pass: build fully, inspect once, fix in one batch, confirm once, stop)
Loading, empty, error and success states on every screen; focus rings; 320 to 1440px with no sideways scroll; both themes; reduced motion on; contrast scan (as in Phase 2: every text element in both themes, 0 failures); read every string for honesty (no claim that a draft runs, sends or connects to anything). **Check:** the list in section 8.

### T12. Verification, cleanup, wrap-up
Run section 8 completely, then delete the disposable accounts, commit if the owner says so, and write the "Done / How it works / Test it" summary.

## 7. Security and privacy checklist

**Keys and secrets**
- [ ] Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` exist as settings. No `service_role` or `sb_secret_` value anywhere in the code or in `.env.local`. After the T12 build, search the files that are sent to the browsers: `grep -r "sb_secret" .next/static` must find nothing, and no long `eyJ...` token may appear there (the word `service_role` inside library code is not a leak; a key is).
- [ ] `.env.local` is ignored by git (`.gitignore` has `.env*` except `.env.example`). Never paste keys into chat, `plan.md`, README or commit messages.
- [ ] Nothing in the app imports a Supabase browser client; the session cookie is never read by page scripts.

**Database**
- [ ] RLS on `workflows`; 4 policies; anonymous request denied (T2 curl check).
- [ ] **Two-account test** (section 8E) passes: B cannot see, rename or delete A's draft.
- [ ] Anonymous sign-ins stay off (if they were on, those users would count as `authenticated`).
- [ ] Waitlist still works and still cannot be read from the browser.

**Accounts and passwords**
- [ ] The app stores no passwords; Supabase stores only a bcrypt hash.
- [ ] Password 10 to 64 characters, enforced in `checkPassword` on the server (the browser hint is only a courtesy). No composition rules; paste and password managers are allowed. Recommended extra, optional: set **Minimum password length** to 10 on the Email provider page (https://supabase.com/dashboard/project/mgvaqoishxsqecpjfnuo/auth/providers) so Supabase refuses short passwords even if someone calls its API directly. Leaked-password protection exists only on the Pro plan; do not claim it.
- [ ] Login errors never say which half was wrong; the "account exists" case on sign-up gets a neutral sentence. (With Confirm email off, Supabase itself can reveal that an address is taken; accepted for a single-owner local app, revisit before opening sign-up to the public.)
- [ ] Supabase rate-limits per IP and the buttons are disabled while sending. While local, every request comes from the same machine; behind a real host Supabase's "IP address forwarding" setting would need attention.
- [ ] Optional after your own accounts exist: turn off "Allow new users to sign up" in the dashboard.

**Sessions and cookies**
- [ ] Server code uses `getClaims()` only; `getSession()` is never trusted on the server.
- [ ] Cookie `sb-mgvaqoishxsqecpjfnuo-auth-token`: Path `/`, SameSite Lax. **HttpOnly always** (page scripts cannot read it; this app has no browser Supabase client, so nothing needs to). **Secure only in production builds**, so over `http://localhost` in development it has no Secure flag (a browser would refuse a Secure cookie on plain http). Both flags are set by this app in `lib/supabase/server.js` and `lib/supabase/proxy.js`; the `@supabase/ssr` library itself defaults to not HttpOnly and never adds Secure. Sign-out removes it.
- [ ] Every Server Action calls `requireUser()` first and validates input. Server Actions check the request origin automatically; do not disable it.
- [ ] No `next=` parameter after login, so no open redirect.

**Privacy page: facts it must now state (and nothing it cannot back up)**
1. **Accounts.** If you create an account we store your email address, a one-way hash of your password (never the password itself), and the times you created the account and last signed in. Supabase's sign-in service also keeps technical sign-in records (for example time and IP address): *confirm this wording against Supabase's data documentation before publishing.*
2. **Drafts.** We store, for each draft you save: the name, the task text you typed, the preview steps, and the times it was created and changed. Do not type passwords, card numbers or other people's personal data into a task.
3. **Drafts do nothing.** They are never run, sent, shared or connected to your email, Stripe or any other app.
4. **No AI.** The preview plan is made by simple keyword matching in your browser; your text goes to no AI service.
5. **Who can see them.** Drafts are visible to you when you are signed in; other accounts cannot read them (database rule). The people who run Hushwork can technically see the database.
6. **Where.** Supabase (our database and sign-in provider), hosted in the Mumbai, India region (AWS ap-south-1).
7. **Cookies.** A sign-in cookie keeps you signed in; it is needed for that and removed when you sign out. Light/dark and pause-motion choices stay in your browser's storage. Still no analytics or advertising trackers.
8. **Waitlist and accounts are separate lists.** Joining the waitlist does not create an account.
9. **Removal.** Write to hello@hushwork.co and we delete the account and its drafts together. There is no delete button in the app yet. Retention: until you ask or the account is deleted.
10. Do **not** write "encrypted in transit" or "secure connection" until the site is served over HTTPS (local `http://localhost` never leaves the computer, and nothing is deployed).

**Before any real deployment (not part of this slice):** replace `http://localhost:3100/**` with an exact URL, turn Confirm email back on with a custom email sender and an `/auth/confirm` route, add a per-user draft limit, add security headers, replace the placeholder sculpture images (licence unknown), re-read the privacy page. Also:
- Sign-in calls to Supabase are made by the server, so Supabase's per-IP rate limit is shared by every visitor (they all arrive from the server's IP). Enable IP forwarding on the Supabase side or add our own throttling.
- No security headers yet (for example a clickjacking guard on `/login`): add them in `next.config.mjs`.
- No per-user cap on saved drafts.
- While Confirm email is off, sign-up reveals whether an address already has an account.
- `getClaims()` does not notice a revoked session until the pass expires (up to 1 hour).
- Replace the placeholder sculpture images (no stated licence).
- A few accounts can use the whole shared AI allowance (the global daily cap) because sign-up is open and Confirm email is off: add a per-IP limit or require confirmed emails.

## 8. Test plan

**A. Quick checks (safe while the dev server runs)**
- `npm run lint` (checks code style and common mistakes; the sculpture file is excluded on purpose).
- `npx tsc --noEmit` (checks the TypeScript files; after T6 that is only the sculpture component).
- `node --test lib/validate.test.js` (about 12 assertions: good and bad emails, password 9/10/64/65 characters, draft with empty prompt, 2001-character prompt, plan not an array, 13 steps, non-string step fields, default name from prompt). A harmless "module type not specified" warning is expected; do not add `"type": "module"`.

**B. Build (not while `npm run dev` is running: `next build` writes into `.next`, the folder the dev server is using, and corrupts it)**
1. In the terminal running the dev server press `Ctrl+C` (stops it).
2. `npm run build` (makes the optimized version; fails loudly on mistakes, including Cache Components errors).
3. `npm run dev` (starts the dev server again).
Do B after T5 and again at T12. Between those, watch the dev server terminal and the red error overlay: Cache Components problems show up there too.

**C. Server-level checks with `curl` (no browser)**
- `/`, `/privacy`, `/login` -> 200. `/app`, `/app/runs` -> 307 to `/login`. `/demo` -> 404 (after T6). `/` has no `set-cookie`.
- Anonymous read of `workflows` with only the public key -> permission denied (not an empty list).
- Waitlist regression, in the browser: join with `you+waitlist-check@gmail.com` on `/` -> "You're on the list"; then delete that row in Table Editor > waitlist.

**D. Real-browser checklist** (same approach as earlier phases: a real headless browser with screenshots and measurements; Edge is installed at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Throwaway scripts live in the scratchpad, not in the repo. If the Browser pane tools are available they work too.)

| # | Check | Pass when |
|---|---|---|
| 1 | `/login` dark and light | sculpture shows, every word readable, contrast scan 0 failures |
| 2 | Mouse over the sculpture | material flows, settles back within a few seconds |
| 3 | Reduced motion (emulate `prefers-reduced-motion: reduce`, or Windows > Accessibility > Visual effects > Animation effects off) | still image, no canvas, form works |
| 4 | Pause motion, reload | frozen, still paused (`localStorage["hw-motion"] = "paused"`) |
| 5 | No WebGL (launch Edge with `--disable-3d-apis`, or turn graphics acceleration off in settings) | still image, no blank box, console clean |
| 6 | 390px wide window | no `/sculpture/*.webp` requests, no sideways scroll, form usable |
| 7 | Wrong then right password | plain error, then `/app`; private window on `/app` -> `/login` |
| 8 | Composer -> Preview plan -> Save | "Preview plan. Nothing will run."; saved state; survives refresh |
| 9 | `/app/runs` | empty message; one row labelled Sample; no real-looking names or numbers |
| 10 | Sign out, then browser Back | lands on `/login`; Back shows no draft data |
| 11 | Keyboard only (Tab, Enter, Space, Esc) on `/login`, `/app`, `/app/runs` | every control reachable, visible focus ring, no trap |
| 12 | Widths 320 / 375 / 768 / 1024 / 1440, both themes | `document.documentElement.scrollWidth <= innerWidth` everywhere |
| 13 | Console | no errors or hydration warnings on any page |
| 14 | Phone Lighthouse on `/login` and `/` (if Lighthouse is available as in Phase 2) | `/` stays near its recorded 80 / 100 / 100 / 100; `/login` accessibility 100 |
| 15 | Frame rate with the live sculpture | about 50 fps or better on this laptop; otherwise lower `particleDensity` |

**E. Two-account RLS check (the one that matters)**
1. Create disposable accounts A and B with real addresses you own (plus-addresses such as `you+hw-a@gmail.com`, `you+hw-b@gmail.com`; made-up domains like `example.com` may be rejected as invalid). Use two different browser profiles or one normal and one private window.
2. As A: save a draft named "A-secret".
3. As B in the browser: `/app` must not list "A-secret".
4. Prove it at database level with a throwaway Node script (kept in the scratchpad, not committed; it uses the installed `@supabase/supabase-js`, the public URL and publishable key from `.env.local`, and B's test email and password; it prints results only, never keys). Sign in as B, then: (a) `select` all workflows -> none of A's rows; (b) `update` A's draft by its id (copy the id from Table Editor) -> 0 rows changed; (c) `delete` A's draft by id -> 0 rows deleted; (d) `insert` a row with `user_id` set to A's id -> refused ("permission denied for column"). Afterwards A's draft is still there and unchanged.
5. As B: save a draft in the browser; as A confirm it is not visible.
6. In the dashboard Table Editor, the `user_id` values of the two drafts are different and match Authentication > Users.

**F. Cleanup (always)**
1. Dashboard > Authentication > Users: select A and B > Delete. Because of `on delete cascade`, their drafts disappear too. Also delete your own throwaway sign-up accounts from T4.
2. Table Editor > `workflows` should be empty (unless you want to keep your own real drafts); Table Editor > `waitlist`: delete the `waitlist-check` row.
3. Clear cookies for `localhost:3100` in the browsers used; close the extra profile/private window. Delete scratch scripts from the scratchpad.
4. Deleting a user does not cancel passes already issued (they expire in about an hour); irrelevant for disposable accounts.

**G. Rollback**
- **Code:** work is on a branch; `git switch main` returns to the old app. Deleting `proxy.js` removes the doorman (then `/app` would be open but its data would still be refused by check 2 and RLS).
- **Packages:** `git restore package.json package-lock.json .npmrc`, then `npm ci`.
- **Database:** run the commented ROLLBACK lines at the bottom of `supabase/workflows.sql` (this deletes all drafts). The waitlist table is never touched.
- **Dashboard:** put back the Site URL, redirect list and Confirm email value you wrote down in T0.
- **Accounts:** delete users in the dashboard.

## 9. Risks and open questions

**Blocking questions: none.** Defaults chosen: Confirm email off for local testing; phones and tablets get the form only (no sculpture image); no link from the landing page to `/login` (that would change the landing page; the owner types `/login`, say so if you want a link).

| Risk | Why it matters | What reduces it |
|---|---|---|
| Next.js 16 conventions differ from older docs | Wrong file name (`middleware`), a blocking `cookies()` call or a `redirect` in `try/catch` fails the build or silently skips the check | Section 1 rules; T3/T4/T5 acceptance checks; build at T5 and T12 |
| Session cookie handling | A wrong copy of Supabase's proxy pattern randomly signs people out | Copy from the current docs for the pinned version; nothing between client creation and `getClaims()`; return the same response object |
| RLS or grant mistake leaks drafts | The only real data risk in this slice | Three layers of checks, anon curl test, two-account test, advisors |
| Built-in email limit | Blocks testing sign-ups if Confirm email is on | Turn it off for local work (T0) |
| WebGL cost and the component's quirks | Heat and battery on weak machines; the component's reduced-motion option does not stop motion; it adds an extra `<h1>` and a Google Fonts request by default | Wrapper only mounts it on desktop, without reduced motion, not paused; `loadFonts={false}`; retag the `<h1>` (T6) |
| Image licence unknown | The four placeholder images have no stated licence | Local use only; replace before any public use (`docs/sculpture-assets.md`) |
| Third-party package supply chain | A bad release could run code on install | Exact pins, lockfile, 7-day rule, `npm audit signatures`, only two new packages |
| Scope creep | Five screenshots, five products | Three pages; no dead controls; Preview plan is labelled; no AI, no runner |

**Not verified in this plan (the builder must confirm):** the current dashboard labels (they move); that `min-release-age` is accepted by npm 11.19; the exact wording for Supabase's own sign-in records on the privacy page; the actual hourly email limit (read it on the Rate Limits page); whether the project uses asymmetric JWT signing keys (if not, `getClaims()` calls the Auth server on each check, which is slower but still correct).
