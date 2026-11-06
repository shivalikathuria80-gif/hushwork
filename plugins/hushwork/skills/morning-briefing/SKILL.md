---
name: morning-briefing
description: One short morning summary of what needs the person today, from Hushwork Agent notes, Linear deadlines and steps waiting for approval. Use when the person asks for a briefing, "what needs me today", "catch me up", or starts the day.
---

# Morning briefing

Pull together what needs the person today into one short summary they can read in under a minute.

## Gather (call these in parallel)

1. **Hushwork Agent notes:** `agent_notes`. If it is off, skip it and add one line at the end: "Tip: turn on the Hushwork Agent in your workspace for daily notes."
2. **Waiting approvals:** `list_waiting`.
3. **Deadlines:** if a Linear tool is available in this conversation, get the person's open issues due today, tomorrow or overdue. If not, look for a Hushwork agent about Linear deadlines in `list_agents` and read its latest run with `get_run`. If neither exists, leave this section out. Don't mention that it's missing.
4. **Overnight problems:** `list_runs` with `since` set to yesterday at 00:00 in the person's time zone, and keep only runs whose outcome starts with "Stopped" or "Not sure".

## Write it

Use these headings, and drop any that are empty:

- **Today:** at most 3 items, most urgent first, merged from the agent notes and deadlines. One line each: what it is, and why today.
- **Waiting for your yes:** one line per waiting step: the agent's name and what it would do, in a few words (from `will_do`). Then: "Say 'approve 1' or 'show me 2' to go on."
- **Needs a look:** runs that stopped, with the reason in a few words.

Keep the whole briefing under 15 lines, and put no IDs in it.

## Approving from the briefing

If the person asks to approve something:
1. Show that step's full `will_do` text, word for word.
2. Ask: "Send this?" (or "Create this?" / "Add this row?", whichever fits).
3. Only after a clear yes, call `approve_step` with `run_id`, `step`, and `seen` set to the exact `will_do` text you showed.
4. If it answers that the words changed, show the new `will_do_now` and ask again. Never approve several steps on one "yes" unless the person said so for those exact steps.
