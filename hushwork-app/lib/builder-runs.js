// The Builder's Executions tab: the runs of ONE workflow, read from the runs table, as short rows for the screen.
// Pure code (the page reads the rows and hands them in), so it is tested in flow-graph.test.js.
//   a PRACTICE run is one go at the workflow (reading steps happen by themselves, a step that sends waits for Approve);
//   a LIVE record is one step really done after Approve.
import { readSavedResults, runOutcome } from "./run-engine.js";

const TONE = { completed: "good", partial: "good", waiting: "you", stopped: "bad", unsure: "bad", practice: "preview" };

// rows: [{ id, mode, created_at, results }] straight from Supabase. Returns [{ id, live, at, label, tone, steps, title }], newest first.
export function runRows(rows) {
  const list = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row.id !== "string" || !row.id) continue;
    const at = Date.parse(typeof row.created_at === "string" ? row.created_at : "");
    const results = readSavedResults(row.results);
    const live = row.mode === "live";
    let label;
    let tone;
    if (live) {
      const first = results[0];
      label = !first ? "Done" : first.quiet ? "Nothing new" : first.status === "failed" ? "Stopped" : first.status === "pending" ? "Not sure it finished" : "Done for real";
      tone = !first ? "good" : first.quiet ? "quiet" : first.status === "failed" || first.status === "pending" ? "bad" : "good";
    } else {
      const outcome = runOutcome(results);
      label = outcome.label;
      tone = TONE[outcome.key] ?? "preview";
    }
    list.push({ id: row.id, live, at: Number.isFinite(at) ? at : 0, label, tone, steps: results.length, title: results.find((r) => r.title && !r.note)?.title?.slice(0, 80) ?? "" });
  }
  return list.sort((a, b) => b.at - a.at);
}
