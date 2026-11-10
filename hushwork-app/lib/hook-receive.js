// START LINKS: what happens when something arrives at a link (app/api/hooks/[code]). The owner's "Send a test" button posts to the very same
// address from their browser, with hushwork_test: true in the body, so a test walks the real path (it is only labelled, and sends no email).
// Everything it needs is handed in, so this file has no Next.js or database imports and tests never touch real services.
//
//   1. FIND the link by the hash of its code (the all-access client: the sender is a stranger with no account).
//   2. REFUSE early, with a small answer that never holds anyone's data: unknown link, switched off, everything paused, too much, too often.
//   3. WRITE DOWN the arrival (a short preview only) and count it.
//   4. START the workflow as its owner in Auto mode with writing switched OFF: the run reads and thinks by itself, and every step that sends
//      or creates waits for the owner's Approve. A stranger holding the link can never make Hushwork send anything.
//   5. If a step is left waiting, ask `nudge` to tell the owner (it decides whether it may: never at night, at most 3 a day).
// Steps 4 and 5 are returned as `finish`, a function the caller runs AFTER it has answered the sender, so a form never waits on the AI.
import { HOOK_LIMITS, TEST_FLAG, hashCode, incomingText, looksLikeCode, parseBody, previewOf, readFields } from "./hooks.js";

export const ANSWERS = {
  unknown: { status: 404, body: { ok: false, error: "This start link does not exist." } },
  off: { status: 410, body: { ok: false, error: "This start link is switched off." } },
  paused: { status: 503, body: { ok: false, error: "Hushwork is paused right now. Try again later." } },
  limited: { status: 429, body: { ok: false, error: "This start link got too much at once. Try again in a little while." } },
  setup: { status: 503, body: { ok: false, error: "Start links are not switched on." } },
  received: { status: 202, body: { ok: true, received: true } },
};

// `deps`: { admin, clientFor(userId), run(input, who), nudge(found), paused(admin), takeSlot(client), limiter: { minute, day, noise? }, now }.
// `arrival`: { code, text, type } from the request.
// Returns { answer: { status, body }, finish?: async () => outcome }.
export async function receiveArrival(deps, arrival) {
  const { admin, now = Date.now() } = deps;
  if (!admin) return { answer: ANSWERS.setup };

  if (!looksLikeCode(arrival.code)) return { answer: ANSWERS.unknown };
  const { data, error } = await admin.from("hooks").select("id, user_id, workflow_id, enabled, received_count, tz_offset").eq("code_hash", hashCode(arrival.code)).limit(1);
  if (error) {
    console.error("finding a start link failed:", error.code);
    return { answer: ANSWERS.unknown };
  }
  const hook = data?.[0] ?? null;
  if (!hook?.id || !hook.user_id || !hook.workflow_id) return { answer: ANSWERS.unknown };

  const parsed = parseBody(arrival.text, arrival.type);
  if (parsed.error) return { answer: { status: parsed.status, body: { ok: false, error: parsed.error } } };
  let payload = parsed.payload;
  const isTest = Boolean(payload) && typeof payload === "object" && !Array.isArray(payload) && (payload[TEST_FLAG] === true || payload[TEST_FLAG] === "true");
  if (isTest) {
    payload = { ...payload };
    delete payload[TEST_FLAG];
  }
  const { fields } = readFields(payload);
  const preview = previewOf(fields);
  const note = async (status, runId = null) => {
    const { data, error } = await admin.from("hook_events").insert({ hook_id: hook.id, user_id: hook.user_id, status, run_id: runId, preview, test: isTest }).select("id");
    if (error) console.error("saving an arrival failed:", error.code);
    return data?.[0]?.id ?? null;
  };

  // A refused or switched-off arrival is written down so the owner can see something knocked, but only a few a minute: someone holding a
  // leaked address must not be able to fill the table.
  const noteQuiet = async (status) => {
    if (deps.limiter.noise?.take(String(hook.user_id), now) !== false) await note(status);
  };
  if (hook.enabled !== true) {
    await noteQuiet("off");
    return { answer: ANSWERS.off };
  }
  if (await deps.paused(admin)) return { answer: ANSWERS.paused };

  // Too often? The in-memory count is taken in ONE synchronous step (so a burst of parallel requests cannot all slip through the check), then
  // the database count (holds across servers) decides too. A refused arrival starts nothing and costs no AI.
  const client = deps.clientFor(hook.user_id);
  const key = String(hook.user_id);
  const roomNow = deps.limiter.minute.take(key, now) && deps.limiter.day.take(key, now);
  const slot = roomNow ? await deps.takeSlot(client) : { ok: false };
  if (!roomNow || !slot.ok) {
    await noteQuiet("limited");
    return { answer: ANSWERS.limited };
  }

  const eventId = await note("started");
  const counted = await admin.from("hooks").update({ received_count: (Number(hook.received_count) || 0) + 1, last_received_at: new Date(now).toISOString() }).eq("id", hook.id);
  if (counted.error) console.error("counting an arrival failed:", counted.error.code);

  const finish = async () => {
    let result = null;
    try {
      result = await deps.run(
        { id: hook.workflow_id, auto: true, allowWrites: false, incoming: { text: incomingText(fields), count: fields.length, test: isTest } },
        { user: { id: hook.user_id }, supabase: client },
      );
    } catch {
      console.error("a run started by a link crashed"); // no detail: it could hold something private
    }
    const runId = result?.ok && result.runId ? result.runId : null;
    if (eventId) {
      const saved = await admin.from("hook_events").update(runId ? { run_id: runId } : { status: "failed" }).eq("id", eventId);
      if (saved.error) console.error("updating an arrival failed:", saved.error.code);
    }
    if (!runId) return { ok: false, error: result?.error ?? "The run could not start." };
    const auto = result.auto ?? null;
    if (auto?.waiting > 0 && !auto?.stoppedAt && !isTest) {
      try {
        await deps.nudge({ userId: hook.user_id, workflowId: hook.workflow_id, runId, tzOffset: hook.tz_offset ?? 0, now, reason: "arrived" });
      } catch {
        console.error("a nudge crashed");
      }
    }
    return { ok: true, runId, auto };
  };
  return { answer: ANSWERS.received, finish };
}

export const hookLimiter = (makeLimiter) => (globalThis.__hushworkHookLimits ??= { minute: makeLimiter({ max: HOOK_LIMITS.perMinute, windowMs: 60_000 }), day: makeLimiter({ max: HOOK_LIMITS.perDay, windowMs: 86_400_000, calendar: true }), noise: makeLimiter({ max: 3, windowMs: 60_000 }) });
