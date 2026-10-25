# PROJECT.md: Hushwork

> **What this file is for:** one shared brief that every AI tool reads before helping with Hushwork (ChatGPT for thinking, Gemini for research, Claude / Claude Code for building). Paste it, attach it, or point the tool at it, so nobody has to re-explain the project.
> **Its partner file:** [`DECISIONS.md`](DECISIONS.md), the list of what has been decided and why.
> **This repository is public.** Never write keys, passwords, private customer details or anything secret in this file.

Last updated: 2026-10-24 (after the actions, schedules, packs and safety work)

---

## 1. One-line summary

Hushwork lets you describe a recurring job in plain English ("every Friday, email me what I worked on"), turns it into readable steps, connects your apps, and runs it **only after you approve each step that does something**.

Tagline: *"Describe the task. Hushwork handles it."* / *"Quiet work, done."*

## 2. Goals

| Goal | What "done" looks like |
|---|---|
| Give freelancers their week back | Admin jobs (invoice chasing, client reports, inbox triage, lead follow-up) run as workflows |
| Never surprise the user | Nothing is sent or changed without an Approve click, or Auto mode switched on on purpose |
| Be honest | The site and app only claim what is actually true today. No fake users, numbers or testimonials |
| Stay simple | Plain words, readable steps, no nodes to wire up, no code |

**Who it's for:** freelancers and solo studios first. Small agencies (2 to 10 people) later. Team features have not been decided yet.

## 3. Where things stand

| Thing | Status |
|---|---|
| Live site | https://hushwork-six.vercel.app (Vercel auto-deploys every push to `main`) |
| Code | https://github.com/shivalikathuria80-gif/hushwork, MIT license, checked by GitHub Actions on every push (tests + lint) |
| Users | The owner only. Early access, no customers yet. Waitlist is open |
| Sign-in, drafts, runs, Builder | Built and working online |
| Templates | 33 ready-made workflows in 5 packs (Everyday, Finance, Marketing, Coding, Design), every one really works with your apps |
| Real actions (always after Approve) | Web calls; Linear (read + create a task); Google Calendar, Gmail (read), Drive (read), Sheets (add a row); 17 more apps through Composio (14 connectable): read one thing from each, and send an email, a Slack message, a GitHub issue, a Todoist task, a Calendar event, a Notion page |
| Scheduled runs | Working. A Supabase clock (`pg_cron`) asks the app every minute; a schedule can be made from the Builder's Start step |
| Safety extras | Failure emails, leaked-password check, rate limits (partly in the database), "Test all my connections", Download my data, Delete my account, Terms page |
| Tests | 467 automated tests (`npm test`), including tests that run the real server code with a pretend database and Composio |
| Domain | Wants `hushwork.in`, registrar not chosen yet |

## 4. Architecture (how it works)

```
 Browser (Next.js pages)
      |
      v
 Server Actions + API routes  ----> Groq AI (writes plans, summarises results)
      |                        ----> Linear / Google (own OAuth sign-in)
      |                        ----> Composio (sign-in + reading + actions for 17 more apps)
      |                        ----> MCP servers (read-only tools only)
      v
 Supabase (Postgres + Auth)   <---- Supabase's own clock (pg_cron + pg_net) calls /api/cron/tick every minute
   tables: waitlist, workflows, runs, schedules, connections, usage_counters
   row-level security: each person only sees their own rows
```

**The life of a workflow:**

1. **Describe:** the person types a job. The AI (or keyword matching if AI is off) writes a plan made of typed blocks. The AI is taught the REAL blocks, and a safety net turns "send to me / my account / an address" into a real email.
2. **Edit:** the plan opens in the Builder (drag-and-drop blocks) and is saved as a draft. After saving, the Builder names any step that only describes ("Plan only"). If the Start step says "On a schedule" with a readable time, saving also creates that schedule.
3. **Practice run:** writes down what each step *would* do. Nothing real happens.
4. **Approve:** the person presses Approve on each real step (or uses Auto mode). Each writing step can be approved only once per run. The card shows exactly what will be sent. `{myEmail}`, `{answer}` and `{answers}` are filled in right there.
5. **Log:** every result is saved as a run, shown as an AI summary followed by the app's exact answer. A step that fails saves its reason under the step, including what the app said.
6. **Schedule (optional):** a schedule runs the workflow by itself. It may write only if "Let it write by itself" is ticked. If a schedule starts failing, the person gets one email.

**Important folders:**

| Path | What's inside |
|---|---|
| `hushwork-app/app/` | Pages (landing, `/login`, `/privacy`, `/terms`, `/app/*` signed-in area, `/api/*`) |
| `hushwork-app/components/` | UI pieces (landing sections, `app/` workspace parts) |
| `hushwork-app/lib/` | The logic: `run-core.js` (what Approve does), `run-engine.js` (what a run is), `schedule-*.js`, `ai/`, `connectors/`, `connections/` |
| `hushwork-app/lib/**/*.test.js` | Automated tests. `*.integration.test.js` run the real server code. Helpers: `lib/test-server-support.js`, `scripts/test-hooks.mjs` |
| `supabase/` | SQL for every table and its privacy rules, plus `clock.sql` (the scheduler clock) |
| `docs/` | Deploy checklist (`deploy.md`, always current), try-it guide, plus older plans and QA reports (historical) |
| `.github/workflows/` | `ci.yml` (tests + lint on every push) and `clock.yml` (an optional backup clock) |
| `hushwork/` | The old no-build prototype, kept for reference only |

## 5. Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind 4, Geist + Geist Mono fonts, violet accent, dark theme by default |
| Animation / icons | `motion`, Phosphor icons, `simple-icons` for app logos |
| Database + sign-in | Supabase (project `hushwork`, region ap-south-1) |
| AI | Groq, model `openai/gpt-oss-20b` (set in `lib/ai/groq.js`) |
| App connections | Own OAuth for Linear + Google; Composio for the rest; MCP over Streamable HTTP |
| Hosting | Vercel (project `hushwork`, root folder `hushwork-app`) |
| Scheduler clock | Supabase `pg_cron` + `pg_net` (`supabase/clock.sql`); GitHub Actions as an optional backup |
| Tests | Node's built-in test runner (`node --test`) with a small loader for the server code |
| Local dev | `npm run dev` on **http://localhost:3100** (port 3000 stays free for another app) |

> Note for AI coding tools: Next.js 16 has breaking changes. Read `hushwork-app/AGENTS.md` and the docs in `node_modules/next/dist/docs/` before writing code. Middleware is now called `proxy.js`. In this repo use `git add <folders>`, never `git add -A` at the top level (it can pick up local files).

## 6. Safety rules (never break these)

1. Nothing is sent or changed without Approve, or Auto mode switched on on purpose, or a schedule with "Let it write by itself" ticked.
2. Secrets live in server settings only. Never put `NEXT_PUBLIC_` in front of a secret.
3. `SUPABASE_SERVICE_ROLE_KEY` is used **only** by the scheduler's handler and by Delete my account. Nothing else may import `lib/supabase/admin.js` (a test lists the files).
4. AI tools take **no input from the model** (except MCP, which is read-only). Tool results are wrapped as `<data>`, and the AI is told to ignore any instructions inside them.
5. Google Sheets rows are added as RAW text, so a cell starting with `=` never runs as a formula.
6. Saved run steps are checked again on the server before any Approve acts on them. Runs are never edited after they are saved (a stop reason is saved as a new small record).
7. Sign-in tokens for other apps are stored encrypted. They are never in a data export.
8. A template or plan never holds a real person's address: use `{myEmail}`. Made-up values (a page id of zeros, `your-name/your-repo`) are refused until changed.
9. A step that only describes must never look like one that works: it is named "Plan only" in the Builder and on the Runs page, and no template is plan-only.
10. What an app said when it refused is cleaned, cut short, and dropped if it looks secret or contains an API key.
11. A step that writes saves a "started" record before it calls the other app. A step that is done is never done again, and a step whose end was never seen is never sent again by itself (the person decides). D-040.
12. Saved memory facts are data: only the person's own verified facts reach the AI, wrapped in `<memory>` tags and never beside an MCP server. D-039.
13. Skill Bundles add no power: turning one on only saves drafts. A writing skill still needs Approve, every writing workflow has an approval step first and emails only the person themself. D-041.
14. Workflow Studio cards only explain and edit the draft. What they say about a step is worked out from the step, never saved, and Verified is shown only for a result that was really saved. D-042.

## 7. Current priorities

| # | Priority | Why |
|---|---|---|
| 1 | Try Slack, GitHub and Linear-create with real accounts (use "Test all my connections", then one real Approve each) | Email, calendar, Notion and Google are proven; these have only been tested with pretend servers |
| 2 | Watch a few real scheduled runs (Runs page + the failure email) | The clock works, but long-running real use has not been seen |
| 3 | Choose the first product slice (Invoice Chaser is proposed; `Chase unpaid invoices` now works with Stripe) | Gives the product a clear first job |
| 4 | Buy the domain `hushwork.in`, then follow `docs/deploy.md` section 13 | Branding and Google verification need a real address |
| 5 | Decide about Google's verification | Until then only listed test users can connect Gmail and Drive |
| 6 | Set a monthly spending cap in the Groq account | The only whole-site protection against a surprise AI bill (D-037) |
| 7 | Review `/privacy` and `/terms` with someone who knows the law | They are plain-words drafts, not legal advice |

## 8. Known problems and limits

- **Not yet tried for real:** Slack and GitHub actions, Linear task creation, and the failure email. Each is covered by tests, and "Test all my connections" checks the connection itself.
- **Limits that live in server memory:** lookups (Linear, Calendar, Gmail, Drive, apps), web calls, sign-in, sign-up, the waitlist and the whole-site AI cap. Each server counts alone and forgets on restart. AI, sent actions, Linear tasks and sheet rows also count in the database.
- **Google app is in "Testing" mode:** only listed test users can connect, they must reconnect every 7 days, and they see a "not verified" warning.
- **Composio:** Vercel, Xero and Cloudflare are listed but cannot be connected (D-038).
- **Schedules:** hourly, daily, weekdays and weekly only (no monthly). Time zone is the one the browser had when the schedule was saved.
- **MCP:** only servers that need no login. No Stripe write actions on purpose.
- **Supabase's leaked-password setting needs a paid plan:** the app has its own free check instead (D-033).
- **Logs:** Vercel's free plan keeps runtime logs for one hour only.
- **Minor bug from QA round 3 (m2):** renaming a draft and then editing it shows a false "changed somewhere else" warning.
- **Accepted risks** (from the 2026-10-19 security review): Google's `spreadsheets` permission covers all of a person's sheets; tokens aren't bound with AES-GCM extra data; no PKCE. See `DECISIONS.md`.

## 9. My AI stack: who does what

| Tool | Job | What to give it | What NOT to give it |
|---|---|---|---|
| **ChatGPT** | Thinking: ideas, architecture options, plans | `PROJECT.md` sections 1 to 4 + the question | Code secrets, `.env.local`, private user data |
| **Gemini** | Research: how other platforms do it, docs, pricing, comparisons | A **generic** question + section 5 (stack) if needed | Hushwork's private plans or code. Ask generally ("how do agent platforms handle retries?") |
| **Claude Code** | Building: writes, tests and fixes code in this repo | The handoff below. It can read this file and the repo directly | Nothing extra, it already has the repo |
| **Claude (chat / Cowork) + Claude Design** | Design, docs, decks, videos, reports, checking work | `PROJECT.md` + the task | Secrets |

**The loop:**

```
 ChatGPT decides  ->  write it in DECISIONS.md
 Gemini researches -> paste key findings into the decision's "Research" line
 Claude Code builds -> reads PROJECT.md + DECISIONS.md + the handoff
 After building    -> update "Where things stand" and "Known problems" here
```

## 10. Handoff template (copy this when passing work to another AI)

```markdown
### Handoff: <short task name>
From: <ChatGPT / Gemini / Claude>   To: <who builds or checks it>   Date: <YYYY-MM-DD>

Task: <one sentence>
Goal: <what should be true when it's finished>
Background: Read PROJECT.md and DECISIONS.md (decision D-<number>).
Research: <2 to 5 key findings, with links>
Requirements:
- <must do>
- <must do>
- Follow the safety rules in PROJECT.md section 6.
Don't touch: <files or features to leave alone>
Expected result: working code, passing `npm test` + `npm run lint` + `npm run build`, and a short summary of what changed.
```

## 11. How to keep this file useful

- Update **"Where things stand"**, **"Current priorities"** and **"Known problems"** after every big change.
- Put the *why* of a choice in `DECISIONS.md`, not here. This file says *what is*. That file says *what we chose and why*.
- Keep it short. If a section grows past a screen, move the details to `docs/` and link to it.
