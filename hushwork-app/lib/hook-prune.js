// START LINK DATA CONTROLS: the two database calls the server makes with the all-access client (supabase/hooks-data.sql). Plain code, so the
// clock (lib/schedule-tick.js), the link's address (app/api/hooks/[code]) and tests share it.
import { NO_DATA_SETUP } from "./hook-data.js";

// How many arrivals of one link started a run since `since` (ISO). null when it could not be counted.
export async function countStartedSince(admin, hookId, since) {
  const { count, error } = await admin.from("hook_events").select("id", { count: "exact", head: true }).eq("hook_id", hookId).eq("status", "started").gte("created_at", since);
  if (error) {
    console.error("counting today's arrivals failed:", error.code);
    return null;
  }
  return Number(count) || 0;
}

// Removes the words one run kept of an arrival (for an arrival deleted while its run was still starting).
export async function scrubRun(admin, runId, ownerId) {
  const { error } = await admin.rpc("scrub_arrival_text", { p_runs: [runId], p_owner: ownerId });
  if (error && !NO_DATA_SETUP.has(error.code)) console.error("removing a run's arrival words failed:", error.code);
}

// Deletes arrivals older than their link's keep days (and the words their runs kept). `hookId` null: every link, 500 at most per call.
// Returns how many went, or 0 (also before hooks-data.sql is run: that is not an error worth a log line every minute).
export async function pruneArrivals(admin, hookId = null) {
  if (!admin) return 0;
  const { data, error } = await admin.rpc("prune_arrivals", { p_hook: hookId });
  if (error) {
    if (!NO_DATA_SETUP.has(error.code)) console.error("deleting old arrivals failed:", error.code);
    return 0;
  }
  return Number(data) || 0;
}
