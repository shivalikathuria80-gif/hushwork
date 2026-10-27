import { describeSchedule, nextRun } from "./schedule.js";
import { inQuietHours, isWatchPlan } from "./watch-rules.js";

// Runs every schedule that is due. `admin` is the all-access client (lib/supabase/admin.js); `run` is startPracticeRun from lib/run-core.js
// (handed in by lib/schedule-tick.js, so this file has no imports of its own and tests never touch real services). For each due schedule:
//   1. CLAIM it: its next_run_at is moved forward in one update that only succeeds if nobody else moved it first, so two overlapping
//      clock calls can never run the same schedule twice.
//   2. RUN the workflow the way Auto mode does, as the person who owns the schedule (startPracticeRun saves a practice run, then does each
//      real step through the normal Approve actions, so every limit and safety rule applies). Steps that WRITE are skipped unless the
//      person ticked "allow writing" for this schedule.
//   3. WRITE DOWN how it went (ok, stopped at a step, or failed).
// A schedule that is days overdue (the server was off) runs ONCE and then waits for its next normal time: there is no catching up.
// At most `limit` schedules per call, so one call cannot run for ever.
// WATCH MODE (lib/watch-rules.js) adds two things, and changes nothing for other schedules:
//   - a due WATCH schedule in the person's quiet hours (20:00 to 08:00 their time) is still claimed, so its next time moves on, but it is NOT run: no AI
//     cost, no email. It is counted as `skipped`.
//   - after a watch run that found something new and left a step waiting for the person's Approve, `nudge` is called (it sends ONE plain email, if the
//     person is allowed one now). A watch run that ended quietly ("nothing new") is `ok` and tells nobody anything.
const toSchedule = (row) => ({ frequency: row.frequency, hour: row.hour, minute: row.minute, weekday: row.weekday, tzOffset: row.tz_offset });

// Is this schedule's workflow a watch workflow? Read from its saved Start step; a problem reading it counts as "no".
async function isWatchWorkflow(admin, row) {
  try {
    const { data } = await admin.from("workflows").select("plan").eq("id", row.workflow_id).eq("user_id", row.user_id).limit(1);
    return isWatchPlan(data?.[0]?.plan);
  } catch {
    return false;
  }
}

export async function runDueSchedules({ admin, run, notify = async () => {}, nudge = async () => {}, now = Date.now(), limit = 20 }) {
  const { data: due, error } = await admin
    .from("schedules")
    .select("id, user_id, workflow_id, frequency, hour, minute, weekday, tz_offset, allow_writes, next_run_at, last_status")
    .eq("enabled", true).lte("next_run_at", new Date(now).toISOString())
    .order("next_run_at", { ascending: true }).limit(limit);
  if (error) {
    console.error("loading due schedules failed:", error.code);
    return { ok: false };
  }
  const summary = { ok: true, due: due.length, ran: 0, stopped: 0, failed: 0, skipped: 0 };

  for (const row of due) {
    const claimed = await admin
      .from("schedules")
      .update({ next_run_at: new Date(nextRun(toSchedule(row), now)).toISOString(), last_run_at: new Date(now).toISOString() })
      .eq("id", row.id).eq("next_run_at", row.next_run_at).select("id");
    if (claimed.error || !claimed.data?.length) {
      summary.skipped += 1; // someone else already took it
      continue;
    }
    if (inQuietHours(now, row.tz_offset) && (await isWatchWorkflow(admin, row))) {
      summary.skipped += 1; // night time: claimed above, not run
      continue;
    }

    let status = "failed";
    let runId = null;
    let auto = null;
    try {
      const result = await run({ id: row.workflow_id, auto: true, allowWrites: row.allow_writes === true, startedBy: `${describeSchedule(toSchedule(row))} (your time)` }, { user: { id: row.user_id }, supabase: admin });
      if (result?.ok) {
        runId = result.runId || null;
        auto = result.auto ?? null;
        status = result.auto?.stoppedAt ? "stopped" : "ok";
      }
    } catch {
      console.error("a scheduled run crashed"); // no detail: it could hold something private
    }
    await admin.from("schedules").update({ last_status: status, last_run_id: runId }).eq("id", row.id);
    // Tell the person ONCE when a schedule starts having trouble (it was fine, or never ran, and now it is not). A failing notice never fails the run.
    if (status !== "ok" && (row.last_status === "ok" || row.last_status == null)) {
      try {
        await notify({ userId: row.user_id, workflowId: row.workflow_id, status });
      } catch {
        console.error("a failure notice crashed");
      }
    }
    // Watch mode: something new and a step waiting for the person -> ask `nudge` to tell them (it decides whether it may; a crash here changes nothing).
    if (status === "ok" && auto?.watch === true && auto.quiet !== true && auto.waiting > 0 && runId) {
      try {
        await nudge({ userId: row.user_id, workflowId: row.workflow_id, runId, tzOffset: row.tz_offset, now });
      } catch {
        console.error("a watch nudge crashed");
      }
    }
    if (status === "ok") summary.ran += 1;
    else if (status === "stopped") summary.stopped += 1;
    else summary.failed += 1;
  }
  return summary;
}
