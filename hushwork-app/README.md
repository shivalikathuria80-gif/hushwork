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
npm test
```

This runs all the automated checks (Node's built-in test runner, nothing to install): the input rules in `lib/validate.js`, the AI planning code in `lib/ai/` (with a pretend `fetch`: no test ever calls a real AI service), a scan that makes sure the AI key is only ever read in one file, and a check of the four login sculpture images. Node may print a harmless "module type not specified" warning; do not add `"type": "module"` to `package.json`.

```bash
npm run make:sculpture
```

This re-draws the four login sculpture images in `public/sculpture/` from `scripts/make-sculpture.mjs` (add `-- --verify` to only check that the files on disk match the script). You only need it if you change the sculpture colours.

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
| `GROQ_API_KEY` | Lets "Preview plan" use an AI model run by Groq to write the plan. Optional | **Yes: secret, server only, never `NEXT_PUBLIC_`** |

`NEXT_PUBLIC_` means the value is sent to the browser. Never put a secret or `service_role` key in one (this app never needs one). After changing `.env.local`, restart `npm run dev`.

## AI plans (optional)

"Preview plan" can ask an AI to write the plan instead of matching keywords. It is **off unless `GROQ_API_KEY` is set** in `.env.local`; without it the page says "AI planning is off" and nothing is sent anywhere. An API key is a secret password for a service: get one at https://console.groq.com/keys (it starts with `gsk_`), paste it as one line (`GROQ_API_KEY=gsk_...`, no quotes), never share it, and restart `npm run dev`. The key is read in one file only, `lib/ai/key.js`, on the server.

- **What is sent:** only the task text from the box, through the server, to Groq (never your email, id or other drafts). Text that looks like a card number or a secret key is refused before sending. Plans are shown as text; nothing runs.
- **Limits** (in `lib/ai/plan.js`): 2 AI plans a minute and 20 a day per person, 3 a minute and 60 a day for everyone together, so this app alone should not overrun the free Groq plan (the Groq limits are shared by your whole Groq organisation and the numbers in our plan are estimates). The counters live in the server's memory and start again when it restarts. **Before any real deployment** replace them with a database table (`../docs/plan-next.md` section 3), and update `/privacy`.
- **If the AI fails** (busy, slow, rate-limited, unusable answer) the page shows the keyword preview and says why. Next.js runs Server Actions one at a time, so a slow AI answer (up to 15 seconds) can delay a Save, rename or delete pressed meanwhile.
- **Swap the model** by editing `GROQ_MODEL` in `lib/ai/groq.js` (and the model name on `/privacy`). If the terminal prints `ai-plan failed why=model_missing`, Groq has retired the model: pick the replacement named at https://console.groq.com/docs/deprecations.
- The terminal prints one line per plan with numbers only (`ai-plan ok in=... out=... reasoning=... ms=...`), never the text, the answer or the key.

## Where things are

- `app/layout.js`: fonts (Geist), page metadata, saved light/dark theme, motion settings.
- `app/globals.css`: colour tokens (light and dark), spacing and shape rules, the CSS animations.
- `app/page.js`: the home page, built from the sections in `components/`.
- `app/privacy/page.js`: the privacy page (draft, review before launch). It describes what is sent to Groq when AI plans are on; change it whenever the AI setup changes.
- `app/login/page.js`: sign in / create account. On desktop the left half holds the liquid sculpture (`components/login/`).
- `app/app/`: the signed-in workspace (`/app`) and runs page (`/app/runs`), inside a shared shell (`layout.js`).
- `proxy.js`: runs before `/app/*` and `/login`: checks the sign-in cookie, renews it, redirects signed-out visitors to `/login`. (Next.js 16 name for what used to be "middleware".)
- `app/opengraph-image.js`: the picture shown when the link is shared.
- `components/`: one file per section (`Hero`, `AgentBox`, `HowItWorks`, `Automations`, `Features`, `Waitlist`, `Footer`), plus shared pieces (`ui.js`, `icons.js`) and helpers (`MotionProvider`, `useTheme`, `usePrefersReducedMotion`).
- `components/app/`: the workspace pieces (`Composer`, `Workspace`, `AiWorkspace` (asks the server whether AI planning is on), `Drafts`, `DraftCard`, `DraftList`, `RunsViewer`, `AppNav`, `UserBadge`, `ThemeToggle`). `components/login/`: the sign-in form and sculpture panel. `components/ui/liquid-sculpture-hero.tsx` is third-party code, see `../docs/sculpture-assets.md`.
- `lib/waitlist.js`: saves an email to Supabase.
- `lib/supabase/`: the two Supabase clients (`server.js` for pages and actions, `proxy.js` for the doorman). There is no browser client: the browser never talks to Supabase.
- `lib/auth.js`: `requireUser()`, the one place that asks "who is this?". `lib/actions/`: Server Actions for sign in/out, drafts and `plan.js` (the AI "Preview plan"). `lib/validate.js` (+ `validate.test.js`): input rules.
- `lib/ai/`: AI planning, in plain JavaScript with no Next.js imports so the tests can run it. `key.js` (the only file that reads the key), `groq.js` (the one web request to Groq), `provider.js` (the door that hides which company answers), `plan.js` (instructions, answer shape, cleaning, the card-number guard, the limits), `limits.js` (the counters), `preview.js` (the order of the checks), `icon-names.js`, and `*.test.js`.

Signed-in data is protected three times: the proxy, `requireUser()` next to the data, and the database rules (Row Level Security).

## How the motion works

- The headline entrance is plain CSS, so it starts without waiting for JavaScript.
- Scroll reveals, the folder-tab indicator, the run log and the footer wordmark use the `motion` library.
- The glow and the workflow band move on their own. They stop when scrolled offscreen, when the visitor presses **Pause motion**, or when their system asks for reduced motion (then movement is removed and only fades remain).
