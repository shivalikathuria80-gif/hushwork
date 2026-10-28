# Watch mode

Watch mode checks something on a schedule and stays quiet unless it finds something new.

## What it is

A normal schedule runs and leaves a record every time. A **watch** is a schedule that keeps silent when nothing has changed. It speaks up only when there is something new, and even then it only sends you a short email asking you to look.

Watch mode never acts alone. It does not send anything for you. Anything that writes waits for your Approve on the Runs page.

## Turn it on

There are two ways:

1. Turn on the **Watch for me** bundle on the **Skills** page. It saves three ready-made workflows: Overdue invoice watch, Unhappy email watch and GitHub watch. See [Skills and bundles](/docs/skills-and-bundles).
2. Or, in the Builder, set a Start step to **Keep watching: tell me only when something new shows up** and write the time in **When**, like `Every weekday at 9:00`. Press **Save**. It makes the same kind of real schedule as **On a schedule**. See [Schedules](/docs/schedules).

## How a check works

Each check is one run. Its **Ask the AI** step looks at one place, such as your Stripe invoices.

Two small words make the "quiet" part work:

- `{last}`: write it in the AI step's job. It hands the AI what **the same step** answered in the previous check, as plain data. The first check has no earlier answer, and the AI is told "This is the first check". This is not an error.
- **NOTHING NEW**: if the AI's answer starts with `NOTHING NEW` (in any capital letters), the run ends quietly right there. Nothing after that step runs and nothing is sent. In a normal workflow these words mean nothing special.

For example, an AI step might say: "List new urgent emails and who wrote. If nothing is new say exactly NOTHING NEW. `{last}`"

On the **Runs** page, quiet checks are hidden from the list. One line counts them, like "3 quiet checks: nothing new".

## The speaking rules

These rules are fixed:

- **Quiet hours: 8 pm to 8 am** in your own time. A watch that comes due at night is skipped. It costs nothing and sends nothing, and its next time moves on.
- **At most 3 speak-ups a day**, counted from your own midnight.

## The one plain email

When a check finds something new and a step is waiting for your Approve, and the rules allow it, Hushwork sends **one short email to you**. It is sent through your own Gmail (send) connection. It says that Hushwork noticed something in your workflow, and asks you to open the Runs page, read it and approve only what you want. It includes a link to the Runs page.

The email holds nothing from the run, and no link in it approves anything. Each email leaves a small "Told you" record, which is how the 3-a-day count is kept.

Without Gmail (send) connected, no email is sent. The run just waits on the Runs page. See the [Connections overview](/docs/connections).

## Good to know

- A new watch starts with **Let it write by itself** off. Leave it off so the email step waits for you.
- "Nothing new" is the AI's own judgement, compared with its last answer only.
- Each check uses one of your **15 AI steps a day**. The ready-made watches run once a day for this reason. You can write `Every hour`, but it will use your allowance quickly. See [Limits and numbers](/docs/limits).
- The Runs page shows the newest records, so a very frequent watch can fill it.

## Try it

1. Turn on **Watch for me** on the Skills page.
2. Open **GitHub watch** in the Builder and press **Save**.
3. Read the "Scheduled" message. Look at its schedule on **Workflows**.

> **Note:** Saving makes a real schedule that reads on its own. Press **Pause** in the Schedule panel on **Workflows** if you only wanted to look.
