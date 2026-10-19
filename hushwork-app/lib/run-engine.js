// The practice-run engine. A practice run walks a plan step by step and writes down what each step WOULD do.
// It touches nothing outside Hushwork: no email, no Slack, no spreadsheet. (The one real action, a Telegram message,
// happens in lib/actions/runs.js after an Approve click, never in this walk.) Plain data in, plain data out, no imports from Next.js or Supabase,
// so `node --test` and the server load the same code.
import { STEP_KINDS, isTypedKind } from "./steps.js";

// Telegram is the first real connection. A "send" step set to "On Telegram" can be approved on the Runs page and then
// posts one message to the owner's own Telegram chat. Everything else stays a practice.
export const isTelegramSend = (step) => step?.kind === "send" && step?.fields?.how === "telegram";

// The exact text that would be posted, built from a SAVED run result. The server builds it again when you approve, so what
// you read on screen is what is sent and the browser cannot change it.
export const telegramMessage = (workflowName, step) =>
  [`Hushwork: ${String(workflowName).slice(0, 120)}`, String(step?.detail ?? "").slice(0, 300), "", "Sent after you approved it in Hushwork."].join("\n");

// Shown when the "runs" table has not been created in Supabase yet (see supabase/runs.sql).
export const SETUP_MESSAGE = "Run history needs one setup step that is not done yet. Open supabase/runs.sql and run it in Supabase.";

const MAX_TEXT = 300;
const short = (text) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text);

// What each kind would do, in one sentence. `f` = the step's fields, `label(key)` = the shown name of a choice.
const WOULD = {
  trigger: (f, label) => `Would start: ${label("how").toLowerCase()}${f.when ? ` (${f.when})` : ""}. A practice run starts right now.`,
  find: (f, label) => `Would look in ${label("where").toLowerCase()} for: ${f.what}. Nothing was opened.`,
  write: (f, label) => `Would draft ${label("what").toLowerCase()}${f.about ? ` about ${f.about}` : ""}. Nothing was written.`,
  approve: (f) => `Would stop and wait for your yes${f.what ? ` to: ${f.what}` : ""}. A practice run carries on.`,
  send: (f, label) => `Would send ${label("how").toLowerCase()} to ${f.to}${f.about ? ` about ${f.about}` : ""}. Nothing was sent.`,
  row: (f) => `Would add a row to ${f.to}: ${f.values}. Nothing was added.`,
};

// One step of a saved plan -> one result. Never throws, whatever the step looks like.
export function practiceStep(step) {
  const text = (value) => (typeof value === "string" ? value : "");
  const base = { icon: text(step?.icon), title: short(text(step?.title)), detail: short(text(step?.detail)) };
  if (isTypedKind(step?.kind) && step.fields && typeof step.fields === "object") {
    const spec = STEP_KINDS[step.kind];
    const f = {};
    for (const field of spec.fields) f[field.key] = text(step.fields[field.key]);
    const label = (key) => spec.fields.find((field) => field.key === key).options[f[key]] ?? f[key];
    return { ...base, kind: step.kind, fields: f, status: "done", outcome: short(WOULD[step.kind](f, label)) };
  }
  return { ...base, status: "done", outcome: "A note. There is nothing to do for this step." };
}

// A whole plan -> { status, results }. An empty or broken plan is "failed" with a reason, not a crash.
export function practiceRun(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return { status: "failed", results: [] };
  return { status: "done", results: plan.map(practiceStep) };
}

// Reads saved results back from the database for the screen: strings only, known fields only.
export function readSavedResults(value) {
  if (!Array.isArray(value)) return [];
  const text = (v) => (typeof v === "string" ? v : "");
  return value.map((r) => {
    const read = { icon: text(r?.icon), title: text(r?.title), detail: text(r?.detail), outcome: text(r?.outcome), status: r?.status === "failed" ? "failed" : "done" };
    if (isTypedKind(r?.kind) && r.fields && typeof r.fields === "object") {
      read.kind = r.kind;
      read.fields = {};
      for (const field of STEP_KINDS[r.kind].fields) read.fields[field.key] = text(r.fields[field.key]);
    }
    return read;
  });
}
