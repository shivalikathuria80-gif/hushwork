// The practice-run engine. A practice run walks a plan step by step and writes down what each step WOULD do.
// It touches nothing outside Hushwork: no email, no Slack, no spreadsheet. (The one real action, a web call,
// happens in lib/actions/runs.js after an Approve click, never in this walk.) Plain data in, plain data out, no imports from Next.js or Supabase,
// so `node --test` and the server load the same code.
import { STEP_KINDS, describeStep, isTypedKind } from "./steps.js";
import { checkId } from "./validate.js";
import { findComposioApp, parseAppAddress } from "./connectors/composio-apps.js";
import { EXAMPLE_NOTICE, checkTarget, findAction, isExampleTarget, labelFor, resolveTarget } from "./connectors/composio-actions.js";
import { fillActionDetails, fillAnswerText } from "./run-answer.js";
import { fillAnswer, parseCells, parseSheetUrl } from "./connectors/google-sheets.js";

// A "Call a web address" step can also be approved on the Runs page: Hushwork then asks that address (a read-only GET).
export const isRequestStep = (step) => step?.kind === "request" && typeof step?.fields?.url === "string";

// A "Look something up" step set to Linear can be approved on the Runs page: Hushwork then asks Linear for your open tasks
// (read-only). The "what to look for" note is kept for reading; the lookup always lists the person's open assigned tasks.
export const isLinearLookup = (step) => step?.kind === "find" && step?.fields?.where === "linear";

export const linearSummary = (step) =>
  ["Hushwork will ask Linear for up to 10 open tasks assigned to you (read-only, nothing in Linear is changed). If the AI is switched on, what it finds is also sent to Groq, the company that runs the AI, to write a clear summary.", step?.fields?.what ? `Your note: ${step.fields.what}` : ""].filter(Boolean).join(String.fromCharCode(10));

// A "Look something up" step set to Calendar can be approved on the Runs page: Hushwork then asks Google Calendar for the
// person's next events (read-only). The "what to look for" note is kept for reading.
export const isCalendarLookup = (step) => step?.kind === "find" && step?.fields?.where === "calendar";

export const calendarSummary = (step) =>
  ["Hushwork will ask Google Calendar for your next 10 events in the coming 7 days (read-only, nothing in your calendar is changed). If the AI is switched on, what it finds is also sent to Groq, the company that runs the AI, to write a clear summary.", step?.fields?.what ? `Your note: ${step.fields.what}` : ""].filter(Boolean).join(String.fromCharCode(10));

// A "Look something up" step set to Inbox can be approved on the Runs page: Hushwork then asks Gmail for the latest mail in the
// person's inbox (who sent it, the subject and the time; never the text of an email). Read-only.
export const isGmailLookup = (step) => step?.kind === "find" && step?.fields?.where === "inbox";

export const gmailSummary = (step) =>
  ["Hushwork will ask Gmail for the latest 10 messages in your inbox: who sent each one, its subject and its time. It never reads the text inside an email, and it cannot send, change or delete anything. If the AI is switched on, what it finds is also sent to Groq, the company that runs the AI, to write a clear summary.", step?.fields?.what ? `Your note: ${step.fields.what}` : ""].filter(Boolean).join(String.fromCharCode(10));

// A "Look something up" step set to Files can be approved on the Runs page: Hushwork then asks Google Drive for the files the
// person changed most recently (name, kind and time; never what is inside a file). Read-only.
export const isDriveLookup = (step) => step?.kind === "find" && step?.fields?.where === "files";

export const driveSummary = (step) =>
  ["Hushwork will ask Google Drive for the 10 files you changed most recently: each file's name, kind and time. It never opens a file or reads what is inside, and it cannot change or delete anything. If the AI is switched on, what it finds is also sent to Groq, the company that runs the AI, to write a clear summary.", step?.fields?.what ? `Your note: ${step.fields.what}` : ""].filter(Boolean).join(String.fromCharCode(10));

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

// A "Create a Linear task" step with a title can be approved on the Runs page: Hushwork then adds that ONE task in Linear.
export const isLinearCreate = (step) => step?.kind === "issue" && typeof step?.fields?.title === "string" && step.fields.title.trim() !== "";

// `answer` is what an Ask the AI step of the same workflow said (or ""): it fills in {answer} so you read the exact words first.
export const linearCreateSummary = (step, answer = "") => {
  const f = step?.fields ?? {};
  const title = fillAnswerText(String(f.title ?? ""), answer, 200);
  const details = fillAnswerText(String(f.details ?? ""), answer, 1500);
  return ["Hushwork will add ONE new task in Linear. It does not change or delete anything that already exists.", `Title: ${title.text ?? f.title}`, f.details ? `Details: ${details.text ?? f.details}` : "", `Team: ${f.team ? f.team : "your first team"}`, title.error ?? details.error ?? ""].filter(Boolean).join(String.fromCharCode(10));
};

// A "Look in another app" step can be approved on the Runs page: Hushwork then asks Composio to read one fixed thing from the app
// (its list entry in lib/connectors/composio-apps.js). Read-only.
export const isAppLookup = (step) => step?.kind === "app" && Boolean(findComposioApp(step?.fields?.app)) && !findComposioApp(step.fields.app).input; // a lookup that needs a typed channel is only used inside an Ask the AI step

export const appSummary = (step) => {
  const app = findComposioApp(step?.fields?.app);
  return [`Hushwork will ask ${app?.name ?? "the app"} for ${app?.what ?? "its information"}. It only reads: nothing in ${app?.name ?? "the app"} is changed.`, "What is read passes through Composio, the company that keeps the connection to the app. If the AI is switched on, it is also sent to Groq, the company that runs the AI, to write a clear summary.", step?.fields?.what ? `Your note: ${step.fields.what}` : ""].filter(Boolean).join(String.fromCharCode(10));
};

// An "Ask the AI" step can be approved on the Runs page: the AI then does the job, using only the read-only tool the step allows.
export const isAiStep = (step) => step?.kind === "ai" && typeof step?.fields?.task === "string" && step.fields.task.trim() !== "";

export const aiSummary = (step) => {
  const uses = { linear: "your Linear tasks", calendar: "your Google Calendar", gmail: "your Gmail inbox (sender, subject and time of the latest 10 messages)", gmailtext: "your Gmail inbox INCLUDING THE TEXT of your 5 newest emails (about the first 450 characters of each). That text goes to Groq with your request", drive: "your Google Drive (names and times of your 10 latest files)", app: parseAppAddress(step?.fields?.address) ? `${parseAppAddress(step.fields.address).app.name}${parseAppAddress(step.fields.address).input ? ` #${parseAppAddress(step.fields.address).input}` : ""} (${parseAppAddress(step.fields.address).app.what}, through Composio)` : "a connected app", mcp: step?.fields?.address ? `the MCP server ${step.fields.address}` : "an MCP server", web: step?.fields?.address ? `the web address ${step.fields.address}` : "a web address" }[step?.fields?.uses];
  const earlier = String(step?.fields?.task ?? "").includes("{answers}") ? "This step also gets what the Ask the AI steps before it found (as information only)." : "";
  return [`Hushwork will ask the AI: ${step?.fields?.task ?? ""}`, earlier, uses ? `The AI may look at ${uses}. It can only read; it cannot change anything.` : "The AI will only think; it will not look at anything.", "Your request" + (uses ? " and what it reads" : "") + " go to Groq, the company that runs the AI." + (step?.fields?.uses === "mcp" ? " The AI\u2019s questions to the MCP server go to that server. Only its read-only tools can be used." : "")].filter(Boolean).join(String.fromCharCode(10));
};

// A "Do something in another app" step: an action from lib/connectors/composio-actions.js with its title and, where it needs one, a valid
// "where". Approved on the Runs page like the other writing steps.
export const isActionStep = (step) => {
  const action = findAction(step?.fields?.action);
  return step?.kind === "action" && Boolean(action) && typeof step.fields.title === "string" && step.fields.title.trim() !== "" && !checkTarget(action, step.fields.target).error;
};

// What you read before approving: exactly what will be sent. `answer` fills in {answer} (see lib/run-answer.js).
export const actionSummary = (step, answer = "", answers = [], myEmail = "") => {
  const action = findAction(step?.fields?.action);
  const f = step?.fields ?? {};
  const title = fillAnswerText(String(f.title ?? ""), answer, 150);
  const details = fillActionDetails(action?.id, String(f.details ?? ""), answer, answers);
  return [
    `Hushwork will do ONE thing: ${action?.name ?? "an action"}. It does nothing else in the app.`,
    action?.needsTarget ? `${labelFor(action, "target")}: ${resolveTarget(action, f.target, myEmail).value ?? "your own email address"}` : "",
    `${labelFor(action, "title")}: ${title.text ?? f.title}`,
    f.details && !action?.noDetails ? `${labelFor(action, "details")}: ${details.text ?? f.details}` : "",
    isExampleTarget(action, f.target) ? `Warning: ${EXAMPLE_NOTICE}` : "",
    "It is sent through Composio, the company that keeps the connection to the app.",
    title.error ?? (action?.noDetails ? "" : details.error) ?? "",
  ].filter(Boolean).join(String.fromCharCode(10));
};

// Steps that WRITE somewhere (add a row, create a task). Auto mode runs them too, so the screens that offer Auto say so in plain words.
export const isWriteStep = (step) => isSheetsRow(step) || isLinearCreate(step) || isActionStep(step);

// Every step that has a real action to approve (the same list the Runs page offers Approve buttons for).
export const isApprovable = (step) =>
  isRequestStep(step) || isLinearLookup(step) || isCalendarLookup(step) || isGmailLookup(step) || isDriveLookup(step) || isLinearCreate(step) || isAppLookup(step) || isActionStep(step) || isSheetsRow(step) || isAiStep(step);

// A step that can only DESCRIBE: it is part of the plan but nothing will happen when it runs (a note, a draft, an old-style Send, a Find that does not
// look anywhere real). The Start step and an "ask you to approve" step are plan-only by nature, so they are not counted. Used to warn the person
// instead of letting them run a plan whose "send" never sends. Returns [{ index, title }].
export const isPlanOnly = (original) => {
  const step = upgradeSend(original); // an old Send by email with a real address is really sent now, so it is not "plan only"
  return step?.kind !== "trigger" && step?.kind !== "approve" && !(step?.icon === "ShieldCheck" && !step?.kind) && !isApprovable(step);
};
export const planOnlySteps = (steps) => (Array.isArray(steps) ? steps : []).map((step, index) => ({ index, title: String(step?.title ?? ""), plan: isPlanOnly(step) })).filter((one) => one.plan).map(({ index, title }) => ({ index, title }));

// A sentence for the Builder to show after a save, or "" when every step really does something.
export function planOnlyWarning(steps) {
  const only = planOnlySteps(steps);
  if (only.length === 0) return "";
  const named = only.slice(0, 3).map((one) => `"${one.title.slice(0, 40)}" (step ${one.index + 1})`).join(", ");
  return `Heads up: ${only.length === 1 ? "this step only describes" : `${only.length} steps only describe`} what would happen and will not really do anything: ${named}${only.length > 3 ? ", and more" : ""}. To really send, create or add something, use "Do something in another app".`;
}

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
  issue: (f) => `Would create a Linear task: ${f.title}${f.team ? ` (team ${f.team})` : ""}. Nothing was created.`,
  app: (f, label) => `Would look in ${label("app")}. Nothing was opened.`,
  action: (f, label) => `Would do: ${label("action")}${f.target ? ` in ${f.target}` : ""} (${f.title}). Nothing was sent.`,
  request: (f) => `Would ask ${f.url} and read the answer${f.why ? ` (${f.why})` : ""}. Nothing was requested.`,
};

// One step of a saved plan -> one result. Never throws, whatever the step looks like.
// The old "Send a message" block only DESCRIBED sending, and plans saved with it (by hand or written by the AI) never sent anything. When such a
// step is an email with a usable address ("me" and "my account" mean the signed-in person's own address), it is treated as the real thing: a
// "Do something in another app" email. The person still sees the To, Subject and text on the approval card and presses Approve before it goes.
// Anything else (a Slack or "other" Send, no address, an odd address) stays a plan-only description. Returns the step, or the real email step.
const ME_WORDS = /^(me|myself|my\s+(own\s+)?(email|e-mail|account|inbox|address|gmail)|\{myemail\})$/i;
export function upgradeSend(step) {
  if (step?.kind !== "send" || step.fields?.how !== "email") return step;
  const to = String(step.fields.to ?? "").trim();
  const target = ME_WORDS.test(to) ? "{myEmail}" : to;
  const email = findAction("gmail_send");
  if (!target || checkTarget(email, target).error) return step;
  const about = String(step.fields.about ?? "").replace(/\s+/g, " ").trim();
  const fields = { action: "gmail_send", target, title: (about.split(/[.!?]/)[0] || "A message from Hushwork").trim().slice(0, 60) || "A message from Hushwork", details: about.slice(0, 120) };
  const words = describeStep("action", fields);
  return { ...step, icon: "Mail", title: words.title, detail: words.detail, kind: "action", fields };
}

export function practiceStep(original) {
  const step = upgradeSend(original);
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
    const read = { icon: text(r?.icon), title: text(r?.title), detail: text(r?.detail), outcome: text(r?.outcome), status: r?.status === "failed" ? "failed" : r?.status === "pending" ? "pending" : "done" };
    if (r?.note === true) read.note = true; // a stop note: words for the person, not a step's state
    if (checkId(r?.from).value) read.from = r.from; // a real run remembers the practice run it was approved from (a plain id, nothing else)
    if (Number.isInteger(r?.fromStep) && r.fromStep >= 0 && r.fromStep < 100) read.fromStep = r.fromStep; // which step of that practice run
    if (isTypedKind(r?.kind) && r.fields && typeof r.fields === "object") {
      read.kind = r.kind;
      read.fields = {};
      for (const field of STEP_KINDS[r.kind].fields) read.fields[field.key] = text(r.fields[field.key]);
    }
    return read;
  });
}
