# Run model

This file explains how a workflow run works: practice versus real steps, the append-only record that makes a step safe to retry, and the guards that stop a double send.

Up: [Reference index](README.md)

Jargon: **append-only** means new records are added and old ones are never edited. A **practice run** only writes down what each step would do. A **live record** is a small saved note about one real step.

## Practice run and live records

`startPracticeRun` (`lib/run-core.js`) loads the person's own workflow, calls `practiceRun` (`lib/run-engine.js`) which turns each step into a "Would ..." sentence, and saves one row in `runs` with `mode = 'practice'`. Nothing leaves the app.

A real step happens when the person presses Approve (or Auto mode or a schedule runs it). It saves a **live record**: a new `runs` row with `mode = 'live'` and `results = [record]`, where the record carries `from` (the practice run id) and `fromStep` (the step number). Runs have no UPDATE permission, so state is never edited in place. `lib/run-state.js` reads the live records of a run oldest first, and the **newest record of a step wins**.

| Record `status` | Meaning |
|---|---|
| `pending` | the step was about to be done and Hushwork never saw the end. The answer is UNKNOWN |
| `failed` | it clearly did not happen, so it may be tried again |
| `done` | it happened. It is never done again |
| none | not tried |

Flags on other records: `note: true` (a stop reason, words only, never changes a step's state), `quiet: true` (a watch check found nothing new), `spoke: true` ("Told you": the nudge email was sent).

## The write path (`writeGate`, `markPending`)

Steps that write are Add a row, Create a Linear task and Do something in another app (`isWriteStep`). Reads do not leave a `pending` record. A write goes through these gates in order, in `approveActionStep`, `approveLinearCreate` and `approveSheetsRow`:

1. `loadPracticeStep` re-reads the saved run from the database and re-checks the step with `checkSteps`. The browser only names a run id and a step number.
2. `writeGate`: if the pause switch is on, stop; read the step state (if it cannot be read, stop with "could not check", never assume "not tried"); `done` means refuse; `pending` means refuse unless `confirmRetry` is true.
3. Fill in `{answer}`, `{answers}`, `{myEmail}`; refuse text that looks like a card number or secret key.
4. `changedSince` (below), then the limits.
5. `markPending` saves a `pending` record **before** calling the other app. If that cannot be saved, nothing is sent.
6. Call the app. A clear refusal becomes `failed` (`afterFailedWrite`). A dropped connection or busy server (`isUnsure`) stays `pending`, so it is never sent again by itself. Success saves `done`.

## confirmRetry and resumeRun

- **confirmRetry**: when a step is `pending`, the Approve button reads "It was not done, try again" and sends `confirmRetry: true`. The person says they checked the app first.
- **resumeRun** (the "Continue from where it stopped" button): runs the steps that are not done, in order, skipping `done` ones, stopping at `pending` ones, retrying `failed` ones. Pressing it twice is safe.

## changedSince and seen (the exact-words check)

The Approve card shows words built by `actionSummary`, `linearCreateSummary` or `sheetsSummary`. `ApproveSend.js` sends those words back as `seen`, only for the kinds `action`, `issue` and `sheets`. The server rebuilds the words; if they differ (say the AI step ran again in another tab) it sends nothing and answers `changed: true`. Auto mode and schedules send no `seen`, because no card was read.

## Auto mode

`startPracticeRun({ auto: true, allowWrites })` then `runAutomatically` goes through the steps in order (at most 20), calling the same Approve functions, so every check applies. It skips `done` steps, stops at `pending`, and stops at the first error, saving a `note` record with the reason. Only an explicit `auto === true` turns it on.

## Schedules

`runDueSchedules` (`lib/schedule-runner.js`), called from `lib/schedule-tick.js` with the all-access client:

1. Pick up to 20 enabled schedules whose `next_run_at` has passed.
2. **Claim** each by updating `next_run_at` only if nobody changed it first, so overlapping ticks cannot run one schedule twice. A late schedule runs once (no catching up).
3. Run it as Auto mode as its owner, with `allowWrites` from `allow_writes`. If false, writing steps are skipped (counted as `waiting`); reading and AI steps still run.
4. Save `last_status` and `last_run_id`. When a schedule goes from fine (or never run) to trouble, `notifyScheduleProblem` sends one email.

A scheduled run sends no `seen` and no `confirmRetry`.

## The pause switch

`isPaused` (`lib/app-controls.js`) reads the `paused` row of `app_controls`. When true: `writeGate` refuses every write, `approveAiStep` refuses to ask the AI, and the tick answers `paused: true` without claiming or running any schedule. A missing table or an error means "not paused". Note: the optional AI summary that reading steps add (`withSummary`) has no pause check in `run-core.js`.

## {answer}, {answers}, {last}

These are words a step can contain. They are filled in from saved live records (`lib/run-answer.js`):

| Tag | What it becomes |
|---|---|
| `{answer}` | the newest saved answer of an Ask the AI step of the same workflow made after this practice run (`findAnswer`). One line, cut to 500 characters; for letter-like actions (email, draft, Notion page, new sheet, slides, doc) line breaks are kept, up to about 3000 characters |
| `{answers}` | every Ask the AI answer of this practice run, in step order (`findAnswers`); each cut to 1200, joined to about 2800 |
| `{last}` | what this same step answered in the previous practice run (`findLastAnswer`), skipping checks that said NOTHING NEW |
| `{myEmail}` | the signed-in person's own address (the clock looks it up for scheduled runs) |

With no answer yet, the step stops and says to approve the earlier step first (`{last}` is the exception: no earlier answer means "this is the first check"). In an Ask the AI step, `{answers}` (only steps before it count) and `{last}` reach the AI as `<data>` with angle brackets made harmless, never as part of the person's request.

## Watch mode and the quiet marker

A workflow whose first step has `how = "watch"` is a watch workflow (`isWatchPlan`; no extra column). In a watch run, an Ask the AI answer starting with `NOTHING NEW` (any capitals) ends the run: a `quiet: true` record is saved, no later step runs, the schedule status is `ok`, and the Runs page folds these into one line ("N quiet checks: nothing new"). In other workflows those words mean nothing special. A watch schedule due between 20:00 and 08:00 in the person's own time is claimed but not run. When a watch run finds something and leaves a write step waiting, `notifyWatch` may send ONE plain email to the person (never 20:00 to 08:00, at most 3 per local day, counted from `spoke: true` records). It holds no run details and no approving link.

## Where in the code

- `hushwork-app/lib/run-core.js` (`startPracticeRun`, `runAutomatically`, `resumeRun`, `writeGate`, `markPending`, `afterFailedWrite`, `changedSince`, `approve*`)
- `hushwork-app/lib/run-state.js`, `lib/run-engine.js`, `lib/run-answer.js`, `lib/watch-rules.js`, `lib/app-controls.js`
- `hushwork-app/lib/schedule-runner.js`, `lib/schedule-tick.js`, `lib/schedule-notify.js`
- `hushwork-app/components/app/ApproveSend.js`, `ResumeRun.js`, `RunsViewer.js`
- Tests: `lib/run-recovery.integration.test.js`, `lib/run-state.test.js`, `lib/watch-mode.test.js`, `lib/app-controls.test.js`
- Decisions: D-009, D-040, D-045, D-046, D-048
