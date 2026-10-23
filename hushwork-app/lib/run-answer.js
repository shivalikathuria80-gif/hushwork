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

// "The answers": ALL the Ask the AI steps of the practice run being approved, in the order they sit in the workflow, so one email can carry
// a whole briefing (calendar, inbox, tasks). Only real runs that came FROM this practice run count (`from` is its id), and an AI step approved
// twice counts once (its newest answer). `run` is { id, workflow_id, created_at }. Returns a list of texts, possibly empty.
export async function findAnswers(supabase, userId, run) {
  if (!run?.id || !run?.workflow_id || !run?.created_at) return [];
  const { data, error } = await supabase
    .from("runs").select("results")
    .eq("user_id", userId).eq("workflow_id", run.workflow_id).eq("mode", "live").gte("created_at", run.created_at)
    .order("created_at", { ascending: false }).limit(40);
  if (error || !Array.isArray(data)) return [];
  const byStep = new Map();
  for (const row of data) {
    const first = Array.isArray(row.results) ? row.results[0] : null;
    if (first?.kind === "ai" && first.from === run.id && Number.isInteger(first.fromStep) && typeof first.answer === "string" && first.answer.trim() && !byStep.has(first.fromStep)) byStep.set(first.fromStep, first.answer);
  }
  return [...byStep.entries()].sort((a, b) => a[0] - b[0]).map(([, answer]) => answer);
}

// {answer} inside one piece of text (a task title, say): the answer is flattened to one line, cut to 500 characters, put in, and the
// whole text is cut to `max`. Returns { text } or { error } (the text uses {answer} but there is no answer yet).
export function fillAnswerText(text, answer, max) {
  if (!text.includes(ANSWER_TAG)) return { text };
  const words = typeof answer === "string" ? answer.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER_LENGTH) : "";
  if (!words) return { error: NO_ANSWER };
  return { text: text.split(ANSWER_TAG).join(words).slice(0, max) };
}

// The "more details" of a Do something in another app step. For an email the text is a letter, so line breaks are kept (at most one blank
// line in a row) and it may be up to 3000 characters; for everything else it is the one-line version above, up to 300. The Runs page and
// the Approve action both call this, so the email you read before pressing Approve is the email that is sent.
export const ANSWERS_TAG = "{answers}";
const tidy = (value) => value.replace(/\r/g, "").replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]+/g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

export function fillActionDetails(actionId, text, answer, answers = []) {
  if (actionId !== "gmail_send") return fillAnswerText(text, answer, 300);
  if (text.includes(ANSWERS_TAG)) {
    const all = Array.isArray(answers) ? answers.filter((one) => typeof one === "string" && tidy(one)).map((one) => tidy(one).slice(0, 1200)) : [];
    if (!all.length) return { error: NO_ANSWER };
    const joined = all.join("\n\n").slice(0, 2800);
    return fillActionDetails(actionId, text.split(ANSWERS_TAG).join(ANSWER_TAG), joined);
  }
  if (!text.includes(ANSWER_TAG)) return { text };
  const words = typeof answer === "string"
    ? answer.replace(/\r/g, "").replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]+/g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 2800)
    : "";
  if (!words) return { error: NO_ANSWER };
  return { text: text.split(ANSWER_TAG).join(words).slice(0, 3000) };
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
