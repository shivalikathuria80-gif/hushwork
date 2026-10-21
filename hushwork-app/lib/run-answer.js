import { ANSWER_TAG, MAX_ANSWER_LENGTH, NO_ANSWER } from "./connectors/google-sheets.js";

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

// {answer} inside one piece of text (a task title, say): the answer is flattened to one line, cut to 500 characters, put in, and the
// whole text is cut to `max`. Returns { text } or { error } (the text uses {answer} but there is no answer yet).
export function fillAnswerText(text, answer, max) {
  if (!text.includes(ANSWER_TAG)) return { text };
  const words = typeof answer === "string" ? answer.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER_LENGTH) : "";
  if (!words) return { error: NO_ANSWER };
  return { text: text.split(ANSWER_TAG).join(words).slice(0, max) };
}

// Steps that WRITE somewhere (add a row, create a task) are approved once per step of a practice run, so going back and pressing
// Approve again cannot add a second copy. True when a real run of this kind from this practice run and step already exists.
export async function wasApproved(supabase, userId, run, kind) {
  const { data, error } = await supabase
    .from("runs").select("id")
    .eq("user_id", userId).eq("mode", "live")
    .contains("results", JSON.stringify([{ kind, from: run.id, fromStep: run.stepIndex }])).limit(1); // JSON TEXT on purpose: handed an array, the database client would write it as a Postgres list and match nothing
  return !error && Array.isArray(data) && data.length > 0;
}
