// The Groq side of "AI Preview plan". Groq is a company that runs open AI models; we send it one web request (plain
// `fetch`, no SDK) and read the answer. This file never imports Next.js, and the key is handed in by the caller: it is
// read from the environment in exactly one place, key.js.
//
// What a call looks like: we send the fixed instructions plus the person's words, ask for an answer in a strict JSON
// shape, wait at most 15 seconds, and try ONCE (no automatic retries: a retry would spend a second slice of a small
// budget). Whatever goes wrong becomes a short code in `why`; Groq's own error text is never read out, logged or shown,
// because it can quote what the model wrote.
import { PLAN_SCHEMA, PLAN_SCHEMA_PLAIN, SYSTEM_PROMPT, SYSTEM_PROMPT_PLAIN, finishSteps, wrapTask } from "./plan.js";

// The model's name. To use a different model, change this one line (the bigger `openai/gpt-oss-120b` is the next step up).
// Groq retires models now and then; if the terminal prints `ai-plan failed why=model_missing`, this is the line to update.
export const GROQ_MODEL = "openai/gpt-oss-20b";
// Fixed in code on purpose: nothing a person types or any setting can point the key at another address.
export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const TIMEOUT_MS = 15000;
const DEFAULT_COOL_OFF_SECONDS = 60; // used when Groq says "slow down" but does not say for how long
const MAX_COOL_OFF_SECONDS = 900; // never wait more than 15 minutes

// After Groq answers "429, slow down" we stop calling it until its waiting time has passed. Kept on globalThis so a
// development hot reload does not forget it.
const coolOff = (globalThis.__hushworkGroqCoolOff ??= { until: 0 });
export const coolOffLeft = (nowMs) => Math.max(0, Math.ceil((coolOff.until - nowMs) / 1000));
export const resetCoolOff = () => { coolOff.until = 0; };

const fail = (why, extra = {}) => ({ ok: false, why, ...extra });
const count = (value) => (Number.isFinite(value) ? value : 0);

// Turns a failed HTTP answer into a short code. Only numbers and a short type word are looked at.
async function explainError(response, now) {
  const status = response.status;
  if (status === 401 || status === 403) return fail("auth", { status });
  if (status === 404) return fail("model_missing", { status, model: GROQ_MODEL });
  if (status === 422) return fail("unusable", { status });
  if (status === 413) return fail("rejected", { status });
  if (status === 429) {
    const asked = Number.parseFloat(response.headers.get("retry-after"));
    const seconds = Math.min(MAX_COOL_OFF_SECONDS, Math.max(1, Number.isFinite(asked) ? Math.ceil(asked) : DEFAULT_COOL_OFF_SECONDS));
    coolOff.until = Math.max(coolOff.until, now + seconds * 1000); // a shorter answer arriving later must not shorten a longer wait
    return fail("busy", { status, retryAfter: seconds });
  }
  if (status === 400) {
    // A 400 can mean a retired model (code "model_not_found" or "model_decommissioned") or a request Groq would not take.
    const body = await response.json().catch(() => null);
    const label = `${body?.error?.code ?? ""} ${body?.error?.type ?? ""}`;
    const errorType = typeof body?.error?.type === "string" && /^[a-z_]{1,40}$/.test(body.error.type) ? body.error.type : undefined;
    const errorCode = typeof body?.error?.code === "string" && /^[a-z_]{1,40}$/.test(body.error.code) ? body.error.code : undefined; // a short slug like json_validate_failed, never text
    return /model_not_found|model_decommissioned/.test(label) ? fail("model_missing", { status, errorType, model: GROQ_MODEL }) : fail("rejected", { status, errorType, errorCode, failedLength: typeof body?.error?.failed_generation === "string" ? body.error.failed_generation.length : undefined }); // a NUMBER only: the cut-off answer itself is never read or kept
  }
  return status >= 500 ? fail("busy", { status }) : fail("rejected", { status });
}

// text: the person's task, already checked by the caller. keys: { groqKey, fetchImpl, now } (the last two are for tests).
// Returns { ok: true, steps, usage: { in, out, reasoning } } or { ok: false, why, status?, retryAfter?, errorType? }.
export async function writeWithGroq(text, keys = {}) {
  const first = await attempt(text, keys, true);
  // The rich answer (steps with blocks) sometimes does not fit the strict shape. Then ask ONCE more for the plain three-field
  // plan, so the person still gets an AI plan. Any other problem (busy, key, timeout) is not retried.
  if (!first.ok && first.why === "rejected" && first.errorCode === "json_validate_failed") return attempt(text, keys, false);
  return first;
}

async function attempt(text, { groqKey, fetchImpl, now = Date.now }, rich) {
  if (!groqKey) return fail("off");
  const left = coolOffLeft(now());
  if (left > 0) return fail("busy", { status: 429, retryAfter: left }); // still cooling off: answered here, Groq not called

  const body = {
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: rich ? SYSTEM_PROMPT : SYSTEM_PROMPT_PLAIN }, // fixed text first
      { role: "user", content: wrapTask(text) }, // the person's words last, marked as data
    ],
    temperature: 0.5,
    max_completion_tokens: 1600,
    reasoning_effort: "low",
    response_format: { type: "json_schema", json_schema: { name: "workflow_plan", strict: true, schema: rich ? PLAN_SCHEMA : PLAN_SCHEMA_PLAIN } },
  };

  let response;
  try {
    response = await (fetchImpl ?? globalThis.fetch)(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (problem) {
    const timedOut = problem?.name === "TimeoutError" || problem?.name === "AbortError";
    return fail(timedOut ? "timeout" : "busy"); // no network, DNS trouble and the like count as "unavailable"
  }
  if (!response.ok) return explainError(response, now());

  let data;
  try {
    data = await response.json();
  } catch {
    return fail("unusable");
  }
  const choice = data?.choices?.[0];
  if (choice?.message?.refusal) return fail("refused");
  const content = choice?.message?.content;
  if (choice?.finish_reason === "length" || typeof content !== "string" || !content.trim()) return fail("unusable");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return fail("unusable");
  }
  const steps = finishSteps(parsed, undefined, text);
  if (!steps) return fail("unusable");
  const usage = data?.usage;
  return {
    ok: true,
    steps,
    usage: { in: count(usage?.prompt_tokens), out: count(usage?.completion_tokens), reasoning: count(usage?.completion_tokens_details?.reasoning_tokens) },
  };
}
