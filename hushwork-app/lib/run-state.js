// What state is each step of a run in? A run is never edited once it is saved, so the state of a step is told by small records added under it,
// oldest first, and the NEWEST one for a step wins:
//   "pending"  the step was about to be done (a real write) and Hushwork never saw how it ended: the answer is UNKNOWN
//   "failed"   it did not happen (and we know it did not)
//   "done"     it happened
// No record at all means the step has not been tried. Reading steps do not write a "pending" record (doing them twice changes nothing), but
// every step that WRITES somewhere (send, create, add) does, BEFORE it asks the other app, so a crash or a dropped connection can never lead to
// the same email or task being sent twice: an unknown step is stopped on and the person decides.
// This file is plain code (no Next.js, no database client of its own) so tests can run it; `supabase` is handed in.
import { checkId } from "./validate.js";

// A record's own status word becomes one of three states.
export const stateOf = (status) => (status === "failed" ? "failed" : status === "pending" ? "pending" : "done");

// rows: the saved "live" runs of one practice run, oldest first. Returns Map(step number -> { status, outcome }).
export function statesFromRows(rows, runId) {
  const states = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const first = Array.isArray(row?.results) ? row.results[0] : null;
    if (!first || first.note === true || first.from !== runId ||!Number.isInteger(first.fromStep) || first.fromStep < 0 || first.fromStep > 99) continue;
    states.set(first.fromStep, { status: stateOf(first.status), outcome: typeof first.outcome === "string" ? first.outcome : "" });
  }
  return states;
}

// Every step state of one run, or null when the database could not be asked (the caller must then NOT assume "not tried" for a write).
export async function loadStepStates(supabase, userId, runId) {
  if (checkId(runId).error) return null;
  try {
    const { data, error } = await supabase
      .from("runs").select("results, created_at")
      .eq("user_id", userId).eq("mode", "live")
      .contains("results", JSON.stringify([{ from: runId }])) // JSON TEXT on purpose: handed an array, the database client would write it as a Postgres list and match nothing
      .order("created_at", { ascending: true }).limit(200);
    if (error || !Array.isArray(data)) return null;
    return statesFromRows(data, runId);
  } catch {
    return null;
  }
}

// The state of ONE step: { status: "done" | "failed" | "pending" | null } or { error: true } when it could not be checked.
export async function stepStatus(supabase, userId, run) {
  const states = await loadStepStates(supabase, userId, run?.id);
  if (!states) return { error: true };
  return { status: states.get(run.stepIndex)?.status ?? null };
}

export const PENDING_MESSAGE = "This step was started, but Hushwork never saw whether it finished (the connection may have dropped). It may already have been done, so it was not sent again. Check the app first. If it was NOT done, press \"It was not done, try again\".";
export const UNCHECKED_MESSAGE = "Hushwork could not check whether this step already ran, so it was not done. Try again in a moment.";
