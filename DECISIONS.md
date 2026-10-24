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
| D-019 | Service-role key only for the scheduler | ✅ | 2026-10-20 |
| D-020 | GitHub Actions as the free scheduler clock | ✅ | 2026-10-23 |
| D-021 | Move AI usage limits into the database | 🟡 | 2026-10-23 |
| D-022 | First product slice = Invoice Chaser | 🟡 | 2026-10-14 |
| D-023 | Domain `hushwork.in`: which registrar? | ❓ | 2026-10-19 |
| D-024 | Google verification for Gmail/Drive: when? | ❓ | 2026-10-23 |
| D-025 | Brand violet: loud or quieter ink-violet? | ❓ | 2026-10-14 |
| D-026 | Shared PROJECT.md + DECISIONS.md for all AI tools | ✅ | 2026-10-24 |

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
- **Decision:** `SUPABASE_SERVICE_ROLE_KEY` (ignores privacy rules) is used only by `/api/cron/tick`, protected by `CRON_SECRET`. Every query names the person's `user_id`. The real actions live in `lib/run-core.js`, which a browser can never call directly.
- **Reason:** It's the most powerful secret in the project. Keeping it in one place limits the damage if something goes wrong.
- **Where:** `lib/supabase/admin.js`, `lib/schedule-tick.js`

---

## Integrations

### D-013: Composio for "more apps"
- **Date:** 2026-10-19
- **Status:** ✅ Approved (not tested against the real Composio yet)
- **Decision:** Reach 16 extra apps (Todoist, Notion, Slack, GitHub, HubSpot ...) through Composio instead of building a sign-in for each one. Each app gets ONE read-only lookup plus a short list of allowed actions.
- **Reason:** Building an OAuth app per website is slow. Composio's free plan covers 100,000 tool calls a month.
- **Options considered:** Pipedream Connect (free only while building), Nango (free for 10 connections).
- **Next action:** Test with a real Composio key and fix any tool that needs inputs.
- **Where:** `lib/connectors/composio-apps.js`, `lib/connectors/composio-actions.js`

### D-015: Results = AI summary + the app's exact answer
- **Date:** 2026-10-19
- **Status:** ✅ Approved
- **Decision:** Every lookup result shows an AI summary first, then the app's own list exactly as it answered.
- **Reason:** A summary is easy to read but could be wrong. The raw list means the AI can never hide the facts.
- **Where:** `lib/actions/runs.js` (`withSummary`), `lib/ai/agent.js` (`summarizeData`)

### D-020: GitHub Actions as the free scheduler clock
- **Date:** 2026-10-23
- **Status:** ✅ Approved (needs secrets before it runs)
- **Decision:** `.github/workflows/clock.yml` calls `/api/cron/tick` about every 5 minutes.
- **Reason:** Vercel's free cron only runs once a day. Every-minute cron needs a paid plan.
- **Options considered:** Vercel Cron (paid), cron-job.org, a scheduled task on the laptop.
- **Next action:** Add `CRON_SECRET` on Vercel and as a GitHub secret, then Run workflow once.

### D-021: Move AI usage limits into the database
- **Date:** 2026-10-23
- **Status:** 🟡 Proposed (built, SQL not pasted yet)
- **Decision:** Count per-person AI use in Supabase (`take_usage` function) instead of server memory.
- **Reason:** On Vercel each server copy counts on its own, so people could get past the limit.
- **Next action:** Paste `supabase/usage.sql`. Then also move the whole-site limit (60 plans a day) into the database.

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
