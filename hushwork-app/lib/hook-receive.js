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
import { HOOK_LIMITS, NO_COLUMN, TEST_FLAG, hashCode, incomingText, looksLikeCode, parseBody, previewOf, readFields } from "./hooks.js";
import { readFieldList } from "./hook-fields.js";

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
  // Every field is kept (`fields`, already cut to the limits) so the owner can read the whole arrival and replay it later. A database that has
  // not had supabase/hook-fields.sql run yet has no such column: the arrival is then saved with its preview only, as before.
  const note = async (status, runId = null) => {
    const row = { hook_id: hook.id, user_id: hook.user_id, status, run_id: runId, preview, test: isTest };
    let saved = await admin.from("hook_events").insert({ ...row, fields }).select("id");
    if (saved.error && NO_COLUMN.has(saved.error.code)) saved = await admin.from("hook_events").insert(row).select("id");
    if (saved.error) console.error("saving an arrival failed:", saved.error.code);
    return saved.data?.[0]?.id ?? null;
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
        { id: hook.workflow_id, auto: true, allowWrites: false, incoming: { text: incomingText(fields), count: fields.length, test: isTest, fields } },
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

// REPLAY: the owner presses Replay on an arrival on the Start links page, and the workflow runs again with exactly the fields that arrived then
// (after they fixed a step, say). Same road as a real arrival: as its owner, Auto mode, writing switched OFF, counted against the same limits.
// It reads with the owner's OWN client, so only their own arrivals can be replayed. No email nudge: they are looking at the page.
// `deps`: { client, run(input, who), limiter, takeSlot(client), now }. `who`: { user }. Returns { ok: true, runId } or { error }.
export const REPLAY_ERRORS = {
  gone: "That arrival is no longer kept.",
  setup: "Replay needs one setup step that is not done yet. Open supabase/hook-fields.sql and run it in Supabase.",
  old: "This arrival came in before Hushwork kept every field, so it cannot be replayed. Send it again from your form, or press Send a test.",
  linkGone: "That start link was removed, so there is no workflow to replay it in.",
  limited: `Start links can start up to ${HOOK_LIMITS.perMinute} runs a minute and ${HOOK_LIMITS.perDay} a day. Try again in a little while.`,
  failed: "Could not replay it. Check your connection and try again.",
};
export async function replayArrival(deps, who, eventId) {
  const { client, now = Date.now() } = deps;
  const userId = String(who?.user?.id ?? "");
  if (!userId || typeof eventId !== "string") return { error: REPLAY_ERRORS.gone };
  const event = await client.from("hook_events").select("id, hook_id, fields, test").eq("id", eventId).eq("user_id", userId).limit(1);
  if (event.error) {
    if (NO_COLUMN.has(event.error.code)) return { error: REPLAY_ERRORS.setup };
    console.error("loading an arrival to replay failed:", event.error.code);
    return { error: REPLAY_ERRORS.failed };
  }
  const row = event.data?.[0];
  if (!row) return { error: REPLAY_ERRORS.gone };
  if (!Array.isArray(row.fields)) return { error: REPLAY_ERRORS.old };
  const fields = readFieldList(row.fields) ?? []; // already cut and checked when it arrived; read again because it comes from a database row
  const hook = await client.from("hooks").select("id, workflow_id").eq("id", row.hook_id).eq("user_id", userId).limit(1);
  if (hook.error) {
    console.error("loading a link to replay failed:", hook.error.code);
    return { error: REPLAY_ERRORS.failed };
  }
  const workflowId = hook.data?.[0]?.workflow_id;
  if (!workflowId) return { error: REPLAY_ERRORS.linkGone };
  const roomNow = deps.limiter.minute.take(userId, now) && deps.limiter.day.take(userId, now);
  const slot = roomNow ? await deps.takeSlot(client) : { ok: false };
  if (!roomNow || !slot.ok) return { error: REPLAY_ERRORS.limited };
  let result = null;
  try {
    result = await deps.run({ id: workflowId, auto: true, allowWrites: false, incoming: { text: incomingText(fields), count: fields.length, test: row.test === true, replay: true, fields } }, { user: who.user, supabase: client });
  } catch {
    console.error("a replayed run crashed");
  }
  if (!result?.ok || !result.runId) return { error: result?.error ?? REPLAY_ERRORS.failed };
  return { ok: true, runId: result.runId, waiting: Number(result.auto?.waiting) || 0 };
}

export const hookLimiter = (makeLimiter) => (globalThis.__hushworkHookLimits ??= { minute: makeLimiter({ max: HOOK_LIMITS.perMinute, windowMs: 60_000 }), day: makeLimiter({ max: HOOK_LIMITS.perDay, windowMs: 86_400_000, calendar: true }), noise: makeLimiter({ max: 3, windowMs: 60_000 }) });
