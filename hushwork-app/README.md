# Hushwork site (Next.js)

The Hushwork landing page plus a first app slice: sign in, a workspace where you preview a plan and save drafts, and a runs page. Next.js 16 (App Router), React 19, Tailwind 4, `motion` for animation, Phosphor icons, Supabase for sign-in and the database. The earlier no-build prototype lives in `../hushwork/` for reference.

Nothing here runs a workflow yet: a draft is only a saved preview plan, and the runs page shows one clearly labelled sample.

## Run it

Install the packages once (this reads `package.json` and downloads what the project needs):

```bash
npm install
```

Start the development server, then open http://localhost:3100. Always use `localhost:3100` (not `127.0.0.1`): the sign-in cookie belongs to that exact address. Edits show up as soon as you save. The port is 3100 on purpose, so port 3000 stays free for your other app:

```bash
npm run dev
```

Other commands:

```bash
npm run lint
```

`lint` checks the code for mistakes without running it.

```bash
node --test lib/validate.test.js
```

This runs the one automated check: it tests the input rules (emails, passwords, drafts) in `lib/validate.js`. Node may print a harmless "module type not specified" warning; do not add `"type": "module"` to `package.json`.

```bash
npx tsc --noEmit
```

This checks the TypeScript file (the sculpture component) for type mistakes without producing files.

```bash
npm run build
```

`build` makes the optimized version visitors would get. It fails loudly if something is wrong. `npm run start` then serves that build. Stop `npm run dev` first (Ctrl+C): `build` writes into the same `.next` folder the dev server is using and would corrupt it.

## Supabase setup (once)

Sign-in and saved drafts need these six things done once in your Supabase project. Until they are done you will see "Could not load your drafts" or a sign-up that never finishes. Write down the old value of anything you change, so you can put it back. (Supabase moves dashboard labels around now and then; the links go straight to the pages.)

1. **Create the drafts table.** Open the SQL Editor (https://supabase.com/dashboard/project/mgvaqoishxsqecpjfnuo/sql/new), paste the whole of `../supabase/workflows.sql` and click Run. This makes the `workflows` table that stores drafts, plus the rules that let each person see only their own rows.
2. **Site URL.** Authentication > URL Configuration (https://supabase.com/dashboard/project/mgvaqoishxsqecpjfnuo/auth/url-configuration): set **Site URL** to `http://localhost:3100` and Save. This is the address Supabase treats as "the app" in its emails and redirects.
3. **Redirect URL.** Same page: under **Redirect URLs** click Add URL, enter `http://localhost:3100/**` and Save. It is an allow-list of addresses Supabase may send people back to (`**` means any page; fine for local use only).
4. **Confirm email OFF, for local testing only.** Authentication > Sign In / Providers > Email (https://supabase.com/dashboard/project/mgvaqoishxsqecpjfnuo/auth/providers): switch **Confirm email** off and Save. With it on, every sign-up sends a real email, Supabase's built-in sender allows only a few per hour, and this build cannot finish the confirmation link, so testing would get stuck.
5. **Keep "Allow anonymous sign-ins" OFF** (same Sign In / Providers area). If it were on, anonymous visitors would count as signed-in people.
6. **Always open the app at `http://localhost:3100`, not `127.0.0.1`.** The sign-in cookie belongs to one exact address, so the other one looks like a different site and you would appear signed out.

## Settings (environment variables)

An environment variable is a value kept outside the code. Copy `.env.example` to `.env.local` and fill it in. `.env.local` is never committed.

| Name | What it is | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Address of the Supabase project (waitlist emails, accounts, drafts) | No, public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Identifies the project; it grants no power by itself. The database rules decide what a visitor or a signed-in person may do (`../supabase/waitlist.sql`, `../supabase/workflows.sql`) | No, public by design |
| `NEXT_PUBLIC_SITE_URL` | The site's own address once it has a domain (used for link previews). Optional | No |

`NEXT_PUBLIC_` means the value is sent to the browser. Never put a secret or `service_role` key in one (this app never needs one). After changing `.env.local`, restart `npm run dev`.

## Where things are

- `app/layout.js`: fonts (Geist), page metadata, saved light/dark theme, motion settings.
- `app/globals.css`: colour tokens (light and dark), spacing and shape rules, the CSS animations.
- `app/page.js`: the home page, built from the sections in `components/`.
- `app/privacy/page.js`: the privacy page (draft, review before launch).
- `app/login/page.js`: sign in / create account. On desktop the left half holds the liquid sculpture (`components/login/`).
- `app/app/`: the signed-in workspace (`/app`) and runs page (`/app/runs`), inside a shared shell (`layout.js`).
- `proxy.js`: runs before `/app/*` and `/login`: checks the sign-in cookie, renews it, redirects signed-out visitors to `/login`. (Next.js 16 name for what used to be "middleware".)
- `app/opengraph-image.js`: the picture shown when the link is shared.
- `components/`: one file per section (`Hero`, `AgentBox`, `HowItWorks`, `Automations`, `Features`, `Waitlist`, `Footer`), plus shared pieces (`ui.js`, `icons.js`) and helpers (`MotionProvider`, `useTheme`, `usePrefersReducedMotion`).
- `components/app/`: the workspace pieces (`Composer`, `Workspace`, `Drafts`, `DraftCard`, `DraftList`, `RunsViewer`, `AppNav`, `UserBadge`, `ThemeToggle`). `components/login/`: the sign-in form and sculpture panel. `components/ui/liquid-sculpture-hero.tsx` is third-party code, see `../docs/sculpture-assets.md`.
- `lib/waitlist.js`: saves an email to Supabase.
- `lib/supabase/`: the two Supabase clients (`server.js` for pages and actions, `proxy.js` for the doorman). There is no browser client: the browser never talks to Supabase.
- `lib/auth.js`: `requireUser()`, the one place that asks "who is this?". `lib/actions/`: Server Actions for sign in/out and drafts. `lib/validate.js` (+ `validate.test.js`): input rules.

Signed-in data is protected three times: the proxy, `requireUser()` next to the data, and the database rules (Row Level Security).

## How the motion works

- The headline entrance is plain CSS, so it starts without waiting for JavaScript.
- Scroll reveals, the folder-tab indicator, the run log and the footer wordmark use the `motion` library.
- The glow and the workflow band move on their own. They stop when scrolled offscreen, when the visitor presses **Pause motion**, or when their system asks for reduced motion (then movement is removed and only fades remain).
