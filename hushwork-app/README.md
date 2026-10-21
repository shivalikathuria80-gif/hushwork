# Hushwork site (Next.js)

The Hushwork landing page plus a first app slice: sign in, a workspace where you preview a plan and save drafts, and a runs page. Next.js 16 (App Router), React 19, Tailwind 4, `motion` for animation, Phosphor icons, Supabase for sign-in and the database. The earlier no-build prototype lives in `../hushwork/` for reference.

Almost nothing runs for real yet: the real actions are a **read-only web call**, a **read-only Linear lookup** and an **Ask the AI** step that may use those two read-only tools, each only when you press Approve on the Runs page (see "Web calls", "Linear" and "Ask the AI" below). A draft is a saved plan, and **Practice run** (on the Workflows page) walks its steps and saves a record of what each step would do, with nothing sent. Practice runs are listed on the Runs page. They need one setup step: paste `../supabase/runs.sql` into the Supabase SQL Editor and run it (until then the Runs page says so).

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

The **Builder** (`/app/builder`) builds a workflow by hand from a short list of **blocks** (Start, Linear, Web address, Find something, Write something, Ask me first, Send a message, Add a row, Note; defined in `lib/step-rows.js`). Drag a block into the line or press it; each step shows only its name and the blanks to fill in (the workspace's own editor still has the kind and icon pickers). It opens blank, from a **template** (`?template=invoices`, from the Templates page) or from a saved draft (`?draft=<id>`, from the Workflows page). It saves the same kind of draft as the workspace, with the same version check. It still **runs nothing**.

- **Typed steps.** A step is either free text (a title and a detail) or one of six kinds with named blanks: Start (what starts it, when), Look something up (where, what), Draft something (what to write, about), Ask you to approve, Send a message (how, to whom, about) and Add a row (spreadsheet, what to add). A typed step's title and detail are worked out from its fields, so it shows like any other step. Plans saved before typed steps existed are free-text steps and keep working. To add a kind, add an entry in `lib/steps.js` and keep its text fields short (a test checks that the worst case fits).
- **Drag and drop.** Drag a kind from the list on the left into the steps, or drag a step by its handle (the dotted grip) to move it. A purple line shows where it will land. This uses the browser's own dragging (no extra package), so it needs a mouse. The Add buttons, the arrow buttons and Delete work everywhere, including by keyboard and on phones. A drop only counts if it carries this app's own drag data and names a real kind, so a file or text dragged in from elsewhere does nothing.
- **Unsaved work.** The Builder says "You have unsaved changes", and the browser asks "Leave site?" if you close the tab. Clicking a sidebar link leaves without asking, like the workspace.

## How the motion works

- The headline entrance is plain CSS, so it starts without waiting for JavaScript.
- Scroll reveals, the folder-tab indicator, the run log and the footer wordmark use the `motion` library.
- The glow and the workflow band move on their own. They stop when scrolled offscreen, when the visitor presses **Pause motion**, or when their system asks for reduced motion (then movement is removed and only fades remain).

## Web calls ("Call a web address")

A step of the kind **Call a web address** (an https address and what it is for) is described in a practice run and can then be approved on the Runs page, which asks that address once with a read-only GET and saves the status and the start of the answer as a "Real" run. Because the server fetches an address a person typed, `lib/connectors/http.js` defends against SSRF (making the server reach its own network): https only, a real domain name (no `127.0.0.1`, `localhost`, `10.x`, `.internal` and so on), the name is looked up at connection time and every answer must be a public address, no redirects are followed, 8 seconds and 64 KB at most, and no cookies or secrets are sent. `approveWebCall` in `lib/actions/runs.js` reads the address from the saved run, never from the browser, and limits calls to 5 a minute and 30 a day per person. `lib/connectors/http.test.js` covers the address checks, private and IPv6 ranges, redirects, size and time limits, with a pretend network.

Not built yet: a schedule ("run every day at 9"). It needs the app hosted and a scheduler that works when your computer is off, plus a safe way to run a workflow without a signed-in person, so it waits for deployment.

## Linear (the Connect button)

A **Look something up** step with Where set to **Linear** (the Linear block) can be approved on the Runs page: Hushwork asks Linear for the person's up to 10 open tasks and saves the list as a "Real" run. It can only READ (the one fixed query in `lib/connectors/linear.js` has no way to change anything, and the permission asked for is `read`).

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

A **Look something up** step set to **Inbox** can now be approved on the Runs page (`approveGmailLookup` in `lib/actions/runs.js`): Hushwork asks Gmail for the latest 10 inbox messages and saves the sender, subject and time as a "Real" run. An **Ask the AI** step can also be set to **My Gmail inbox** (the template **What is in my inbox?**). `lib/connectors/google-gmail.js` only sends GET requests and asks only for the From, Subject and Date headers (`format=metadata`), so the text of an email is never read or stored; the new Google permission `gmail.readonly` cannot send, change or delete mail. Values are flattened and cut short because strangers write them; the AI agent wraps them as data and ignores instructions inside. Limits: 5 a minute and 30 a day per person.

**Owner set-up:** in Google Cloud also enable the **Gmail API** (APIs & Services, Library). Anyone who connected Google earlier must press **Disconnect** and **Connect Google** again so Google asks for the new Gmail permission (until then Gmail answers "refused" and the Runs page says so). While the app is in Testing, Google shows the same "not verified" warning. Not yet tested against the real Gmail: built from Google's published docs and tested with a pretend Google.

## Google Drive: your latest files (names only, read-only)

A **Look something up** step set to **Files** can be approved on the Runs page (`approveDriveLookup`): Hushwork asks Google Drive for the 10 files you changed most recently and saves each file's name, kind (Doc, Sheet, PDF...) and time as a "Real" run. An **Ask the AI** step can be set to **My Google Drive files** (template **What did I work on lately?**). `lib/connectors/google-drive.js` sends one GET asking only for `name,mimeType,modifiedTime`; the Google permission `drive.metadata.readonly` can only see file details, never open, change or delete a file. Limits: 5 a minute and 30 a day per person.

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

The **Ask the AI** block gives the Groq model a job (`task`) and lets it look at ONE read-only thing first: your Linear tasks, a web address written in the step, or nothing. After a practice run, press **Approve and ask the AI** on the Runs page; the answer is saved as a "Real" run. This is "tool calling": the model says "please run this tool", Hushwork runs it, hands the result back and the model writes its answer (`lib/ai/agent.js`, at most 4 rounds).

Safety, all covered by `lib/ai/agent.test.js` and `lib/secrets.test.js`: every tool takes **no input from the model** (so a web page cannot talk the AI into fetching another address or sending your data anywhere); tools are read-only; tool results are wrapped as `<data>` and the model is told to ignore instructions inside; the request is refused if it looks like a card number or secret key; AI steps are limited to 3 a minute and 15 a day per person; the Groq key stays in `lib/ai/key.js`. What goes to Groq (the request and what the tool read) is stated on the approval card and the privacy page.

## The AI plan writer builds with blocks

"Preview plan" with AI on no longer returns only plain text steps. Each step the AI writes names a **block** (trigger, find, linear, write, approve, send, row or ai) plus three small answers (`choice`, `a`, `b`) that `lib/ai/plan.js` turns into the named blanks of a typed step. Those blanks go through the same checks as a person's own steps; a step that fails them (or is marked `note`) stays a plain text step. The AI is never offered the web-address block (it must not choose addresses), two approval steps in a row become one, and an approval step is still added before the first step that sends something.

Reliability: Groq sometimes refuses to produce the richer shape (`json_validate_failed`). Then `lib/ai/groq.js` asks **once more** for the original plain plan (`SYSTEM_PROMPT_PLAIN`, `PLAN_SCHEMA_PLAIN`), so a person still gets an AI plan; any other failure is not retried. The log line for a failed plan now also carries Groq's short error code and, for shape failures, the length of the failed answer (numbers only, never the text).

## Google Calendar and Sheets (the second Connect button)

A **Look something up** step with Where set to **Calendar** can be approved on the Runs page: Hushwork asks Google Calendar for the person's next 10 events in the coming 7 days and saves the list as a "Real" run. An **Ask the AI** step may also be allowed to look at "My Google Calendar" (a tool with no input from the model). It is READ-ONLY twice over: the only permission ever requested is `calendar.readonly` and `lib/connectors/google-calendar.js` only sends GET requests (both are checked by `lib/secrets.test.js`).

Connect works exactly like Linear's (`lib/connections/oauth-flow.js` is shared; `lib/connections/store.js` keeps one encrypted row per person and app and renews tokens; Google keeps the same refresh token when it renews). One-time owner set-up (also on the Connections page with ticks): `supabase/connections-any-app.sql` if the table already exists (a fresh `connections.sql` already allows Google), then in Google Cloud: a project, the Google Calendar API enabled, an OAuth consent screen in Testing with yourself as a test user, and a Web OAuth client with the redirect address `http://localhost:3100/api/connect/google/callback`; its Client ID and secret go into `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. While the app is in Testing, Google makes people connect again every 7 days, and shows a "not verified" warning (Advanced, Go to Hushwork). Not yet tested against the real Google: it is built from Google's published docs and tested with a pretend Google.

## Deleting runs

Every run has a **Delete this run** button (it asks first). A run is only a record, so deleting it changes nothing outside Hushwork; `deleteRun` in `lib/actions/runs.js` only ever deletes the caller's own run.

### Google Sheets: add a row

An **Add a row** step whose **Google Sheet address** is a normal `https://docs.google.com/spreadsheets/d/...` address and whose **What to add** has comma-separated boxes (for example `Ana, 500, 20 Oct`) can be approved on the Runs page. The approval card shows the exact boxes; **Approve and add the row** then adds ONE row at the bottom of that sheet and saves a "Real" run. Older plans that only name a spreadsheet (no address) stay descriptions.

This is the one action that writes into a person's Google account, so: the sheet and the boxes come from the saved run (never the browser) and are checked again on the server; `lib/connectors/google-sheets.js` has a single request, Google's "append" (`values/A1:append`, `INSERT_ROWS`), with `valueInputOption=RAW` so a box that starts with `=` stays plain text and never runs as a formula; it has no way to read, change or delete cells; the address must be a real Google Sheets address (the id is the only part used); at most 20 boxes of 100 characters; 5 rows a minute and 30 a day per person (`lib/secrets.test.js` and `lib/connectors/google-sheets.test.js`).

**Permissions:** the Google Allow screen now shows two: `calendar.readonly` and `spreadsheets` (Google has no narrower permission that works on an existing sheet). In Google Cloud also enable the **Google Sheets API**. Someone who connected Google before Sheets was added must press Disconnect and Connect Google again so Google asks for the new permission. Not yet tested against the real Google.

## Linear: create a task (the first step that writes to Linear)

A **Create a Linear task** step (block **Create Linear task** in the Builder) has a title, optional details and an optional team key (like `ENG`; empty means your first team). On the Runs page its **Approve and create the task** button adds ONE new task in Linear (`approveLinearCreate` in `lib/actions/runs.js`). `lib/connectors/linear-create.js` is the only file that changes anything in Linear: one fixed `issueCreate` request, with the words sent as separate variables (never glued into the request text) and a read-only question first to find the team. The new Linear permission is `issues:create` (Linear wants commas between permissions, so the Linear entry in `app-list.js` has `scopeSeparator: ","`): it cannot change or delete anything that exists. Both the title and details may use `{answer}` (see below). Writing steps (this one and **Add a row**) can be approved only once per practice run and step, so going back and pressing Approve again cannot create a second copy (`wasApproved` in `lib/run-answer.js`). Limits: 3 a minute and 15 a day per person.

**Owner set-up:** nothing new in Linear's developer settings. Anyone who connected Linear earlier must press **Disconnect** and **Connect Linear** again so Linear asks for the new permission (until then the Runs page says Linear refused). The personal key in `.env.local` (this computer only) can create tasks too. Not yet tested against the real Linear.

## More apps through Composio (Todoist, Notion, Airtable, HubSpot, Jira)

Composio (composio.dev) already holds the sign-in for hundreds of apps, so Hushwork reaches more apps without making an app on each website. Free plan at the time of writing: 100,000 tool calls a month and unlimited connected accounts (check their pricing page; alternatives are Pipedream Connect, free only while building, and Nango, free for 10 connections).

**How it works:** the apps are one list, `lib/connectors/composio-apps.js`: each entry names ONE read-only Composio tool (for example `TODOIST_GET_ALL_TASKS`). The Connections page shows a Connect button per app (`/api/composio/<app>` -> `lib/connections/composio-flow.js`): Hushwork makes sure Composio has a sign-in for that app **limited to that one tool** (`restrict_to_following_tools`), asks Composio for a one-time sign-in page and sends the person there. Composio keeps the permission and refreshes it; Hushwork stores nothing new in the database (it asks Composio which apps are connected each time the page loads). A **Look in another app** step (block **Another app**) can be approved on the Runs page (`approveAppLookup`): Hushwork asks Composio to run that one tool for this person, with nothing to fill in, and saves the answer as text. An **Ask the AI** step can use an app too (`uses: Another app`, with the app's short name such as `todoist` in the web address box). The person is identified to Composio only by their Hushwork account id. `lib/connectors/composio.js` holds every call, with fixed error sentences and tests with a pretend Composio.

**Add an app:** add one entry to `composio-apps.js` (the toolkit name and one list/read tool from https://docs.composio.dev/toolkits/<toolkit> that needs no input). Nothing else changes. Writing tools are never allowed here; for writing, build a proper step with its own Approve (like Create a Linear task).

**Owner set-up:** make a free Composio account, copy the API key (Settings) into `.env.local` as `COMPOSIO_API_KEY=...`, restart `npm run dev`. The Connect buttons then appear. **Not tested against the real Composio** (built from their API reference: `POST /api/v3.1/auth_configs`, `POST /connected_accounts/link`, `GET /connected_accounts`, `POST /tools/execute/{slug}`); the exact tool inputs are unverified, so a tool that insists on an input will show "The app did not answer" and needs its list entry changed or removed.

## Results are summarised by the AI and shown big

Every lookup (Linear tasks, Calendar, Gmail, Drive, another app) now saves two things as its result: first a clear, detailed **AI summary** (`summarizeData` in `lib/ai/agent.js`: no tools, it may use ONLY the list it is given, the list goes in as `<data>` and the question as `<task>`), then **the app's own list exactly as it answered**, so a summary can never hide the facts (`withSummary` in `lib/actions/runs.js`). If the AI is off, the person's AI limit is used up, or the AI fails, the result is simply the app's own list (no error). **Ask the AI** answers are no longer limited to 8 short lines: they are structured (one main sentence, `- ` detail lines, an optional `Next step:` line, up to about 20 lines). On the Runs page a real run's result is laid out in a card (`ResultText` in `components/app/RunsViewer.js`): blank lines kept, `- ` lines as bullets, `Next step:` highlighted. Because the data now goes to Groq for these steps, the approval text and `/privacy` say so.

Gmail also had "broken" text for accents, emoji and non-English names: mail headers store them as coded words like `=?UTF-8?Q?Caf=C3=A9?=`. `decodeMimeWords` in `lib/connectors/google-gmail.js` turns them back into real words (and never throws).

## Passing an answer to the next step: `{answer}`

An **Add a row** step can use what an **Ask the AI** step of the same workflow said: write `{answer}` in one of its boxes (for example `20 Oct, {answer}`). The order is: do a Practice run, press **Approve** on the Ask the AI step (this saves a "Real" run that also keeps the AI's words), go back to the practice run, and the Add a row step now shows the exact row with the real words filled in; press **Approve** to add it. `lib/run-answer.js` finds the newest real AI step of the same workflow saved after that practice run (only your own runs). The words are put into the box after the row was cut at the commas, flattened to one line and cut to 500 characters, so they cannot add extra boxes, and they are written as plain text (never a formula). If there is no answer yet the step says so and nothing is written.

## Open an AI plan in the Builder

On the workspace page, a plan (written by the AI or the keyword preview) has an **Open in the Builder** button next to Save as draft. A new plan is saved as a draft first (the same save as Save as draft), then the Builder opens it (`/app/builder?draft=<id>`), where its blocks can be dragged around and its blanks filled in (for example the Google Sheet address of an Add a row step). The button is hidden while a saved draft has unsaved step edits (save the changes first).

## Templates that work for real

Three templates in `lib/templates.js` carry a `needs` label and show "Works with Linear", "Works with Google" or "Works now" on the Templates page: **Which task should I do first?** (an Ask the AI step that may look at your Linear tasks), **My week ahead** (an Ask the AI step that may look at your Google Calendar) and **Is my website up?** (an Ask the AI step that may read one web page; the address starts as `https://example.com/`, change it to your own). Open one in the Builder, Save, press Practice run on the Workflows page, then Approve on the Runs page. `lib/templates.test.js` checks that each one's AI step can really be approved and that its tool matches what it needs. The older templates still only describe a plan.

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
