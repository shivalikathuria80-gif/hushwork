// The order of everything that happens when someone asks for an AI plan. The Server Action (lib/actions/plan.js) has
// already checked who is asking and that the text is 1 to 2000 characters; this file does the rest and decides what the
// screen is told. No imports from Next.js, so `node --test` can run it with a fake `fetch`.
//
// The answer is always small and safe to send to the browser:
//   { source: "ai", steps, remaining }                               the AI wrote a plan
//   { source: "keyword", why, notice, canRetry, remaining?, retryAfter? }   no AI plan; the screen makes the keyword plan itself
// `notice` is one plain sentence for the person. Provider error text, the prompt, the key and ids never appear in it.
import { AI_LIMITS, looksSensitive } from "./plan.js";
import { makeAiLimits } from "./limits.js";
import { coolOffSeconds, writePlan } from "./provider.js";

// What the person reads when there is no AI plan. Each one says it is a keyword preview, so the page never pretends.
const TAIL = "so this is a keyword preview.";
export function noticeFor(why, { status, limit = AI_LIMITS.perUserDay } = {}) {
  switch (why) {
    case "off": return `AI planning is switched off, ${TAIL}`;
    case "sensitive": return "Your text looked like it held a card number or secret key, so it was not sent to the AI. This is a keyword preview.";
    case "limit_minute": return `You have made several AI plans in a short time, ${TAIL} Try again in a minute.`;
    case "limit_day": return `You have used your ${limit} AI plans for today, ${TAIL} They reset at midnight UTC.`;
    case "limit_all_minute": return `AI planning has reached its limit for now, ${TAIL} Try again in a minute.`;
    case "limit_all_day": return `AI planning has reached its daily limit, ${TAIL} Try again tomorrow.`;
    case "auth":
    case "model_missing": return `AI planning is not working right now, ${TAIL}`;
    case "busy": return status === 429 ? `The AI is busy right now, ${TAIL} Try again in a minute.` : `The AI is busy or unavailable right now, ${TAIL}`;
    case "timeout": return `The AI took too long to answer, ${TAIL}`;
    case "rejected": return `The AI could not take that request right now, ${TAIL}`;
    case "refused": return `The AI would not write a plan for that text, ${TAIL}`;
    default: return `The AI's reply could not be used, ${TAIL}`; // "unusable" and anything unexpected
  }
}

// "Try AI again" only makes sense when waiting or trying again could help.
const RETRYABLE = ["busy", "timeout", "rejected", "unusable", "refused"];

// All four limits are shared by the whole running server, and survive a development hot reload.
const sharedLimits = () => (globalThis.__hushworkAiLimits ??= makeAiLimits());

// prompt, userId: already checked. groqKey: from key.js (null when there is none). now/fetchImpl/limiters/log: for tests.
export async function makePreview({ prompt, userId, groqKey, now = Date.now, fetchImpl, limiters = sharedLimits(), log = console.log }) {
  // A keyword answer: no steps, the screen builds the keyword plan itself and shows `notice`.
  const keyword = (why, { status, remaining, retryAfter } = {}) => ({
    source: "keyword",
    why,
    notice: noticeFor(why, { status }),
    canRetry: RETRYABLE.includes(why),
    ...(remaining === undefined ? {} : { remaining }),
    ...(retryAfter ? { retryAfter } : {}),
  });

  if (!groqKey) { log("ai-plan skipped why=off"); return keyword("off"); }
  if (looksSensitive(prompt)) { log("ai-plan skipped why=sensitive"); return keyword("sensitive"); }
  const waiting = coolOffSeconds(now());
  if (waiting > 0) { log(`ai-plan skipped why=cooling_off retry_after=${waiting}`); return keyword("busy", { status: 429, retryAfter: waiting }); }

  // From here a real request will be made, so the attempt is counted even if it fails.
  const slot = limiters.take(userId, now());
  if (!slot.ok) { log(`ai-plan skipped why=${slot.why}`); return keyword(slot.why, { remaining: slot.remaining }); }

  const started = now();
  let result;
  try {
    result = await writePlan(prompt, { groqKey, fetchImpl, now });
  } catch {
    result = { ok: false, why: "unusable" }; // a bug on our side must not crash the page
  }
  const ms = now() - started;

  if (result.ok) {
    const { usage } = result;
    log(`ai-plan ok in=${usage.in} out=${usage.out} reasoning=${usage.reasoning} ms=${ms}`);
    return { source: "ai", steps: result.steps, remaining: slot.remaining };
  }
  // Numbers and codes only: never the prompt, the reply, the key or the provider's error message.
  const parts = [`why=${result.why}`];
  if (result.status) parts.push(`status=${result.status}`);
  if (result.errorType) parts.push(`type=${result.errorType}`);
  if (result.errorCode) parts.push(`code=${result.errorCode}`);
  if (result.failedLength !== undefined) parts.push(`failed_length=${result.failedLength}`);
  if (result.retryAfter) parts.push(`retry_after=${result.retryAfter}`);
  if (result.why === "model_missing" && result.model) parts.push(`model=${result.model}`); // the "model retired" alarm
  log(`ai-plan failed ${parts.join(" ")}`);
  return keyword(result.why, { status: result.status, remaining: slot.remaining, retryAfter: result.retryAfter });
}
