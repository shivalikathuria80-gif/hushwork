// START LINKS: what happens when something arrives at a link (app/api/hooks/[code]). The owner's "Send a test" button posts to the very same
// address from their browser, with hushwork_test: true in the body, so a test walks the real path (it is only labelled, and sends no email).
// Everything it needs is handed in, so this file has no Next.js or database imports and tests never touch real services.
//
//   1. FIND the link by the hash of its code (the all-access client: the sender is a stranger with no account).
//   2. REFUSE early, with a small answer that never holds anyone's data: unknown link, switched off, everything paused, too much, too often.
//   2b. CHECK THE SENDER when the link asks for signed arrivals (lib/hook-sign.js): no matching signature, nothing starts.
//   2c. SKIP A REPEAT: the same delivery (by its id, or the same words within minutes) starts one run, not two (table hook_seen).
//   3. WRITE DOWN the arrival (a short preview only) and count it.
//   4. START the workflow as its owner in Auto mode with writing switched OFF: the run reads and thinks by itself, and every step that sends
//      or creates waits for the owner's Approve. A stranger holding the link can never make Hushwork send anything.
//   5. If a step is left waiting, ask `nudge` to tell the owner (it decides whether it may: never at night, at most 3 a day).
// Steps 4 and 5 are returned as `finish`, a function the caller runs AFTER it has answered the sender, so a form never waits on the AI.
import { HOOK_LIMITS, NO_COLUMN, NO_TABLE, TEST_FLAG, hashCode, incomingText, looksLikeCode, parseBody, previewOf, readFields, repeatKey, verifySignature } from "./hooks.js";
import { readFieldList } from "./hook-fields.js";
import { NO_DATA_SETUP, dayStart, readCap } from "./hook-data.js";

export const ANSWERS = {
  unknown: { status: 404, body: { ok: false, error: "This start link does not exist." } },
  off: { status: 410, body: { ok: false, error: "This start link is switched off." } },
  paused: { status: 503, body: { ok: false, error: "Hushwork is paused right now. Try again later." } },
  limited: { status: 429, body: { ok: false, error: "This start link got too much at once. Try again in a little while." } },
  unsigned: { status: 401, body: { ok: false, error: "This start link only takes signed arrivals, and this one's signature did not match." } },
  // A repeat is answered like a success, so the sender stops trying again; it starts nothing.
  duplicate: { status: 200, body: { ok: true, received: true, duplicate: true } },
  capped: { status: 429, body: { ok: false, error: "This start link has reached its limit for today. Try again tomorrow." } },
  setup: { status: 503, body: { ok: false, error: "Start links are not switched on." } },
  received: { status: 202, body: { ok: true, received: true } },
};

// `deps`: { admin, clientFor(userId), run(input, who), nudge(found), paused(admin), takeSlot(client), limiter: { minute, day, noise? }, now,
//          countToday?(hookId, sinceIso) -> number | null, prune?(hookId), scrub?(runId, ownerId) } (the last three: supabase/hooks-data.sql).
// `arrival`: { code, text, type, headers } from the request; `headers` is { lower-case name: value } (only the few this file reads).
// Returns { answer: { status, body }, finish?: async () => outcome }.
export async function receiveArrival(deps, arrival) {
  const { admin, now = Date.now() } = deps;
  if (!admin) return { answer: ANSWERS.setup };

  if (!looksLikeCode(arrival.code)) return { answer: ANSWERS.unknown };
  // Optional columns: the sender check (supabase/hooks-signing.sql) and the data controls (supabase/hooks-data.sql). A database without one
  // of them yet answers 42703, and the link is read again without it, so links keep working whatever was run.
  const find = (columns) => admin.from("hooks").select(columns).eq("code_hash", hashCode(arrival.code)).limit(1);
  const BASE = "id, user_id, workflow_id, enabled, received_count, tz_offset";
  let data = null;
  let error = null;
  for (const columns of [`${BASE}, signing_style, signing_secret, keep_days, daily_cap`, `${BASE}, keep_days, daily_cap`, `${BASE}, signing_style, signing_secret`, BASE]) {
    ({ data, error } = await find(columns));
    if (!error || !(NO_COLUMN.has(error.code) || NO_DATA_SETUP.has(error.code))) break;
  }
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
  // `keep` false = save no words at all (a refused arrival: they came from someone who is not the sender).
  const note = async (status, runId = null, keep = true) => {
    const row = { hook_id: hook.id, user_id: hook.user_id, status, run_id: runId, preview: keep ? preview : [], test: isTest };
    let saved = await admin.from("hook_events").insert({ ...row, fields: keep ? fields : [] }).select("id");
    if (saved.error && NO_COLUMN.has(saved.error.code)) saved = await admin.from("hook_events").insert(row).select("id");
    if (saved.error) console.error("saving an arrival failed:", saved.error.code);
    return saved.data?.[0]?.id ?? null;
  };

  // A refused or switched-off arrival is written down so the owner can see something knocked, but only a few a minute: someone holding a
  // leaked address must not be able to fill the table.
  const noteQuiet = async (status, keep = true) => {
    if (deps.limiter.noise?.take(String(hook.user_id), now) !== false) await note(status, null, keep);
  };
  if (hook.enabled !== true) {
    await noteQuiet("off");
    return { answer: ANSWERS.off };
  }
  if (await deps.paused(admin)) return { answer: ANSWERS.paused };

  // The sender check. A refused arrival keeps no preview: its words came from someone who is not the sender.
  const style = typeof hook.signing_style === "string" && hook.signing_style !== "none" ? hook.signing_style : "";
  if (style && !verifySignature(style, hook.signing_secret, arrival.headers ?? {}, arrival.text, now).ok) {
    await noteQuiet("refused", false);
    return { answer: ANSWERS.unsigned };
  }

  // One delivery, one run. The key is claimed before the limits are counted (a repeat costs no slot) and given back whenever the arrival
  // does not end in a run, so the sender's next try can still start it.
  const repeat = repeatKey(arrival.headers ?? {}, payload, arrival.text);
  const claim = await claimKey(admin, hook.id, repeat, now);
  if (!claim.ok) {
    await noteQuiet("duplicate");
    return { answer: ANSWERS.duplicate };
  }
  const release = () => (claim.held ? releaseKey(admin, hook.id, repeat.key) : Promise.resolve());

  // The link's own daily limit, set by its owner: counted from the arrivals that started a run since the start of the owner's day. Checked
  // before the account limits, so a capped link does not use up the owner's runs.
  // Arrivals of the same link that are counting at the same moment are reserved first (one synchronous step), so a burst cannot all read
  // "0 so far" and slip through together. (Across several servers a few could still pass; the account limits below hold either way.)
  const cap = readCap(hook.daily_cap);
  let reserved = false;
  const releaseCap = () => {
    if (!reserved) return;
    reserved = false;
    const left = (INFLIGHT.get(hook.id) ?? 1) - 1;
    if (left > 0) INFLIGHT.set(hook.id, left);
    else INFLIGHT.delete(hook.id);
  };
  if (cap !== null && deps.countToday) {
    const before = INFLIGHT.get(hook.id) ?? 0;
    INFLIGHT.set(hook.id, before + 1);
    reserved = true;
    const today = await deps.countToday(hook.id, dayStart(now, hook.tz_offset ?? 0)).catch(() => null);
    if (today !== null && today + before >= cap) { // a count that could not be read lets it through: the account limits below still hold
      releaseCap();
      await release();
      await noteQuiet("capped");
      return { answer: ANSWERS.capped };
    }
  }

  // Too often? The in-memory count is taken in ONE synchronous step (so a burst of parallel requests cannot all slip through the check), then
  // the database count (holds across servers) decides too. A refused arrival starts nothing and costs no AI.
  const client = deps.clientFor(hook.user_id);
  const key = String(hook.user_id);
  const roomNow = deps.limiter.minute.take(key, now) && deps.limiter.day.take(key, now);
  const slot = roomNow ? await deps.takeSlot(client) : { ok: false };
  if (!roomNow || !slot.ok) {
    releaseCap();
    await release();
    await noteQuiet("limited");
    return { answer: ANSWERS.limited };
  }

  const eventId = await note("started");
  releaseCap(); // the "started" row now counts for itself
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
      const query = admin.from("hook_events").update(runId ? { run_id: runId } : { status: "failed" }).eq("id", eventId);
      const saved = await (typeof query.select === "function" ? query.select("id") : query);
      if (saved.error) console.error("updating an arrival failed:", saved.error.code);
      // The owner deleted this arrival while its run was still starting: nothing pointed at the run then, so its words are removed now.
      else if (runId && !saved.data?.length && hook.keep_days !== undefined && deps.scrub) {
        try {
          await deps.scrub(runId, hook.user_id);
        } catch {
          console.error("removing the words of a deleted arrival crashed");
        }
      }
    }
    // Arrivals older than the link's keep days go now (the clock also does this for links nothing arrives at).
    if (hook.keep_days !== undefined && deps.prune) {
      try {
        await deps.prune(hook.id);
      } catch {
        console.error("pruning old arrivals crashed");
      }
    }
    if (!runId) {
      await release();
      return { ok: false, error: result?.error ?? "The run could not start." };
    }
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

const INFLIGHT = (globalThis.__hushworkHookInflight ??= new Map()); // link id -> arrivals between their cap count and their "started" row

export const hookLimiter = (makeLimiter) => (globalThis.__hushworkHookLimits ??= { minute: makeLimiter({ max: HOOK_LIMITS.perMinute, windowMs: 60_000 }), day: makeLimiter({ max: HOOK_LIMITS.perDay, windowMs: 86_400_000, calendar: true }), noise: makeLimiter({ max: 3, windowMs: 60_000 }) });

// Takes the key for this arrival in table hook_seen. { ok: true, held } = go on (held: a row was written and can be given back); { ok: false }
// = the same key is already taken inside its window. One database statement decides each case, so two copies of a delivery that arrive at
// the same moment cannot both start. If the table is missing or the database stumbles, the arrival goes on: a rare repeat beats a lost lead.
export async function claimKey(admin, hookId, repeat, now = Date.now()) {
  const until = new Date(now + repeat.windowMs).toISOString();
  const made = await admin.from("hook_seen").insert({ hook_id: hookId, key_hash: repeat.key, expires_at: until });
  if (!made.error) return { ok: true, held: true };
  if (NO_TABLE.has(made.error.code)) return { ok: true, held: false };
  if (made.error.code !== "23505") {
    console.error("checking for a repeat failed:", made.error.code);
    return { ok: true, held: false };
  }
  // Already there: it is a repeat unless its window is over, in which case this arrival takes the key over.
  const taken = await admin.from("hook_seen").update({ expires_at: until }).eq("hook_id", hookId).eq("key_hash", repeat.key).lt("expires_at", new Date(now).toISOString()).select("hook_id");
  if (taken.error) {
    console.error("checking for a repeat failed:", taken.error.code);
    return { ok: true, held: false };
  }
  return taken.data?.length ? { ok: true, held: true } : { ok: false };
}

export async function releaseKey(admin, hookId, key) {
  const { error } = await admin.from("hook_seen").delete().eq("hook_id", hookId).eq("key_hash", key);
  if (error && !NO_TABLE.has(error.code)) console.error("giving back a repeat key failed:", error.code);
}
