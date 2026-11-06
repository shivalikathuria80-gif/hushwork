// "Waiting for you": how many steps of each workflow's LATEST run still wait for the person's Approve on the Runs page. Built only from what the
// runs table already holds (a practice run and the small "live" records under it, see lib/run-state.js); no table of its own.
// Plain code: `supabase` is handed in, so tests can use a fake one.
import { readSavedResults, stepState } from "./run-engine.js";

const RUNS_LIMIT = 100; // the newest practice runs looked at; an agent whose latest run is older than these shows nothing (never a wrong number)
const RECORDS_LIMIT = 300; // the live records looked at; when there are more, nothing is shown rather than a guess

// The records of ONE practice run (oldest first, each the first entry of a live row's results) sorted the way the Runs page sorts them
// (components/app/RunsViewer.js): done, stopped (a refusal or a stop note) or started but never seen to finish. Returns how many steps are
// "waiting": a step that can be approved and has no record at all, which is what the Runs page marks Waiting and offers Approve for.
// A watch run that ended quietly ("nothing new") has nothing waiting: the steps after the quiet stop were never meant to run.
export function countWaiting(results, records) {
  const steps = Array.isArray(results) ? results : [];
  const done = new Set();
  const stopped = new Set();
  const unknown = new Set();
  for (const first of Array.isArray(records) ? records : []) {
    if (!first || !Number.isInteger(first.fromStep)) continue;
    if (first.quiet === true) return 0;
    if (first.status === "failed") { stopped.add(first.fromStep); if (!first.note) unknown.delete(first.fromStep); }
    else if (first.status === "pending") { unknown.add(first.fromStep); stopped.delete(first.fromStep); }
    else { done.add(first.fromStep); stopped.delete(first.fromStep); unknown.delete(first.fromStep); }
  }
  return steps.filter((step, index) => stepState(step, index, done, stopped, unknown) === "waiting").length;
}

// For the person's workflows `workflowIds` (at most 50): Map(workflowId -> { runId, waiting }) for each one whose latest run has a step waiting.
// Two bounded queries, both limited to the person's own rows (and the database's own rules, RLS, say the same). Any failure gives an empty Map:
// the cards then simply show no count.
export async function loadWaiting(supabase, userId, workflowIds) {
  const waiting = new Map();
  const ids = (Array.isArray(workflowIds) ? workflowIds : []).filter((id) => typeof id === "string" && id).slice(0, 50);
  if (!ids.length) return waiting;
  try {
    const { data: runs, error } = await supabase
      .from("runs").select("id, workflow_id, results, created_at")
      .eq("user_id", userId).eq("mode", "practice").in("workflow_id", ids)
      .order("created_at", { ascending: false }).limit(RUNS_LIMIT);
    if (error || !Array.isArray(runs)) return waiting;
    const latest = new Map(); // workflowId -> its newest practice run (the list is newest first)
    for (const run of runs) if (typeof run?.workflow_id === "string" && !latest.has(run.workflow_id)) latest.set(run.workflow_id, run);
    if (!latest.size) return waiting;

    const oldest = [...latest.values()].map((run) => String(run.created_at ?? "")).sort()[0];
    let query = supabase
      .from("runs").select("results, created_at")
      .eq("user_id", userId).eq("mode", "live").in("workflow_id", [...latest.keys()]);
    if (oldest) query = query.gte("created_at", oldest);
    const { data: rows, error: recordsError } = await query.order("created_at", { ascending: true }).limit(RECORDS_LIMIT);
    if (recordsError || !Array.isArray(rows) || rows.length >= RECORDS_LIMIT) return waiting;

    const byRun = new Map(); // practice run id -> its records, oldest first
    for (const row of rows) {
      const first = readSavedResults(row?.results)[0];
      if (first?.from) byRun.set(first.from, [...(byRun.get(first.from) ?? []), first]);
    }
    for (const [workflowId, run] of latest) {
      const count = countWaiting(readSavedResults(run.results), byRun.get(run.id));
      if (count > 0) waiting.set(workflowId, { runId: String(run.id), waiting: count });
    }
  } catch {
    // no count shown
  }
  return waiting;
}
