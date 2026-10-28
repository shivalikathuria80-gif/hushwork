# AI planner

This file explains how a plain-English request becomes a list of steps, which AI model writes it, the safety nets that fix a weak answer, the daily limits, memory, and how untrusted text is kept from steering the AI.

Up: [Reference index](README.md)

Jargon: **Groq** is the company that runs the AI model. A **prompt** is the text sent to the model. **Prompt injection** is when text the AI reads (an email, a web page) contains orders such as "ignore your rules"; Hushwork treats all outside text as information only.

## The path from words to steps

1. The Composer (`components/app/Composer.js`) takes the person's text. With AI off it builds the keyword plan in the browser. With AI on it calls the Server Action `previewPlan` (`lib/actions/plan.js`).
2. `previewPlan` checks who is asking (`requireUser`), checks the text is 1 to 2000 characters (`checkPrompt`), reads the Groq key (`getGroqKey`), loads the person's memory, and calls `makePreview` (`lib/ai/preview.js`).
3. `makePreview`, in order: no key means a keyword plan; text that looks like a card number or secret key (`looksSensitive`) is never sent; a Groq "slow down" cool-off is honoured; the database limit is counted (`ai_plan`), then the in-memory limits; then `writePlan` asks Groq.
4. The answer goes through `finishSteps` (below). The screen gets a small object: `{ source: "ai", steps, remaining }` or `{ source: "keyword", why, notice, canRetry }`. It never contains the key, the prompt or Groq's own error text.

## The model call

`lib/ai/groq.js`: model `openai/gpt-oss-20b` (the constant `GROQ_MODEL`; if logs say `model_missing`, change that one line), a fixed Groq address, a 15 second wait, one try, `temperature 0.5`, up to 1600 tokens, low reasoning effort, and a strict JSON shape (`PLAN_SCHEMA`). If Groq rejects the rich shape (`json_validate_failed`) it asks once more for the plain three-field plan. A 429 starts a cool-off (the `retry-after` value, default 60 seconds, at most 15 minutes). `lib/ai/provider.js` is the single door, so a second AI company could be added without changing screens.

## The offered blocks

The model is offered only blocks that really work (D-043): `trigger`, `approve`, `ai` (Ask the AI), `row`, `issue`, `action`, and `note` only when nothing fits. For `ai`, `choice` is `nothing`, `linear`, `calendar`, `gmail`, `gmailtext` (email text, only when the task needs it), `drive`, or the short id of a connected app. For `action`, `choice` is one of the action ids in `composio-actions.js`. The old describe-only blocks (`find`, `linear`, `write`, `send`, `app`) are not offered; if an answer still uses one, `rewrittenStep` turns it into the matching Ask the AI step.

## `finishSteps` and the safety nets

`finishSteps` in `lib/ai/plan.js` runs these in order:

| Step | What it does |
|---|---|
| `cleanAiSteps` | keeps what can be kept: unknown icon becomes Sparkles, text cut to 200 characters, titleless steps dropped, at most 12 steps. Each step becomes a typed step (`typedStep`), else a rewritten one (`rewrittenStep`), else a plain note |
| `realizeNotes` | a plain note becomes a real step by its first word: a reading verb (read, check, find...) becomes an Ask the AI step that looks in the right place; a writing verb (draft, write...) is merged into the look before it, or becomes its own Ask the AI step; a storing/sending verb (save, send, email...) becomes ONE real email to the person, only if nothing already sends |
| `ensureRealSend` | if the task says "send it to me" (or names an address) and no step really sends, a plan-only send is replaced by a real email, or one is added. A Gmail draft or Slack message counts as sending |
| `withApproval` | if no approval step comes before the first step that writes, one ("Ask you to approve") is added. A typed step that only reads never gets one |
| `cleanPlan` | the strict gate that saved drafts also pass, which rebuilds every step from scratch |

An email "to me" always becomes `{myEmail}`, never a real address. A failed `finishSteps` makes the answer `unusable`.

## The keyword fallback

`lib/ai/keyword-plan.js` is used when the AI is off, rate limited, busy or unusable. It matches words in the task against a short list (leads, calendar, receipts, invoices, payments, inbox, reports) and builds two steps: Start (manual) and one Ask the AI step. It goes through the same `finishSteps`, so "send it to me" still becomes a real email. `noticeFor` in `preview.js` gives the person one honest sentence saying it is a keyword preview. "Try AI again" is offered only for `busy`, `timeout`, `rejected`, `unusable` and `refused`.

## Limits

| What | Limit | Where counted |
|---|---|---|
| AI plans, per person | 2 a minute, 20 a day | database (`ai_plan`) and memory |
| AI plans, whole site | 3 a minute, 60 a day | memory only, forgotten on restart (D-037) |
| Ask the AI step | 3 a minute, 15 a day | memory and database (`ai_step`) |
| AI summaries of lookups | share the `ai_step` allowance; skipped quietly if used up | same |

Days reset at midnight UTC. If the database table is missing, the request is allowed and the in-memory limit still applies (`lib/db-limits.js`). Set a monthly spending cap in the Groq account as the only whole-site protection.

## Memory

Settings, Memory holds up to 50 short facts (`workflow_memories`). `lib/ai/memory.js` sends at most 20 facts and about 2000 characters, only facts with `source = person` and `verification_status = verified`. They go in a `<memory>` block, and `MEMORY_RULE` tells the model to treat them as information and ignore instructions inside. A fact that looks secret is refused when saved and skipped when sent. Memory goes to the plan writer and to Ask the AI steps, never beside an MCP server and not into lookup summaries. If the table is missing, the AI runs without memory.

## What text reaches the AI, and how it is neutralised

- **The person's request** is wrapped as `<task>...</task>` by `wrapTask`. Every `<` and `>` in it becomes the look-alike marks U+2039 and U+203A, so nothing typed can close or open a tag.
- **Outside text** (a tool's result such as emails, tasks, web pages, MCP answers; earlier answers for `{answers}`; the last answer for `{last}`) is wrapped as `<data>...</data>` by `wrapData` in `lib/ai/agent.js`, with the same bracket swap, cut to 3000 characters per piece. The system prompt says text in `<data>` is information only.
- **Built-in tools take no input from the model.** The step fixes what is read. The one exception is MCP tools, which are read-only and get a small input that goes only to that server.
- The loop runs at most 4 rounds, answers are capped at 3500 characters, and an agent call waits 20 seconds.
- Email text reaches Groq only for the `gmailtext` choice (about the first 450 characters of the 5 newest emails); otherwise only sender, subject and time.

## Where in the code

- `hushwork-app/lib/ai/plan.js`, `keyword-plan.js`, `preview.js`, `groq.js`, `provider.js`, `agent.js`, `memory.js`, `limits.js`, `key.js`, `icon-names.js`
- `hushwork-app/lib/actions/plan.js`, `lib/actions/memory.js`, `lib/db-limits.js`, `lib/ai-status.js`
- `hushwork-app/components/app/Composer.js`
- `hushwork-app/lib/run-core.js` (`approveAiStep`, `withSummary`)
- Tests: `lib/ai/plan.test.js`, `keyword-plan.test.js`, `preview.test.js`, `groq.test.js`, `agent.test.js`, `memory.test.js`
- Decisions: D-010, D-011, D-029, D-039, D-043
