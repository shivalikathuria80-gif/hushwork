# Skills and bundles

A skill is one small thing Hushwork can do, and a bundle is a package of skills for one kind of work, with ready-made workflows.

## Skills and bundles

A **skill** is one step with plain words about what it reads and what it writes. For example, "Email me the result" sends one email to you. A skill adds no new power: reading skills only read, and writing skills still wait for your Approve.

A **bundle** groups skills, lists the apps it needs, and comes with ready-made workflows. Open the **Skills** page to see what every skill reads and writes, and which apps are connected.

## What "Turn on" does

> **Note:** **Turn on** saves the bundle's workflows as drafts in **Workflows**. It connects no app, makes no schedule and runs nothing.

- A workflow whose name you already have is skipped.
- **Turn off** only removes the switch. The workflows stay.
- You can have up to 20 bundles on.
- The times below are only suggestions. If you open a workflow in the Builder and press Save, a Start step that says "On a schedule" or "Keep watching" makes a real schedule, with writing switched off. See [Schedules](/docs/schedules).

## Every bundle and workflow

There are 6 bundles and 21 workflows. Every email they send goes to you, not to anyone else.

### Finance and operations

Needs Stripe, Google and Gmail (send).

- **Invoice Chaser:** Fridays at 10:00, finds unpaid Stripe invoices, drafts a reminder and emails you the lot.
- **Expense Categorizer:** Mondays at 9:00, emails which recent Drive files look like receipts.
- **Weekly Money Report:** Fridays at 16:00, sums up your Stripe payments.

### Marketing and growth

Needs Gmail (send) and Notion.

- **Campaign Repurposer:** when you ask, turns one blog post into takeaways, 5 social posts and a newsletter draft. Put the post's address in both AI steps first.
- **Weekly Post Ideas:** Mondays at 9:00, emails five post ideas.
- **Post Ideas to Notion:** when you ask, writes five ideas on a new Notion page. Change the page id first.

### Dev and admin

Needs Google, Linear, Gmail (send), GitHub, PagerDuty and Slack.

- **Client Project Triage:** when you ask, spots urgent client emails, sums up what is blocked in Linear, creates one Linear task and emails a brief.
- **Reply Drafts:** when you ask, writes short replies to your 5 newest emails. Their opening text goes to the AI (Groq).
- **Slack Channel Brief:** when you ask, reads one Slack channel and emails a brief. Change the channel name first.
- **Weekly Dev Digest:** Mondays at 9:00, one email of GitHub notifications and PagerDuty incidents.

### Freelancer safety net

Needs Slack, Linear, Google, Gmail (send) and GitHub.

- **Scope Creep Alarm:** when you ask, compares what a client asked for in Slack with your Linear tasks and emails requests with no task.
- **Week Balancer:** Mondays at 8:00, matches 3 tasks to your lightest days.
- **Meeting-Day Rescue Brief:** weekdays at 8:00, emails a 3-bullet prep card.
- **Context Switchboard:** when you ask, reads Slack and GitHub and, after you approve, creates one Linear task for the item with no task.

### Watch for me

Needs Stripe, Google, GitHub and Gmail (send). See [Watch mode](/docs/watch-mode).

- **Overdue invoice watch:** weekdays at 9:00, quiet unless an invoice is newly overdue.
- **Unhappy email watch:** weekdays at 8:30, quiet unless a new urgent or unhappy email arrives.
- **GitHub watch:** every day at 17:00, quiet unless something new needs action.

### Google Docs, Sheets and Slides

Needs Stripe, Google, and Google Sheets, Slides and Docs (create).

- **Weekly report as a Google Sheet:** Fridays at 16:00, makes a new Sheet of your Stripe payments after you approve.
- **Proposal slides:** when you ask, writes a 5-slide outline from your brief, then makes a Slides deck.
- **Meeting notes doc:** weekdays at 8:00, makes a Doc with notes for each meeting today.
- **Drive tidy-up plan:** when you ask, makes a Doc with a plan for your 10 newest files. Nothing is renamed or moved.
