import { ANSWER_TAG, MAX_ANSWER_LENGTH, NO_ANSWER } from "./connectors/google-sheets.js";
import { isNothingNew } from "./watch-rules.js";

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
// twice counts once (its newest answer). `run` is { id, workflow_id, created_at }, and may carry `before` (a step number): then only the Ask the AI
// steps that come BEFORE that step count (an Ask the AI step that uses {answers} must not read its own old answer or a later step's). Returns a list of texts, possibly empty.
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
    if (Number.isInteger(run.before) && first?.fromStep >= run.before) continue;
    if (first?.kind === "ai" && first.from === run.id && Number.isInteger(first.fromStep) && typeof first.answer === "string" && first.answer.trim() && !byStep.has(first.fromStep)) byStep.set(first.fromStep, first.answer);
  }
  return [...byStep.entries()].sort((a, b) => a[0] - b[0]).map(([, answer]) => answer);
}

// "The last check": what THIS SAME Ask the AI step answered in the PREVIOUS practice run of the same workflow (a job that writes {last}, which is how a
// watch workflow notices only what is new). `run` is { id, workflow_id, created_at } of the practice run being approved and `stepIndex` is the step.
// The previous practice run is the newest one of this workflow created before this run; only its answer for the same step counts (never another step's,
// never another workflow's). Returns the text, or "" when there is none (the first check: that is not an error).
export const LAST_TAG = "{last}";
export async function findLastAnswer(supabase, userId, run, stepIndex) {
  if (!run?.id || !run?.workflow_id || !run?.created_at || !Number.isInteger(stepIndex)) return "";
  const { data: before, error } = await supabase
    .from("runs").select("id, created_at")
    .eq("user_id", userId).eq("workflow_id", run.workflow_id).eq("mode", "practice")
    .order("created_at", { ascending: false }).limit(10);
  if (error || !Array.isArray(before)) return "";
  // Older checks first matter too: a check that said NOTHING NEW teaches nothing, so it is skipped and the one before it is used (otherwise the AI would
  // be told "last time: nothing new" and could report something it already flagged two checks ago).
  for (const previous of before.filter((one) => one.id !== run.id && Date.parse(one.created_at) < Date.parse(run.created_at))) {
    const { data, error: liveError } = await supabase
      .from("runs").select("results")
      .eq("user_id", userId).eq("workflow_id", run.workflow_id).eq("mode", "live")
      .contains("results", JSON.stringify([{ from: previous.id, fromStep: stepIndex }])) // JSON TEXT on purpose (see loadStepStates in lib/run-state.js)
      .order("created_at", { ascending: false }).limit(10);
    if (liveError || !Array.isArray(data)) return "";
    for (const row of data) {
      const first = Array.isArray(row.results) ? row.results[0] : null;
      if (first?.kind === "ai" && first.from === previous.id && first.fromStep === stepIndex && typeof first.answer === "string" && first.answer.trim() && !isNothingNew(first.answer)) return first.answer;
    }
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

// The "more details" of a Do something in another app step. For an email (or the text of a Notion page or a Google file) the text is a letter, so line breaks are kept (at most one blank
// line in a row) and it may be up to 3000 characters; for everything else it is the one-line version above, up to 300. The Runs page and
// the Approve action both call this, so the email you read before pressing Approve is the email that is sent.
export const ANSWERS_TAG = "{answers}";
const tidy = (value) => value.replace(/\r/g, "").replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]+/g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

// Actions whose details are a LETTER or a page of text (line breaks kept, up to 3000 characters). That includes the rows of a new sheet and the outline of a new
// presentation (one row or one slide per line), the text of a new document and the text of an email draft.
const LETTER_ACTIONS = new Set(["gmail_send", "gmail_draft", "notion_page", "sheet_create", "slides_create", "doc_create"]);

export function fillActionDetails(actionId, text, answer, answers = []) {
  if (!LETTER_ACTIONS.has(actionId)) return fillAnswerText(text, answer, 300);
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
