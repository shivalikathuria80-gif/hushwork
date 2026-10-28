# Schedules

A schedule runs a workflow by itself at a time you choose, and it only writes things if you tick one box.

## The Start step choices

Every workflow begins with a **Start** step. Its choices are:

- **When I ask**: runs only when you press Run.
- **On a schedule**: runs at the time you write in the **When** box.
- **Keep watching: tell me only when something new shows up**: a quieter kind of schedule. See [Watch mode](/docs/watch-mode).
- **When an email arrives** and **When a new lead arrives**: Not available yet. They are in the list, but nothing starts a workflow from them. Only a schedule or a watch runs by itself.

## Make a schedule

1. In the Builder, set the Start step to **On a schedule**.
2. In **When**, write the time like you would say it. For example `Every weekday at 17:30`, `Every Monday at 9`, `Daily at 5pm` or `Every hour`.
3. Press **Save**. The message tells you the schedule was made, for example "Scheduled: Every weekday at 17:30 (your time)."

If Hushwork cannot read the time, it says so and schedules nothing. Monthly schedules are not supported.

You can also use the **Schedule** panel under a workflow on the **Workflows** page. Press **Schedule it**, choose **How often** (every hour, day, weekday or week), the time and the day, and press **Save schedule**. **Pause** and **Resume** stop and restart it, and **Remove schedule** deletes it. You can have up to **10 schedules**.

## Times and the clock

Times are in **your own time**. Your browser tells Hushwork how far you are from UTC, and it saves that. If your country changes its clocks, a schedule can be an hour off until you save it again.

Hushwork's clock looks for due schedules **every minute**. If Hushwork was off for a while, an overdue schedule runs **once** and then waits for its next normal time. It does not catch up.

The panel shows **Next run** and **Last run**, with "it worked", "it stopped at a step that needs attention" or "it did not work".

## What a scheduled run does

A scheduled run works like Auto mode, as you:

- **Reading steps** (looking in an app, asking the AI) run by themselves. The usual daily limits still apply.
- **Writing steps** (send an email, create a task, add a row) are **skipped** unless you ticked **Let it write by itself**. A new schedule has it off.
- If it is ticked, those steps happen while you are away, with no Approve click.

> **Careful:** A step called **Ask me first** is only a marker. It does not stop a scheduled run. The switch that protects you is **Let it write by itself**.

Skipped writing steps stay marked **Waiting** on the **Runs** page. Open the run, read the exact words and press **Approve** when you are ready. See [Runs and Approve](/docs/runs-and-approvals).

## When a schedule has trouble

If a step fails, or Hushwork is not sure a step finished, the run stops. You get **one email** saying the workflow "stopped at a step that needs you" or "could not run", with a link to the Runs page. It names the workflow only and holds none of your results.

You get that email once each time a schedule starts having trouble, not every time it runs. It needs **Gmail (send)** connected. See the [Connections overview](/docs/connections).

## Try it

1. Open a template such as **Receipts and invoices I saved, by email**.
2. Press **Save**. Read the "Scheduled" message.
3. On **Workflows**, look at the Schedule panel and its next run time.
4. Leave **Let it write by itself** unticked while you learn.
5. Press **Pause** if you only wanted to look. A saved schedule really runs.
