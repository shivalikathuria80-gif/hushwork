# Hushwork site (Next.js)

The Hushwork landing page plus a first app slice: sign in, a workspace where you preview a plan and save drafts, and a runs page. Next.js 16 (App Router), React 19, Tailwind 4, `motion` for animation, Phosphor icons, Supabase for sign-in and the database. The earlier no-build prototype lives in `../hushwork/` for reference.

Almost nothing runs for real yet: the two real actions are a **Telegram message to yourself** and a **read-only web call**, each only when you press Approve on the Runs page (see "Telegram" and "Web calls" below). A draft is a saved plan, and **Practice run** (on the Workflows page) walks its steps and saves a record of what each step would do, with nothing sent. Practice runs are listed on the Runs page. They need one setup step: paste `../supabase/runs.sql` into the Supabase SQL Editor and run it (until then the Runs page says so).

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

This runs all the automated checks (Node's built-in test runner, nothing to install): the input rules in `lib/validate.js` (including the step rules the editor and the server share), saving edited steps in `lib/update-plan.js` (with a pretend database: no test touches Supabase), the AI planning code in `lib/ai/` (with a pretend `fetch`: no test ever calls a real AI service), a scan that makes sure the AI key is only ever read in one file, and a check of the four login sculpture images. Node may print a harmless "module type not specified" warning; do not add `"type": "module"` to `package.json`.

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

- **What is sent:** only the task text from the box, through the server, to Groq (never your email, id or other drafts). Text that looks like a card number or a secret key is refused before sending. Plans are shown as text; a practice run only writes down what each step would do.
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
- `app/app/`: the signed-in pages, inside a shared shell (`layout.js`) with a sidebar (`components/app/AppNav.js`): the workspace (`/app`), Workflows (`/app/workflows`, all saved drafts), the Builder (`/app/builder`), Templates (`/app/templates`), Runs (`/app/runs`, your saved practice runs), Connections (`/app/connections`, nothing is connected yet) and Settings (`/app/settings`).
- `proxy.js`: runs before `/app/*` and `/login`: checks the sign-in cookie, renews it, redirects signed-out visitors to `/login`. (Next.js 16 name for what used to be "middleware".)
- `app/opengraph-image.js`: the picture shown when the link is shared.
- `components/`: one file per section (`Hero`, `AgentBox`, `HowItWorks`, `Automations`, `Features`, `Waitlist`, `Footer`), plus shared pieces (`ui.js`, `icons.js`) and helpers (`MotionProvider`, `useTheme`, `usePrefersReducedMotion`).
- `lib/run-engine.js` (the practice-run walk: what each kind of step would do, tested in `lib/run-engine.test.js`) and `lib/actions/runs.js` (the Practice run button's server action).
- `components/app/`: the workspace pieces (`Composer`, `StepEditor` (the by-hand step editor, shown inside the Composer's plan card), `Workspace`, `AiWorkspace` (asks the server whether AI planning is on), `Builder` (the Builder page: name, palette of step kinds, Save), `Drafts`, `DraftCard`, `DraftList`, `RunsViewer` (the Runs page), `RunTime`, `AppNav`, `UserBadge`, `ThemeToggle`). `components/useWarnBeforeLeaving.js` makes the browser ask "Leave site?" while step edits are unsaved. `components/login/`: the sign-in form and sculpture panel. `components/ui/liquid-sculpture-hero.tsx` is third-party code, see `../docs/sculpture-assets.md`.
- `lib/waitlist.js`: saves an email to Supabase.
- `lib/supabase/`: the two Supabase clients (`server.js` for pages and actions, `proxy.js` for the doorman). There is no browser client: the browser never talks to Supabase.
- `lib/auth.js`: `requireUser()`, the one place that asks "who is this?". `lib/actions/`: Server Actions for sign in/out, drafts and `plan.js` (the AI "Preview plan"). `lib/validate.js` (+ `validate.test.js`): input rules, including `checkSteps`, which the step editor (in the browser) and the server both run. `lib/update-plan.js` (+ `update-plan.test.js`): the part of "save changed steps" that checks the input and the draft's version before writing; the Server Action `updateDraft` calls it. `lib/steps.js`: the kinds of step and their named fields. `lib/step-rows.js`: the editor's rows, switching a step's kind, and the moving and inserting that drag and drop uses. `lib/templates.js`: the starter workflows. `lib/builder-start.js`: what the Builder opens with (blank, a template or a saved draft). `lib/ai-status.js`: the only thing pages learn about the AI key (on or off).
- `lib/ai/`: AI planning, in plain JavaScript with no Next.js imports so the tests can run it. `key.js` (the only file that reads the key), `groq.js` (the one web request to Groq), `provider.js` (the door that hides which company answers), `plan.js` (instructions, answer shape, cleaning, the card-number guard, the limits), `limits.js` (the counters), `preview.js` (the order of the checks), `icon-names.js`, and `*.test.js`.

Signed-in data is protected three times: the proxy, `requireUser()` next to the data, and the database rules (Row Level Security).

## Editing steps

On a plan preview or an opened draft, **Edit steps** lets you change each step's title, detail and icon, add steps, delete steps and move them up or down (buttons only here; dragging is in the Builder, see below). It still **runs nothing**: steps are only text to read.

- **A fresh preview:** changes stay on the page until you choose **Done**, then **Save as draft** saves the edited steps. **A saved draft:** **Save changes** replaces the old steps of that same draft. The old steps are not kept anywhere: there is no history to go back to. Only the steps change; the draft's name and request text do not.
- **The version check.** Each draft has a time it was last changed (`updated_at`, set by the database). The screen remembers the time it saw when the draft was opened and sends it back when you save. If the draft was changed since (for example by a save in another tab), nothing is saved: you see "This draft was changed somewhere else, so your edits were not saved. They are still on screen." and can press **Load latest** to throw your typing away and see what is saved. Renaming a draft in the list also changes its time. When that is the only thing that moved (the saved steps are still the ones you started from), the page notices, takes the new time and saves once more, without bothering you. If the draft was deleted meanwhile, **Save as new draft** keeps your steps.
- **Known small gap.** The server reads the draft's time, compares it, then writes. Another tab saving in the few milliseconds between those two steps would be overwritten: a rare lost update of the steps only, never another person's data (a delete in that gap is reported as "no longer exists", and a rename is not lost). It can be closed later by also filtering the update on the time the server just read (not the one the browser sent) and treating 0 rows as "changed". That is left open for now because only the live table can prove that such a filter matches, so it should be done together with the live checks.
- **Unsaved edits** are protected by an inline "Discard changes / Keep editing" bar (before a new preview, Edit request, Start over, opening another draft or the sidebar's New workflow), and by the browser's own "Leave site?" question when you close or reload the tab. Clicking a link in the sidebar moves to another page inside the app without that question, so unsaved edits are lost there. While the editor has changes it also says "Unsaved changes are lost if you leave this page."
- **Rules** (same in the browser and on the server, in `lib/validate.js`): 1 to 12 steps, a title of 1 to 200 characters, a detail of 0 to 200, icons only from the list the editor shows. Invisible characters (zero-width ones, direction marks, soft hyphens and the like) are removed, so a title made only of them counts as empty, line breaks become spaces, and text is never cut silently. A typed step (see below) is checked field by field, and a whole plan over 19,000 bytes is refused with a sentence (the database itself stops at 20,000).
- **Privacy:** edited steps leave the browser only when you press a save button (Save as draft, Save as new draft or Save changes), and `/privacy` says so.

## The Builder and typed steps

The **Builder** (`/app/builder`) builds a workflow by hand. It opens blank, from a **template** (`?template=invoices`, from the Templates page) or from a saved draft (`?draft=<id>`, from the Workflows page). It saves the same kind of draft as the workspace, with the same version check. It still **runs nothing**.

- **Typed steps.** A step is either free text (a title and a detail) or one of six kinds with named blanks: Start (what starts it, when), Look something up (where, what), Draft something (what to write, about), Ask you to approve, Send a message (how, to whom, about) and Add a row (spreadsheet, what to add). A typed step's title and detail are worked out from its fields, so it shows like any other step. Plans saved before typed steps existed are free-text steps and keep working. To add a kind, add an entry in `lib/steps.js` and keep its text fields short (a test checks that the worst case fits).
- **Drag and drop.** Drag a kind from the list on the left into the steps, or drag a step by its handle (the dotted grip) to move it. A purple line shows where it will land. This uses the browser's own dragging (no extra package), so it needs a mouse. The Add buttons, the arrow buttons and Delete work everywhere, including by keyboard and on phones. A drop only counts if it carries this app's own drag data and names a real kind, so a file or text dragged in from elsewhere does nothing.
- **Unsaved work.** The Builder says "You have unsaved changes", and the browser asks "Leave site?" if you close the tab. Clicking a sidebar link leaves without asking, like the workspace.

## How the motion works

- The headline entrance is plain CSS, so it starts without waiting for JavaScript.
- Scroll reveals, the folder-tab indicator, the run log and the footer wordmark use the `motion` library.
- The glow and the workflow band move on their own. They stop when scrolled offscreen, when the visitor presses **Pause motion**, or when their system asks for reduced motion (then movement is removed and only fades remain).

## Telegram (the first real connection)

A "Send a message" step set to **On Telegram** can really post to your own Telegram chat. It works in two stages: a **Practice run** (Workflows page) records the step and shows the exact message on the Runs page; there, **Approve and send to my Telegram** posts it and saves a separate "Sent" run. Nothing is sent without that click.

Set-up (also explained on the Connections page): create a bot with @BotFather in Telegram, send your bot one message, find your chat id, then add two lines to `hushwork-app/.env.local` and restart `npm run dev`:

```
TELEGRAM_BOT_TOKEN=your bot token
TELEGRAM_CHAT_ID=your chat id
```

The token is a secret. It is read only in `lib/connectors/telegram-env.js` (server only, checked by `lib/secrets.test.js`), never shown on a page or logged. `lib/connectors/telegram.js` makes the web request (tested with a pretend `fetch`), and `approveTelegramSend` in `lib/actions/runs.js` is the Server Action behind the button: it re-reads the saved run, allows only a Telegram send step, limits sends to 3 a minute and 20 a day per person, and saves a "live" run.

## Web calls ("Call a web address")

A step of the kind **Call a web address** (an https address and what it is for) is described in a practice run and can then be approved on the Runs page, which asks that address once with a read-only GET and saves the status and the start of the answer as a "Real" run. Because the server fetches an address a person typed, `lib/connectors/http.js` defends against SSRF (making the server reach its own network): https only, a real domain name (no `127.0.0.1`, `localhost`, `10.x`, `.internal` and so on), the name is looked up at connection time and every answer must be a public address, no redirects are followed, 8 seconds and 64 KB at most, and no cookies or secrets are sent. `approveWebCall` in `lib/actions/runs.js` reads the address from the saved run, never from the browser, and limits calls to 5 a minute and 30 a day per person. `lib/connectors/http.test.js` covers the address checks, private and IPv6 ranges, redirects, size and time limits, with a pretend network.

Not built yet: a schedule ("run every day at 9"). It needs the app hosted and a scheduler that works when your computer is off, plus a safe way to run a workflow without a signed-in person, so it waits for deployment.
