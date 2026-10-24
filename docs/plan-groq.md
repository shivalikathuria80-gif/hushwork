# Plan amendment: Groq instead of Anthropic for "Preview plan"

> **Historical document.** Written for an earlier slice of the project and not kept up to date. For how Hushwork works today read [`PROJECT.md`](../PROJECT.md) and [`DECISIONS.md`](../DECISIONS.md).

Written 2026-10-17 (architect). Local only (http://localhost:3100), port 3000 never touched. No key exists and **no AI API was called**: every Groq fact was read from Groq's own pages on **2026-10-17** (curl, text only, nothing saved in the repo). UNVERIFIED marks what cannot be confirmed without a key or a sign-in. **Where this file and `docs/plan-next.md` (sections 1 to 4, 6, 8 T7 to T10, 9, 10) or `docs/design-next.md` section 3 disagree about the AI provider, this file wins. Everything else in them stands** (safety layers, validation chain, UI states, fallback to the keyword preview, no SDK, no tools, no SQL now).

**Words (one plain line each)**

| Word | Meaning |
|---|---|
| Groq | A company that runs open AI models on its own fast chips and sells access through an API (a web address our server sends requests to). |
| Model id | The exact name sent with each request, like `openai/gpt-oss-20b`. Groq retires old ids, so the id lives in one constant. |
| Strict JSON schema | We hand the AI a shape; "strict" makes Groq force the answer into exactly that shape. |
| 429 / retry-after | The "slow down" status a service sends when a limit is used up; `retry-after` is how many seconds to wait. |
| RPM, RPD, TPM, TPD | Requests per minute / day and tokens per minute / day (a token is about 3 to 4 letters). |
| Zero Data Retention (ZDR) | A Groq setting that stops Groq keeping your requests even for troubleshooting. |
| Project (Groq console) | A labelled bucket inside your Groq account with its own keys, limits and allowed models. |
| Provider seam | One small function, `writePlan(text)`; which AI company answers is hidden behind it. |

## 1. Groq facts (sources S1 to S17 are listed at the end of this section; all read 2026-10-17)

| Topic | Fact |
|---|---|
| Endpoint, auth | `POST https://api.groq.com/openai/v1/chat/completions`, headers `Authorization: Bearer <key>` and `Content-Type: application/json` (S3, S5 curl examples). The URL is a constant in our code. Keys start `gsk_` (S15 example). |
| Reply shape | `choices[0].message.content` (the JSON text), `choices[0].finish_reason` (`stop`, `length`, `tool_calls`), `choices[0].message.refusal` (string or null), `usage.prompt_tokens`, `usage.completion_tokens`, `usage.completion_tokens_details.reasoning_tokens` (S4). |
| Token field | `max_completion_tokens`; `max_tokens` is marked deprecated (S4). `reasoning_effort` for gpt-oss accepts `low`, `medium`, `high` (default medium); other values give 400 (S4, S5). |
| System prompt | Groq's reasoning page tells reasoning models to avoid system prompts (S5 table), but its own gpt-oss structured-output and caching examples use one (S3, S13). We use system + user. UNVERIFIED live; if plans ignore the rules, merge both into the user message. |
| Strict mode | Supported on `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3.8-27b` (S3): constrained decoding, so the output always matches the schema. Rules: every property in `required`, `additionalProperties: false` on every object, `enum` allowed. `minItems`/`maxItems` are **not listed** as supported, so we do not use them (the 12-step cap stays in our code, as before). Streaming and tools are not supported together with it (we use neither). |
| Free plan limits (org-wide, per model) | gpt-oss-20b and gpt-oss-120b: **30 RPM, 1K RPD, 8K TPM, 200K TPD**. Developer plan: 1K RPM, 500K RPD, 250K TPM, TPD not shown (S2). Limits apply to the whole Groq organization, not per user, and cached (re-used) prompt tokens are not counted (S2, S13). Day-reset time: not stated (UNVERIFIED). Whether `max_completion_tokens` is reserved against TPM up front: not stated (UNVERIFIED; we design as if it is). |
| On 429 | Status 429 with header `retry-after` (seconds, set only on 429). Headers `x-ratelimit-remaining-requests` (per day) and `x-ratelimit-remaining-tokens` (per minute) are always sent (S2). |
| Other errors | 400, 401, 403, 404, 413, 422 (a valid request that could not be followed, which Groq ties to model errors), 429, 498 (flex tier only), 500, 502, 503; body `{error:{message,type}}`; server errors are not billed (S14). A 400 structured-output failure can echo the model's text, so we never log or return the error body. |
| Paid pricing | Per 1M tokens, gpt-oss-20b **$0.075 in / $0.30 out**, cached input $0.037 (S16); gpt-oss-120b $0.15 / $0.60; qwen3.8-27b $0.80 / $4.00 (S1). `groq.com/pricing` now redirects to the home page, so S1/S16 are the price source. Caching is automatic for gpt-oss, no code (S13): our fixed system prompt goes first so it can be cached; we do not count on it. |
| Data handling | By default Groq does not keep customer data from inference requests; it may temporarily log inputs and outputs only to troubleshoot errors or investigate abuse, for up to 30 days; **any customer may turn on ZDR** in Data Controls (https://console.groq.com/settings/data-controls); retained data sits in Google Cloud buckets in the United States (S6). Services Agreement 4.2 (modified June 22, 2026): Groq may not use inputs or outputs to train or fine-tune any models unless the customer permits it or instructs it (S7). Groq's general privacy policy says it does not cover API customer data (it points to the Services Agreement and DPA). I found no sentence that treats free and paid differently (unlike Google, section 5). Where inference itself runs: not stated (UNVERIFIED), so we claim nothing. |
| Deprecations | Groq announces by email and on S8, with a shutdown date and a named replacement; requests to a retired id return errors (S8). **2026 so far:** kimi-k2 (Apr 15), llama-4-maverick (Mar 9), llama-guard-4 (Mar 5), qwen3-32b and llama-4-scout (Jul 17), llama-3.1-8b and llama-3.3-70b (Aug 16), qwen3.6-27b (Sep 14), compound (Sep 21). Notice ranged from about 17 days to 2 months. Preview models can be dropped at short notice (S1); gpt-oss-20b is listed **Production** and is Groq's named replacement for llama-3.1-8b (S1, S8). Expect an id change within months, not years. |
| Account, keys | Sign in or create an account at https://console.groq.com (the owner does this). Keys page https://console.groq.com/keys has a **Create API Key** button and a table with Name, Secret Key, Created, Last Used, Usage (24hrs) (S17, headings only). Whether a key can have an expiry or its own limits, and whether the secret is shown once: not documented (UNVERIFIED; treat it as shown once). Limits live on **projects**: pick a project (top-left "Organization / Projects"), keys created while it is selected belong to it, project rate limits can be set at or below the org's, and **Only Allow** can restrict a project to chosen models, others get 403 (S11, S12). |
| Spend limits | Need the **paid** Developer tier: Settings > Billing > Limits (https://console.groq.com/settings/billing/limits) > Add Limit (monthly USD) + alerts; tracking lags 10 to 15 minutes; at the limit calls return **400 code `blocked_api_access`**; one limit for the whole org, monthly only (S9). The free tier needs a payment method only to upgrade, so it cannot bill (S10). Billing is progressive ($1, $10, $100, ...; different for India) (S10). Usage: https://console.groq.com/dashboard/usage. |

Sources: S1 /docs/models, S2 /docs/rate-limits, S3 /docs/structured-outputs, S4 /docs/api-reference, S5 /docs/reasoning, S6 /docs/your-data, S7 /docs/legal/services-agreement, S8 /docs/deprecations, S9 /docs/spend-limits, S10 /docs/billing-faqs, S11 /docs/projects, S12 /docs/model-permissions, S13 /docs/prompt-caching, S14 /docs/errors, S15 /docs/production-readiness/security-onboarding, S16 /docs/model/openai/gpt-oss-20b, S17 /keys (all under https://console.groq.com).

**Model choice**

| Id | Context / max out | Speed | Price in / out per 1M | Strict | Status |
|---|---|---|---|---|---|
| **`openai/gpt-oss-20b` (DEFAULT)** | 131,072 / 65,536 | ~1000 tps | $0.075 / $0.30 | yes | Production |
| `openai/gpt-oss-120b` (one-line upgrade) | 131,072 / 65,536 | ~500 tps | $0.15 / $0.60 | yes | Production |
| `qwen/qwen3.8-27b` | 131,072 / 16,384 | ~450 tps | $0.80 / $4.00 | yes | Preview, not chosen |

20b is the cheapest and fastest, Production not Preview, and strict mode makes the answer's *shape* certain whatever the model size. Plan *quality* is the only reason to go up, and I cannot test it without a key (UNVERIFIED): after the key is added, read plans for the five recipe tasks; if they are poor, change `GROQ_MODEL` to the 120b (same free limits, 2x price).

## 2. Replacement AI core (plan-next section 3 safety goals unchanged)

- **Plain `fetch`, no SDK.** `groq-sdk` 1.6.0 exists (0 dependencies, published 2026-08-26) but retries 2 times by default, including on 429 and 5xx (its README): one press could become 3 calls against an 8K tokens-per-minute budget. Our call is ~30 lines. Revisit only for streaming or tools.
- **Key:** `GROQ_API_KEY`, read only in `lib/ai/key.js` (`import "server-only"`), function `getGroqKey()`: trimmed, read at request time, never `NEXT_PUBLIC_`, never logged, returned or put in a prompt. Blank means AI off.
- **Files** (`.js`, relative imports ending `.js`, no Next imports so `node --test` loads them): `plan.js` keeps everything provider-neutral (system prompt, `PLAN_SCHEMA`, `cleanAiSteps`, `withApproval`, `looksSensitive`, `AI_LIMITS`); **new `groq.js`** holds `GROQ_MODEL`, `GROQ_URL`, and `writeWithGroq(text, { groqKey, fetchImpl })` (what `requestAiPlan` was); **new `provider.js`** holds the seam. `limits.js`, `preview.js`, `icon-names.js` keep their jobs; `preview.js` calls `writePlan` instead of `requestAiPlan`.
- **Request body** (one call, no retry, `AbortSignal.timeout(15000)`; at about 1000 tokens a second an answer should take roughly 1 to 3 s (my estimate), so 15 s is generous):
```js
{ model: GROQ_MODEL,                       // "openai/gpt-oss-20b": the ONLY place the id is written
  messages: [ { role: "system", content: SYSTEM_PROMPT },          // fixed text first (cache-friendly)
              { role: "user",   content: `<task>\n${text}\n</task>` } ],  // the person's words, as data, last
  temperature: 0.5,                        // inside Groq's advised 0.5 to 0.7 for reasoning models
  max_completion_tokens: 1200,             // 8 steps need ~350; the rest is room for low-effort reasoning
  reasoning_effort: "low",
  response_format: { type: "json_schema", json_schema: { name: "workflow_plan", strict: true, schema: PLAN_SCHEMA } } }
```
  `PLAN_SCHEMA` is plan-next's object `{steps:[{icon,title,detail}]}` with `icon` an `enum` from `lib/ai/icon-names.js` (the 32 names that exist in `components/icons.js`), all three fields in `required`, `additionalProperties:false` on both objects, and **no `minItems`/`maxItems`**. Not sent: `tools`, `stream`, `max_tokens`, `user`, `include_reasoning`, `seed`, `service_tier`.
- **System prompt:** plan-next's text, unchanged, plus one sentence at the end: `Reply only with the JSON object.` (The icon list is still inserted from `icon-names.js`.)
- **Result parsing:** `finish_reason === "length"` or empty `content` = unusable; `message.refusal` set = refused; else `JSON.parse(content)`, then the chain stays: `cleanAiSteps` (lenient) > `withApproval` > `cleanPlan` (strict gate). Result shape is exactly what the Server Action already expects: `{ ok: true, steps, usage:{in,out,reasoning} }` or `{ ok: false, why, retryAfter? }` with `why` in `off | auth | busy | timeout | rejected | unusable | refused | model_missing`.
- **Errors to plain sentences** (all start "Made by simple keyword matching."; only the changed rows of plan-next's table are listed, the others stay):

| Situation | Sentence added |
|---|---|
| 401, 403 | AI planning is not working right now. (log status; owner checks key and project permissions) |
| 404, or 400 whose `type` says the model does not exist | AI planning is not working right now. (log `why=model_missing model=<id>`: this is the "model retired" alarm) |
| 429 | The AI is busy right now. Try again in a minute. (read `retry-after`; **keep a cool-off**: no call to Groq until `retry-after` seconds pass, capped at 15 minutes; answered locally with the same sentence) |
| 500, 502, 503, network error | The AI is busy or unavailable right now. |
| 400 (includes `blocked_api_access` on a paid account), 413 | The AI could not take that request right now. |
| 422, `length`, bad JSON, 0 usable steps | The AI's answer could not be used. |
| `refusal` set | The AI would not write a plan for that text. |
| timeout (15 s) | The AI took too long to answer. |

- **Logging:** one line each, numbers and codes only: `ai-plan ok in=812 out=300 reasoning=120 ms=1400` / `ai-plan failed why=busy status=429 retry_after=20`. Never the prompt, reply, key, email, id, or Groq's error `message` (it can quote the model's text).
- **Secret guard** gains `gsk_` and `AIza` (Google keys, for a later Gemini) in the token-looking pattern.
- **The seam** (`lib/ai/provider.js`, the page and the Server Action never learn which company answered):
```js
import { writeWithGroq } from "./groq.js";
const PROVIDERS = [writeWithGroq];                 // later: [writeWithGroq, writeWithGemini]
const TROUBLE = ["busy", "timeout", "model_missing"]; // only these fall through to the next provider
export async function writePlan(text, keys) {      // keys = { groqKey, fetchImpl }, later + geminiKey
  let last = { ok: false, why: "off" };
  for (const write of PROVIDERS) {
    last = await write(text, keys);
    if (last.ok || !TROUBLE.includes(last.why)) return last;
  }
  return last;
}
```
  Adding a provider = one new file with the same return shape + one array entry + its env name; **no UI change**. Not built now.

## 3. Limits under Groq's free tier
Per plan I assume **800 tokens in and 500 out typical** (prompt+schema about 650, task about 150; output includes low-effort reasoning), **1,150 in and 1,200 out worst** (2,000-character task, whole cap used). Re-measure from the logged `in/out/reasoning` after the first real calls.

| Limit | Groq free | Ours (constants in `plan.js`) | Our load on Groq's limit |
|---|---|---|---|
| Per person per minute | n/a | **2** | n/a |
| Everyone per minute (new) | 8K TPM, 30 RPM | **3** | typical 3 x 1,300 = 3.9K (49%); if max tokens are reserved 3 x 2,000 = 6K (75%); RPM 10% |
| Per person per UTC day | n/a | **20** | n/a |
| Everyone per UTC day | 200K TPD, 1K RPD | **60** | typical 78K (39%); worst 60 x 2,350 = 141K (70%); RPD 6% |

So our limiter fires first in normal use. plan-next's 5 / 30 / 200 would have gone over the 200K tokens-per-day budget (200 x 1,300 = 260K) and nearly used all of the 8K per minute, so they are replaced. **The limits are org-wide:** anything else using the same Groq organization (the owner's other apps) spends the same budget. The UI's "{remaining} of {limit} AI plans left today" uses limit **20**. Sentences for our own limits stay as in plan-next, with the global-minute case reusing "AI planning has reached its limit for now. Try again in a minute." **When Groq itself returns 429** the page shows the keyword preview plus "The AI is busy right now. Try again in a minute." and "Try AI again" appears after the cool-off. **If the owner upgrades** to the Developer plan: set 5 per person per minute, 30 per person per day, 30 per minute and 500 per day for everyone (worst case about 500 x $0.00045 = $0.22 a day), and set a Groq spend limit. **Cost per 1,000 plans, paid tier:** typical about **$0.21** (800 in, 500 out), worst about **$0.45**; on the free tier **$0**.

## 4. Exact replacements
**UI copy** (the label must be true: an AI model run by Groq). Apply in `design-next.md` 3.3 and its sketch, `Composer.js`, `AiNote.js`:

| Old text | New text |
|---|---|
| Switch "Write with Claude" | "Write with AI" |
| "Your text is sent to Anthropic to write the plan." | "Your text is sent to Groq to write the plan." |
| "Claude is writing your plan." (card and status) | "The AI is writing your plan." |
| h2 "Plan written by Claude. Nothing will run." | "Plan written by AI. Nothing will run." |
| "Claude can get things wrong. Read each step before you save." | "AI can get things wrong. Read each step before you save." |
| "Try Claude again" | "Try AI again" |
| "Claude's reply could not be used, so this is a keyword preview." | "The AI's reply could not be used, so this is a keyword preview." |
| AiNote on: "...sent to Anthropic's Claude to write the plan. Nothing runs." | "AI planning is on. When you press the arrow, your task text is sent to Groq, which runs an AI model to write the plan. Nothing runs." |
| Source line "Written by Claude, an AI from Anthropic. Read each step before you rely on it." | "Written by an AI model run by Groq. Read each step before you rely on it." |
| design-next 8.1 and 8.3 "written by Claude" | "written by AI" |
| Unchanged (already neutral) | "We could not reach the AI, so this is a keyword preview.", AiNote off, "No AI is used...", keyword heading, "Show keyword preview instead" |

Also in plan-next: every "Claude", "Anthropic", `ANTHROPIC_API_KEY`, `claude-haiku-5-5`, `sk-ant-`, "Messages API", "workspace" and "request_id" mention is replaced by the Groq equivalents in this file; stale older mentions (low priority, change when touching those files): `PLAN.md` lines 337, 388, 395, `docs/spec.md` lines 42 and 72, `docs/plan.md` line 6, `PRODUCT.md` line 34.

**Privacy page (`app/privacy/page.js`)**, replacing the "No AI" section; every sentence is from Groq's pages (S6, S7), dated, and nothing more:
1. AI planning is optional and off unless a key is set. When off, task text goes only to our server to make the keyword preview.
2. When on, **only the task text** is sent (through our server) to Groq, which runs an AI model (currently `openai/gpt-oss-20b`, an open-weight model from OpenAI) to write the plan. No email, name, account id or other drafts. Plans can be wrong and are shown as text; nothing runs.
3. Groq says it does not keep inference requests by default, may log them for up to 30 days to fix errors or investigate abuse, and keeps any retained data in the United States (https://console.groq.com/docs/your-data, read 2026-10-17). **Pick the variant that is true on the day:** (A) owner switched ZDR on: add "Zero Data Retention is switched on for our account." (B) not on: say nothing more. Do not claim ZDR unless it is on.
4. Groq's Services Agreement says Groq may not use inputs or outputs to train or fine-tune models unless the customer allows it, and we do not allow it (https://console.groq.com/docs/legal/services-agreement, modified June 22, 2026).
5. Do not type passwords, card numbers or other people's personal data; the server also refuses to send obvious card numbers and secret keys.
6. Add Groq to "Where it lives" (US storage by Groq, versus Supabase in Mumbai) and to "Who sees it"; update "Last updated". No "encrypted" or "secure connection" wording.
Design-next 3.6 paragraph becomes: "When AI plans are on, the text you type in a task is sent through our server to Groq, a company that runs the AI model which writes the preview plan. Groq handles it under its own terms. You can switch AI off in the box, and then the plan is matched on keywords and your text goes to no AI service. A plan is never run."

**`.env.example`** (replace the Anthropic block):
```
# Optional, SECRET. Lets "Preview plan" use an AI model run by Groq to write the plan. Without it the keyword preview is used.
# Server only: never put NEXT_PUBLIC_ in front of it. Get one at https://console.groq.com/keys (it starts with gsk_)
# GROQ_API_KEY=
```
**README** settings-table row: `GROQ_API_KEY` | Lets "Preview plan" use an AI model run by Groq. Optional | **Yes: secret, server only, never `NEXT_PUBLIC_`**. Add a short "AI plans (optional)" paragraph: what is sent, the limits (2 a minute, 20 a day per person, 60 a day overall), and "swap the model by editing `GROQ_MODEL` in `lib/ai/groq.js`".

**Owner steps, replacing plan-next section 6** (about 10 minutes; nothing is needed now):
1. Open https://console.groq.com and sign in or create an account (only you; no assistant does this). The free plan needs no card.
2. Make a project: top-left "Organization / Projects" > **Create Project** > name `hushwork`. Keep it selected (keys belong to the selected project).
3. Optional limits: Manage Projects > `hushwork` > View: set requests per minute at or below 10, and set **Only Allow** `openai/gpt-oss-20b` (S11, S12). Look at https://console.groq.com/settings/limits to see your real limits.
4. Data Controls (https://console.groq.com/settings/data-controls): read the options. Switching **Zero Data Retention** on is the more private choice (S6); tell the assistant which you chose so the privacy page matches.
5. https://console.groq.com/keys > **Create API Key** > name `hushwork-local`. If the form offers an expiry, choose 30 days. Copy the key now (it starts `gsk_`).
6. Open `D:\arjun work\claude expo\hUSHWORK INTELLIGENT WORKSPACE\hushwork-app\.env.local`, add one line at the bottom: `GROQ_API_KEY=gsk_...` (no quotes, no spaces around `=`). **SECRET:** never paste it into chat, README, docs or a commit message. Save.
7. Restart the dev server: in the terminal running `npm run dev` press Ctrl+C, then run `npm run dev` again inside `hushwork-app` (it must say port 3100; if it says 3000 stop, that is your other app).
8. Check it worked: sign in, open `/app`; the line under the box says AI planning is on. Type a task and press the arrow: the heading says "Plan written by AI" and the terminal prints `ai-plan ok in=... out=... reasoning=... ms=...`. https://console.groq.com/dashboard/usage shows the request. Press the arrow 3 times within a minute: the third shows the limit sentence.
9. Remove it: delete the `GROQ_API_KEY=` line, restart; the page says AI planning is off. Then delete or revoke the key on the keys page (look for the delete control on its row; its exact label is not documented). If the key was ever pasted anywhere public, delete it at once and make a new one.
10. Every month, read https://console.groq.com/docs/deprecations (and watch for Groq's email). If `ai-plan failed why=model_missing` appears in the terminal, change `GROQ_MODEL` to the replacement named there.
11. If you later upgrade: Settings > Billing > Limits > Add Limit ($5 a month) with alerts at 50, 75 and 90 percent, then raise our limits as in section 3.

**Tests** (all mock `fetch`; a guard sets `globalThis.fetch` to throw, so any unmocked call fails; no test calls Groq):
- `lib/ai/groq.test.js`: exact URL and `Authorization: Bearer` header; body has `model: "openai/gpt-oss-20b"`, `max_completion_tokens: 1200`, `reasoning_effort: "low"`, `response_format.json_schema.strict: true`; every schema object has `additionalProperties:false`, all properties required, no `minItems`/`maxItems`, icon enum equals `icon-names.js`; system message first, user message wrapped in `<task>`; **absent**: `tools`, `stream`, `max_tokens`, `user`; exactly one fetch call on 429 and on 500 (no retry); 401, 403, 404, 400, 413, 422, 429 (with `retry-after`), 500, 502, 503, thrown error and timeout each map to the sentence table; `length`, `refusal`, empty and invalid JSON, 0 steps; a 400 body containing `failed_generation` text never appears in the result or any `console` call; the key never appears in any result or `console` call; after a 429 with `retry-after: 30` a second call within 30 s does not call fetch (injected clock).
- `lib/ai/provider.test.js`: success passes through; `busy` falls to a fake second provider; `auth` does not.
- `lib/ai/plan.test.js` (was request + cleaning): cleaning, `withApproval`, `looksSensitive` (adds `gsk_`, `AIza`), schema and prompt snapshots. `preview.test.js` uses the new numbers (3rd plan in a minute, 21st in a day, 61st overall refused without fetch).
- `lib/secrets.test.js`: `GROQ_API_KEY` only in `key.js` (plus `.env.example`, README, docs, this test); no `NEXT_PUBLIC_GROQ`; no `gsk_` followed by 20 or more key characters anywhere; no leftover `ANTHROPIC` or `sk-ant-` in code.

**`docs/plan-next.md` task list changes** (file names stay except `groq.js` and `provider.js`; T1 to T6, T11 unchanged):

| Task | Change |
|---|---|
| T7 AI core and tests | Build `plan.js` (neutral parts), `groq.js`, `provider.js`, `limits.js`, `preview.js`, tests above. Check line: request has `model: "openai/gpt-oss-20b"`, `max_completion_tokens: 1200`, `reasoning_effort: "low"`, strict `json_schema`, `Authorization: Bearer`, no `tools`/`stream`/`max_tokens`; limits 2 / 20 / 3 per minute overall / 60. Risk: the live request cannot be proven without a key (see "First live call" below). |
| T8 Key reader, action, AiNote | `key.js` exports `getGroqKey()`; the Server Action passes `{ groqKey }` to `makePreview`, which calls `writePlan`. Check: `grep -r "GROQ" .build-check/.next/static` and `gsk_` find nothing. Rest unchanged. |
| T9 Composer states | Copy from the table above; counter limit 20; the slow-after-6-s notice stays (a normal Groq answer takes 1 to 3 s). Everything else unchanged. |
| T10 Docs | Privacy text, README, `.env.example`, `lib/secrets.test.js` as above; privacy still ships before or with T8. |
| T12 | Build recipe step 3: do **not** set `GROQ_API_KEY`; the `.next\static` search pattern becomes `GROQ|gsk_|sb_secret`. Section 9E: "press the arrow six times" becomes "three times". Section 10: risk row "Haiku plan quality" becomes "gpt-oss-20b plan quality: change `GROQ_MODEL`"; add "model id retired (alarm: `why=model_missing`)" and "Groq limits are org-wide". |

**First live call (owner adds the key, then the builder or owner reads one real result).** Most likely one-field fixes if it fails with `status=400`: the `reasoning_effort` plus `json_schema` combination, or the system message. The log shows status and error `type` only; the page falls back, so trying is safe.

## 5. Other ideas: honest verdicts
**Gemini API (keep as a later fallback, not now).** Facts (https://ai.google.dev/gemini-api/terms, /docs/pricing, /docs/rate-limits, read 2026-10-17): limits are per project and visible only in Google AI Studio, daily limits reset at midnight Pacific, which fits "keeps hitting limits"; on the **free (unpaid) quota Google says it uses your prompts and outputs to improve its products and human reviewers may read them**, and tells you not to submit sensitive or personal information; paid usage is listed as not used to improve their products; apps serving the EEA, Switzerland or UK may use **Paid Services only**; the terms also forbid using the service to build competing models. So: **never send real users' text to the free Gemini quota**; use it only on a paid (billing-linked) project, and add Google to the privacy page when you do. Plugging in = `lib/ai/gemini.js` with `writeWithGemini(text, { geminiKey, fetchImpl })` returning the same shape (native `generateContent` with header `x-goog-api-key` and a JSON response schema, or Google's OpenAI-compatible URL `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, whose `json_schema` support I did not verify), one entry in `PROVIDERS`, env `GEMINI_API_KEY`, `secrets.test.js` extended, secret guard already has `AIza`. Two providers double the privacy surface, so build it only after a real shortage.

**Training our own Python model: not sensible now.** (Sizes below are rules of thumb, not measured.)
- *Data:* none exists. The keyword matcher picks among 5 canned plans; a classifier trained to pick among the same 5 would not add value. To write free-form steps you need a model that generates plans: realistically 1,000 to 5,000 good (task text, plan) pairs, written or reviewed by a person, plus a held-out test set of 100 or more.
- *Compute and hosting:* fine-tuning a small open model is a few GPU-hours on rented hardware; running it needs a GPU or slow CPU service. A Python service (for example FastAPI) is a second thing to deploy, secure, monitor and pay for next to Next.js, and Vercel-style hosts do not keep GPU models warm. At $0.0002 to $0.0005 a plan on Groq, a rented GPU costs more per month than the first hundreds of thousands of plans.
- *Privacy:* using people's drafts as training data needs consent, a privacy-page rewrite, and a way to remove one person's data, which is hard once it is baked into model weights. Our drafts are today stored for their owner only.
- *Time:* weeks of work before it could match a prompted model, and it needs ongoing care.
- *Realistic path:* (1) ship Groq and watch real use; (2) add an optional thumbs up / down and an **off-by-default checkbox** "let us keep this example to improve plans", saved in a separate table with deletion; (3) build a 50 to 100 task test set and compare keyword matcher, prompted model and few-shot prompted model; (4) only if a measured gap and enough consented data exist, fine-tune a small hosted model (Groq offers LoRA fine-tuned inference to enterprise customers only: https://console.groq.com/docs/lora) or another provider's fine-tuning service.
- *Do NOT:* train from scratch; scrape or buy datasets of unknown licence; use anyone's drafts without consent; generate training data with another company's model against its terms (Gemini's forbid it); build the Python service before the test set shows a need.

## 6. Future roadmap note (no design now; order matters)
Smallest honest phases: **A.** Manual step editor: people edit, add, reorder and delete the steps of a saved draft by hand (the same icon list); still "Nothing will run"; reuses the existing `workflows.plan` column. **B.** Typed steps: a short fixed list of step kinds (a trigger, "send a message", "add a row") with named fields instead of free text, validated, still labelled "Not connected". **C.** ONE connector end to end in test mode, on the owner's own account, with a "Run test" button that first shows exactly what will happen and needs a click to approve; results saved to a real `runs` table (the Runs page already exists as a sample). Simplest picks: Slack in your own workspace, or Google Sheets or Drive using `drive.file`. **D.** More connectors, each with approvals (Gmail send, Calendar). **E.** Scheduled runs, which need a place that runs without a browser open. **F.** Opening connectors to the public, which needs Google's verification and security work below.
Constraints to know before starting:
- **OAuth app and consent screen:** each integration needs an app you register (Google Cloud project, Slack app), a consent screen people see, and exact "scopes" (permissions). A Google app in "Testing" status gets refresh tokens that **expire in 7 days** while an unverified app has a cap on how many Google accounts may connect (https://developers.google.com/identity/protocols/oauth2 and .../production-readiness/sensitive-scope-verification, read 2026-10-17; the cap number was not confirmed).
- **Google verification:** requesting sensitive or restricted scopes needs verification before real users; brand verification takes about 2 to 3 business days. **Gmail:** `gmail.send` is *sensitive*; `gmail.readonly`, `gmail.modify`, `gmail.compose` are *restricted*. **Drive:** `drive.file` is non-sensitive; `drive` and `drive.readonly` are restricted (https://developers.google.com/workspace/gmail/api/auth/scopes, .../drive/api/guides/api-specific-auth). Calendar scope classes: not confirmed in the text I read; check the Cloud Console "Data Access" page. **Restricted scopes whose data passes through or sits on your server need an annual security assessment by a Google-approved third party, and verification can take several weeks** (https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification). Its cost is not stated there (UNVERIFIED). Exceptions include personal use and development or testing.
- **Slack:** an app in one workspace needs no review; an unlisted distributed app can run a pilot; commercial distribution should go through Marketplace review (https://docs.slack.dev/distribution/).
- **Token storage:** refresh tokens are keys into people's inboxes. Store them encrypted on the server only, one row per person with row-level security, never in the browser, never in logs; on "disconnect" revoke at the provider and delete.
- **Job runner:** a scheduled run cannot live in a Server Action or the browser; decide then between database cron plus an edge function, the host's cron, or a queue service. It also needs retries that do not double-send an email, and a kill switch.
- **Security review before the first real connector:** least-privilege scopes, an audit log of every run, and a threat model for AI plus actions: an email's text can try to instruct the AI, so a human approval step stays mandatory.
- **Honest claims:** the moment anything actually runs, "Nothing will run", "It will not run" and "Hushwork does not run workflows yet" (Composer, DraftCard, RunsViewer, `/privacy`, README, `PRODUCT.md`, landing copy) become false and must change in the same commit, together with the privacy page (new third parties, stored tokens, retention, deletion).
- **MCP connectors vs OAuth integrations:** MCP connectors (Supabase, Notion, Gmail tools) are things *a coding assistant* uses on your machine, under your login, while building; they never ship. OAuth integrations are code *inside Hushwork* that each customer authorizes for their own accounts, so Hushwork holds their tokens and carries the legal and security duties.

## 7. Open questions and defaults
**Blocking questions: none.** Decisions to confirm when convenient (cheap to change): (1) turn on Zero Data Retention in Groq's Data Controls or not (the privacy page has both variants, section 4); (2) default model `openai/gpt-oss-20b` versus the 120b, decided after reading real plans.
**Defaults chosen:** Groq via plain `fetch`; `openai/gpt-oss-20b`; strict JSON schema; `max_completion_tokens` 1200; `reasoning_effort` low; 15 s timeout; no retries; limits 2 a minute and 20 a day per person, 3 a minute and 60 a day overall; in-memory limiter and cool-off now (database limiter before any deployment, as in plan-next); no SQL; Gemini and a Python model not built.

Related: [Plan: restyle and Preview plan (partly superseded by this file)](plan-next.md), [Design: Arjun AI restyle](design-next.md), [QA round 2](qa-2.md)
