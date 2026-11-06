---
name: weekly-review
description: Summarize what the person's Hushwork agents did this week, what failed, and what is still waiting for approval. Use when the person asks for a weekly review, "how did my agents do", "what ran this week", or a Friday recap.
---

# Weekly review

A short, honest review of the person's Hushwork week.

## Gather

1. `list_agents`: names, schedules, and whether each has steps waiting.
2. `list_runs` with `since` set to 7 days ago and `limit` 25. If 25 runs come back, say the review covers the latest 25.
3. For each run whose outcome starts with "Stopped" or "Not sure", call `get_run` to find the step and the reason.
4. `list_waiting`.

## Write it

- **The week in one line:** how many runs, how many completed, how many stopped, and how many steps are waiting.
- **What got done:** per agent, one line on what it actually did (from the run outcomes and done steps' results). Combine repeated runs: "Morning briefing ran 5 times, all completed."
- **What went wrong:** per stopped run, the agent, the step, and the reason in plain words, plus the likely fix (for example "Google sign-in expired: reconnect Google on the Connections page"). Don't guess beyond what the reason says.
- **Waiting for you:** the waiting steps, each with a few words from `will_do`. Offer: "Say 'review the waiting ones' to go through them."
- **Quiet agents:** scheduled agents with no run this week, if any. They may be paused.
- **One suggestion:** at most one, only if the data supports it. For example, an agent that stops on the same step every time, or one whose drafts have waited for days.

Keep it under 20 lines, with no IDs.

## Going through the waiting steps

For each one: show the full `will_do` text, then ask "Approve, turn down, or skip?"
- Approve: call `approve_step` with `seen` set to the exact text shown.
- Turn down: call `reject_step`, with their reason if they gave one.
- Skip: leave it.
If `approve_step` says the words changed, show `will_do_now` and ask again.
