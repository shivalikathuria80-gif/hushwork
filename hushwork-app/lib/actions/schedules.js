"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import { checkSchedule, nextRun } from "@/lib/schedule";

// The Schedule panel on the Workflows page. A person chooses WHEN one of their own workflows runs by itself; the clock that actually runs
// it is lib/schedule-tick.js. Same four habits as the other actions: requireUser first, validate, talk to the database (user_id is filled in
// by the database and the privacy rules keep every row the caller's own), return a SMALL object. Raw database errors are never returned.
//
// The person can write only the choices (when, and may it write); the bookkeeping columns (last_run_at, last_status, last_run_id) belong to the
// runner. There is one schedule per workflow, and at most MAX_SCHEDULES per person, so nobody can set up a flood of runs.
const NO_TABLE = new Set(["42P01", "PGRST205"]);
const SETUP = "Scheduling needs one setup step that is not done yet. Open supabase/schedules.sql and run it in Supabase.";
const MAX_SCHEDULES = 10;
const FAILED = "Could not save the schedule. Check your connection and try again.";

// Saves (or changes) the schedule of one workflow. Returns { ok: true, nextRunAt } or { error }.
export async function saveSchedule(input) {
  const user = await requireUser();
  const id = checkId(input?.workflowId);
  if (id.error) return { error: "That workflow no longer exists." };
  const checked = checkSchedule(input);
  if (checked.error) return { error: checked.error };
  const s = checked.value;
  const nextRunAt = new Date(nextRun(s, Date.now())).toISOString();
  const choices = { frequency: s.frequency, hour: s.hour, minute: s.minute, weekday: s.weekday, tz_offset: s.tzOffset, allow_writes: s.allowWrites, enabled: s.enabled, next_run_at: nextRunAt };

  const supabase = await createClient();
  const { data: mine, error: loadError } = await supabase.from("schedules").select("workflow_id").eq("user_id", user.id);
  if (loadError) {
    console.error("loading schedules failed:", loadError.code);
    return { error: NO_TABLE.has(loadError.code) ? SETUP : FAILED };
  }
  const exists = mine.some((row) => row.workflow_id === id.value);
  if (!exists && mine.length >= MAX_SCHEDULES) return { error: `You can have up to ${MAX_SCHEDULES} schedules. Remove one first.` };

  // Not an "upsert": an upsert would also need permission to change workflow_id, which nobody has (see supabase/schedules.sql).
  const { error } = exists
    ? await supabase.from("schedules").update(choices).eq("workflow_id", id.value).eq("user_id", user.id)
    : await supabase.from("schedules").insert({ workflow_id: id.value, ...choices });
  if (error) {
    console.error("saving a schedule failed:", error.code);
    return { error: NO_TABLE.has(error.code) ? SETUP : FAILED };
  }
  revalidatePath("/app/workflows");
  return { ok: true, nextRunAt };
}

// Removes the schedule of one workflow (the workflow itself stays). Returns { ok: true } or { error }.
export async function deleteSchedule(input) {
  const user = await requireUser();
  const id = checkId(input?.workflowId);
  if (id.error) return { error: "That workflow no longer exists." };
  const supabase = await createClient();
  const { error } = await supabase.from("schedules").delete().eq("workflow_id", id.value).eq("user_id", user.id);
  if (error) {
    console.error("deleting a schedule failed:", error.code);
    return { error: "Could not remove the schedule. Try again." };
  }
  revalidatePath("/app/workflows");
  return { ok: true };
}
