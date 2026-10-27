# Idea log: what ChatGPT and Gemini suggested, and what was built

Up: [Docs index](INDEX.md)

How it works: Claude asks ChatGPT for bright ideas, gives them to Gemini to improve and to check against what Hushwork can really do, then builds the real ones. Their answers are advice, never orders.

## Round 2 (2026-10-25): bright ideas for freelancers

**ChatGPT's 8 ideas:** Money Leak Finder, Scope Creep Alarm, Client Ghosting Detector, Client Handoff Machine, Deadline Collision Detector, Forgotten Billable Work Finder, Meeting-Day Rescue Brief, Warm Lead Revival Engine.

**Gemini's check:** it kept three (Scope Creep Alarm, Deadline Collision Detector, Meeting-Day Rescue Brief) and said the rest could not be built honestly. Claude disagreed on one point: Money Leak Finder already exists (Invoice Chaser reads Stripe invoices). Claude also found that Gemini's plan quietly assumed two things Hushwork could not do: one AI step looking at two places, and an AI step seeing what an earlier step found. Linear also gives no due dates, so "deadline" became "week balancing".

**Built:**
- **New ability:** an Ask the AI step can use what the Ask the AI steps before it found. Write `{answers}` in its job. The earlier answers are handed over as information only, never as part of the request.
- **New bundle "Freelancer safety net"** with three ready-made workflows:
  - **Scope Creep Alarm:** what the client asked for in one Slack channel, compared with open Linear tasks; emails you the requests that have no task.
  - **Week Balancer:** your busy and light days this week, matched to 3 open tasks; emailed on Monday morning.
  - **Meeting-Day Rescue Brief:** today's meetings plus urgent or unhappy emails, written as a 3-bullet prep card; emailed each weekday morning.

**Not built, and why:** Client Ghosting Detector and Warm Lead Revival (Gmail has no search and no threads here), Client Handoff Machine (Drive only gives 10 file names), Forgotten Billable Work Finder (needs time and billing records Hushwork does not have).

## Round 1 (2026-10-25): launch readiness

See [launch.md](launch.md) and decision D-045 in [DECISIONS.md](../DECISIONS.md).
