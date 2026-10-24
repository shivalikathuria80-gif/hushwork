import { parseWhen } from "./schedule-text.js";
import { checkSchedule, describeSchedule, nextRun } from "./schedule.js";
import { isApprovable } from "./run-engine.js";

// Makes the Start step's schedule REAL. A workflow whose Start says "On a schedule: Every weekday at 17:30" gets a saved schedule when it is
// saved in the Builder, so what is written there is what runs. It is careful:
//   - it only reads the saved workflow, never the browser's copy of the plan,
//   - it creates a schedule only when the words can be read (lib/schedule-text.js) and the workflow has a step that can really run,
//   - a NEW schedule starts with "may write" OFF (only reading steps run by themselves) until the person ticks it on the Workflows page,
//   - an existing schedule keeps its "may write" and "paused" choices, and only its time changes,
//   - nothing is ever deleted (a workflow that stops saying "on a schedule" keeps whatever schedule it has; remove it on the Workflows page).
// Returns { text } : one sentence for the Builder to show (empty when the Start step has nothing to do with a schedule).
export const MAX_SCHEDULES = 10;
const NO_TABLE = new Set(["42P01", "PGRST205"]);

const quoted = (value) => `"${String(value ?? "").slice(0, 40)}"`;

export async function syncStartSchedule({ supabase, userId, workflowId, plan, tzOffset, now = Date.now() }) {
  const start = Array.isArray(plan) ? plan[0] : null;
  if (start?.kind !== "trigger" || start.fields?.how !== "schedule") return { text: "" };

  const when = parseWhen(start.fields.when);
  if (!when) return { text: `The Start step says "On a schedule", but the time ${quoted(start.fields.when)} could not be read, so nothing is scheduled. Write it like "Every Monday at 9:00" or "Every weekday at 17:30".` };
  if (!plan.some((step) => isApprovable(step))) return { text: "The Start step says \"On a schedule\", but none of this workflow's steps can really run yet (they only describe a plan), so nothing is scheduled." };

  const { data: rows, error: loadError } = await supabase.from("schedules").select("workflow_id, frequency, hour, minute, weekday, tz_offset, allow_writes, enabled").eq("user_id", userId);
  if (loadError) {
    console.error("loading schedules failed:", loadError.code);
    return { text: NO_TABLE.has(loadError.code) ? "Scheduling is not set up on this server yet, so nothing is scheduled." : "The workflow was saved, but its schedule could not be saved. Set it on the Workflows page." };
  }
  const existing = rows.find((row) => row.workflow_id === workflowId);
  if (!existing && rows.length >= MAX_SCHEDULES) return { text: `You already have ${MAX_SCHEDULES} schedules, so this one was not added. Remove one on the Workflows page.` };

  const checked = checkSchedule({ ...when, tzOffset, allowWrites: existing?.allow_writes === true, enabled: existing ? existing.enabled !== false : true });
  if (checked.error) return { text: `The workflow was saved, but its schedule was not: ${checked.error}` };
  const s = checked.value;
  const words = `${describeSchedule(s)} (your time)`;

  if (existing && existing.frequency === s.frequency && existing.hour === s.hour && existing.minute === s.minute && existing.weekday === s.weekday && existing.tz_offset === s.tzOffset) {
    return { text: `Scheduled: ${words}. Already set.` };
  }

  const choices = { frequency: s.frequency, hour: s.hour, minute: s.minute, weekday: s.weekday, tz_offset: s.tzOffset, allow_writes: s.allowWrites, enabled: s.enabled, next_run_at: new Date(nextRun(s, now)).toISOString() };
  const { error } = existing
    ? await supabase.from("schedules").update(choices).eq("workflow_id", workflowId).eq("user_id", userId)
    : await supabase.from("schedules").insert({ workflow_id: workflowId, ...choices });
  if (error) {
    console.error("saving a schedule from the Start step failed:", error.code);
    return { text: NO_TABLE.has(error.code) ? "Scheduling is not set up on this server yet, so nothing is scheduled." : "The workflow was saved, but its schedule could not be saved. Set it on the Workflows page." };
  }
  const tail = !s.enabled ? " It is paused: press Resume on the Workflows page." : s.allowWrites ? " It may write by itself." : " It only reads by itself: tick \"Let it write by itself\" on the Workflows page if it should send or create things.";
  return { text: `Scheduled: ${words}.${tail}` };
}
