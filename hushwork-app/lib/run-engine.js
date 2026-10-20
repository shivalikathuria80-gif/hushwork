// The practice-run engine. A practice run walks a plan step by step and writes down what each step WOULD do.
// It touches nothing outside Hushwork: no email, no Slack, no spreadsheet. (The one real action, a web call,
// happens in lib/actions/runs.js after an Approve click, never in this walk.) Plain data in, plain data out, no imports from Next.js or Supabase,
// so `node --test` and the server load the same code.
import { STEP_KINDS, isTypedKind } from "./steps.js";
import { fillAnswer, parseCells, parseSheetUrl } from "./connectors/google-sheets.js";

// A "Call a web address" step can also be approved on the Runs page: Hushwork then asks that address (a read-only GET).
export const isRequestStep = (step) => step?.kind === "request" && typeof step?.fields?.url === "string";

// A "Look something up" step set to Linear can be approved on the Runs page: Hushwork then asks Linear for your open tasks
// (read-only). The "what to look for" note is kept for reading; the lookup always lists the person's open assigned tasks.
export const isLinearLookup = (step) => step?.kind === "find" && step?.fields?.where === "linear";

export const linearSummary = (step) =>
  ["Hushwork will ask Linear for up to 10 open tasks assigned to you (read-only, nothing in Linear is changed).", step?.fields?.what ? `Your note: ${step.fields.what}` : ""].filter(Boolean).join(String.fromCharCode(10));

// A "Look something up" step set to Calendar can be approved on the Runs page: Hushwork then asks Google Calendar for the
// person's next events (read-only). The "what to look for" note is kept for reading.
export const isCalendarLookup = (step) => step?.kind === "find" && step?.fields?.where === "calendar";

export const calendarSummary = (step) =>
  ["Hushwork will ask Google Calendar for your next 10 events in the coming 7 days (read-only, nothing in your calendar is changed).", step?.fields?.what ? `Your note: ${step.fields.what}` : ""].filter(Boolean).join(String.fromCharCode(10));

// A "Look something up" step set to Inbox can be approved on the Runs page: Hushwork then asks Gmail for the latest mail in the
// person's inbox (who sent it, the subject and the time; never the text of an email). Read-only.
export const isGmailLookup = (step) => step?.kind === "find" && step?.fields?.where === "inbox";

export const gmailSummary = (step) =>
  ["Hushwork will ask Gmail for the latest 10 messages in your inbox: who sent each one, its subject and its time. It never reads the text inside an email, and it cannot send, change or delete anything.", step?.fields?.what ? `Your note: ${step.fields.what}` : ""].filter(Boolean).join(String.fromCharCode(10));

// A "Look something up" step set to Files can be approved on the Runs page: Hushwork then asks Google Drive for the files the
// person changed most recently (name, kind and time; never what is inside a file). Read-only.
export const isDriveLookup = (step) => step?.kind === "find" && step?.fields?.where === "files";

export const driveSummary = (step) =>
  ["Hushwork will ask Google Drive for the 10 files you changed most recently: each file's name, kind and time. It never opens a file or reads what is inside, and it cannot change or delete anything.", step?.fields?.what ? `Your note: ${step.fields.what}` : ""].filter(Boolean).join(String.fromCharCode(10));

// An "Add a row" step whose Google Sheet address and boxes are valid can be approved on the Runs page: Hushwork then adds that
// one row at the bottom of the sheet. (An older plan that only names a spreadsheet stays a description.)
export const isSheetsRow = (step) => step?.kind === "row" && !parseSheetUrl(step?.fields?.to).error && !parseCells(step?.fields?.values).error;

// What you read before approving: the exact boxes, in order. The server builds the row again from the saved run.
// `answer` is what an Ask the AI step of the same workflow said (or ""): it fills in {answer} so you read the exact words first.
export const sheetsSummary = (step, answer = "") => {
  const parsed = parseCells(step?.fields?.values).cells ?? [];
  const filled = fillAnswer(parsed, answer);
  const cells = filled.cells ?? parsed;
  return ["Hushwork will add ONE row at the bottom of your Google Sheet. It adds a row and changes nothing else.", `The row has ${cells.length} ${cells.length === 1 ? "box" : "boxes"}:`, cells.map((cell, index) => `${index + 1}. ${cell || "(empty)"}`).join(String.fromCharCode(10)), filled.error ?? ""].filter(Boolean).join(String.fromCharCode(10));
};

// An "Ask the AI" step can be approved on the Runs page: the AI then does the job, using only the read-only tool the step allows.
export const isAiStep = (step) => step?.kind === "ai" && typeof step?.fields?.task === "string" && step.fields.task.trim() !== "";

export const aiSummary = (step) => {
  const uses = { linear: "your Linear tasks", calendar: "your Google Calendar", gmail: "your Gmail inbox (sender, subject and time of the latest 10 messages)", drive: "your Google Drive (names and times of your 10 latest files)", mcp: step?.fields?.address ? `the MCP server ${step.fields.address}` : "an MCP server", web: step?.fields?.address ? `the web address ${step.fields.address}` : "a web address" }[step?.fields?.uses];
  return [`Hushwork will ask the AI: ${step?.fields?.task ?? ""}`, uses ? `The AI may look at ${uses}. It can only read; it cannot change anything.` : "The AI will only think; it will not look at anything.", "Your request" + (uses ? " and what it reads" : "") + " go to Groq, the company that runs the AI." + (step?.fields?.uses === "mcp" ? " The AI\u2019s questions to the MCP server go to that server. Only its read-only tools can be used." : "")].join(String.fromCharCode(10));
};

// What you read before approving a web call. The server reads the address from the saved run again when you approve.
export const requestSummary = (step) =>
  ["Hushwork will ask this web address (a read-only GET, nothing is posted):", step?.fields?.url ?? "", step?.fields?.why ? `What it is for: ${step.fields.why}` : ""].filter(Boolean).join(String.fromCharCode(10));

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
  ai: (f, label) => `Would ask the AI: ${f.task}. It could look at: ${label("uses").toLowerCase()}. Nothing was asked.`,
  request: (f) => `Would ask ${f.url} and read the answer${f.why ? ` (${f.why})` : ""}. Nothing was requested.`,
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
