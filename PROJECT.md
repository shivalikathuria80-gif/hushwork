# PROJECT.md: Hushwork

> **What this file is for:** one shared brief that every AI tool reads before helping with Hushwork (ChatGPT for thinking, Gemini for research, Claude / Claude Code for building). Paste it, attach it, or point the tool at it, so nobody has to re-explain the project.
> **Its partner file:** [`DECISIONS.md`](DECISIONS.md), the list of what has been decided and why.
> **This repository is public.** Never write keys, passwords, private customer details or anything secret in this file.

Last updated: 2026-10-24

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
| Code | https://github.com/shivalikathuria80-gif/hushwork, MIT license |
| Users | None yet. Pre-launch, waitlist only |
| Sign-in, drafts, runs, Builder, templates | Built |
| Real actions (with approval) | Web calls, Linear, Google (Calendar, Gmail, Drive, Sheets), 16 apps through Composio, email, Slack, GitHub, Todoist |
| Scheduled runs | Built. Needs the secrets added on Vercel before it works online |
| Domain | Wants `hushwork.in`, registrar not chosen yet |

## 4. Architecture (how it works)

```
 Browser (Next.js pages)
      |
      v
 Server Actions + API routes  ----> Groq AI (writes plans, summarises results)
      |                        ----> Linear / Google (own OAuth sign-in)
      |                        ----> Composio (sign-in for 16 more apps)
      |                        ----> MCP servers (read-only tools only)
      v
 Supabase (Postgres + Auth)   <---- GitHub Actions "clock" calls /api/cron/tick every ~5 min
   tables: waitlist, workflows, runs, schedules, connections, usage
   row-level security: each person only sees their own rows
```

**The life of a workflow:**

1. **Describe:** the person types a job. The AI (or keyword matching if AI is off) writes a plan made of typed blocks.
2. **Edit:** the plan opens in the Builder (drag-and-drop blocks) and is saved as a draft.
3. **Practice run:** writes down what each step *would* do. Nothing real happens.
4. **Approve:** the person presses Approve on each real step (or uses Auto mode). Each writing step can be approved only once per run.
5. **Log:** every result is saved as a run, shown as an AI summary followed by the app's exact answer.
6. **Schedule (optional):** a schedule runs the workflow by itself. It may write only if "Let it write by itself" is ticked.

**Important folders:**

| Path | What's inside |
|---|---|
| `hushwork-app/app/` | Pages (landing, `/login`, `/app/*` signed-in area, `/api/*`) |
| `hushwork-app/components/` | UI pieces (landing sections, `app/` workspace parts) |
| `hushwork-app/lib/` | The logic: `run-core.js`, `run-engine.js`, `schedule-*.js`, `ai/`, `connectors/`, `connections/` |
| `hushwork-app/lib/**/*.test.js` | Automated tests (`npm test`) |
| `supabase/` | SQL for every table and its privacy rules |
| `docs/` | Plans, design notes, QA reports, deploy checklist |
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
| Hosting | Vercel |
| Scheduler clock | GitHub Actions (`.github/workflows/clock.yml`) |
| Tests | Node's built-in test runner (`node --test`) |
| Local dev | `npm run dev` on **http://localhost:3100** (port 3000 stays free for another app) |

> Note for AI coding tools: Next.js 16 has breaking changes. Read `hushwork-app/AGENTS.md` and the docs in `node_modules/next/dist/docs/` before writing code. Middleware is now called `proxy.js`.

## 6. Safety rules (never break these)

1. Nothing is sent or changed without Approve, or Auto mode switched on on purpose.
2. Secrets live in server settings only. Never put `NEXT_PUBLIC_` in front of a secret.
3. `SUPABASE_SERVICE_ROLE_KEY` is used **only** by the scheduler clock's handler.
4. AI tools take **no input from the model** (except MCP, which is read-only). Tool results are wrapped as `<data>`, and the AI is told to ignore any instructions inside them.
5. Google Sheets rows are added as RAW text, so a cell starting with `=` never runs as a formula.
6. Saved run steps are checked again on the server before any Approve acts on them.
7. Sign-in tokens for other apps are stored encrypted.

## 7. Current priorities

| # | Priority | Why |
|---|---|---|
| 1 | Add the secret settings on Vercel (Groq, Connections, Composio, Linear, Google, Cron, service role) and redeploy | The live site can't do AI, connections or schedules without them |
| 2 | Tell Supabase, Linear and Google about the live address (redirect URLs) | Sign-in and Connect buttons fail online until this is done |
| 3 | Paste `supabase/usage.sql` and `supabase/schedules.sql`, then switch on the GitHub clock | Moves AI limits into the database and turns on scheduled runs |
| 4 | Test against the **real** Google, Linear and Composio | So far they've only been tested with pretend versions |
| 5 | Choose the first product slice (Invoice Chaser is proposed) | Gives the product a clear first job |
| 6 | Buy the domain `hushwork.in` | Branding and Google verification need a real address |

## 8. Known problems and limits

- **Not tested for real:** Google, Linear-create and Composio have only been tested with fake servers. Composio tool inputs aren't verified.
- **Whole-site AI limit** (60 plans a day for everyone) still lives in server memory.
- **Google app is in "Testing" mode:** only listed test users can connect, they must reconnect every 7 days, and they see a "not verified" warning. Gmail and Drive need Google's full verification before the public can use them.
- **Composio:** Vercel, Xero and Cloudflare are listed but can't be connected (no ready-made sign-in).
- **Schedules** run at most every ~5 minutes online, because of the GitHub clock's rhythm.
- **Minor bug from QA round 3 (m2):** renaming a draft and then editing it shows a false "changed somewhere else" warning.
- **Accepted risks** (from the 2026-10-19 security review): Google's `spreadsheets` permission covers all of a person's sheets; tokens aren't bound with AES-GCM extra data; no PKCE. See `DECISIONS.md`.
- `/privacy` and `/terms` are drafts. Review them before launch.

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
