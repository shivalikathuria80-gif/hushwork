# Data model

This file lists every table in Hushwork's Supabase (Postgres) database, what each column stores, who may read or write it, and which tables the app can live without.

Up: [Reference index](README.md)

The SQL lives in `supabase/*.sql`. Many file headers say "NOT applied yet"; that is old wording, since DECISIONS.md says the app is live (I did not check the live database).

## Privacy rules in one paragraph

Every personal table has **row-level security (RLS)**: a rule inside the database that says a signed-in person can only see and change rows whose `user_id` equals their own id. The `user_id` column is filled in by the database itself (`default auth.uid()`), so the app never sends it and a person cannot claim a row for someone else. The public (not signed-in) role gets nothing, except `waitlist` where it may only add a row. Permission is also cut down by column: for example a person may write the `name`, `prompt` and `plan` of a workflow but never its `id`, `user_id` or dates. Deleting an account deletes all its rows (`on delete cascade`). The test `lib/sql-rls.test.js` reads the SQL and fails if a personal table breaks these rules, or if a policy reads its own table (Postgres error 42P17).

## Tables at a glance

| Table | One row is | File |
|---|---|---|
| `waitlist` | an email that joined early access | `waitlist.sql` |
| `workflows` | a saved draft (name, task text, steps) | `workflows.sql` |
| `runs` | one practice run, or one saved record of a real step | `runs.sql` |
| `schedules` | when one workflow runs by itself | `schedules.sql` |
| `connections` | an encrypted sign-in token for Linear or Google | `connections.sql` |
| `workflow_memories` | a short fact the AI may use | `memory.sql` |
| `enabled_bundles` | a Skill Bundle a person turned on | `skills.sql` |
| `usage_counters` | how many times someone used a limited thing | `usage.sql` |
| `app_controls` | an on/off switch for the whole app | `app-controls.sql` |

## waitlist

| Column | Holds |
|---|---|
| `id` | uuid, made automatically |
| `email` | up to 254 characters, must look like an email |
| `created_at` | when |

One signup per address, ignoring capitals (a unique index on `lower(email)`). The public role can only insert; `authenticated` has nothing; `service_role` has full access. You read the list in the Supabase dashboard.

## workflows

| Column | Holds |
|---|---|
| `id`, `user_id` | uuid; owner (cascade) |
| `name` | 1 to 120 characters (the app itself allows up to 80) |
| `prompt` | the task as typed, 1 to 2000 characters |
| `plan` | jsonb array of steps, at most 20,000 bytes as text (the app stops at 19,000) and at most 12 steps |
| `created_at`, `updated_at` | `updated_at` is set by a trigger |

A step is an object such as `{"icon":"Mail","title":"Send the report","detail":"...","kind":"action","fields":{"action":"gmail_send","target":"{myEmail}","title":"Weekly report","details":"{answer}"}}`. Steps with no `kind` are plain notes. The person may select and delete, insert and update only `name`, `prompt`, `plan`. The `updated_at` value doubles as the "version" the Builder compares to notice that a draft was changed elsewhere.

## runs

| Column | Holds |
|---|---|
| `id`, `user_id` | uuid; owner |
| `workflow_id` | the workflow, or empty if it was deleted (`on delete set null`) |
| `workflow_name` | 1 to 120 characters, so a run still has a name |
| `mode` | `practice` or `live` |
| `status` | `done` or `failed` |
| `results` | jsonb array, at most 40,000 bytes |
| `created_at` | when |

A **practice** row has one entry per step saying what the step would do. A **live** row is a small record of a real step and holds exactly one entry that points back with `from` (the practice run id) and `fromStep` (the step number). The step state (`pending`, `failed`, `done`) lives inside that entry's `status`, not in the row's own `status` column, which is always `done` for live rows. See [run-model.md](run-model.md). Example live entry: `{"title":"Send the report","kind":"action","status":"done","outcome":"Sent an email to ...","from":"<run id>","fromStep":3}`.

Grants: select, delete, and insert of `workflow_id, workflow_name, mode, status, results`. **No update**: runs are never edited. The insert policy also checks the workflow belongs to the same person.

## schedules

| Column | Holds |
|---|---|
| `workflow_id` | unique, so one schedule per workflow (cascade) |
| `frequency` | `hourly`, `daily`, `weekdays` or `weekly` |
| `hour`, `minute`, `weekday`, `tz_offset` | local time; weekday 0 = Sunday; `tz_offset` in minutes east of UTC (India = 330) |
| `allow_writes` | may a scheduled run do steps that write? Default false |
| `enabled` | on or off |
| `next_run_at` | when it is next due |
| `last_run_at`, `last_status`, `last_run_id` | bookkeeping: `ok`, `stopped` or `failed`, and the run (`on delete set null`) |

A person may insert and update only the choice columns. The bookkeeping columns are written by the clock using the all-access key. The limit of 10 schedules per person is checked in the app (`lib/actions/schedules.js`), not in the database. Example: "every weekday at 09:00 India time" is `weekdays, 9, 0, 0, 330, false, true`.

## connections

| Column | Holds |
|---|---|
| `provider` | `linear` or `google` (the database accepts any short lowercase name; the app accepts only `lib/connectors/app-list.js`) |
| `access_token_enc`, `refresh_token_enc` | encrypted tokens, at most 2000 characters each |
| `expires_at` | when the access token runs out |

Unique per (`user_id`, `provider`). Tokens are encrypted before they reach the database (see [connectors.md](connectors.md)). Composio apps are not stored here; Composio keeps those sign-ins. Download my data never includes this table.

## workflow_memories

`scope` (default `general`, 1 to 40 letters, digits, space, `_`, `-`), `key` (1 to 60), `value` (1 to 300), `source` (`person`, `workflow` or `ai`, default `person`), `verification_status` (`verified`, `unverified`, `rejected`, default `verified`). Unique per (`user_id`, `scope`, `key`). A person may insert only `scope, key, value` and update only `value`, so `source` and `verification_status` cannot be chosen. **Trigger `workflow_memories_cap`**: at most 50 facts per person.

## enabled_bundles

`bundle_id` (matches `^[a-z][a-z0-9-]{1,39}$`), unique per person and bundle. Insert and delete only, no update. **Trigger `enabled_bundles_cap`**: at most 20 per person. The bundles themselves are code in `lib/skills/bundles.js`; this table only remembers which are on.

## usage_counters

Primary key (`user_id`, `bucket`, `kind`, `window_start`) plus `hits`. `kind` is `minute` or `day` (UTC day). RLS is on with **no policies**, so nobody can read or edit it directly. The function `take_usage(p_bucket, p_per_minute, p_per_day)` (SECURITY DEFINER, executable only by signed-in people) counts for `auth.uid()` and answers `ok`, `limit_minute`, `limit_day`, `no_user` or `bad_request`. It deletes counters older than 2 days. Buckets used in code: `ai_plan`, `ai_step`, `linear_create`, `action`, `sheets_row`.

## app_controls

`name` (primary key, `^[a-z_]{1,40}$`), `value` (boolean), `note`, `updated_at`. One row, `paused`. Signed-in people may only read it. Nobody can write it from the app: you flip it in the Supabase SQL Editor (`update public.app_controls set value = true where name = 'paused';`).

## Other triggers and SQL files

- `workflows_set_updated_at` (before update on `workflows`) keeps `updated_at` honest.
- Repair files for older databases: `policy-recursion-fix.sql`, `connections-any-app.sql`, `schedules-index.sql`.
- `clock.sql` is not a table; it creates the `pg_cron` job (see [architecture.md](architecture.md)).

## Tables the app tolerates missing

| Table or function | If missing or unreadable |
|---|---|
| `app_controls` | treated as "not paused" (`lib/app-controls.js`) |
| `usage_counters` / `take_usage` | the request is allowed; in-memory limits still apply (`lib/db-limits.js`) |
| `workflow_memories` | the AI runs without memory |
| `enabled_bundles` | Skills page shows bundles but Turn on says a setup step is missing |
| `schedules` | the Schedule panel says one setup step is not done |
| `runs`, `connections` | Runs page / Connect button say a setup step is missing |

`workflows` and `waitlist` are core and have no such fallback.

## Where in the code

- `supabase/*.sql` (all the SQL above)
- `hushwork-app/lib/sql-rls.test.js` (the privacy checks)
- `hushwork-app/lib/validate.js` (`LIMITS`, `cleanDraft`, `checkSteps`)
- `hushwork-app/lib/db-limits.js`, `lib/app-controls.js`, `lib/ai/memory.js`
- `hushwork-app/lib/actions/schedules.js`, `lib/actions/drafts.js`, `lib/export-data.js`, `lib/account-core.js`
