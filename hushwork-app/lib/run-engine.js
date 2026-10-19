// The practice-run engine. A practice run walks a plan step by step and writes down what each step WOULD do.
// It touches nothing outside Hushwork: no email, no Slack, no spreadsheet. (A real run will reuse this walk and
// add one real action behind an Approve click.) Plain data in, plain data out, no imports from Next.js or Supabase,
// so `node --test` and the server load the same code.
import { STEP_KINDS, isTypedKind } from "./steps.js";

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
    return { ...base, kind: step.kind, status: "done", outcome: short(WOULD[step.kind](f, label)) };
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
  return value.map((r) => ({
    icon: text(r?.icon), title: text(r?.title), detail: text(r?.detail), outcome: text(r?.outcome),
    status: r?.status === "failed" ? "failed" : "done",
  }));
}
