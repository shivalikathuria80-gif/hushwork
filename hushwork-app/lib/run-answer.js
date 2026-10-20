// "The answer": what an Ask the AI step of the same workflow said after the person approved it. An Add a row step may use it
// by writing {answer} in a box (see fillAnswer in lib/connectors/google-sheets.js). The Runs page and the Approve action both call
// this, so the words the person reads before pressing Approve are the words that get written.
//
// How it is found: the practice run being approved is `run` ({ workflow_id, created_at }). The answer is the newest REAL run of
// the same workflow, saved after that practice run, whose first step is an Ask the AI step with a saved `answer`. Only the signed-in
// person's own runs can be read (user_id filter plus the database rules). Returns the text, or "" when there is none.
export async function findAnswer(supabase, userId, run) {
  if (!run?.workflow_id || !run?.created_at) return "";
  const { data, error } = await supabase
    .from("runs").select("results")
    .eq("user_id", userId).eq("workflow_id", run.workflow_id).eq("mode", "live").gte("created_at", run.created_at)
    .order("created_at", { ascending: false }).limit(10);
  if (error || !Array.isArray(data)) return "";
  for (const row of data) {
    const first = Array.isArray(row.results) ? row.results[0] : null;
    if (first?.kind === "ai" && typeof first.answer === "string" && first.answer.trim()) return first.answer;
  }
  return "";
}
