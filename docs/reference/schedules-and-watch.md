# Schedules, the clock and watch mode

How a Hushwork workflow runs by itself: the Start step choices, how a schedule is stored, the clock that wakes it up, and watch mode (quiet checks that only speak up when something is new).

Up: [Reference index](README.md)

## The big idea

A **schedule** is only a note in the database saying "run this workflow at this time". Nothing happens until something calls Hushwork about once a minute and asks "is anything due?". That caller is the **clock**. When the clock calls, Hushwork finds due schedules and runs them the way Auto mode does, as the person who owns them.

## The Start step choices

The Start step (`trigger` in `lib/steps.js`) has the field `how`:

| `how` | Label | Makes a real schedule? |
| --- | --- | --- |
| `schedule` | On a schedule | Yes, if the `when` words can be read |
| `watch` | Keep watching: tell me only when something new shows up | Yes, the same kind of schedule plus watch rules |
| `manual` | When I ask | No |
| `email`, `lead` | When an email / a new lead arrives | No. Nothing in the schedule code reacts to them (they are labels only) |

`when` is free text of at most 80 characters, such as `Every weekday at 17:30`. `lib/schedule-text.js` (`parseWhen`) reads these shapes: `every hour`, `hourly`, `every hour, 43 minutes past`, `every day at 9`, `daily at 9:30`, `every weekday at 17:30`, `every Monday at 9`, `every week on Friday at 16:00`, with 24-hour or am/pm times. If it cannot be read, the Builder says so and schedules nothing; it never guesses.

## Where schedules are made

- **From the Start step**: after a workflow is saved, the Builder calls `syncScheduleFromStart` (`lib/actions/schedules.js`), which calls `syncStartSchedule` (`lib/schedule-sync.js`). It reads the saved workflow from the database (never the browser's copy), needs at least one step that can really run, and creates or updates the schedule. A **new** schedule starts with writing turned **off**. An existing one keeps its "may write" and "paused" choices; only the time changes. Nothing is ever deleted automatically.
- **From the Workflows page** (`saveSchedule`, `deleteSchedule`).

Rules (`lib/schedule.js`): frequencies are `hourly`, `daily`, `weekdays`, `weekly`. The time is the person's local time, stored as `tz_offset`, minutes east of UTC (India is +330). It is one fixed offset, so in places with daylight saving a schedule can drift by an hour twice a year. At most **10 schedules per person**, one per workflow (`unique (workflow_id)` in `supabase/schedules.sql`).

## The tick endpoint

`app/api/cron/tick/route.js` accepts GET (what Vercel Cron sends) and POST. Both go to `handleTick` in `lib/schedule-tick.js`:

| Answer | Meaning |
| --- | --- |
| 503 | Scheduled runs are not switched on: `CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` is missing |
| 401 | Wrong or missing `Authorization: Bearer <CRON_SECRET>` (compared in constant time) |
| 200 `{ ok, paused: true, ... }` | The pause switch is on: nothing is claimed or run |
| 200 `{ ok, due, ran, stopped, failed, skipped }` | It worked |

The secret is read only in `lib/schedule-env.js`.

## The clock options

| Clock | File | Notes |
| --- | --- | --- |
| **Supabase clock (the real one)** | `supabase/clock.sql` | Uses `pg_cron` and `pg_net` to POST to `/api/cron/tick` every minute. You replace the placeholder with your `CRON_SECRET` before pasting; the password goes into Supabase Vault (secret name `hushwork_cron_secret`), the job is named `hushwork-clock`. The site address is written inside the SQL, so when the domain changes you run the `cron.schedule(...)` command again. Stop it with `select cron.unschedule('hushwork-clock');` |
| Your own computer | `scripts/clock.mjs`, `npm run clock` | Posts to `http://localhost:3100/api/cron/tick` once a minute while the app runs. `npm run clock -- --once` asks one time. |
| GitHub backup | `.github/workflows/clock.yml` | About every 5 minutes on paper, in practice every 3 to 4 hours. Uses the Actions secret `CRON_SECRET` and the Actions variable `HUSHWORK_URL`. |
| Vercel Cron | none in the repo | No `vercel.json` exists. The free plan allows a cron only once a day. |

Two clocks never run one schedule twice (claiming, below).

## Claiming and running (`lib/schedule-runner.js`)

`runDueSchedules` loads enabled schedules whose `next_run_at` has passed (oldest first, **at most 20 per call**). For each:

1. **Claim**: update `next_run_at` to the next time, but only `where next_run_at` still equals the old value. If nothing was updated, someone else took it and it counts as `skipped`.
2. **Run** `startPracticeRun` as the owner with `auto: true`. Writing steps are skipped unless the schedule's `allow_writes` is true ("Let it write by itself"). Every normal limit and approval rule still applies.
3. **Record** `last_status` (`ok`, `stopped`, `failed`) and `last_run_id`.

A schedule that is days overdue runs **once**, then waits for its next normal time. There is no catching up.

## Emails Hushwork sends by itself (`lib/schedule-notify.js`)

- **Problem notice** (`notifyScheduleProblem`): sent once when a schedule changes from fine (or never run) to stopped or failed. It goes to the person's own address through their own Gmail (send) connection at Composio. It holds only the workflow name and a link to the Runs page, nothing from the run. Without a Composio key or connection nothing is sent and nothing breaks.
- **Watch nudge** (`notifyWatch`): see below.

## Watch mode (`lib/watch-rules.js`)

A watch workflow is a scheduled workflow whose Start step is `watch`. It stays silent unless something is new. The one thing Hushwork does by itself is one plain email to the person.

| Rule | Value |
| --- | --- |
| Quiet hours | 20:00 to 08:00 in the person's own time (`QUIET_FROM`, `QUIET_UNTIL`) |
| Daily cap | 3 nudges per person per local day (`DAILY_CAP`) |
| Quiet marker | An Ask the AI answer that starts with `NOTHING NEW` (any capitals, `^nothing new\b`) |
| `{last}` | In an Ask the AI task, replaced by what that same step answered in the previous run (first 900 characters, handed to the AI as data). No earlier answer is not an error: the AI is told it is the first check. |

How it flows:

1. The check's AI step answers. If the answer starts with NOTHING NEW, `lib/run-core.js` ends the run there, saves a small "Nothing new" record, and the Runs page folds such runs into one quiet line.
2. If something is new and a writing step is left waiting for Approve, `runDueSchedules` calls the nudge. `notifyWatch` stays silent in quiet hours, when 3 nudges are already counted today, or with no Composio key. Otherwise it sends one email with a link to `/app/runs` (no link that approves anything) and saves a "Told you" record so the day's count is right.
3. A watch schedule that comes due **in quiet hours** is still claimed (so its next time moves on) but **not run**: no AI cost, no email. It counts as `skipped`. Ordinary schedules still run at night. Which kind it is comes from the saved first step (`isWatchPlan`).

Each check uses one AI step and a person gets 15 AI steps a day, so the ready-made watchers run daily or on weekdays.

## The pause switch

`isPaused` (`lib/app-controls.js`) reads the `paused` row of `app_controls`. When true, the tick returns early, writing steps refuse, and AI steps are not asked. See [safety-and-limits.md](safety-and-limits.md).

## Where in the code

- `lib/schedule.js`, `schedule-text.js`, `schedule-sync.js`, `schedule-runner.js`, `schedule-tick.js`, `schedule-env.js`, `schedule-notify.js`, `schedule-status.js`
- `lib/watch-rules.js`, `lib/run-core.js` (quiet marker, `{last}`), `lib/run-answer.js`
- `lib/actions/schedules.js`, `app/api/cron/tick/route.js`
- `supabase/schedules.sql`, `supabase/clock.sql`, `supabase/app-controls.sql`
- `scripts/clock.mjs`, `.github/workflows/clock.yml`
- Tests: `lib/schedule*.test.js`, `lib/watch-rules.test.js`, `lib/watch-mode.test.js`
