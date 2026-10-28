# Runs and Approve

A run is one go at a workflow: pressing Run makes a practice run, and nothing real happens until you press Approve on the Runs page.

## Practice run versus real

When you press **Run** on the Workflows page, Hushwork makes a **practice run**. It lists every step and writes down what it would do. Nothing leaves Hushwork.

A step turns **real** when you press **Approve** on its card. The result is then saved right under the step as its own record.

## The Runs page

Open **Runs**. On the left is **Your runs**, newest first. Each shows a chip: **Needs approval** or **Completed**. Click one to see its steps. A step that is waiting says **Waiting**. A finished step shows **Done. Result:** with what happened.

At the top of a run is a **one-line summary**, made only from results Hushwork really saved. For example: "3 of 4 steps done: looked in Gmail and Stripe, sent 1 email." It counts steps, never invented items.

## The exact-words approval

Each step that can act has a card called **Needs your approval**. It shows the exact words: the email text and who gets it, the task title, the sheet row. Buttons are named for the job, like **Approve and send it** or **Approve and create the task**.

- A step that writes can be approved **only once per run**.
- If the words changed since you read them (for example the AI step ran again in another tab), nothing is sent. You read the new words first.
- Steps that only read, like **Approve and ask the AI**, also wait in the default Manual mode.

## "May or may not have happened"

Sometimes Hushwork starts a step but never sees it finish, for example when the connection drops. The card says **Not sure if this happened**, and the summary says the step "may or may not have happened".

Hushwork never sends such a step again by itself, because a double email is worse than a stopped run. Instead:

1. Look in the app. Is the email there? Is the task there?
2. Only if it was **not** done, press **It was not done, try again**.

## Continue from where it stopped

When a step fails, the run shows **It stopped here** with the reason. Fix the cause, then press **Approve** on that step again, or press **Continue from where it stopped**. Steps that are already done are skipped, so pressing it twice never sends anything twice.

## Auto mode

On the **Workflows** page, **How should a run work?** has two choices:

- **Manual** (the default): you approve each step.
- **Auto**: pressing the button (now **Run automatically**) does every step in order, without asking. That includes sending, adding rows and creating tasks. It stops at the first step that does not work.

The choice is remembered in this browser. Auto is off until you pick it.

> **Careful:** Auto mode approves for you. Use it only for workflows you trust.

## More to know

- **Delete this run** removes only the record, not anything it did.
- AI steps are limited to 15 a day (3 a minute), resetting at midnight UTC. See [Limits and numbers](/docs/limits).
- If the owner has paused Hushwork as a safety step, nothing is sent and the AI is not asked.

## Try it

1. Run any saved workflow, then open **Runs**.
2. Read the card. Find the exact words.
3. Press **Approve** on the first step and watch the result appear.

More on safety: [How Hushwork keeps you in control](/docs/safety).
