# Skills, bundles and ready-made workflows

How Hushwork's ready-made workflows are defined in code, what turning one on does, which tests guard them, and how to add a new one.

Up: [Reference index](README.md)

## The three words

- **Skill**: one small thing Hushwork can do. In code it is one typed step (see `lib/steps.js`) plus plain words saying what it reads and what it writes. A skill adds no new power: it can only do what its step kind can do.
- **Bundle**: a named package of skills for one kind of work. It lists the app connections it needs and a few ready-made workflows.
- **Workflow (ready-made)**: an ordered list of skills (`flow`), a Start step, and a request sentence. It is built into normal steps and saved as a draft.

All of it is plain data in one file, `lib/skills/bundles.js`. It has no Next.js and no database, so the page, the server and the tests all load the same rules. At the time of writing there are 37 skills, 6 bundles and 21 workflows.

## What is in `bundles.js`

| Name | What it is |
| --- | --- |
| `step(kind, fields)` | Makes one step object: `{ kind, fields }`. |
| `skill(id, name, icon, about, { reads, writes, needs, alone }, step)` | Makes one skill. `needs` lists connection ids (for example `"stripe"`, `"google"`, `"gmailsend"`). `alone` gives plain words for when the skill is the only step (no AI answer exists to put in `{answers}`). |
| `SKILLS` | The array of all skills. |
| `BUNDLES` | The array of bundles. Each has `id`, `name`, `icon`, `blurb`, `connections`, `skills`, `workflows`. |
| `flow` | In a workflow: a list of skill ids in order. An entry may be `[skillId, { field: value }]` to change that skill's words for this workflow only (for example an email's `title`). |
| `start` | The workflow's Start step, for example `{ how: "schedule", when: "Every Friday at 10:00" }`. `how` is `manual`, `schedule` or `watch` here. |
| `schedule` | A suggestion only, `{ frequency, weekday, hour, minute }`. Turning a bundle on never creates a schedule. |

Helpers: `findSkill` and `findBundle` (unknown id gives `null`), `accessOf` (`write`, `read`, `think` or `control`), `buildWorkflow` (Start step, then each skill's step with the workflow's changes, checked by `checkSteps` in `lib/validate.js`; `null` if anything is invalid), `skillStart` (the Builder's `?skill=<id>` link) and `describeBundle` (what the Skills page shows).

## What turning a bundle on does

`lib/skills/enable.js`, `enableBundle()`, does exactly two things:

1. Saves a row in `enabled_bundles` (`supabase/skills.sql`) saying this person turned it on. The row is saved first, so a double click or a second tab finds it and does nothing (error 23505 means "already").
2. Saves each ready-made workflow as a **draft** in the person's own `workflows` list, skipping any whose name they already have.

It never connects an app, never makes a schedule and never runs anything. If saving the drafts fails, the row is removed again so the person can retry. Turning a bundle off (`disableBundle`) removes only the row; the saved workflows stay. It uses the person's own database client, so privacy rules apply. A person can have at most 20 bundles on (a database trigger, see [safety-and-limits.md](safety-and-limits.md)).

## The tests that guard them

`lib/skills/bundles.test.js` checks, among other things:

- Ids are unique and match `^[a-z][a-z0-9-]{1,39}$`. The list of bundle ids is pinned exactly.
- Every skill has an icon from `lib/ai/icon-names.js`, a name of at most 40 characters, and says what it reads or writes.
- A writing skill (`action`, `issue` or `row` step) says it waits for **Approve**; a reading skill is an Ask the AI step or the approval stop sign.
- **Connections are the union of skill needs.** A bundle's `connections` must be exactly the connections its skills need, each must exist, and every skill must be used by some workflow.
- **A writing workflow has an approval step first.** Before the first writing step there must be an `approve` step.
- **Emails go only to the person.** Every `gmail_send` has target `{myEmail}`. A bundle may only write an email to the person, one Notion page or one new Google file (sheet, slides, doc), and a new Google file has an empty target.
- **110-character limit.** The Ask the AI `task` box allows 110 characters (`lib/steps.js`). `{answers}` and `{last}` count too. A longer task makes `buildWorkflow` return `null`, which fails several tests. Watch workflows must end with `If nothing is new say exactly NOTHING NEW. {last}` and stay under 110.
- A suggested `schedule` must agree with the Start step's words (`parseWhen`). Workflow titles are unique (a saved copy is recognised by name) and a workflow has at most 12 steps.

Other tests: `enable.test.js`, `bundles.integration.test.js` (real server code, fake database), `lib/studio/capabilities.test.js` (every skill must be recognised by `skillOf`), `lib/watch-mode.test.js`.

## Every bundle and its workflows

| Bundle (id) | Needs | Workflows (Start) |
| --- | --- | --- |
| Finance and operations (`finance-ops`) | Stripe, Google, Gmail send | Invoice Chaser (Fri 10:00), Expense Categorizer (Mon 9:00), Weekly Money Report (Fri 16:00) |
| Marketing and growth (`marketing-growth`) | Gmail send, Notion | Campaign Repurposer (when asked), Weekly Post Ideas (Mon 9:00), Post Ideas to Notion (when asked) |
| Dev and admin (`dev-admin`) | Google, Linear, Gmail send, GitHub, PagerDuty, Slack | Client Project Triage (when asked), Reply Drafts (when asked), Slack Channel Brief (when asked), Weekly Dev Digest (Mon 9:00) |
| Freelancer safety net (`freelancer-safety-net`) | Slack, Linear, Google, Gmail send, GitHub | Scope Creep Alarm (when asked), Week Balancer (Mon 8:00), Meeting-Day Rescue Brief (weekdays 8:00), Context Switchboard (when asked) |
| Watch for me (`watchers`) | Stripe, Google, GitHub, Gmail send | Overdue invoice watch (weekdays 9:00), Unhappy email watch (weekdays 8:30), GitHub watch (daily 17:00); all three use the `watch` Start |
| Google Docs, Sheets and Slides (`google-creator`) | Stripe, Google, Sheets/Slides/Docs create | Weekly report as a Google Sheet (Fri 16:00), Proposal slides (when asked), Meeting notes doc (weekdays 8:00), Drive tidy-up plan (when asked) |

## Recipe: add a new ready-made workflow

1. **Reuse skills if you can.** Find the skills you need in `SKILLS`. Only add a new skill if no existing one fits.
2. **New skill (if needed):** add `skill("my-id", "Name", "IconName", "About text", { reads or writes, needs: [...] }, step("ai", { task, uses, address }))`. Keep `task` at 110 characters or fewer. A writing skill's `writes` text must contain the word `Approve`.
3. **Add the skill id** to the bundle's `skills` list, and add any new connection ids to the bundle's `connections` (the test wants the exact union).
4. **Add the workflow** to the bundle's `workflows`: unique `id` and `title`, `body`, `request`, `start`, optionally `schedule`, and `flow`. If anything writes, put `"ask-approval"` before it. Send email only through `email-me`.
5. **If it has a `schedule`,** make `start.when` words that `parseWhen` can read and that match the schedule numbers.
6. **Run the tests:** `npm test` (see [testing.md](testing.md)). Read the failing message; it names the workflow.
7. **Update the tests that count things** if they now disagree:
   - New bundle: the exact id list in `bundles.test.js` ("ids" test).
   - New workflow in `google-creator`: the title list and the `expected` map in the Google creator test in `bundles.test.js`.
   - New workflow in `watchers`: the title list and `expected` map in `lib/watch-mode.test.js`.
   - Other bundles pin only a few named workflows (Invoice Chaser, Client Project Triage, Campaign Repurposer, Context Switchboard).
8. Update the user docs page under `content/docs/` if it lists bundles (not verified).

## Where in the code

- `hushwork-app/lib/skills/bundles.js`, `enable.js`, `connection-status.js`
- `hushwork-app/lib/skills/bundles.test.js`, `bundles.integration.test.js`, `enable.test.js`
- `hushwork-app/lib/steps.js` (step kinds and the 110-character task limit), `lib/validate.js` (`checkSteps`)
- `hushwork-app/lib/studio/capabilities.js` (`skillOf`, `capabilityOf`)
- `hushwork-app/app/app/skills/page.js`, `lib/actions/skills.js`
- `supabase/skills.sql`
