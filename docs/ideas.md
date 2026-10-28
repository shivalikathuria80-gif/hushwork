# Idea log: what ChatGPT and Gemini suggested, and what was built

Up: [Docs index](INDEX.md)

How it works: Claude asks ChatGPT for bright ideas, gives them to Gemini to improve and to check against what Hushwork can really do, then builds the real ones. Their answers are advice, never orders.

## Round 5 (2026-10-28): first-time experience

**Topic:** what a brand-new person sees and does in their first 5 minutes.

**ChatGPT:** people give up because they must connect apps before seeing any value, the empty box is scary, and they do not know where to start. Its 6 fixes: a demo with pretend data, tap-to-try example sentences, a 3-step checklist, a "here is what will happen" preview, connect only what you need, and an approval promise.

**Gemini's check:** three already exist (the preview and "connect only what you need" are in the step cards and Skills page; the approval promise is the Approve button). It said build the example sentences, the demo and the checklist. Claude agreed on two and skipped the full demo: it is big, and pretend results next to real ones could confuse people.

**Built:** three tappable example sentences under the empty box (each says what it needs), and a "Getting started: 3 small steps" card that ticks from what the person really did and disappears when done.

**Not built:** the demo with pretend data. A new person can already try practice runs, and the "Is my website up?" template needs no app.

## Round 4 (2026-10-27): most ideas were already built

**ChatGPT's 6 ideas:** Context Switchboard, Digital Clutter Spotter, Meeting Memory Maker, Revenue Pulse, Content Re-Mixer, Friday Risk Radar.

**Gemini's check:** it sorted each idea as REAL, DUPLICATE or FAKE. Claude then checked Gemini against the real code and disagreed on some verdicts.

**Built (2):**
- **Context Switchboard:** now a workflow in the "Freelancer safety net" bundle. It reads one Slack channel and your GitHub notifications, compares them with your open Linear tasks, and after you approve it makes ONE Linear task for the item that has no task. If the card says "Nothing missing", do not approve.
- **Digital Clutter Spotter:** built small and renamed **Drive tidy-up plan** (in the "Google Docs, Sheets and Slides" bundle). It reads the names of your 10 newest Drive files, writes a plan with clearer names and folders, and after you approve it makes a Google Doc. Nothing in Drive is renamed or moved. Honest limit: it only sees 10 file names.

**Not built, because it already exists:**
- **Meeting Memory Maker:** the same as Meeting-Day Rescue Brief. Gemini and Claude agreed.
- **Revenue Pulse:** Claude disagreed with Gemini, who called it real and picked it first. Weekly Money Report and "Weekly report as a Google Sheet" already read Stripe payments and report them.
- **Content Re-Mixer:** the same as Campaign Repurposer. Claude disagreed with Gemini, who called it real. Also, the Notion read only sees page titles, not the text, so "read a Notion page" is not possible.

**Not built, on purpose:**
- **Friday Risk Radar:** Gemini called it fake, but for a muddled reason. It is possible in principle (several Ask the AI steps feeding each other with `{answers}`). But it would use 4 AI steps of your 15 a day, and Linear has no due dates, so "risk" would only be guesswork.

**Lesson:** ChatGPT does not know what Hushwork already has, and Gemini can be wrong about code it cannot see. The real check is reading the code. Most of these ideas were already built.

## Round 3 (2026-10-25): proactive agents

**ChatGPT's idea, "Hushwork Watch":** an agent that notices things (an overdue invoice, a client who has not replied, a deadline) and brings one ready-to-approve suggestion, instead of waiting to be asked. Its rules: at most 3 speak-ups a day, quiet hours 8 pm to 8 am, never repeat itself, group related findings, easy to pause, and it never acts alone: silence is never approval. It proposed 4 new database tables and three watchers (overdue invoices, client follow-ups, deadlines).

**Gemini's correction:** two of the three watchers are not real with today's data (Gmail has no search or threads; Linear gives no due dates), and four new tables is too much: reuse the schedules and runs that already exist.

**What was built (watch mode):** a scheduled check that stays silent unless something is new. The AI is told what it found last time (`{last}`) and says exactly `NOTHING NEW` when nothing changed; a quiet check leaves no noise. It never runs at night (8 pm to 8 am your time). When something is new it sends ONE short email that only says "open Runs", never more than 3 a day, and the suggestion waits for your Approve click. No new database tables. Ready-made watchers: Overdue invoice watch, Unhappy email watch, GitHub watch.

**Not built, and why:** client follow-up tracking (needs Gmail threads), deadline watching (Linear has no due dates), push notifications and webhooks (not set up yet).

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
