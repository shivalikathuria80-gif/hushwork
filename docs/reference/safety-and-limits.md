# Safety rules and limits

Every safety rule and limit in Hushwork, what its value is, and which file it lives in.

Up: [Reference index](README.md)

## How to read this page

Two words you will see a lot:

- **Row-level security (RLS)**: a database rule that says a signed-in person can only see and change their own rows. The rule is enforced by Postgres itself, not by app code.
- **In memory vs in the database**: a limit counted "in memory" lives in one server's RAM. On Vercel there can be several servers, and a restart forgets the count, so it is friction, not a wall. A limit counted "in the database" holds everywhere.

## The main table

| Rule | Value | File |
| --- | --- | --- |
| Approval for every writing step | Send, create or add never starts without an Approve click (or Auto mode / a schedule with writing allowed). Rebuilt on the server from the saved run, never from the browser | `lib/run-core.js` (`loadPracticeStep`, `writeGate`) |
| Exact-words check | The Approve button sends back the words the person read (`seen`). If what would be sent now differs, nothing is sent and the person must read again | `lib/run-core.js` (`changedSince`, `CHANGED_MESSAGE`) |
| One try per step | A step already `done` is never sent again. A step left `pending` (result unknown) is never resent by itself, only if the person says it was not done | `lib/run-core.js`, `lib/run-state.js` |
| Emails only to the person | Ready-made workflows send only to `{myEmail}`, the signed-in person's own address | `lib/connectors/composio-actions.js` (`MY_EMAIL`, `checkTarget`), `lib/skills/bundles.test.js` |
| Secret-looking text refused | Card numbers, secret keys, AWS keys, private keys and JWT-shaped text in a request are not sent | `lib/ai/plan.js` (`looksSensitive`), `lib/run-core.js` |
| Pause switch | One row `paused` in `app_controls`. While true: no writing step, no AI step, no scheduled run. A missing table means "not paused" | `lib/app-controls.js`, `supabase/app-controls.sql` |
| Scheduled writing off by default | A schedule only writes if "Let it write by itself" is ticked | `lib/schedule-runner.js`, `lib/schedule-sync.js` |
| AI only reads | Tool results are wrapped in `<data>` tags and treated as information, never instructions. At most 4 rounds, 3000 characters per tool result | `lib/ai/agent.js` |
| MCP read-only rule | Only tools the server marks read-only, or whose names start with a reading word (get, list, read, search, find, fetch, lookup, ask, describe, show, view) and contain no writing word. At most 8 tools, answers cut to 3000 characters, no login | `lib/connectors/mcp.js` |
| Private addresses refused (web steps) | https only, real domain name, no IP numbers, no `localhost`/`.local`/`.internal`, no port, no password in the address, 120 characters. The connection itself is checked so every resolved address must be public. No redirects followed, 8 second timeout, 65,536 byte limit | `lib/connectors/http.js` |
| Row-level security | Every per-person table has RLS on, `revoke all` from `anon` and `authenticated` first, then narrow grants. A person cannot write `user_id`, `id` or `created_at` | `supabase/*.sql`, `lib/sql-rls.test.js` |
| Browser safety headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation, payment off), `Strict-Transport-Security: max-age=31536000`, `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. No script policy, because Next.js needs inline scripts | `next.config.mjs`, `lib/headers.test.js` |
| Sign-in cookie | HttpOnly always, Secure in production | `lib/supabase/server.js`, `lib/supabase/proxy.js` |
| Pages behind sign-in | `/app/*` redirects signed-out visitors to `/login`; if Supabase cannot be reached, treated as signed out | `proxy.js`, `lib/supabase/proxy.js` |
| Saved connections encrypted | AES-256-GCM with `CONNECTIONS_KEY`; tampering makes decryption fail | `lib/connections/crypto.js` |
| Personal Linear key | Ignored in production builds | `lib/connector-status.js` |
| Leaked-password check | At sign-up only. First 5 characters of the SHA-1 fingerprint go to Pwned Passwords (with padding); 2.5 second timeout; if the service fails, the password is allowed | `lib/leaked-password.js` |
| Delete my account | Needs the typed words `delete my account`. The id comes from the session, never the browser. Composio connections are disconnected first, then the sign-in row is deleted and the database cascades | `lib/account-core.js`, `lib/actions/account.js` |
| Download my data | JSON of the person's own workflows, runs (newest 500), schedules and memory. Saved connections (tokens) are never included. Signed out gives 401 | `lib/export-data.js`, `app/api/export/route.js` |
| All-access database client | Exactly two users: the clock's handler and Delete my account. Every query names the person | `lib/supabase/admin.js`, `lib/secrets.test.js` |

## Text and size limits (`lib/validate.js`, `lib/steps.js`)

| What | Limit |
| --- | --- |
| Email | 254 characters |
| Password (create account) | 10 to 64 characters, and at most 72 bytes |
| Sign-in password | at most 256 characters |
| Workflow name | 80 characters (the database allows 120) |
| Request (prompt) | 2000 characters (also a database check) |
| Steps in a plan | 12 |
| Plain-note step title or detail | 200 characters |
| Plan size | 19,000 bytes in the app; the database refuses over 20,000 |
| Run results size | 40,000 bytes (database check) |
| Ask the AI task | 110 characters; address 100 |
| Start step `when` | 80 characters |
| Action `target` / `title` / `details` | 40 / 80 / 120 characters |
| Linear task title / details / team | 100 / 150 / 10 characters |
| Memory fact | value 300, key 60, scope 40 characters; 2000 characters in total used per request |

Invisible characters are stripped from step text (`tidyText`). Too long is an error sentence, never a silent cut.

## Database caps: triggers, not policies

| Cap | Value | File |
| --- | --- | --- |
| Bundles turned on per person | 20 | `supabase/skills.sql` |
| Memory facts per person | 50 | `supabase/memory.sql` |
| Schedules per person | 10 (app code only) | `lib/actions/schedules.js`, `lib/schedule-sync.js` |

These caps are **triggers**, not row-level policies. A policy that counts rows in its own table makes Postgres stop with error **42P17** ("infinite recursion detected in policy"). `supabase/policy-recursion-fix.sql` repairs databases made before 2026-10-25. `lib/sql-rls.test.js` fails if a policy reads its own table.

## AI and action limits

| Limit | Value | Counted | File |
| --- | --- | --- | --- |
| AI plan preview | 2 a minute, 20 a day per person | database (`take_usage`, bucket `ai_plan`) and memory | `lib/ai/plan.js` (`AI_LIMITS`), `lib/actions/plan.js` |
| Whole site AI plans | 3 a minute, 60 a day | memory only | `lib/ai/limits.js` |
| AI steps and summaries | 3 a minute, 15 a day per person | database (bucket `ai_step`) and memory | `lib/run-core.js` |
| Sent actions, Linear tasks | 3 a minute, 15 a day | database and memory | `lib/run-core.js` |
| Sheet rows | 5 a minute, 30 a day | database and memory | `lib/run-core.js` |
| Lookups (Linear, Calendar, Gmail, Drive, apps), web calls | 5 a minute, 30 a day | memory only | `lib/run-core.js` |
| Connect an app via Composio | 5 a minute | memory | `lib/connections/composio-flow.js` |
| Waitlist | 5 per 10 minutes per visitor, 100 an hour for everyone | memory | `lib/waitlist-core.js` |

Days reset at midnight UTC. The database counter is `take_usage` in `supabase/usage.sql`; if the table is missing the request is allowed and the memory count still applies (`lib/db-limits.js`). The clock's client skips the database counter. Set a spending cap in Groq as the only whole-site protection.

## Sign-in limits (`lib/auth-limits.js`)

| Action | Per email | Per visitor | Window |
| --- | --- | --- | --- |
| Sign in | 8 | 30 | 10 minutes |
| Sign up | 3 | 6 | 1 hour |

Counted before the password is checked, in memory. The visitor address comes from `x-forwarded-for` (`lib/visitor.js`) and is never stored.

## Where in the code

`lib/run-core.js`, `lib/app-controls.js`, `lib/validate.js`, `lib/steps.js`, `lib/auth-limits.js`, `lib/leaked-password.js`, `lib/db-limits.js`, `lib/connectors/http.js`, `lib/connectors/mcp.js`, `lib/account-core.js`, `lib/export-data.js`, `next.config.mjs`, `proxy.js`, and the SQL in `supabase/`. Guarded by `lib/secrets.test.js`, `lib/sql-rls.test.js`, `lib/headers.test.js`, `scripts/two-account-check.mjs`.
