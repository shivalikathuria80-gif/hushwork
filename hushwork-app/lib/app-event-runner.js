// APP EVENTS: the clock's part (lib/schedule-tick.js calls runDueWatches after the schedules). Everything it needs is handed in, so this file has
// no Next.js or database imports and tests never touch real services. For each watch that is due (supabase/app-events.sql):
//   1. CLAIM it: next_check_at moves forward in ONE update that only succeeds if nobody moved it first, so two clock calls never look twice.
//   2. LOOK (`read`, lib/app-event-read.js): new mail matching the filter, or events created since the cursor. A problem is written on the watch
//      (one short sentence) and the next look waits longer (BACKOFF_MS).
//   3. PICK what is new (lib/app-events.js pickNew): never an id it already started for, never from before the cursor, at most 3 a look.
//   4. START the workflow once per new email or event, exactly like a start link: as its owner, in Auto mode, with writing switched OFF (every step
//      that sends or creates waits for Approve). Counted first, per person (5 a minute, 40 a day, in memory and in the database).
//   5. If a step is left waiting, ask `nudge` to tell the owner (never at night, at most 3 a day).
//   6. SAVE where it got to: the ids it handled, the new cursor, how it went.
// No new look is started after `deadline` (ms, read from `clock`): the rest stay due for the next call a minute later.
import { BACKOFF_MS, WATCH_LIMITS, isWatchSource, nextSeen, pickNew, readSeen } from "./app-events.js";

const iso = (ms) => new Date(ms).toISOString();

// One watch, already claimed. Returns { status, started, limited, failed }.
async function lookOnce(deps, watch, now) {
  const { admin, clock = Date.now, deadline = Infinity } = deps;
  const tally = { status: "ok", started: 0, limited: 0, failed: 0 };
  const cursorMs = Date.parse(watch.cursor_at);
  const sinceMs = Number.isFinite(cursorMs) ? cursorMs : now;
  let read;
  try {
    read = await deps.read({ admin, watch, sinceMs });
  } catch {
    read = { ok: false, kind: "failed", error: "Hushwork could not look just now. It tries again in a few minutes." };
  }
  if (!read?.ok) {
    const kind = Object.hasOwn(BACKOFF_MS, read?.kind) ? read.kind : "failed";
    const status = kind === "not_connected" ? "not_connected" : "failed";
    const saved = await admin.from("app_watches").update({ last_status: status, last_error: String(read?.error ?? "").slice(0, 300) || null, next_check_at: iso(now + BACKOFF_MS[kind]) }).eq("id", watch.id).eq("user_id", watch.user_id);
    if (saved.error) console.error("saving a watch problem failed:", saved.error.code);
    return { ...tally, status };
  }

  const seen = readSeen(watch.seen);
  const picked = pickNew(read.items, { seen, cursorMs: sinceMs });
  const handled = [];
  let cursor = sinceMs;
  const userId = String(watch.user_id);
  const client = picked.take.length ? deps.clientFor(userId) : null;
  for (const item of picked.take) {
    if (clock() >= deadline) break; // not marked seen: the next look takes it
    handled.push(item.id);
    cursor = Math.max(cursor, item.at);
    const note = async (status, runId = null) => {
      const { data, error } = await admin.from("app_watch_events").insert({ watch_id: watch.id, user_id: userId, status, run_id: runId, preview: item.preview ?? [] }).select("id");
      if (error) console.error("saving an app event failed:", error.code);
      return data?.[0]?.id ?? null;
    };
    // A flood (a newsletter burst, a calendar import) is written down and skipped, never queued up for later: it would only grow.
    const roomNow = deps.limiter.minute.take(userId, now) && deps.limiter.day.take(userId, now);
    const slot = roomNow ? await deps.takeSlot(client) : { ok: false };
    if (!roomNow || !slot.ok) {
      tally.limited += 1;
      await note("limited");
      continue;
    }
    const eventId = await note("started");
    let result = null;
    try {
      result = await deps.run(
        { id: watch.workflow_id, auto: true, allowWrites: false, incoming: { text: item.text, fields: item.fields ?? [], count: item.fields?.length ?? 0, from: watch.source } },
        { user: { id: userId }, supabase: client },
      );
    } catch {
      console.error("a run started by an app event crashed"); // no detail: it could hold something private
    }
    const runId = result?.ok && result.runId ? result.runId : null;
    if (eventId) {
      const saved = await admin.from("app_watch_events").update(runId ? { run_id: runId } : { status: "failed" }).eq("id", eventId);
      if (saved.error) console.error("updating an app event failed:", saved.error.code);
    }
    if (!runId) {
      tally.failed += 1;
      continue;
    }
    tally.started += 1;
    if (result.auto?.waiting > 0 && !result.auto?.stoppedAt) {
      try {
        await deps.nudge({ userId, workflowId: watch.workflow_id, runId, tzOffset: watch.tz_offset ?? 0, now, reason: watch.source === "calendar" ? "event" : "email" });
      } catch {
        console.error("a nudge crashed");
      }
    }
  }

  tally.status = tally.started > 0 ? "new" : tally.limited > 0 ? "limited" : tally.failed > 0 ? "failed" : "ok";
  const update = {
    last_status: tally.status,
    last_error: tally.failed > 0 && tally.started === 0 ? "The workflow could not start. Open it in the Builder and check it still has a Start step and a step that can run." : null,
    seen: nextSeen(seen, handled),
    cursor_at: iso(cursor),
    ...(tally.started > 0 ? { started_count: (Number(watch.started_count) || 0) + tally.started, last_started_at: iso(now) } : {}),
    // More was waiting than one look may start: look again at the next clock call instead of in 2 minutes.
    ...(picked.waiting > 0 || handled.length < picked.take.length ? { next_check_at: iso(now) } : {}),
  };
  const saved = await admin.from("app_watches").update(update).eq("id", watch.id).eq("user_id", watch.user_id);
  if (saved.error) console.error("saving a watch failed:", saved.error.code);
  return tally;
}

// `onlyId` + `userId`: look at ONE watch of one person right now ("Check now" on the Start links page), due or not.
export async function runDueWatches(deps) {
  const { admin, now = Date.now(), clock = Date.now, deadline = Infinity, limit = WATCH_LIMITS.perCall } = deps;
  let query = admin.from("app_watches").select("id, user_id, workflow_id, source, filter, enabled, tz_offset, cursor_at, seen, next_check_at, started_count").eq("enabled", true);
  query = deps.onlyId ? query.eq("id", deps.onlyId).eq("user_id", deps.userId) : query.lte("next_check_at", iso(now)).order("next_check_at", { ascending: true });
  const { data: due, error } = await query.limit(deps.onlyId ? 1 : limit);
  if (error) {
    if (!["42P01", "PGRST205"].includes(error.code)) console.error("loading due watches failed:", error.code);
    return { ok: error.code === "42P01" || error.code === "PGRST205", looked: 0, started: 0, setup: error.code === "42P01" || error.code === "PGRST205" };
  }
  const summary = { ok: true, due: due.length, looked: 0, started: 0, limited: 0, failed: 0, skipped: 0, problems: 0 };
  for (const [position, watch] of due.entries()) {
    if (clock() >= deadline) {
      summary.deferred = due.length - position;
      break;
    }
    if (!isWatchSource(watch.source) || !watch.workflow_id) {
      summary.skipped += 1;
      continue;
    }
    const claimed = await admin.from("app_watches").update({ next_check_at: iso(now + WATCH_LIMITS.checkEveryMs), last_checked_at: iso(now) })
      .eq("id", watch.id).eq("next_check_at", watch.next_check_at).select("id");
    if (claimed.error || !claimed.data?.length) {
      summary.skipped += 1; // another clock call took it
      continue;
    }
    const tally = await lookOnce(deps, watch, now);
    summary.looked += 1;
    summary.started += tally.started;
    summary.limited += tally.limited;
    summary.failed += tally.failed;
    if (tally.status === "not_connected" || tally.status === "failed") summary.problems += 1;
    if (deps.onlyId) summary.status = tally.status;
  }
  return summary;
}

export const watchLimiter = (makeLimiter) => (globalThis.__hushworkWatchLimits ??= { minute: makeLimiter({ max: WATCH_LIMITS.perMinute, windowMs: 60_000 }), day: makeLimiter({ max: WATCH_LIMITS.perDay, windowMs: 86_400_000, calendar: true }) });
