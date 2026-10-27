# Hushwork (Next.js app)

The Hushwork landing page and the app behind it: sign in, a workspace where you describe a job and get a plan, a Builder, 33 ready-made templates in five packs, a Runs page, Connections, Settings, scheduled runs and a few legal and safety pages. Next.js 16 (App Router), React 19, Tailwind 4, Supabase for sign-in and data, Groq for the AI, `motion` for animation. It is live at https://hushwork-six.vercel.app and open source (MIT, see `../LICENSE`). The big picture is in `../PROJECT.md` and why things were chosen is in `../DECISIONS.md`; this file is the how-to for working in this folder.

**What is real.** A plan is only text until you run it. A run first writes down what each step *would* do (a **practice run**), then each step that really does something waits for your **Approve** click (or runs straight away in **Auto** mode, or by itself on a **schedule** you ticked "Let it write by itself" for). The real things are: web calls, Linear (read and create a task), Google Calendar, Gmail (read), Drive (read), Sheets (add a row), 17 more apps through Composio (read one thing each; 14 can be connected), and actions that send an email, a Slack message, a GitHub issue, a Todoist task, a Calendar event or a Notion page. A step that only *describes* is named "Plan only" so it can never pretend.

**A note on words.** Older parts of this file say a step's result is saved as a "Real" run. The app no longer shows "Real" or "Practice" anywhere: a run says **Completed** or **Needs approval**, and each result sits inside its run. Inside the database a run's `mode` is still `practice` (the run with its steps) or `live` (one small record per finished step, pointing back at its run); that is the only place the words survive.

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

This runs all the automated checks (Node's built-in test runner, nothing to install): the input rules, the AI planning code with a pretend `fetch` (no test ever calls a real AI service), the scheduling and connection code, scans that make sure secrets are only read where they should be, and **tests that run the real server code** from "press Run" to "the email left" with a pretend database and a pretend Composio (`lib/run-core.integration.test.js`; see "Tests that run the real server code" below). `npm test` loads the server code through `scripts/test-hooks.mjs`. Node may print a harmless "module type not specified" warning; do not add `"type": "module"` to `package.json`. GitHub runs `npm test` and `npm run lint` on every push (`../.github/workflows/ci.yml`).

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

Sign-in, saved workflows and everything else need your Supabase project to have these SQL files run once (Dashboard, SQL Editor, New query, paste, Run). They are in `../supabase/`; run only the ones for features you use, in this order:

| File | What it makes | Needed for |
|---|---|---|
| `waitlist.sql` | the waitlist table (insert only for the public) | the home page's waitlist |
| `workflows.sql` | saved workflows and the privacy rules | sign-in + drafts |
| `runs.sql` | runs (never edited after they are saved) | the Runs page |
| `connections.sql` (or `connections-any-app.sql` if the table already exists) | each person's encrypted app connections | Connect Linear / Google |
| `schedules.sql` (and `schedules-index.sql` if you made the table before the index existed) | schedules | scheduled runs |
| `usage.sql` | counters + the `take_usage` function | limits that hold across servers |
| `memory.sql` | the `workflow_memories` table (your saved facts) | Settings > Memory (the AI works without it) |
| `skills.sql` | the `enabled_bundles` table (which bundles you turned on) | the Skills page's Turn on button |
| `clock.sql` | the once-a-minute clock (`pg_cron` + `pg_net`) | scheduled runs online. Edit your password into it first |

Then, in the Supabase dashboard (links go to the project `mgvaqoishxsqecpjfnuo`; change them for your own):

1. **Site URL and Redirect URLs** (Authentication, URL Configuration): `http://localhost:3100` and `http://localhost:3100/**` for local work; also your live address (`https://hushwork-six.vercel.app` and `https://hushwork-six.vercel.app/**`) for the online copy.
2. **Confirm email** (Authentication, Sign In / Providers, Email): off is easier for local testing; with it on, every sign-up sends a real email and Supabase's built-in sender allows only a few per hour.
3. **Keep "Allow anonymous sign-ins" OFF**, or anonymous visitors would count as signed-in people.
4. **Always open the local app at `http://localhost:3100`, not `127.0.0.1`**: the sign-in cookie belongs to one exact address.
5. Supabase's own "Leaked password protection" needs a paid plan; the app has a free check of its own (see "Limits and sign-in protection").

## Settings (environment variables)

An environment variable is a value kept outside the code. Locally, copy `.env.example` to `.env.local` and fill it in (it is never committed). Online, add them in Vercel (project, Settings, Environment Variables) and redeploy. After changing `.env.local`, restart `npm run dev`.

| Name | What it is | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Address of the Supabase project | No, public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Identifies the project; grants no power by itself (the database rules decide) | No, public by design |
| `NEXT_PUBLIC_SITE_URL` | The site's own address (link previews, sign-in links). Set it online | No |
| `GROQ_API_KEY` | Lets the AI write plans, answer Ask the AI steps and summarise results | **Yes** |
| `CONNECTIONS_KEY` | Locks every saved connection (`npm run secret` makes one). If it changes, people press Connect again | **Yes** |
| `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` | Hushwork's own app in Linear (Connect Linear) | secret is **yes** |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Hushwork's own app in Google Cloud (Connect Google) | secret is **yes** |
| `COMPOSIO_API_KEY` | The **Project** API key from Composio (starts with `ak_`) for the 17 more apps and the actions | **Yes** |
| `CRON_SECRET` | The clock's password for `/api/cron/tick` (`npm run secret cron` makes one) | **Yes** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase's all-access key. Used **only** for scheduled runs and Delete my account | **Yes, the most powerful one** |
| `LINEAR_API_KEY` | Your own personal Linear key, for working on your own computer only (ignored in production on purpose) | **Yes** |

`NEXT_PUBLIC_` means the value is sent to the browser. Never put a secret in one. Vercel and GitHub never show a secret again after you save it, so keep each one in a note or a password manager; if you lose one, make a new one and put it everywhere it is used.

## AI plans (optional)

"Preview plan" can ask an AI to write the plan instead of matching keywords. It is **off unless `GROQ_API_KEY` is set** in `.env.local`; without it the page says "AI planning is off" and nothing is sent anywhere. An API key is a secret password for a service: get one at https://console.groq.com/keys (it starts with `gsk_`), paste it as one line (`GROQ_API_KEY=gsk_...`, no quotes), never share it, and restart `npm run dev`. The key is read in one file only, `lib/ai/key.js`, on the server.

- **What is sent:** only the task text from the box, through the server, to Groq (never your email, id or other drafts). Text that looks like a card number or a secret key is refused before sending. Plans are shown as text; a practice run only writes down what each step would do.
- **Limits** (in `lib/ai/plan.js`): 2 AI plans a minute and 20 a day per person, 3 a minute and 60 a day for everyone together. The per-person count is kept in the database (`supabase/usage.sql`, `lib/db-limits.js`), so it holds across servers; until that SQL is run it falls back to server memory. The whole-site count stays in memory on purpose (anyone signed in could otherwise use it up): set a monthly spending cap in your Groq account too. See "Limits and sign-in protection".
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
- `lib/actions/waitlist.js` + `lib/waitlist-core.js`: the waitlist form, on the server, counted per visitor. `lib/actions/account.js` + `lib/account-core.js`: Delete my account. `lib/export-data.js` + `app/api/export/`: Download my data. `app/terms/page.js`: the Terms page.
- `lib/run-core.js`: everything an Approve button (or Auto mode, or the scheduler) does, told WHO it works for. `lib/run-engine.js`: what a run is and what each step would do; `planOnlySteps` names steps that only describe. `lib/run-answer.js`: `{answer}`, `{answers}` and the once-per-run rule.
- `lib/connectors/`: one file per outside service. `composio-apps.js` (the apps and their one read-only lookup), `composio-actions.js` (the actions that send or create), `composio.js` (the Composio client), `composio-env.js` (the only file that reads its key).
- `lib/schedule*.js`: the schedule rules (`schedule.js`), reading a Start step's words (`schedule-text.js`), making that a real schedule (`schedule-sync.js`), the runner, the clock's handler and the failure email (`schedule-notify.js`).
- `lib/template-packs.js` + `components/app/TemplateLibrary.js`: the template packs. `lib/templates.js`: the templates themselves.
- `supabase/`: one SQL file per table, plus `clock.sql`. `scripts/`: `make-secret.mjs` (`npm run secret`), `clock.mjs` (`npm run clock`, a clock for your own computer), `test-hooks.mjs` + `test-resolve.mjs` (the test loader).
- `lib/supabase/`: the two Supabase clients (`server.js` for pages and actions, `proxy.js` for the doorman). There is no browser client: the browser never talks to Supabase.
- `lib/auth.js`: `requireUser()`, the one place that asks "who is this?". `lib/actions/`: Server Actions for sign in/out, drafts and `plan.js` (the AI "Preview plan"). `lib/validate.js` (+ `validate.test.js`): input rules, including `checkSteps`, which the step editor (in the browser) and the server both run. `lib/update-plan.js` (+ `update-plan.test.js`): the part of "save changed steps" that checks the input and the draft's version before writing; the Server Action `updateDraft` calls it. `lib/steps.js`: the kinds of step and their named fields. `lib/step-rows.js`: the editor's rows, switching a step's kind, and the moving and inserting that drag and drop uses. `lib/templates.js`: the starter workflows. `lib/builder-start.js`: what the Builder opens with (blank, a template or a saved draft). `lib/ai-status.js`: the only thing pages learn about the AI key (on or off).
- `lib/ai/`: AI planning, in plain JavaScript with no Next.js imports so the tests can run it. `key.js` (the only file that reads the key), `groq.js` (the one web request to Groq), `provider.js` (the door that hides which company answers), `plan.js` (instructions, answer shape, cleaning, the card-number guard, the limits), `limits.js` (the counters), `preview.js` (the order of the checks), `icon-names.js`, and `*.test.js`.

Signed-in data is protected three times: the proxy, `requireUser()` next to the data, and the database rules (Row Level Security).

## Editing steps

On a plan preview or an opened draft, **Edit steps** lets you change each step's title, detail and icon, add steps, delete steps and move them up or down (buttons only here; dragging is in the Builder, see below). Editing runs nothing: steps are only text to read until you press Run on the Workflows page and approve the steps that do something.

- **A fresh preview:** changes stay on the page until you choose **Done**, then **Save as draft** saves the edited steps. **A saved draft:** **Save changes** replaces the old steps of that same draft. The old steps are not kept anywhere: there is no history to go back to. Only the steps change; the draft's name and request text do not.
- **The version check.** Each draft has a time it was last changed (`updated_at`, set by the database). The screen remembers the time it saw when the draft was opened and sends it back when you save. If the draft was changed since (for example by a save in another tab), nothing is saved: you see "This draft was changed somewhere else, so your edits were not saved. They are still on screen." and can press **Load latest** to throw your typing away and see what is saved. Renaming a draft in the list also changes its time. When that is the only thing that moved (the saved steps are still the ones you started from), the page notices, takes the new time and saves once more, without bothering you. If the draft was deleted meanwhile, **Save as new draft** keeps your steps.
- **Known small gap.** The server reads the draft's time, compares it, then writes. Another tab saving in the few milliseconds between those two steps would be overwritten: a rare lost update of the steps only, never another person's data (a delete in that gap is reported as "no longer exists", and a rename is not lost). It can be closed later by also filtering the update on the time the server just read (not the one the browser sent) and treating 0 rows as "changed". That is left open for now because only the live table can prove that such a filter matches, so it should be done together with the live checks.
- **Unsaved edits** are protected by an inline "Discard changes / Keep editing" bar (before a new preview, Edit request, Start over, opening another draft or the sidebar's New workflow), and by the browser's own "Leave site?" question when you close or reload the tab. Clicking a link in the sidebar moves to another page inside the app without that question, so unsaved edits are lost there. While the editor has changes it also says "Unsaved changes are lost if you leave this page."
- **Rules** (same in the browser and on the server, in `lib/validate.js`): 1 to 12 steps, a title of 1 to 200 characters, a detail of 0 to 200, icons only from the list the editor shows. Invisible characters (zero-width ones, direction marks, soft hyphens and the like) are removed, so a title made only of them counts as empty, line breaks become spaces, and text is never cut silently. A typed step (see below) is checked field by field, and a whole plan over 19,000 bytes is refused with a sentence (the database itself stops at 20,000).
- **Privacy:** edited steps leave the browser only when you press a save button (Save as draft, Save as new draft or Save changes), and `/privacy` says so.

## The Builder and typed steps

The **Builder** (`/app/builder`) builds a workflow by hand from a list of **blocks** (Start, Linear, Web address, Ask the AI, MCP server, Find something, Write something, Ask me first, Send a message (plan only), Add a row, Create Linear task, Another app, Do in another app, Note; defined in `lib/step-rows.js`). Drag a block into the line or press it; each step shows only its name and the blanks to fill in. It opens blank, from a **template** (`?template=invoices`, from the Templates page) or from a saved draft (`?draft=<id>`, from the Workflows page). It saves the same kind of draft as the workspace, with the same version check. After a save it tells you about two things: (1) **steps that only describe** ("Plan only") and (2) if the Start step says "On a schedule" with a time it can read, the **schedule it made** (see Scheduling). The Builder itself runs nothing.

- **Typed steps.** A step is either free text (a title and a detail) or one of twelve kinds with named blanks: Start, Look something up, Draft something, Ask you to approve, Send a message (plan only), Add a row, Call a web address, Ask the AI, Look in another app, Create a Linear task, MCP server and Do something in another app. A typed step's title and detail are worked out from its fields, so it shows like any other step. Plans saved before typed steps existed are free-text steps and keep working. To add a kind, add an entry in `lib/steps.js` and keep its text fields short (a test checks that the worst case fits the plan size limit).
- **Drag and drop.** Drag a kind from the list on the left into the steps, or drag a step by its handle (the dotted grip) to move it. A purple line shows where it will land. This uses the browser's own dragging (no extra package), so it needs a mouse. The Add buttons, the arrow buttons and Delete work everywhere, including by keyboard and on phones. A drop only counts if it carries this app's own drag data and names a real kind, so a file or text dragged in from elsewhere does nothing.
- **Unsaved work.** The Builder says "You have unsaved changes", and the browser asks "Leave site?" if you close the tab. Clicking a sidebar link leaves without asking, like the workspace.

## How the motion works

- The headline entrance is plain CSS, so it starts without waiting for JavaScript.
- Scroll reveals, the folder-tab indicator, the run log and the footer wordmark use the `motion` library.
- The glow and the workflow band move on their own. They stop when scrolled offscreen, when the visitor presses **Pause motion**, or when their system asks for reduced motion (then movement is removed and only fades remain).

## Web calls ("Call a web address")

A step of the kind **Call a web address** (an https address and what it is for) is described in a practice run and can then be approved on the Runs page, which asks that address once with a read-only GET and saves the status and the start of the answer as a finished record. Because the server fetches an address a person typed, `lib/connectors/http.js` defends against SSRF (making the server reach its own network): https only, a real domain name (no `127.0.0.1`, `localhost`, `10.x`, `.internal` and so on), the name is looked up at connection time and every answer must be a public address, no redirects are followed, 8 seconds and 64 KB at most, and no cookies or secrets are sent. `approveWebCall` in `lib/actions/runs.js` reads the address from the saved run, never from the browser, and limits calls to 5 a minute and 30 a day per person. `lib/connectors/http.test.js` covers the address checks, private and IPv6 ranges, redirects, size and time limits, with a pretend network.

Not built yet: a schedule ("run every day at 9"). It needs the app hosted and a scheduler that works when your computer is off, plus a safe way to run a workflow without a signed-in person, so it waits for deployment.

## Linear (the Connect button)

A **Look something up** step with Where set to **Linear** (the Linear block) can be approved on the Runs page: Hushwork asks Linear for the person's up to 10 open tasks and saves the list as a finished record. It can only READ (the one fixed query in `lib/connectors/linear.js` has no way to change anything, and the permission asked for is `read`).

**How people connect (like Zapier or n8n):** on the Connections page they press **Connect Linear**, sign in on Linear's own page and press Allow. Nobody pastes a key.
1. `/api/connect/linear` (`app/api/connect/[provider]/route.js`, the same two route files serve every app) makes a random `state`, keeps it in a short-lived HttpOnly cookie and sends the person to Linear's Allow screen.
2. Linear sends them back to `/api/connect/linear/callback` with a one-time code. The callback checks the state, swaps the code for tokens (using the app secret, server only), scrambles them (AES-256-GCM, `lib/connections/crypto.js`) and saves them for that person in the `connections` table.
3. Linear access tokens last 24 hours; `lib/connections/store.js` renews them with the refresh token (Linear hands out a new refresh token each time, and both are saved). Disconnect revokes the permission at Linear and deletes the row.

**One-time set-up by the owner** (also written step by step on the Connections page, with ticks for what is done):
1. Run `supabase/connections.sql` in the Supabase SQL Editor (the table, with the same owner-only rules as `runs`).
2. `npm run secret`, then paste the `CONNECTIONS_KEY=...` line it prints into `hushwork-app/.env.local`. This secret scrambles every saved token: lose it and people must press Connect again.
3. In Linear (Settings, API, OAuth applications) create an app named Hushwork with the callback address `http://localhost:3100/api/connect/linear/callback` (add the real website address when there is one), and put its Client ID and Client secret into `.env.local` as `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET`. Restart `npm run dev`.

The owner can still test without the button: a personal key in `.env.local` as `LINEAR_API_KEY` (Linear, Settings, Security & access, Personal API keys) works on that computer only. Every secret is read only in `lib/connectors/linear-env.js` or `lib/connectors/oauth-env.js` (server only, checked by `lib/secrets.test.js`), never shown or logged. `approveLinearLookup` in `lib/actions/runs.js` uses the person's own connection first, then the personal key, and limits lookups to 5 a minute and 30 a day per person.

Not tested against the real Linear yet: the sign-in, the token swap and the renewal were built from Linear's published docs and tested with a pretend Linear.

## Gmail: look at the inbox (read-only)

A **Look something up** step set to **Inbox** can now be approved on the Runs page (`approveGmailLookup` in `lib/actions/runs.js`): Hushwork asks Gmail for the latest 10 inbox messages and saves the sender, subject and time as a finished record. An **Ask the AI** step can also be set to **My Gmail inbox** (the template **What is in my inbox?**). `lib/connectors/google-gmail.js` only sends GET requests and asks only for the From, Subject and Date headers (`format=metadata`), so the text of an email is never read or stored; the new Google permission `gmail.readonly` cannot send, change or delete mail. Values are flattened and cut short because strangers write them; the AI agent wraps them as data and ignores instructions inside. Limits: 5 a minute and 30 a day per person.

**Owner set-up:** in Google Cloud also enable the **Gmail API** (APIs & Services, Library). Anyone who connected Google earlier must press **Disconnect** and **Connect Google** again so Google asks for the new Gmail permission (until then Gmail answers "refused" and the Runs page says so). While the app is in Testing, Google shows the same "not verified" warning. Not yet tested against the real Gmail: built from Google's published docs and tested with a pretend Google.

## Google Drive: your latest files (names only, read-only)

A **Look something up** step set to **Files** can be approved on the Runs page (`approveDriveLookup`): Hushwork asks Google Drive for the 10 files you changed most recently and saves each file's name, kind (Doc, Sheet, PDF...) and time as a finished record. An **Ask the AI** step can be set to **My Google Drive files** (template **What did I work on lately?**). `lib/connectors/google-drive.js` sends one GET asking only for `name,mimeType,modifiedTime`; the Google permission `drive.metadata.readonly` can only see file details, never open, change or delete a file. Limits: 5 a minute and 30 a day per person.

**Owner set-up:** in Google Cloud also enable the **Google Drive API**. Anyone who connected Google before must press **Disconnect** and **Connect Google** again (once is enough for both Gmail and Drive) so Google asks for the new permissions. Not yet tested against the real Drive.

## Adding another app to the Connect buttons

The apps are one list: `lib/connectors/app-list.js`. Linear and Google are the first two entries. Everything shared (the sign-in, the encrypted saved permission, renewing, Disconnect, the two route files, the box with the setup checklist on the Connections page, the status ticks) reads that list, so a new app is **one new entry** and nothing else in the sign-in code:

```js
{
  id: "notion",            // lowercase name; also the callback address /api/connect/notion/callback
  name: "Notion", heading: "Notion", envPrefix: "NOTION",   // settings: NOTION_CLIENT_ID and NOTION_CLIENT_SECRET in .env.local
  authorizeUrl: "...", tokenUrl: "...", revokeUrl: "...",
  scopes: ["read"],        // as small as possible
  about: "One plain sentence under the button.",
  setup: { intro: "...", steps: ["...", "... `{callback}` ..."] },   // how the owner makes Hushwork's own app on that site
}
```

Then: put the two settings in `.env.local`, restart `npm run dev`, and the Connect button appears. The **database** needs nothing new if you ran `supabase/connections-any-app.sql` once (it lets the `provider` column hold any lowercase name; the app still only accepts names in the list). What still has to be written by hand, because it is different for every app: a small connector file that does the actual work with the permission (for example `lib/connectors/linear.js`), a step kind for it in `lib/steps.js`, and its Approve action. Only an app whose token answer looks like the usual OAuth one (`access_token`, optional `refresh_token`, `expires_in`) fits the shared sign-in; Notion-style or Slack-style variations would need a small tweak in `lib/connectors/oauth-common.js`.

## Ask the AI (an AI that can use tools)

The **Ask the AI** block gives the Groq model a job (`task`) and lets it look at ONE read-only thing first: your Linear tasks, a web address written in the step, or nothing. After a practice run, press **Approve and ask the AI** on the Runs page; the answer is saved as a finished record. This is "tool calling": the model says "please run this tool", Hushwork runs it, hands the result back and the model writes its answer (`lib/ai/agent.js`, at most 4 rounds).

Safety, all covered by `lib/ai/agent.test.js` and `lib/secrets.test.js`: every tool takes **no input from the model** (so a web page cannot talk the AI into fetching another address or sending your data anywhere); tools are read-only; tool results are wrapped as `<data>` and the model is told to ignore instructions inside; the request is refused if it looks like a card number or secret key; AI steps are limited to 3 a minute and 15 a day per person; the Groq key stays in `lib/ai/key.js`. What goes to Groq (the request and what the tool read) is stated on the approval card and the privacy page.

## The AI plan writer builds with blocks

"Preview plan" with AI on returns typed steps. Each step the AI writes names a **block** (only ones that really do something: trigger, approve, **ai**, row, issue or **action**) plus three small answers (`choice`, `a`, `b`) and its own detail line; `lib/ai/plan.js` turns them into the named blanks of a typed step. Those blanks go through the same checks as a person's own steps; a step that fails them (or is marked `note`) stays a plain text step. The AI is never offered the web-address block (it must not choose addresses), two approval steps in a row become one, and an approval step is added before the first step that sends something.

- **Fewer blocks, all real (2026-10-25).** The AI is no longer offered *Look something up*, *Linear*, *Write something*, *Send a message* or *Another app*: the first three only described, and **Ask the AI** already looks (in Linear, the calendar, the inbox, Drive or one of 13 connected apps), finds, sums up, picks and writes. So "look in my inbox" is one `ai` step with `choice: gmail`, not a second block. If an answer still uses an old block, `rewrittenStep` in `lib/ai/plan.js` turns it into the matching Ask the AI step. An Ask the AI step never gets an "Ask you to approve" step in front of it just because of a word like "payments" (only steps that write do). The keyword preview (`lib/ai/keyword-plan.js`) now builds the same real steps. The Builder's palette also hides the three describe-only blocks (`PALETTE_BLOCKS`); older plans that hold them still open and are marked Plan only.
- **A safety net for plain notes (`realizeNotes` in `lib/ai/plan.js`).** The model sometimes ignores the blocks and answers with plain notes ("Read important emails", "Draft replies", "Store drafts in Notion"). A note only describes, so it is turned into the real step that does the job, decided by the first word of its title: a reading verb (read, check, find, summarise...) becomes an Ask the AI step that looks where the words say; a writing verb (draft, write, reply...) is added to the look before it (Ask the AI steps cannot see each other's answers) or becomes its own step; a sending or storing verb (store, save, send, email...) becomes ONE real email to the person (or to the address written in the task) carrying the answer, only if nothing already really sends. A note whose first word is none of these (a heading, a stop sign) stays as it was. Notion pages cannot hold text yet, so "store it in Notion" becomes that email.
- **The real blocks.** `action` makes a **Do something in another app** step: `choice` is `gmail_send`, `slack_message`, `github_issue`, `calendar_event`, `notion_page` or `todoist_task`; `a` is where it goes (`{myEmail}` for the person's own address, a channel, `owner/name`, a start time like `2026-11-05 15:00`, a page id); `b` is the subject or title; the step's detail is the text. `app` makes a **Look in another app** step. The old `send` block is taught as **plan-only** ("it does NOT send anything").
- **A safety net in code** (`ensureRealSend`). If the task says send-to-me (`send a message to my account`, `email me`, `message myself`) or names an email address with a sending word, and no step really sends, the first plan-only sending step is replaced by a real email (or one is added). If an Ask the AI step comes before it, the email carries that step's answer (`{answer}`). The keyword preview (when the AI is off) goes through the same net.
- **Old plans.** A saved plan with the old "Send a message" by email and a usable address (or `me` / `my account`) is treated as a real email when run: the approval card shows To, Subject and the text (`upgradeSend` in `lib/run-engine.js`). Slack, "other" and addresses it cannot use stay descriptions.
- **Reliability.** Groq sometimes refuses the richer shape (`json_validate_failed`). Then `lib/ai/groq.js` asks **once more** for the original plain plan (`SYSTEM_PROMPT_PLAIN`, `PLAN_SCHEMA_PLAIN`), so a person still gets an AI plan (the safety net still applies). Any other failure is not retried. The log line carries only numbers and short codes, never text.
- The instructions are guarded by a test (`lib/ai/plan.test.js`): the safety sentences must stay word for word, and every block the code understands must be explained.

## Google Calendar and Sheets (the second Connect button)

A **Look something up** step with Where set to **Calendar** can be approved on the Runs page: Hushwork asks Google Calendar for the person's next 10 events in the coming 7 days and saves the list as a finished record. An **Ask the AI** step may also be allowed to look at "My Google Calendar" (a tool with no input from the model). It is READ-ONLY twice over: the only permission ever requested is `calendar.readonly` and `lib/connectors/google-calendar.js` only sends GET requests (both are checked by `lib/secrets.test.js`).

Connect works exactly like Linear's (`lib/connections/oauth-flow.js` is shared; `lib/connections/store.js` keeps one encrypted row per person and app and renews tokens; Google keeps the same refresh token when it renews). One-time owner set-up (also on the Connections page with ticks): `supabase/connections-any-app.sql` if the table already exists (a fresh `connections.sql` already allows Google), then in Google Cloud: a project, the Google Calendar API enabled, an OAuth consent screen in Testing with yourself as a test user, and a Web OAuth client with the redirect address `http://localhost:3100/api/connect/google/callback`; its Client ID and secret go into `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. While the app is in Testing, Google makes people connect again every 7 days, and shows a "not verified" warning (Advanced, Go to Hushwork). Not yet tested against the real Google: it is built from Google's published docs and tested with a pretend Google.

## Deleting runs

Every run has a **Delete this run** button (it asks first). A run is only a record, so deleting it changes nothing outside Hushwork; `deleteRun` in `lib/actions/runs.js` only ever deletes the caller's own run.

### Google Sheets: add a row

An **Add a row** step whose **Google Sheet address** is a normal `https://docs.google.com/spreadsheets/d/...` address and whose **What to add** has comma-separated boxes (for example `Ana, 500, 20 Oct`) can be approved on the Runs page. The approval card shows the exact boxes; **Approve and add the row** then adds ONE row at the bottom of that sheet and saves a finished record. Older plans that only name a spreadsheet (no address) stay descriptions.

This is the one action that writes into a person's Google account, so: the sheet and the boxes come from the saved run (never the browser) and are checked again on the server; `lib/connectors/google-sheets.js` has a single request, Google's "append" (`values/A1:append`, `INSERT_ROWS`), with `valueInputOption=RAW` so a box that starts with `=` stays plain text and never runs as a formula; it has no way to read, change or delete cells; the address must be a real Google Sheets address (the id is the only part used); at most 20 boxes of 100 characters; 5 rows a minute and 30 a day per person (`lib/secrets.test.js` and `lib/connectors/google-sheets.test.js`).

**Permissions:** the Google Allow screen now shows two: `calendar.readonly` and `spreadsheets` (Google has no narrower permission that works on an existing sheet). In Google Cloud also enable the **Google Sheets API**. Someone who connected Google before Sheets was added must press Disconnect and Connect Google again so Google asks for the new permission. Tested with the real Google by the owner.

## Linear: create a task (the first step that writes to Linear)

A **Create a Linear task** step (block **Create Linear task** in the Builder) has a title, optional details and an optional team key (like `ENG`; empty means your first team). On the Runs page its **Approve and create the task** button adds ONE new task in Linear (`approveLinearCreate` in `lib/actions/runs.js`). `lib/connectors/linear-create.js` is the only file that changes anything in Linear: one fixed `issueCreate` request, with the words sent as separate variables (never glued into the request text) and a read-only question first to find the team. The new Linear permission is `issues:create` (Linear wants commas between permissions, so the Linear entry in `app-list.js` has `scopeSeparator: ","`): it cannot change or delete anything that exists. Both the title and details may use `{answer}` (see below). Writing steps (this one and **Add a row**) can be approved only once per practice run and step, so going back and pressing Approve again cannot create a second copy (`wasApproved` in `lib/run-answer.js`). Limits: 3 a minute and 15 a day per person.

**Owner set-up:** nothing new in Linear's developer settings. Anyone who connected Linear earlier must press **Disconnect** and **Connect Linear** again so Linear asks for the new permission (until then the Runs page says Linear refused). The personal key in `.env.local` (this computer only) can create tasks too. Not yet tested against the real Linear.

## More apps through Composio (17 apps, 14 connectable)

Composio (composio.dev) already holds the sign-in for hundreds of apps, so Hushwork reaches more apps without making an app on each website. The apps are one list, `lib/connectors/composio-apps.js`: Todoist, Notion, Airtable, HubSpot, Jira, GitHub, Vercel, Sentry, Cloudflare, PagerDuty, Slack, Stripe, Xero, Mailchimp, Google Tasks, Trello, plus **Gmail (send)** and **Google Calendar (events)** (separate connections, used for the actions). Each entry names ONE read-only Composio tool (for example `TODOIST_GET_ALL_TASKS`) and the sign-in Hushwork asks Composio to make is limited to that tool plus the tools of the actions listed for that app (`restrict_to_following_tools`).

- **Connect:** the Connections page has a Connect button per app (`/api/composio/<app>` -> `lib/connections/composio-flow.js`). Hushwork makes sure Composio has a sign-in for the app, asks Composio for a one-time sign-in page and sends the person there. Composio keeps the permission; Hushwork never sees it and identifies the person to Composio only by their random account id.
- **Vercel, Xero and Cloudflare cannot be connected** (Composio has no ready-made sign-in for the first two, and Cloudflare needs an API key, which Hushwork never collects). They stay in the list with an `unavailable` reason and show "Not available yet" instead of a Connect button.
- **Add an app:** add one entry to `composio-apps.js` (the toolkit name and one list/read tool from https://docs.composio.dev/toolkits/<toolkit> that needs no input). Check the toolkit's page: if it says "Composio-managed OAuth not available", give the entry an `unavailable` sentence.
- **Setting up:** make a Composio account, copy the **Project API key** (starts with `ak_`; a key starting `ck_` or `uak_` is a different kind and is refused with a plain sentence) into `COMPOSIO_API_KEY`, restart. After a change to what an app may do (new actions), press Disconnect and Connect on that app once so its sign-in gets the new permission.
- **Real use:** emails, calendar events, Notion pages and Google/Linear reads have been run for real; Slack, GitHub issue and Linear create have been tested with pretend servers only. Use "Test all my connections" (below) to check a connection.

## Scheduling (a workflow that runs by itself)

A schedule is a row in `schedules` (`../supabase/schedules.sql`): one per workflow, at most 10 per person, hourly, daily, weekdays or weekly (no monthly), at a time in the person's own time zone (saved as an offset when the schedule is made). A person can never write the runner's bookkeeping columns. Two ways to make one:

1. **From the Builder (the Start step).** Set Start to "On a schedule" and write the time the way people do: `Every weekday at 17:30`, `Every Monday at 9`, `Daily at 5pm`, `Every hour, 43 minutes past` (`lib/schedule-text.js` reads it; the templates and the Schedule panel's own words all read back). Pressing Save makes or updates the real schedule (`lib/schedule-sync.js`) and says so in the "Saved" message. A new schedule starts with "may write" **off**; an existing schedule keeps its "may write" and "paused" choices. Nothing is made if the words cannot be read (it says so) or if no step of the workflow can really run.
2. **From the Workflows page.** The **Schedule it** panel: how often, the time, and **Let it write by itself** (off unless ticked: a scheduled run skips every step that sends, creates or adds, because nobody is there to approve it). If the panel and the Start step disagree it says so and offers **Use the Start step's time**.

**What runs it:** a clock calling `GET or POST /api/cron/tick` every minute with `Authorization: Bearer <CRON_SECRET>` (`lib/schedule-tick.js`). Without that password nothing happens (503 if scheduled runs are not switched on, 401 for a wrong password, compared in constant time). For each schedule whose `next_run_at` has passed, `lib/schedule-runner.js` (1) **claims** it by moving `next_run_at` forward in one update that only succeeds if nobody else moved it first, so two overlapping calls never run it twice, (2) runs the workflow the way Auto mode does, as its owner, through the normal Approve actions (so every check and limit applies; a run says "Started by its schedule: ..."), and (3) writes down how it went (`ok`, `stopped` or `failed`). A schedule that is days overdue runs once and waits for its next normal time. At most 20 schedules per call.

**The clock:** `../supabase/clock.sql` makes Supabase itself call the address every minute (`pg_cron` + `pg_net`, the password kept in Supabase's Vault). Edit your `CRON_SECRET` into it before running it. GitHub's free timer (`../.github/workflows/clock.yml`) fires only every 3 to 4 hours, so it is only an optional backup. On your own computer, `npm run clock` (a second terminal next to `npm run dev`) asks once a minute.

**When a schedule starts failing**, the person gets one email (not one per run): `lib/schedule-notify.js`, sent through their own Gmail (send) connection to their own address. It names only the workflow and says where to look.

**The all-access key:** with nobody signed in, the runner needs a database client that ignores the privacy rules: `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase/admin.js`). Only the clock's handler and Delete my account use it, never a page or a button, and every query names the person's `user_id` (a test lists which files may import it). Treat it like a bank password.

**Setting up:** (1) run `schedules.sql` (and `schedules-index.sql` if the table is older); (2) `npm run secret cron` and put the value in `CRON_SECRET`; (3) put the Supabase secret key in `SUPABASE_SERVICE_ROLE_KEY`; (4) run `clock.sql` (with your `CRON_SECRET` edited in); (5) redeploy. Full steps: `../docs/deploy.md` sections 7, 9, 11 and 15.

## Manual mode and Auto mode, and logos

**Manual (the default):** a run first only writes down what each step would do (a practice run); then the person presses **Approve** on each real step. **Auto:** pressing the run button does every real step straight away, in order, without asking. The choice is a switch above the list on the Workflows page, remembered in the browser (`hw-run-mode`, `components/app/RunMode.js`); the run button says **Practice run** or **Run automatically**, and a card warns when the workflow will write by itself (add a row, create a Linear task). Auto is `runAutomatically` in `lib/actions/runs.js`: after the practice run is saved it calls the very same Approve actions in order (so every check, limit, "once per practice run" rule and error sentence applies unchanged), stops at the first step that fails, and does at most 20 steps. Only an explicit `auto: true` turns it on. Because a real run now belongs to a practice run (`from`, `fromStep`), the Runs page shows each real result **right under its step** of the practice run (and hides that step's Approve box); after a Manual Approve the page stays and refreshes instead of jumping to a separate run.

**Logos:** every connection on the Connections page has a thumbnail (`components/AppLogo.js`, `lib/app-logos.js`) drawn from the `simple-icons` package (one SVG path per brand, no images downloaded when the page loads). Google shows four (Calendar, Sheets, Gmail, Drive). An app with no logo gets a plain icon; to add one, add a line in `lib/app-logos.js`. Installed `simple-icons` for this (CC0 shapes; the brands belong to their owners).

## Results are summarised by the AI and shown big

Every lookup (Linear tasks, Calendar, Gmail, Drive, another app) now saves two things as its result: first a clear, detailed **AI summary** (`summarizeData` in `lib/ai/agent.js`: no tools, it may use ONLY the list it is given, the list goes in as `<data>` and the question as `<task>`), then **the app's own list exactly as it answered**, so a summary can never hide the facts (`withSummary` in `lib/actions/runs.js`). If the AI is off, the person's AI limit is used up, or the AI fails, the result is simply the app's own list (no error). **Ask the AI** answers are no longer limited to 8 short lines: they are structured (one main sentence, `- ` detail lines, an optional `Next step:` line, up to about 20 lines). On the Runs page a real run's result is laid out in a card (`ResultText` in `components/app/RunsViewer.js`): blank lines kept, `- ` lines as bullets, `Next step:` highlighted. Because the data now goes to Groq for these steps, the approval text and `/privacy` say so.

Gmail also had "broken" text for accents, emoji and non-English names: mail headers store them as coded words like `=?UTF-8?Q?Caf=C3=A9?=`. `decodeMimeWords` in `lib/connectors/google-gmail.js` turns them back into real words (and never throws).

## Passing an answer to the next step: `{answer}`

An **Add a row** step can use what an **Ask the AI** step of the same workflow said: write `{answer}` in one of its boxes (for example `20 Oct, {answer}`). The order is: do a Practice run, press **Approve** on the Ask the AI step (this saves a finished record that also keeps the AI's words), go back to the practice run, and the Add a row step now shows the exact row with the real words filled in; press **Approve** to add it. `lib/run-answer.js` finds the newest real AI step of the same workflow saved after that practice run (only your own runs). The words are put into the box after the row was cut at the commas, flattened to one line and cut to 500 characters, so they cannot add extra boxes, and they are written as plain text (never a formula). If there is no answer yet the step says so and nothing is written.

## Open an AI plan in the Builder

On the workspace page, a plan (written by the AI or the keyword preview) has an **Open in the Builder** button next to Save as draft. A new plan is saved as a draft first (the same save as Save as draft), then the Builder opens it (`/app/builder?draft=<id>`), where its blocks can be dragged around and its blanks filled in (for example the Google Sheet address of an Add a row step). The button is hidden while a saved draft has unsaved step edits (save the changes first).

## Templates and template packs

`lib/templates.js` holds 33 ready-made workflows. **Every one really works** with your connected apps once you press Approve (none is plan-only; a test enforces it), and each says what it needs ("Works with Google, Gmail (send)"). They are split into **packs** (`lib/template-packs.js`): **Everyday**, **Finance** (Stripe summary, invoice emails, receipts), **Marketing** (post ideas, page check, writing time, Notion launch notes), **Coding** (GitHub digest, notification to Linear task, weekly dependency issue, incident digest) and **Design** (review task, feedback roundup, design log, focus time). The Templates page has a button per pack with a count; your pick is remembered in the browser (`components/app/TemplateLibrary.js`).

- A template may suggest a **schedule** (`schedule: { frequency, weekday, hour, minute }`), shown on its card. Its Start step carries the same words, so saving it in the Builder makes the real schedule (see Scheduling).
- Emails in templates go to `{myEmail}`, never to a real address (a test scans for any address). A few templates start with a made-up value that you must change first (a Notion page id of zeros, `your-name/your-repo`, an example date or web address); the card says so and Hushwork refuses to send the made-up value.
- `lib/template-packs.test.js` and `lib/templates.test.js` check: every pack has at least three templates, every step can be approved, a schedule suggestion is valid and matches the Start step, and the made-up values are announced in the template's text.

## Real actions in other apps (email, Slack, GitHub, Todoist, Calendar, Notion)

A step of the kind **Do something in another app** names one action from `lib/connectors/composio-actions.js` (never a tool name): Send an email (Gmail), Send a Slack message, Create a GitHub issue, Add a Todoist task, Add a Google Calendar event, Create a Notion page (and the Google files and the Gmail draft, see "Google files and a Gmail draft" below). Its boxes are **Where** (an address, channel, `owner/name`, start time or page id; checked by a pattern before anything is asked), **Message or title** and **More details**. On the Runs page the approval card shows the exact words and where they go; **Approve and send it** can be pressed **once per run** for a step. Before sending, Hushwork asks Composio for the tool's real inputs and builds the request only from inputs that exist; if the tool needs something Hushwork cannot fill in, **nothing is sent**.

- **Add an action:** add one entry to `composio-actions.js` (id, app, name, tool, a pattern for "where", the names the tool may call each input, how the words map to inputs, optional `labels`, `noDetails`, `example`, `selfAllowed`). Nothing else changes; the sign-in, the step, the approval card and the checks all read the list.
- **Safety:** actions take their words from the saved run (never the browser), are checked again on the server, refuse text that looks like a card number or secret key, and are limited (3 a minute, 15 a day per person, counted in the database too).
- **Not offered on purpose:** anything that moves money (Stripe) or deletes.

## Placeholders: `{myEmail}`, `{answer}`, `{answers}`

- `{myEmail}` as an email's **Where** means the signed-in person's own address. It is filled in from the session (and from the database for a scheduled run), shown on the approval card, never read from the step.
- `{answer}` is what the **last** Ask the AI step of the run said (one line, cut to 500 characters; an email keeps its line breaks up to 3,000).
- `{answers}` (emails only) carries **every** Ask the AI step of the run, in workflow order, joined by blank lines: this is how the **Morning briefing by email** template sends three summaries in one email. With no answer yet the step stops with a clear sentence instead of sending an empty email.

## Safe recovery: continue a run, never send twice

Runs are never edited, so a step's state is told by small records added under it (`lib/run-state.js`); the newest one wins: `pending` (started, end not seen), `failed`, `done`. Every step that **writes** (email, Slack, GitHub, Todoist, Calendar, Notion, Linear task, Sheets row) saves `pending` **before** it calls the other app, then `done` or `failed`.

- A step that is **done** is skipped, always.
- A step that **failed** (a clear refusal) can be tried again.
- A step still **pending** (dropped connection, busy server, crash) is **unknown**: it may already have happened, so it is never sent again by itself. The Runs page says "Not sure if this happened"; after you check the app, **It was not done, try again** sends it once.
- **Continue from where it stopped** (button on a run that stopped, `resumeRun` in `lib/run-core.js`) does the steps that are not done and skips the rest, so pressing it twice is safe.
- If the "started" record cannot be saved, nothing is sent. If the state cannot be read, writing is blocked.

Tests: `lib/run-recovery.integration.test.js` (real server code, pretend database and Composio) and `lib/run-state.test.js`. Why: `../DECISIONS.md` D-040.

## Skills and Skill Bundles (plugins)

A **skill** is one small capability: one typed step plus plain words saying what it **reads** and what it **writes** (for example "Find unpaid payments" reads your latest Stripe payments; "Email me the result" sends one email to you). A **bundle** is a package of skills for one kind of work, with the apps it needs and ready-made workflows built only from its own skills. The registry is `lib/skills/bundles.js` (plain data, no database).

| Bundle | Connections | Ready-made workflows |
|---|---|---|
| `finance-ops` Finance and operations | Stripe, Google, Gmail (send) | **Invoice Chaser** (Fridays 10:00), **Expense Categorizer** (Mondays 9:00), **Weekly Money Report** (Fridays 16:00) |
| `marketing-growth` Marketing and growth | Gmail (send) | **Campaign Repurposer** (when asked), **Weekly Post Ideas** (Mondays 9:00) |
| `dev-admin` Dev and admin | Google, Linear, Gmail (send), GitHub, PagerDuty | **Client Project Triage** (when asked), **Weekly Dev Digest** (Mondays 9:00) |

The **Skills** page (`/app/skills`, `app/app/skills/page.js` and `components/app/BundleCard.js`) shows each bundle, which apps it needs and whether they are connected, exactly what every skill can read and write, and a **Turn on** button.

- **Turn on** (`lib/skills/enable.js`): saves a row in `enabled_bundles` first (a double click cannot save twice), then saves the bundle's workflows as drafts in your own Workflows list (a workflow you already have by that name is kept). It connects no app, makes no schedule and runs nothing. If saving fails the row is taken back.
- **Turn off** removes the row only. The saved workflows stay.
- **Schedules:** the suggested time is shown. To use it, open the workflow in the Builder and press Save: that creates the schedule (reads only until you tick "Let it write by itself").
- **Safety:** reading skills only read; writing skills (email, Linear task) still wait for Approve; every writing workflow has an "Ask you to approve" step before its first write and emails only you (`{myEmail}`). The AI steps do not see each other's answers, so an email carries them all with `{answers}`.
- **Limits worth knowing:** Invoice Chaser reads Stripe *payments* and emails the review pack to you (it cannot email each client). Client Project Triage reads Gmail senders and subjects; Slack can only list channel names. Campaign Repurposer needs the blog post's address typed into its two Ask the AI steps.
- **Set up once:** paste `../supabase/skills.sql` in the Supabase SQL Editor. Until then the page shows the bundles and says one step is missing.

Tests: `lib/skills/bundles.test.js` (every skill and workflow follows the rules), `lib/skills/enable.test.js`, `lib/skills/bundles.integration.test.js` (the real run code), `lib/sql-rls.test.js` (RLS on every per-person table). Why: `../DECISIONS.md` D-041.

## An Ask the AI step can use what earlier steps found (2026-10-25)

Write `{answers}` in the job of an Ask the AI step, for example "Which of these requests have NO matching open task? {answers}". That step is then handed the answers of the Ask the AI steps before it, as information only (never as part of your request). With none before it, it stops and says to approve those first. One step still looks in ONE place, so a "compare" is two steps: the first finds, the second looks somewhere else and compares. The bundle **Freelancer safety net** (Scope Creep Alarm, Week Balancer, Meeting-Day Rescue Brief) is built on this. The idea log is `../docs/ideas.md`.

## Watch mode: a check that stays silent unless something is new (2026-10-27)

In the Builder, set the **Start** step to **Keep watching** and write how often like a schedule ("Every weekday at 9:00"). Saving makes the same real schedule as "On a schedule" (writing stays OFF until you tick it on the Workflows page). Then use the pieces:

- **`{last}`** in an Ask the AI job: the step is handed what it answered the last time the workflow ran (as information only, like `{answers}`), so it can say what is new. The first check is not an error: the AI is told it is the first.
- **NOTHING NEW:** in a watch workflow, an Ask the AI answer that starts with `NOTHING NEW` ends the run quietly: nothing after it runs, nothing is sent, the schedule counts as fine. The Runs page hides those checks and shows one line, "3 quiet checks: nothing new".
- **When it speaks** (`lib/watch-rules.js`): never between 20:00 and 08:00 your time, at most 3 times a day. A watch schedule that comes due at night is skipped (it just moves on to its next time, no AI is used). When a check finds something and a step is waiting for your Approve, Hushwork sends you ONE plain email (through your own Gmail (send) connection, to yourself) that only says to open the Runs page. It never contains what was found and never approves anything. Each one leaves a small "Told you" record that the 3-a-day count uses. No Gmail (send) connection: no email, the run just waits on the Runs page.
- **Never alone:** a watch schedule does not write by itself unless you ticked "Let it write by itself". The pause switch stops it too.
- **The "Watch for me" bundle** (Skills page) has three ready-made ones. Their times are daily because every check uses one of your 15 AI steps a day; "Every hour" works but uses that allowance up fast.

## Safety switches and checks before launch (2026-10-25)

- **Pause switch.** `supabase/app-controls.sql` makes a one-row table. In the Supabase SQL Editor, `update public.app_controls set value = true where name = 'paused';` stops everything at once (no deploy): no writing step starts, no Ask the AI step is asked, no schedule runs, and the Runs page says Hushwork is paused. Set it back to `false` to start again. Nobody can change it from the app.
- **Changed since you read it.** The Approve button on a writing step hands back the exact words of its card. If the step would now send different words (the AI step ran again somewhere else), nothing is sent and you read the new words first.
- **Two-account privacy check.** `npm run check:privacy` (see the top of `scripts/two-account-check.mjs`): with two throwaway accounts it proves against the real database that B and a visitor cannot read, change, delete or write into A's data, schedule A's workflow, or flip the pause switch. Run it before launch and after any change to a `supabase/*.sql` file.
- **Launch checklist:** `../docs/launch.md`.

## More abilities (2026-10-25)

- **Run summary line.** At the top of a run on the Runs page: "3 of 4 steps done: looked in Stripe and Google, the AI wrote 1 text and sent 1 email. 1 step could not run: step 3 (...)". Built only from saved results (`lib/studio/run-summary.js`): counts steps, never made-up item counts.
- **Notion pages with text.** The action's "details" box is the text written on the page (Composio's create-page tool takes it as `markdown`). The approval card shows it as "Text on the page".
- **Stripe invoices.** `stripeinvoices` (`STRIPE_LIST_INVOICES`) shares the Stripe sign-in. If you connected Stripe earlier, press **Disconnect** then **Connect** once so the sign-in allows the new tool. Invoice Chaser reads invoices.
- **The text of emails (opt-in).** In an Ask the AI step choose **My Gmail inbox, with the text of each email**. The opening (about 450 characters) of your 5 newest emails goes to the AI (Groq); quoted replies, signatures and links are removed; the email text is not kept, only the AI's answer. The default **My Gmail inbox (senders and subjects)** never reads the text. Skill and workflow: **Draft replies to my emails** / **Reply Drafts** (emails the drafts to YOU).
- **Slack messages.** In an Ask the AI step set to *Another app*, write `slackmessages:channelname` in the address box: Hushwork finds the channel in your own channel list and reads its latest 10 messages (read only). Skill and workflow: **Read a Slack channel** / **Slack Channel Brief**. Untested against a real Slack.
- **Email several people.** In the Builder, **Email several people**: type up to 8 addresses; each gets its own email step (its own Approve click, its own done record). Recipients are only ever the addresses you type, never picked from an email or an app.

## Google files and a Gmail draft (2026-10-27)

Five more **Do something in another app** actions, all through Composio and all behind the normal Approve click (once per run, the card shows the exact words, the pause switch and limits apply):

- **Create a Google Sheet with rows** (`sheet_create`): the title is the spreadsheet name; the details are the rows, one per line, boxes separated by `|` (or commas); up to 50 rows x 10 boxes. It takes two calls (make the sheet, then write the rows as plain text). If the sheet is made but the rows fail, the run says so plainly, keeps the link and does not try again.
- **Create a Google Slides presentation** (`slides_create`): the details are an outline; a line starting with `# ` begins a slide, the lines after it are its bullets; up to 12 slides.
- **Create a Google Doc with text** (`doc_create`): the details are the text, line breaks kept.
- **Create a Google Drive folder** (`drive_folder_create`): the title is the folder name; "Where" is empty (top of your Drive) or the id of a folder that exists.
- **Save an email as a Gmail draft** (`gmail_draft`): like the email action, but it only saves a draft in your Gmail. Nothing is sent.

Write `{answer}` in the details to use what an Ask the AI step wrote (a typed box is one line, so several lines come from `{answer}`). When the file is made, the result holds its link (only docs.google.com or drive.google.com addresses are ever kept). The ready-made bundle **Google Docs, Sheets and Slides** has three workflows: Weekly report as a Google Sheet, Proposal slides, Meeting notes doc.

**Your steps (the owner):** open **Connections** and press **Connect** for each of **Google Sheets (create)**, **Google Docs (create)**, **Google Slides (create)** and **Google Drive (folders)** that you want (you sign in on Composio's page). If Gmail (send) was connected before, press Disconnect then Connect once so it allows drafts. Nothing else. Google Slides has no lookup of its own (Composio has no tool that lists presentations without being told which), so it is only used to create. Decision: D-047.

## Workflow Studio: one Builder, cards that explain every step

Every way of starting a workflow ends in the same Builder: a **goal** (the workspace box), a **template**, or a **skill** (`/app/builder?skill=<id>`: from "Start a workflow with this skill" on the Skills page, or the **Skills** list on the Builder's left side). Under each step the Builder shows a card (`components/app/StepStudioCard.js`):

- **Why** the step exists, and **Evidence**: *Planned* in the Builder (nothing has run). On the Runs page the same card says *Verified* only when a saved result exists, *Failed* (with the saved reason) or *Not sure* (started, end never seen).
- Folded away: **How** it runs (the skill and the plugin it uses), what it **Produces**, and **what happens if it fails** (a step that writes is never sent again by itself after a dropped connection).
- A **warning in place** when an app the step needs is not connected: *Connect* (opens Connections in a new tab), *I connected it: check again*, *Let the AI just think* (for an Ask the AI step) or *Remove this step*. Apps that cannot be connected yet say so. If Hushwork cannot check (for example Composio is not set up) it shows a soft note instead of a warning. You can always save anyway.
- A skill that writes added from the list brings an "Ask me first" row with it.

All of it is worked out from the step each time (`lib/studio/capabilities.js`), not saved with the workflow, so it cannot go stale. The buttons only edit the draft; nothing on a card runs anything. Why: `../DECISIONS.md` D-042. Tests: `lib/studio/capabilities.test.js`.

## Memory (Settings > Memory)

Short facts you save (up to 50, 300 characters each), for example "Timezone: India (IST)". The AI plan writer and the **Ask the AI** step receive them as background. They are **data, not instructions** (D-039): only facts you wrote and that are verified are sent, inside `<memory>` tags with look-alike angle brackets, and the prompt says to ignore any instructions in them. Text that looks like a secret is refused. They are not given to the AI beside an MCP server. Saved facts are sent to Groq with your AI requests; they are part of **Download my data** and are deleted with your account. Set up once: paste `../supabase/memory.sql` into the Supabase SQL Editor. Without it the AI simply runs without memory. Code: `lib/ai/memory.js`, `lib/actions/memory.js`, `components/app/MemorySettings.js`.

## Steps that only describe ("Plan only")

Some steps can only describe what would happen (a note, a draft, a Find that looks nowhere real). They are fine inside a plan, but they never do anything when run. So: the Builder names them in the "Saved" message ("Heads up: ... will not really do anything: ..."), the Runs page marks them **Plan only**, and the block list says "(plan only)" on the old Send. To really send, create or add something, use **Do something in another app**. The rule lives in `isPlanOnly` / `planOnlyWarning` in `lib/run-engine.js`.

## Failures: why a step stopped

- When an app refuses something, the message is **our sentence** (chosen from what the app said: not found, not allowed, not valid, not connected) followed by **what the app said**, cleaned, cut to 160 characters, and dropped if it looks like a secret or contains the API key (`cleanSaid`, `explainFailure` in `lib/connectors/composio.js`).
- When Auto mode or a schedule stops at a step, the reason is saved as a small record under that step (runs are never edited) and the Runs page shows it as "It stopped here. ..." (`saveStopNote` in `lib/run-core.js`).
- A schedule that starts failing sends one email to the person (see Scheduling).

## Test all my connections

The Connections page has a **Test all my connections** button (`components/app/TestConnections.js`, `lib/actions/connections-check.js`, `testAllConnections` in `lib/run-core.js`). It does a real but harmless look: a few calendar events, a few email headers, a few file names, your Linear tasks, and each connected Composio app's one lookup; for each action it only checks that the tool's inputs match what Hushwork sends (`checkComposioConnections`). Nothing is sent, written or changed. It shows green, red (with what the app said) or "not connected" per line, and is limited to 4 runs every 5 minutes.

## Settings: Download my data and Delete my account

- **Download my data** (`/api/export`, `lib/export-data.js`): one JSON file with your workflows, your 500 newest runs and your schedules, read with your own database client (so only your rows). Saved app connections are never included (they hold sign-in tokens).
- **Delete my account** (`components/app/DeleteAccount.js`, `lib/account-core.js`): you type the words "delete my account"; the Composio connections are removed first; then the database deletes the account and everything it owns ("on delete cascade"). The account comes from the session, never from the browser. It uses the all-access key (a test limits which files may).
- `/terms` is a plain-words Terms page. There is no public contact address: the privacy page points to the project's GitHub issues page for removing a waitlist email.

## Limits and sign-in protection

| What | Where it is counted |
|---|---|
| AI plans, AI steps, AI summaries; sent actions; Linear tasks; sheet rows | the database (`supabase/usage.sql`) and memory |
| Lookups, web calls, sign-in (8 tries per email per 10 minutes), sign-up (3 per email per hour), the waitlist (5 per visitor per 10 minutes, 100 an hour overall), "Test all my connections" | memory only (friction, not a wall) |
| The whole-site AI cap | memory only, on purpose; set a spending cap in Groq |

- **New passwords** are checked against the free Pwned Passwords list (`lib/leaked-password.js`): only the first 5 characters of the password's SHA-1 fingerprint leave the server, and a password found on the list is refused. If that service is down, sign-up still works.
- **Browser headers** (`next.config.mjs`): no framing by other sites, no content-type guessing, a strict referrer policy, no camera or microphone, HSTS, and a safe slice of a content policy. A full script policy would break Next.js's own scripts and needs per-request nonces.
- The waitlist form goes through the server (`lib/actions/waitlist.js`), so a script cannot skip the page and write to the database straight from a browser.

## Tests that run the real server code

Most tests read or call small pure functions. `lib/run-core.integration.test.js` goes further: it loads the real `lib/run-core.js` through `scripts/test-hooks.mjs` (a loader that understands `@/` and replaces the few Next.js-only modules) and runs it against a pretend database and a pretend Composio/Groq (`lib/test-server-support.js`). It covers the exact flows people use: "send a message to my account" end to end, a scheduled run with no session, the AI-then-email chain, a morning briefing with `{answers}`, an example Notion id being refused, Notion refusing and its reason being saved, once-per-run, and old saved plans. When you find a bug, add a flow here first.

## MCP servers (the "MCP server" block)

MCP (Model Context Protocol) is a standard way for apps and companies to offer **tools** to an AI. The **MCP server** block (an Ask the AI step with "An MCP server" and the server's https address) lets the AI use the tools of ONE server the person typed in. After a practice run, press **Approve and ask the AI** on the Runs page. Tried for real against the public DeepWiki server (`https://mcp.deepwiki.com/mcp`): the AI used its `read_wiki_structure` tool and answered correctly.

`lib/connectors/mcp.js` speaks the "Streamable HTTP" transport (initialize, the `initialized` note, `tools/list`, `tools/call`; answers as JSON or an event stream; session and protocol headers). Safety, all in `lib/connectors/mcp.test.js`, `lib/ai/agent.test.js` and `lib/secrets.test.js`:
- every request goes through `publicRequest` in `lib/connectors/http.js` (https only, public addresses only checked at connection time, no redirects, size and time limits, no cookies or secrets);
- only **read-only tools** are offered or callable: tools the server marks `readOnlyHint`, or (when it says nothing) tools whose name is a plain reading word (get, list, read, search, find, fetch, query, lookup, ask, describe, show, view) and are not marked destructive. A tool marked destructive or `readOnlyHint: false` is never used, whatever its name;
- at most 8 tools; a tool's declared input shape is kept only if small; the AI's input to a tool must be a small JSON object (2,000 characters at most); an answer is cut to 3,000 characters and wrapped as data for the AI;
- no logins: a server that asks for one is refused, because Hushwork has nowhere safe to keep a person's login for a third-party server yet;
- an MCP step gets no other private source in the same step (no Linear or calendar), so there is nothing else for the AI to pass on.
The built-in tools (Linear, calendar, one web page) still take no input from the model at all.

## Security review (2026-10-19) and what changed

An independent read-only review of the Linear/Google connections, the guarded web request, MCP, the AI tool loop, token storage and the SQL found no high-severity problem. Fixed afterwards (each locked in by a test):
- The owner's personal Linear key (`LINEAR_API_KEY`) now works only when `NODE_ENV` is not `production` (before, any signed-in person on a server that had the key set could read the owner's tasks).
- The AI step's rate limit is counted before any outside request, so a loop of Approves cannot be used as a request relay (an MCP step connects to an outside server).
- The one-try OAuth state cookie is now really deleted (it is deleted with the same path it was set with).
- MCP: with no read-only hint from the server, a tool whose name contains a writing word (delete, create, send, run, deploy, and, ...) is never offered; `query` is no longer a reading word; a server's own tool descriptions have angle brackets made harmless and the AI is told to ignore instructions inside them.
- Saved run steps are validated again (right choices, right lengths) before any Approve acts on them, because a person can write their own rows into `runs` with the public key.
- An address that looks like it holds a secret key is refused for web calls and for web/MCP AI steps.
- A Linear token renewal that fails because another request just renewed uses that request's fresh token.
Known and accepted: the Google `spreadsheets` permission covers all of a person's sheets (Google has no narrower option for an existing sheet; the code only ever appends); stored tokens are not bound to the user/provider as AES-GCM "additional data" (changing it would force everyone to reconnect; users cannot read each other's rows anyway); there is no PKCE (not needed for a server-side client with a secret and a `state`).
