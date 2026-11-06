---
name: make-agent
description: Turn a plain request like "every Monday, sum up my calendar" into a Hushwork agent, with a schedule if the person gave a time. Use when the person asks to automate something, make an agent, or have something happen every day, week or hour.
---

# Make a Hushwork agent

Turn what the person wants into one clear sentence, save it as a Hushwork agent with the `create_agent` tool, and tell them what it will do.

## Steps

1. **Write the sentence.** One plain sentence that says what to look at, what to do with it, and where the result goes. Keep the person's own words. Good shapes:
   - "Every Monday at 9, sum up my calendar for the week and email it to me."
   - "Every weekday at 17:30, list my Linear tasks due tomorrow and post them in Slack #team."
   - "Every day at 8, check my inbox for invoices and add each one to my Invoices sheet."
   If they gave no time, ask once whether it should run on a schedule. A sentence without a time makes an agent they run on demand.
2. **Work out their time zone** as minutes east of UTC (India is 330, London in winter is 0, New York in winter is -300). Use what you know from the conversation; if you don't know it, ask. Without it, "at 9" means 9:00 UTC.
3. **Confirm before saving.** Show the sentence and the time zone and ask "Shall I create this agent?" Create it only after a clear yes.
4. **Call `create_agent`** with `sentence` and `tz_offset_minutes`.
5. **Report back in a few lines:**
   - its name, and its schedule if it has one;
   - what its first run did (`first_run`);
   - if `steps_that_wait_for_approval` is more than 0: "Anything it sends or creates waits for your approval. Say 'show what's waiting' when you're ready."
   - any `notice` it returned (for example that the AI planner was off and a simpler plan was used).

## Rules

- Never call `approve_step` as part of making an agent. The first run reads and thinks only; anything that sends or creates waits.
- A new schedule never sends by itself. If the person wants it to, tell them to tick "Let it write by itself" on the agent's card in Hushwork. You cannot change that from here, on purpose.
- If `create_agent` returns an error, say it plainly and suggest one rewording. Don't retry silently more than once.
