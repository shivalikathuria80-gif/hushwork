# DECISIONS.md: Hushwork decision log

> **What this file is for:** every important choice about Hushwork, *why* it was made, and what happens next. Any AI tool (ChatGPT, Gemini, Claude) can read this, so nobody has to re-explain past choices.
> **Partner file:** [`PROJECT.md`](PROJECT.md) (what Hushwork is and how it works today).
> **This repository is public:** no secrets, keys or private details here.

Last updated: 2026-10-24

## How to use this log

1. Made a decision in any chat? Add it at the **bottom** with the next number (`D-027`, `D-028` ...).
2. **Never delete** an old decision. If you change your mind, set its status to `Replaced by D-0xx` and write a new one.
3. Add one row to the summary table too.

**Status words:**

| Status | Meaning |
|---|---|
| ✅ Approved | Decided, and in use or being built |
| 🟡 Proposed | Suggested, not confirmed yet |
| ❓ Open | A question that still needs an answer |
| 🔁 Replaced | No longer true, see the newer decision |

**Template (copy for a new decision):**

```markdown
### D-0xx: <short title>
- **Date:** YYYY-MM-DD
- **Status:** ✅ Approved / 🟡 Proposed / ❓ Open / 🔁 Replaced by D-0xx
- **Decision:** <what we chose, in one sentence>
- **Reason:** <why>
- **Options considered:** <what else we looked at>
- **Decided with:** <ChatGPT / Gemini / Claude / me>
- **Research:** <key findings or links, optional>
- **Next action:** <the next concrete step>
- **Where in code/docs:** <files>
```

---

## Summary table

| # | Decision | Status | Date |
|---|---|---|---|
| D-001 | Freelancers first, agencies later | ✅ | 2026-10-14 |
| D-002 | Supabase for waitlist, sign-in and data | ✅ | 2026-10-14 |
| D-003 | Next.js 16 + React 19 + Tailwind 4 | ✅ | 2026-10-15 |
| D-004 | Geist font, violet accent, dark default | ✅ | 2026-10-15 |
| D-005 | Motion only with a reason, reduce-motion, Pause | ✅ | 2026-10-15 |
| D-006 | Run locally only, don't deploy | 🔁 by D-017 | 2026-10-15 |
| D-007 | Local dev on port 3100 | ✅ | 2026-10-15 |
| D-008 | Say only what is true today | ✅ | 2026-10-14 |
| D-009 | Approve before anything real happens | ✅ | 2026-10-15 |
| D-010 | Groq (not Anthropic) for AI plans | ✅ | 2026-10-17 |
| D-011 | AI tools take no input from the model | ✅ | 2026-10-18 |
| D-012 | Own OAuth for Linear and Google, tokens encrypted | ✅ | 2026-10-18 |
| D-013 | Composio for "more apps" | ✅ | 2026-10-19 |
| D-014 | MCP servers: read-only tools, no logins | ✅ | 2026-10-19 |
| D-015 | Results = AI summary + the app's exact answer | ✅ | 2026-10-19 |
| D-016 | Security review fixes + accepted risks | ✅ | 2026-10-19 |
| D-017 | Deploy on Vercel, open source (MIT) | ✅ | 2026-10-23 |
| D-018 | Schedules write only if ticked | ✅ | 2026-10-20 |
| D-019 | Service-role key only for the scheduler and Delete my account | ✅ | 2026-10-20 |
| D-020 | GitHub Actions as the free scheduler clock | 🔁 by D-031 | 2026-10-23 |
| D-021 | Move AI usage limits into the database | ✅ | 2026-10-23 |
| D-022 | First product slice = Invoice Chaser | 🟡 | 2026-10-14 |
| D-023 | Domain `hushwork.in`: which registrar? | ❓ | 2026-10-19 |
| D-024 | Google verification for Gmail/Drive: when? | ❓ | 2026-10-23 |
| D-025 | Brand violet: loud or quieter ink-violet? | ❓ | 2026-10-14 |
| D-026 | Shared PROJECT.md + DECISIONS.md for all AI tools | ✅ | 2026-10-24 |
| D-027 | Real actions through Composio, each approved | ✅ | 2026-10-24 |
| D-028 | Placeholders, not real addresses, in templates | ✅ | 2026-10-24 |
| D-029 | Never let a plan pretend: label plan-only steps, teach the AI real blocks | ✅ | 2026-10-24 |
| D-030 | The Start step makes the schedule real | ✅ | 2026-10-24 |
| D-031 | Supabase pg_cron is the scheduler clock | ✅ | 2026-10-24 |
| D-032 | Delete my account, Download my data, Terms page | ✅ | 2026-10-24 |
| D-033 | Free leaked-password check at sign-up | ✅ | 2026-10-24 |
| D-034 | Say why something failed (and test every connection) | ✅ | 2026-10-24 |
| D-035 | Template packs with suggested schedules | ✅ | 2026-10-24 |
| D-036 | Tests that run the real server code | ✅ | 2026-10-24 |
| D-037 | No whole-site AI limit in the database | ✅ | 2026-10-24 |
| D-038 | Vercel, Xero and Cloudflare cannot be connected through Composio | ✅ | 2026-10-24 |
| D-039 | Shared workflow memory is data, not instructions | ✅ | 2026-10-25 |
| D-040 | Safe run recovery: started, done, failed, and never send twice | ✅ | 2026-10-25 |
| D-041 | Skills and Skill Bundles (plugins) add no new power | ✅ | 2026-10-25 |
| D-042 | Workflow Studio: one Builder, step cards that explain themselves | ✅ | 2026-10-25 |
| D-043 | The AI plan writer only uses blocks that really work | ✅ | 2026-10-25 |
| D-044 | Run summary line, and five things that were not built are now built (carefully) | ✅ | 2026-10-25 |
| D-045 | Pre-launch hardening from a ChatGPT + Gemini review: pause switch, changed-since-read guard, two-account check | ✅ | 2026-10-25 |
| D-046 | An Ask the AI step can use what earlier steps found ({answers}); the Freelancer safety net bundle | ✅ | 2026-10-25 |

---

## Product

### D-001: Freelancers first, agencies later
- **Date:** 2026-10-14
- **Status:** ✅ Approved
- **Decision:** Build for freelancers and solo studios first. Small agencies (2 to 10 people) come later.
- **Reason:** One person with their own admin is the simplest user to build for. Team features (shared workflows, team approval) add a lot of complexity.
- **Next action:** Nothing about team features is decided. Revisit after the first product slice works.
- **Where:** `PRODUCT.md`

### D-008: Say only what is true today
- **Date:** 2026-10-14
- **Status:** ✅ Approved
- **Decision:** The site and app never claim users, beta status, numbers, testimonials or features that don't exist. Sample data is labelled as sample.
- **Reason:** Trust is the product. A tool that runs your email can't start with fake claims.
- **Where:** `PRODUCT.md` (Product Principles)

### D-022: First product slice = Invoice Chaser
- **Date:** 2026-10-14
- **Status:** 🟡 Proposed (not confirmed)
- **Decision:** The first complete job Hushwork should do really well is chasing unpaid invoices.
- **Reason:** It's the landing page's lead example and a painful, repeated freelancer task.
- **Options considered:** Weekly client report, inbox triage, lead follow-up.
- **Next action:** Confirm or pick another. If Invoice Chaser: decide whether it needs Stripe or Gmail first (Gmail needs D-024).

---

## Tech stack

### D-002: Supabase for waitlist, sign-in and data
- **Date:** 2026-10-14
- **Status:** ✅ Approved (live)
- **Decision:** Use Supabase (project `hushwork`, region ap-south-1) for the waitlist, accounts and all app data.
- **Reason:** One service gives a Postgres database, sign-in and row-level security. Region is close to India.
- **Options considered:** A no-code form service for the waitlist only.
- **Where:** `supabase/*.sql`, `hushwork-app/lib/supabase/`

### D-003: Next.js 16 + React 19 + Tailwind 4
- **Date:** 2026-10-15
- **Status:** ✅ Approved
- **Decision:** Move from the no-build prototype (`hushwork/`) to a real Next.js 16 app in `hushwork-app/`, with `motion` and Phosphor icons.
- **Reason:** Needed server code (sign-in, secrets, AI calls) that a plain HTML page can't do safely.
- **Where:** `hushwork-app/package.json`, `hushwork-app/AGENTS.md`

### D-007: Local dev on port 3100
- **Date:** 2026-10-15
- **Status:** ✅ Approved
- **Decision:** `npm run dev` always runs on http://localhost:3100. Always use `localhost`, not `127.0.0.1`.
- **Reason:** Port 3000 stays free for another app. The sign-in cookie belongs to one exact address.

### D-010: Groq (not Anthropic) for AI plans
- **Date:** 2026-10-17
- **Status:** ✅ Approved
- **Decision:** "Preview plan", Ask-the-AI steps and summaries use Groq, model `openai/gpt-oss-20b`. AI is off unless `GROQ_API_KEY` is set. If it's off, keyword matching is used instead.
- **Reason:** Groq has a free plan and is fast. Groq says it doesn't train on API data and offers Zero Data Retention.
- **Options considered:** Anthropic (Claude), the original plan in `docs/plan-next.md`.
- **Watch out:** Groq retires models every few months. The id lives in one constant (`GROQ_MODEL`). If logs say `model_missing`, swap it.
- **Where:** `lib/ai/groq.js`, `lib/ai/provider.js`, `docs/plan-groq.md`

### D-017: Deploy on Vercel, open source (MIT)
- **Date:** 2026-10-23 (replaces D-006 from 2026-10-15)
- **Status:** ✅ Approved (live)
- **Decision:** Hushwork is online at https://hushwork-six.vercel.app. The public GitHub repo deploys by itself on every push to `main`. MIT license.
- **Reason:** Scheduled runs, real sign-in links and sharing all need the app to be online.
- **Options considered:** Netlify, Hostinger. Earlier: local only (D-006).
- **Next action:** Add the secret settings on Vercel and the redirect addresses in Supabase, Linear and Google (`docs/deploy.md` sections 3 and 10).
- **Where:** `docs/deploy.md`

### D-006: Run locally only, don't deploy
- **Date:** 2026-10-15
- **Status:** 🔁 Replaced by D-017

---

## Safety and security

### D-009: Approve before anything real happens
- **Date:** 2026-10-15
- **Status:** ✅ Approved (core rule)
- **Decision:** Manual mode is the default. A practice run only describes steps, and each real step needs an Approve click showing the exact words first. Auto mode exists but only when switched on on purpose. Each writing step can be approved only once per run.
- **Reason:** "Nothing consequential happens unseen" is Hushwork's main promise.
- **Where:** `lib/run-core.js`, `lib/actions/runs.js`, `lib/run-answer.js` (`wasApproved`), `components/app/RunMode.js`

### D-011: AI tools take no input from the model
- **Date:** 2026-10-18
- **Status:** ✅ Approved
- **Decision:** Built-in AI tools (Linear, Calendar, one web page, an app lookup) are read-only and take no arguments from the AI. Tool results are wrapped as `<data>`, the AI is told to ignore instructions inside, and the agent loop runs at most 4 rounds.
- **Reason:** Stops "prompt injection": a web page can't trick the AI into fetching other addresses or leaking data.
- **Where:** `lib/ai/agent.js`, `lib/ai/agent.test.js`, `lib/secrets.test.js`

### D-012: Own OAuth for Linear and Google, tokens encrypted
- **Date:** 2026-10-18
- **Status:** ✅ Approved
- **Decision:** Linear and Google use Hushwork's own OAuth apps. Tokens are stored encrypted (one row per person per app) using `CONNECTIONS_KEY`. Google asks for `calendar.readonly` and `spreadsheets` only.
- **Reason:** Each person connects their own account in one click, and the database never holds readable tokens.
- **Where:** `lib/connections/`, `supabase/connections.sql`

### D-014: MCP servers: read-only tools, no logins
- **Date:** 2026-10-19
- **Status:** ✅ Approved
- **Decision:** The MCP block only offers tools a server marks read-only, or tools named with a reading word (get, list, read ...) and not marked destructive. At most 8 tools. Servers that need a login are refused. HTTPS and public addresses only.
- **Reason:** Hushwork has nowhere safe to keep logins for third-party servers yet, and writing tools would skip the Approve rule.
- **Where:** `lib/connectors/mcp.js`, `lib/connectors/http.js`

### D-016: Security review fixes + accepted risks
- **Date:** 2026-10-19
- **Status:** ✅ Approved
- **Decision:** Fixed: owner's personal Linear key works only outside production; AI rate limit is counted before outside requests; OAuth state cookie really deleted; stricter MCP tool names; saved run steps re-validated; addresses that look like they hold secrets refused.
- **Accepted (on purpose, for now):** Google `spreadsheets` permission covers all sheets (Google has no narrower option; code only appends). Tokens not bound with AES-GCM extra data (changing it would force everyone to reconnect). No PKCE (not needed for a server-side client with a secret).
- **Next action:** Look at these again before opening to the public.
- **Where:** `hushwork-app/README.md` ("Security review")

### D-018: Schedules write only if ticked
- **Date:** 2026-10-20
- **Status:** ✅ Approved
- **Decision:** A scheduled run skips writing steps (add a row, create a task, send) unless that schedule's "Let it write by itself" box is ticked. Max 10 schedules per person. Overdue schedules run once, no catching up.
- **Reason:** A run with nobody watching must be safe by default.
- **Where:** `lib/schedule*.js`, `supabase/schedules.sql`

### D-019: Service-role key only for the scheduler
- **Date:** 2026-10-20
- **Status:** ✅ Approved
- **Decision:** `SUPABASE_SERVICE_ROLE_KEY` (ignores privacy rules) is used only by `/api/cron/tick`, protected by `CRON_SECRET`, **and by Delete my account** (D-032), which deletes only the signed-in person's own account (the id comes from the session, never from the browser). Every query names the person's `user_id`. The real actions live in `lib/run-core.js`, which a browser can never call directly.
- **Reason:** It's the most powerful secret in the project. Keeping it in two small, tested places limits the damage if something goes wrong. A test lists exactly which files may import `lib/supabase/admin.js`.
- **Where:** `lib/supabase/admin.js`, `lib/schedule-tick.js`, `lib/actions/account.js`

---

## Integrations

### D-013: Composio for "more apps"
- **Date:** 2026-10-19
- **Status:** ✅ Approved (works: real emails were sent and apps were connected through it)
- **Decision:** Reach 17 extra apps (Todoist, Notion, Slack, GitHub, HubSpot ...) through Composio instead of building a sign-in for each one; 14 can be connected today (see D-038). Each app gets ONE read-only lookup plus a short list of allowed actions (D-027).
- **Reason:** Building an OAuth app per website is slow. Composio's free plan covers 100,000 tool calls a month.
- **Options considered:** Pipedream Connect (free only while building), Nango (free for 10 connections).
- **Where:** `lib/connectors/composio-apps.js`, `lib/connectors/composio-actions.js`

### D-015: Results = AI summary + the app's exact answer
- **Date:** 2026-10-19
- **Status:** ✅ Approved
- **Decision:** Every lookup result shows an AI summary first, then the app's own list exactly as it answered.
- **Reason:** A summary is easy to read but could be wrong. The raw list means the AI can never hide the facts.
- **Where:** `lib/actions/runs.js` (`withSummary`), `lib/ai/agent.js` (`summarizeData`)

### D-020: GitHub Actions as the free scheduler clock
- **Date:** 2026-10-23
- **Status:** 🔁 Replaced by D-031 (in practice GitHub's free timer fired only every 3 to 4 hours)
- **Decision:** `.github/workflows/clock.yml` calls `/api/cron/tick` about every 5 minutes.
- **Reason:** Vercel's free cron only runs once a day. Every-minute cron needs a paid plan.
- **Options considered:** Vercel Cron (paid), cron-job.org, a scheduled task on the laptop.
- **What happened:** The workflow works (it reached the app with a 200), but the history showed runs hours apart. It stays in the repo as an optional backup; set a `CRON_SECRET` Actions secret to keep it green.

### D-021: Move AI usage limits into the database
- **Date:** 2026-10-23
- **Status:** ✅ Approved (live: `supabase/usage.sql` is pasted)
- **Decision:** Count per-person use in Supabase (`take_usage` function) instead of server memory: AI plans, AI steps, AI summaries, and also sent actions (email, Slack, GitHub...), Linear tasks and sheet rows. If the table is missing or the database does not answer, the request is allowed and the in-memory limit still applies.
- **Reason:** On Vercel each server copy counts on its own, so people could get past the limit.
- **Not moved:** the whole-site limit, see D-037. Lookups, web calls, sign-in and the waitlist are still counted in memory only.
- **Where:** `supabase/usage.sql`, `lib/db-limits.js`

---

## Actions, schedules and safety (added 2026-10-24)

### D-027: Real actions through Composio, each approved
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** Besides reading, a step called "Do something in another app" can send an email (through Gmail), send a Slack message, create a GitHub issue, add a Todoist task, add a Google Calendar event or create a Notion page. Each action is one entry in `lib/connectors/composio-actions.js`. The approval card shows exactly what will be sent, a writing step can be approved once per run, and Hushwork first asks Composio for the tool's real inputs and sends nothing if they do not match. Stripe writes are deliberately not offered (real money).
- **Reason:** Reading is not enough for a workflow to be useful. Listing each action keeps a step from ever naming an arbitrary tool.
- **Options considered:** An own sign-in per app (slow); a "run any tool" step (unsafe).
- **Where:** `lib/connectors/composio-actions.js`, `lib/connectors/composio.js`, `lib/run-core.js` (`approveActionStep`)

### D-028: Placeholders, not real addresses, in templates
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** Templates and AI plans use `{myEmail}` (the signed-in person's own address, filled in when the step is shown and when it runs, also for scheduled runs), `{answer}` (what the last Ask the AI step said) and `{answers}` (every AI answer of the run, in order, for a morning briefing). A template never holds a real person's address, and its made-up values (a Notion page id of zeros, `your-name/your-repo`) are refused with a plain sentence until changed.
- **Reason:** A weekly scan found the owner's address written into five templates. Public templates must not email someone else.
- **Where:** `lib/connectors/composio-actions.js`, `lib/run-answer.js`, `lib/templates.js`

### D-029: Never let a plan pretend
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** (1) The AI plan writer and the keyword preview write the real blocks; when the task says "send to me / my account / an address" and no step really sends, code adds a real email step. (2) The old plan-only "Send a message" by email with a usable address is upgraded to a real email on the approval card. (3) Steps that only describe are named after saving in the Builder, marked "Plan only" on the Runs page, and labelled in the palette. (4) No template is plan-only; a test enforces it.
- **Reason:** A plan the AI wrote said "Send a message" and a run answered "Nothing was sent". The person lost an hour. Silent no-ops destroy trust.
- **Where:** `lib/ai/plan.js` (`ensureRealSend`), `lib/run-engine.js` (`upgradeSend`, `planOnlyWarning`), `lib/step-rows.js`

### D-030: The Start step makes the schedule real
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** Saving a workflow whose Start step says "On a schedule" with a time that can be read ("Every weekday at 17:30") creates the real schedule (writing OFF until ticked; an existing schedule keeps its writing and paused choices). A scheduled run names which schedule started it. The Schedule panel warns when it disagrees with the Start step. Monthly schedules are not supported.
- **Reason:** The Start step used to be a note nobody read, so two places could disagree and "it doesn't run on a schedule".
- **Where:** `lib/schedule-text.js`, `lib/schedule-sync.js`, `lib/actions/schedules.js`

### D-031: Supabase pg_cron is the scheduler clock
- **Date:** 2026-10-24
- **Status:** ✅ Approved (replaces D-020)
- **Decision:** `supabase/clock.sql` makes the database call `/api/cron/tick` every minute with `pg_cron` and `pg_net`; the password is stored in Supabase Vault. Verified live: every run succeeded and the app answered 200.
- **Reason:** It is free, runs every minute and needs no outside account.
- **Where:** `supabase/clock.sql`, `docs/deploy.md` section 15

### D-032: Delete my account, Download my data, Terms page
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** Settings has a Download my data button (workflows, newest runs and schedules as one JSON file; saved connections are never included) and a Delete my account button (the person types the words; Composio apps are disconnected first; everything else is removed by the database's "on delete cascade"). `/terms` is a plain-words page. There is no public contact address, so people use the GitHub issues page.
- **Reason:** A public app needs a way to leave and to keep a copy. The privacy page promised it.
- **Where:** `lib/account-core.js`, `lib/actions/account.js`, `lib/export-data.js`, `app/terms/page.js`

### D-033: Free leaked-password check at sign-up
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** New passwords are checked against the free Pwned Passwords service in its privacy-keeping way (only the first 5 characters of the SHA-1 fingerprint leave the server). If the service is down, sign-up still works.
- **Reason:** Supabase's own leaked-password protection needs a paid plan.
- **Where:** `lib/leaked-password.js`, `lib/actions/auth.js`

### D-034: Say why something failed, and test every connection
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** When an app refuses, Hushwork's own sentence is followed by what the app said (cleaned, cut to 160 characters, dropped if it looks secret or contains the API key). A run that stops saves the reason as a small record under the step (runs are never edited). A scheduled workflow that starts failing sends one email (not repeated while it stays broken). The Connections page has a "Test all my connections" button that really reads from Google, Linear and each Composio app and only checks that each action fits.
- **Reason:** "The app did not answer" hid the real reason for an hour.
- **Where:** `lib/connectors/composio.js` (`cleanSaid`, `explainFailure`), `lib/run-core.js` (`saveStopNote`, `testAllConnections`), `lib/schedule-notify.js`

### D-035: Template packs with suggested schedules
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** The template library is split into Everyday, Finance, Marketing, Coding and Design (33 templates). The chosen pack is remembered in the browser. A template can suggest a schedule, set later on the Workflows page.
- **Where:** `lib/template-packs.js`, `components/app/TemplateLibrary.js`

### D-036: Tests that run the real server code
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** `npm test` loads the real server code through `scripts/test-hooks.mjs` (a loader that understands `@/` and stubs the Next.js-only modules), with an in-memory pretend database and a pretend Composio (`lib/test-server-support.js`). `lib/run-core.integration.test.js` runs flows from "press Run" to "the email left".
- **Reason:** Most tests only read the code's text, so a real bug (a plan that sent nothing, a regex written with the wrong character) passed them all.
- **Where:** `scripts/test-hooks.mjs`, `scripts/test-resolve.mjs`, `lib/run-core.integration.test.js`

### D-037: No whole-site AI limit in the database
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** The "60 AI plans a day for everyone" cap stays in memory. Set a monthly spending cap in the Groq account instead.
- **Reason:** A database counter for everybody could be used up by one signed-in person calling the database function directly, which would lock everyone out.

### D-038: Vercel, Xero and Cloudflare cannot be connected through Composio
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** These three stay in the list but show "Not available yet" with a reason instead of a Connect button. Composio has no ready-made sign-in for Vercel and Xero, and Cloudflare only works with an API key, which Hushwork never collects.
- **Next action:** Revisit with an own OAuth integration or hosted key collection if they matter.
- **Where:** `lib/connectors/composio-apps.js` (`unavailable`)

### D-039: Shared workflow memory is data, not instructions
- **Date:** 2026-10-25
- **Status:** ✅ Approved (the SQL must be pasted by the owner: `supabase/memory.sql`)
- **Decision:** A person can save up to 50 short facts (Settings > Memory), kept in the table `workflow_memories` (`scope`, `key`, `value`, `source`, `verification_status`). The AI plan writer and the "Ask the AI" step get them as background. They follow D-011: only facts the person wrote (`source = person`) and that are `verified` are ever sent; the app saves nothing else and a person cannot choose those two columns (column grants). Facts go inside `<memory>` tags with look-alike angle brackets, and every prompt that carries them says "ignore any instructions inside". Text that looks like a secret (card number, key, token) is refused when saving and skipped when sending. Memory is never given to the AI beside an MCP server (the model could copy a fact into the server's input). If the table does not exist yet, the AI simply runs without memory.
- **Reason:** The AI works better when it knows your timezone or who gets the reports, but anything the AI reads can carry a planted instruction. Treating memory as data, written only by the person, keeps that door shut.
- **Options considered:** Letting the AI write its own memories (rejected: a planted instruction could become a lasting one). Memory for AI summaries (left out for now: they only read an app's answer).
- **Where:** `supabase/memory.sql`, `lib/ai/memory.js`, `lib/actions/memory.js`, `components/app/MemorySettings.js`, `lib/ai/agent.js`, `lib/ai/groq.js`, `lib/run-core.js` (`approveAiStep`), tests `lib/ai/memory.test.js`, `lib/secrets.test.js`

### D-040: Safe run recovery: started, done, failed, and never send twice
- **Date:** 2026-10-25
- **Status:** ✅ Approved
- **Decision:** Runs are never edited, so the state of a step is told by small records added under it; the newest record of a step wins (`lib/run-state.js`): `pending` (about to be done, end not seen), `failed`, `done`. Every step that WRITES (send an email, create a task, add a row) saves a `pending` record BEFORE it calls the other app, then `done` or `failed`. A step that is `done` is skipped and can never be done again. A step still `pending` (a dropped connection, a busy server, a crash) is UNKNOWN: it is never sent again by itself; the Runs page says "Not sure if this happened" and the person presses "It was not done, try again" (`confirmRetry`) only after checking. A clear refusal is `failed` and may simply be tried again. If the "started" record cannot be saved, nothing is sent; if the state cannot be read, writing is blocked. "Continue from where it stopped" (`resumeRun`) does the steps that are not done yet and skips the rest, so pressing it twice is safe.
- **Reason:** Without this, a run that failed halfway could only be restarted from the beginning, and an email whose answer was lost could be sent again. A duplicate email or task is worse than a stopped run.
- **Options considered:** Editing the run row to track state (rejected: runs have no UPDATE permission on purpose). Retrying unknown steps automatically (rejected: cannot be made safe without the other app's help).
- **Where:** `lib/run-state.js`, `lib/run-core.js` (`writeGate`, `markPending`, `afterFailedWrite`, `runAutomatically`, `resumeRun`), `components/app/ResumeRun.js`, `components/app/ApproveSend.js`, `components/app/RunsViewer.js`, tests `lib/run-recovery.integration.test.js`, `lib/run-state.test.js`

### D-041: Skills and Skill Bundles (plugins) add no new power
- **Date:** 2026-10-25
- **Status:** ✅ Approved (the SQL must be pasted by the owner: `supabase/skills.sql`)
- **Decision:** A **skill** is one typed step (lib/steps.js) with words that say what it reads and writes. A **bundle** is a named package of skills (finance-ops, marketing-growth, dev-admin) with the apps it needs and ready-made workflows built only from its own skills (`lib/skills/bundles.js`). The Skills page (`/app/skills`) shows each bundle, what each skill can read and write, which apps are connected, and one button to turn it on. Turning it on saves a row in `enabled_bundles` FIRST (so a double click cannot save twice) and then saves the bundle's workflows as drafts in the person's own list; it never connects an app, never makes a schedule and never runs anything. Turning it off removes the row only; the saved workflows stay. A skill can only do what its step kind can do: reading skills only read, writing skills (email, Linear task) still wait for the Approve click (or Auto mode / a "Let it write by itself" schedule, which are the person's own choices). Every workflow that writes has an "Ask you to approve" step before its first write and only ever emails the person themself (`{myEmail}`). Tests keep it true.
- **Reason:** People think in jobs ("chase unpaid invoices"), not in single steps. A bundle gives a whole job in one click without giving the AI any new power or weakening Approve.
- **What is honest about the three examples:** Invoice Chaser reads Stripe payments (not invoices) and emails the review pack to YOU, with a reminder draft; it does not email clients, because a step cannot pick a different address each time. Client Project Triage reads Gmail (senders and subjects only); Slack can only list channel names, not read messages. Campaign Repurposer starts "when I ask" (no "new post" trigger exists), and its review queue is your inbox; the post's address is typed into the two Ask the AI steps.
- **Lesson (2026-10-25):** the first `skills.sql` and `memory.sql` capped rows with a policy that counted rows in its own table; Postgres refuses that (error 42P17, "infinite recursion detected in policy") so every Turn on failed. The caps are triggers now, `supabase/policy-recursion-fix.sql` repairs a database that has the first version, and `lib/sql-rls.test.js` fails if any policy reads its own table. The pretend database in the tests cannot see this kind of mistake, so a real run on the live database is still the final check.
- **Options considered:** Bundles that unlock extra tools or skip approvals (rejected: they would add risk for no gain). Storing bundles in the database (rejected: they are code, reviewed and tested; the table only holds which ones a person turned on).
- **Where:** `lib/skills/bundles.js`, `lib/skills/enable.js`, `lib/actions/skills.js`, `app/app/skills/page.js`, `components/app/BundleCard.js`, `components/app/EnableBundle.js`, `supabase/skills.sql`; tests `lib/skills/*.test.js`, `lib/sql-rls.test.js`, `lib/secrets.test.js`

### D-042: Workflow Studio: one Builder, step cards that explain themselves
- **Date:** 2026-10-25
- **Status:** ✅ Approved. (The Gemini handoff called this "D-027". That number was already taken by the real-actions decision, so this is D-042.)
- **Decision:** Every way of starting a workflow ends in the same editable Builder: a **goal** (the workspace box, then "Open in the Builder"), a **template**, or a **skill** (`/app/builder?skill=<id>`, from the Skills page or the new Skills list in the Builder). Under every step the Builder shows a **Workflow Studio card** (`components/app/StepStudioCard.js`): **Why** the step exists, **Evidence** (Planned, Verified, Failed or Not sure), and, folded away, **How** it runs (which skill and plugin), what it **Produces** and **what happens if it fails**. The Runs page shows the same card under each step, where the evidence is real: *Verified* only when a saved result exists, *Failed* with the saved reason, *Not sure* for a step whose end was never seen; a step that has not run is only *Planned*. When an app a step needs is not connected, the card shows a warning in place with next actions: **Connect** (opens Connections in a new tab, so unsaved work is not lost), **check again**, **choose another way** (an Ask the AI step can just think), or **remove the step**. An app that can never be connected yet (Vercel, Xero, Cloudflare) says so and offers no Connect button. A skill that writes brings an "Ask me first" row with it.
- **Reason:** A workflow should say what it is doing and why, and say what is missing before it fails, not after.
- **A deliberate difference from the handoff:** the handoff asked to save `skillId`, `pluginId`, `requirementStatus` and `transparency` inside every step. They are **worked out from the step each time instead** (`lib/studio/capabilities.js`). Saved copies would go stale the moment someone connects an app or edits a step (a saved "missing_connection" would be wrong an hour later), the saved plan format and the database stay exactly as they were, and the step checks (`checkSteps`) would have stripped unknown fields anyway.
- **Not changed:** approval gates and recovery (`lib/run-core.js`, `lib/run-state.js`), the database, sign-in, token encryption and the AI fallback. Nothing on a card can run anything: the buttons only edit the draft or open a page.
- **Not built:** a separate "start from a plugin" entry (`?plugin=`). A plugin is reached through its skills: the Builder's Skills list says which apps each skill needs and whether they are connected.
- **Where:** `lib/studio/capabilities.js`, `lib/skills/connection-status.js`, `lib/skills/bundles.js` (`skillStart`), `lib/step-rows.js` (`rowsForSkill`), `lib/builder-start.js`, `components/app/StepStudioCard.js`, `components/app/Builder.js`, `components/app/StepEditor.js` (`renderExtra`), `components/app/RunsViewer.js`; tests `lib/studio/capabilities.test.js`

### D-043: The AI plan writer only uses blocks that really work
- **Date:** 2026-10-25
- **Status:** ✅ Approved (the owner's request)
- **Decision:** The AI plan writer is offered only `trigger`, `approve`, `ai`, `row`, `issue` and `action` (and `note` when nothing fits). `find`, `linear`, `write`, `send` and `app` are cut: three of them only described and did nothing, and **Ask the AI** can already look, find, sum up and write in Linear, the calendar, the inbox, Drive and 13 connected apps. A leftover old block in an answer is rewritten into the matching Ask the AI step, and a plain note (a model that ignores the blocks) is turned into the real step that does its job (`realizeNotes`), because a model cannot be relied on to follow instructions: the owner's next plan came back as four plain notes anyway. A typed step that only reads never gets an approval step in front of it. The keyword preview builds the same real steps. The Builder's palette hides the describe-only blocks. Plans saved earlier are untouched and still open.
- **Reason:** The owner kept getting AI plans full of steps that ran and did nothing, while a working alternative existed.
- **Where:** `lib/ai/plan.js`, `lib/ai/keyword-plan.js`, `lib/step-rows.js` (`PALETTE_BLOCKS`), `components/app/Composer.js`; tests `lib/ai/plan.test.js`, `lib/ai/keyword-plan.test.js`, `lib/steps.test.js`

### D-044: Run summary line, and five things that were not built are now built (carefully)
- **Date:** 2026-10-25
- **Status:** ✅ Approved (the owner asked for all of them)
- **Decision:**
  - **Run summary line** on the Runs page (`lib/studio/run-summary.js`): one sentence of what was looked at, written, sent and what could not run, built only from saved results (a step counts as done only if its saved record says so). It counts steps, never invented item counts.
  - **Notion pages carry text.** Composio's create-page tool takes a `markdown` box in the same call, so the action's "details" are the page text (shown on the approval card as "Text on the page"). A tool that has no such box is never sent the text by guessing.
  - **Stripe invoices.** A second lookup on the same Stripe sign-in (`stripeinvoices`, `STRIPE_LIST_INVOICES`; `lookupOf: "stripe"` in `lib/connectors/composio-apps.js`). The Stripe sign-in's allowed tools are now the union of all the lookups of that app, so **a Stripe connected before this must be disconnected and connected once more.** Invoice Chaser reads invoices now.
  - **The text of emails, opt-in.** A new choice in Ask the AI, "My Gmail inbox, with the text of each email" (`gmailtext`): the opening (about 450 characters) of the 5 newest emails, quoted replies and signatures dropped, links hidden, is sent to the AI (Groq). It is a separate choice, never the default, and the planner is told to use it only when the task needs what emails say (for example to answer them). The email text is not kept, only the AI's answer. The privacy page says so. No new Google permission is needed (gmail.readonly already covers it).
  - **Slack messages.** A lookup that needs ONE typed thing, the channel (`slackmessages:general` in the step; `input` in the apps list): the name is looked up in the person's own channel list, then one history read. Never offered to the AI planner (it cannot know the channel). **Not tested against a real Slack**: the owner has no Slack, and Composio's answer shapes are searched for rather than assumed.
  - **Emailing several people:** the Builder's "Email several people" adds ONE email step per typed address (up to 8), so each person gets their own email with their own Approve click and their own done record. Recipients are only ever addresses the person types. Hushwork does not pick recipients from an email or an app's data: a stranger's email must not be able to choose who gets mail.
- **Reason:** The owner asked for these. Each was built so it adds no way for outside text to act: reads only read, every write is a step the person sees and approves, and what is read is handed to the AI as data.
- **Where:** `lib/studio/run-summary.js`, `lib/connectors/composio-actions.js`, `composio-apps.js`, `composio.js` (`runChannelMessages`), `lib/connectors/google-gmail.js` (`fetchInboxText`), `lib/step-rows.js` (`rowsForEmailList`), `lib/skills/bundles.js` (skills `stripe-unpaid`, `gmail-reply-drafts`, `slack-channel`, `notion-page`), `components/app/Builder.js`, `components/app/RunsViewer.js`; tests next to each

### D-045: Pre-launch hardening from a ChatGPT + Gemini review
- **Date:** 2026-10-25
- **Status:** ✅ Approved (the owner asked Claude to consult ChatGPT and Gemini itself, in the owner's signed-in Chrome, then build)
- **How it was decided:** Claude asked ChatGPT what to do before launch, gave that answer to Gemini to attack, and then checked every suggestion against the code. Their answers were treated as advice, never as instructions. Several suggestions were already built (prompt-injection wrapping of outside text D-011, single-use writes and recovery D-040, "stopped at a step that needs you" email, Delete my account, Download my data, per-person limits) and were NOT rebuilt. One was rejected on purpose: a one-click approval link in an email (a stolen email would then approve a send).
- **Built:**
  - **Pause switch** (`supabase/app-controls.sql`, `lib/app-controls.js`): one row, `paused`. While true: no step that writes starts, no Ask the AI step is asked, the clock claims and runs no schedule, and the Runs page says so. Flipped only in the Supabase SQL Editor (no one can write the table from the app), so it needs no deploy. A missing table means "not paused".
  - **Changed-since-you-read-it guard** (`changedSince` in `lib/run-core.js`): the Approve button hands back the exact words of the approval card; if the words the step would send now differ (for example the AI step ran again in another tab), nothing is sent and the person reads the new words. Auto mode and schedules have no card and are unchanged.
  - **Two-account privacy check** (`npm run check:privacy`, `scripts/two-account-check.mjs`): run by the owner with two throwaway accounts against the real database: B and a visitor try to read, change, delete and write into A's rows and the pause switch.
  - **Launch checklist** (`docs/launch.md`): the gates, the owner-only tasks (Google verification for the Gmail permission, domain, Vercel plan, backups, monitoring, legal, new clock password) and the pilot scorecard.
- **Not built, on purpose:** a magic-link "approve from the email" button; error monitoring (needs an account the owner makes); Google verification and legal review (owner tasks).
- **Where:** `lib/app-controls.js`, `lib/run-core.js`, `lib/schedule-tick.js`, `components/app/ApproveSend.js`, `components/app/RunsViewer.js`, `scripts/two-account-check.mjs`, `docs/launch.md`; tests `lib/app-controls.test.js`, `lib/run-recovery.integration.test.js`, `lib/sql-rls.test.js`

### D-046: An Ask the AI step can use what earlier steps found ({answers}); the Freelancer safety net bundle
- **Date:** 2026-10-25
- **Status:** ✅ Approved (second ChatGPT + Gemini round, see `docs/ideas.md`)
- **Decision:** Writing `{answers}` in an Ask the AI step's job hands that step the answers of the Ask the AI steps BEFORE it (never its own old answer or a later step's). They arrive as `<data>` after the task with angle brackets neutralised, never as part of the person's request, so text that came from an email or a Slack channel cannot act as an instruction. With no earlier answer the step stops and says to approve the earlier steps first. This unlocks "compare" and "combine" jobs, which Hushwork could not do. New bundle **Freelancer safety net**: Scope Creep Alarm, Week Balancer, Meeting-Day Rescue Brief.
- **Reason:** Both outside AIs proposed jobs that need one step to see what another found. The honest fix was to give Hushwork that ability once, safely, instead of faking it in each workflow.
- **Limits worth knowing:** one Ask the AI step still looks in ONE place; Linear gives no due dates; Slack needs the channel typed in the step.
- **Where:** `lib/run-core.js` (`approveAiStep`), `lib/run-answer.js` (`findAnswers`, `before`), `lib/ai/agent.js` (`context`), `lib/skills/bundles.js`; tests in `lib/ai/agent.test.js`, `lib/run-core.integration.test.js`

---

## Brand and design

### D-004: Geist font, violet accent, dark default
- **Date:** 2026-10-15
- **Status:** ✅ Approved (Geist is binding; the rest is current style)
- **Decision:** Geist + Geist Mono, violet accent without gradients, dark theme by default with a working light theme, dot-matrix "hushwork" wordmark.
- **Where:** `app/globals.css`, `app/layout.js`

### D-005: Motion only with a reason
- **Date:** 2026-10-15
- **Status:** ✅ Approved
- **Decision:** Animation is welcome on the landing page, but each piece needs a reason, must stop under "reduce motion", and anything that moves by itself needs a visible Pause button. Target: WCAG 2.2 AA.

### D-025: Loud violet or quieter ink-violet?
- **Date:** 2026-10-14
- **Status:** ❓ Open
- **Question:** "Hush" suggests calm, but bright violet is loud. Keep it or move toward a darker ink-violet?

---

## Business

### D-023: Domain `hushwork.in`: which registrar?
- **Date:** 2026-10-19
- **Status:** ❓ Open
- **Question:** Buy `hushwork.in` through Hostinger or GoDaddy?
- **Next action:** Compare first-year and renewal prices, then point the domain at Vercel and update `NEXT_PUBLIC_SITE_URL` + all redirect addresses.

### D-024: Google verification for Gmail/Drive: when?
- **Date:** 2026-10-23
- **Status:** ❓ Open
- **Question:** Gmail and Drive permissions are "sensitive/restricted", so Google needs a privacy page, a demo video and sometimes a security review before the public can connect. When should Hushwork start that?
- **Depends on:** D-022 (if the first slice needs Gmail), D-023 (needs a real domain).

---

## Workflow

### D-026: Shared PROJECT.md + DECISIONS.md for all AI tools
- **Date:** 2026-10-24
- **Status:** ✅ Approved
- **Decision:** Keep `PROJECT.md` (what Hushwork is) and `DECISIONS.md` (what was decided and why) in the repo root as the one source every AI tool reads. Hand work between tools with the handoff template in `PROJECT.md` section 10.
- **Reason:** ChatGPT, Gemini and Claude don't share memory. A common file stops the copy-pasting and re-explaining.
- **Options considered:** Automating handoffs between models with an orchestration script. Postponed until the manual version proves useful.
- **Next action:** Try it on one real task: ChatGPT plans, Gemini researches, Claude Code builds. Then check whether it saved explaining.
