# How Hushwork makes and runs work: Workspace, Builder, Agents and the Hushwork Agent

Hushwork has four ways to get work done. Three of them make the same thing, a **workflow** (a saved list of steps in the `workflows` table). The fourth, the **Hushwork Agent**, is a different thing: it saves no steps at all, it only reads your apps and leaves notes.

> **One Builder, not two.** The code and older plans say "workflow builder" (for example the comment at the top of `lib/steps.js`, "workflow builder, phase B"). That is the same Builder page at `/app/builder`. There is no separate "regular" builder. What people often mean by the second one is the **Workspace** (`/app`), where you describe a chore in a sentence and get a plan. Both end in the same Builder and save the same kind of workflow.

## At a glance

| | Workspace | Builder | Agents page | Hushwork Agent |
| --- | --- | --- | --- | --- |
| Where | `/app` (home) | `/app/builder` | `/app/agents` | A card at the top of `/app` |
| You give it | One sentence | Blocks, by hand | One sentence | Nothing; you turn it on once |
| What it makes | A draft workflow (`kind = 'workflow'`) | A workflow (`kind = 'workflow'`) | A workflow with `kind = 'agent'` | Up to 3 notes (`agent_state` table) |
| You see the plan first? | Yes, a preview to save or edit | Yes, you build it | No, it saves and runs straight away | No plan; just notes |
| Runs when | When you press Run, or on its schedule | When you press Run, or on its schedule | Once right away, then Run now or its schedule | 9:00, 13:00 and 17:00 your time, plus Look now |
| Can it write (send, create)? | Yes, each write waits for Approve (Manual) or runs (Auto) | Same as Workspace | Writes wait for Approve; scheduled runs only write if you tick "Let it write by itself" | Never. Read only |
| Main code | `components/app/Workspace.js`, `Composer.js`, `lib/ai/preview.js` | `components/app/Builder.js`, `lib/step-rows.js`, `lib/steps.js` | `lib/agents/create.js`, `lib/actions/agents.js`, `components/app/AgentMaker.js` | `lib/agent/brain.js`, `check.js`, `runner.js`, `components/app/AgentPanel.js` |
| Setup SQL | `workflows.sql` | `workflows.sql` | `agents.sql` (adds the `kind` column) | `agent.sql` (the `agent_state` table) |

All paths are under `hushwork-app/` unless they start with `supabase/`.

## 1. The Workspace: describe a chore, review the plan

The home page asks "What should Hushwork take off your plate?". You type a chore in plain English (up to 2000 characters).

1. With **Write with AI** on, your text goes to the AI planner (Groq, `lib/ai/preview.js`), which writes typed steps. With it off, a keyword preview is made in your browser and nothing leaves it.
2. You see a **plan preview** card. Nothing has run.
3. You choose: **Save as draft**, **Open in the Builder**, **Edit steps**, **Edit request** or **Start over**.

The Workspace is for people who want to start from words but still look at the plan before saving. It has a limit of 20 AI plans a day (2 a minute). See `content/docs/workspace.md`.

## 2. The Builder: build a workflow block by block

The Builder is where any workflow is edited by hand. Everything ends here: a Workspace plan ("Open in the Builder"), a template, a skill, a saved workflow from the Workflows page, an agent from the Agents page, or an empty one from "New in the Builder".

- On the left are the **Blocks** (Start, Ask the AI, Linear, Web address, MCP server, Ask me first, Add a row, Create Linear task, Another app, Do in another app, Note) and **Skills**. On the right is **Your workflow**, up to 12 steps.
- Drag or press a block to add it, fill in its blanks, reorder with the arrows, and press **Save**.
- Each step has a **Workflow Studio** card (`StepStudioCard.js`): why the step is there, how it runs, its evidence (Planned until it has run), and a warning with **Connect** if its app is not connected.
- The Builder itself runs nothing. You run the workflow from the **Workflows** page, in **Manual** (you approve each writing step) or **Auto** (Hushwork does them all). A **Start** block set to "On a schedule" or "Keep watching" creates the schedule when you save.

The Builder is for people who want full control of every step. See `content/docs/builder.md`.

## 3. Agents: one sentence, saved and running

The Agents page (D-055) is the fastest path. You describe a task in one sentence and press **Create agent**. `createAgent` in `lib/agents/create.js` then does everything in one go:

1. **Plans it** with the same AI planner as the Workspace (keyword plan if the AI is off or fails), then passes the same strict check every saved plan passes (`cleanPlan`). A sentence with no real task is refused.
2. **Finds the "when"**. If your sentence says "every Monday at 9" or "every weekday at 17:30" and the plan's Start step does not already say when, the Start step becomes "On a schedule" with that time (`findWhen`, `withSentenceSchedule`).
3. **Saves it** as a row in `workflows` with `kind = 'agent'`.
4. **Schedules it** if there is a when, in your own time zone.
5. **Runs it once** right away (`startPracticeRun` with `auto: true, allowWrites: false`) and takes you to that run.

What an agent may do by itself: read, look things up and ask the AI. A step that writes (send an email, add a row, create a task) waits on the Runs page for your **Approve**, exactly like a Manual run. A scheduled agent only writes by itself after you tick **Let it write by itself** on its schedule.

An agent is a workflow underneath, so its name opens it in the Builder, and it uses the same run engine, write gates, schedules and limits. The `kind` can be set only when the row is added, never changed, so an agent stays an agent. Until `supabase/agents.sql` is run, the Agents page shows a setup message and everything else works as before.

## 4. The Hushwork Agent: always on, read only

The Hushwork Agent (D-053) is not a workflow and has no steps. It is a single helper per person that you turn on once from the **Your Hushwork Agent** card on the Workspace.

- **When it looks:** at 9:00, 13:00 and 17:00 your time (`CHECK_HOURS` in `lib/agent/brain.js`). The minute clock (`lib/schedule-tick.js`) calls `runDueAgents` in `lib/agent/runner.js`, which claims each due person so nobody is looked at twice, then calls `checkAgent`. **Look now** takes an extra look.
- **What it reads** (`lib/agent/check.js`): Google Calendar for the next 7 days, the sender and subject of your newest emails (never the body), your open Linear tasks (with due date and priority), and up to 3 Composio apps such as Stripe invoices, GitHub or Todoist.
- **What it writes:** only up to 3 notes on your Workspace, each with a title, a why and a ready request. The AI is told to use only facts from your apps and not to repeat notes you already saw.
- **Do this** puts the note's request into the Workspace box. From there it is a normal Workspace plan, and every writing step still waits for Approve. **Make it an agent** sends the note's request to `createAgent` (`lib/actions/agents.js`, then `lib/agents/create.js`): it is saved as an agent on the Agents page and run once, with writes waiting for Approve on the Runs page. **Dismiss** hides the note.
- **Email:** only when it finds something new, so at most 3 a day and never at night. The email only says to open your workspace.
- **Cost:** each look is one of your 15 AI steps a day.
- **Setup:** `supabase/agent.sql` (the `agent_state` table).

## How they differ, in one paragraph each

- **Workspace vs Builder:** same output, different start. The Workspace starts from words and shows you a plan; the Builder starts from blocks. The Workspace hands its plan to the Builder whenever you want to change it by hand.
- **Agents vs Workspace:** both start from one sentence and use the same planner. The Workspace stops at a preview and waits for you to save and run it. The Agents page skips the preview, saves the plan as an agent, picks up the schedule from your words, and runs it straight away. Writes still wait for Approve.
- **Agents vs the Hushwork Agent:** the names are close but they are different things. Agents on the Agents page are ones you make yourself, each for one task, and they can write after you approve. The Hushwork Agent is one always-on helper that only reads and only leaves notes; it never runs a workflow by itself. In the code, `lib/agents/` and `lib/actions/agents.js` are the Agents page, and `lib/agent/` and `lib/actions/agent.js` are the Hushwork Agent.

## How they connect

```
Hushwork Agent note --"Make it an agent"--> agent (a workflow, kind='agent'), run once
Hushwork Agent note --"Do this"--> Workspace box --> plan preview --"Open in the Builder"--> Builder --Save--> workflow
Agents page sentence ------------------------------> agent (a workflow, kind='agent') --click its name--> Builder
Template / Skill / Workflows page ----------------------------------------------------------------------> Builder
                                       every workflow and agent runs on the same engine (lib/run-core.js),
                                       with the same Approve gate, schedules and limits
```

## The rules every path shares

- Steps that send or create something are gated: Manual runs and agent runs wait for Approve; scheduled runs write only when you allowed it on that schedule.
- The same step check (`lib/validate.js`), the same 12-step limit, the same AI limits, and the same pause switch apply everywhere.
- Text that looks like a card number or secret key is never sent to the AI.

## Where to read more

- In-app docs (docs.hushwork.in): `content/docs/workspace.md`, `builder.md`, `agents.md`, `agent.md`, `runs-and-approvals.md`, `schedules.md`.
- Decisions: D-053 (Hushwork Agent) and D-055 (Agents) in `DECISIONS.md`.
- Technical reference: `docs/reference/run-model.md`, `schedules-and-watch.md`, `ai-planner.md`.
