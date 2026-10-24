// The shared core of every REAL action a run can do: the Approve buttons and Auto mode (called as the signed-in person through the
// thin Server Actions in lib/actions/runs.js) and scheduled runs (called by lib/schedule-runner.js as the owner of each schedule).
// Every function takes `who` = { user: { id }, supabase }: whose run it is and the database client to use. This file is NOT a
// "use server" file on purpose: nothing in it can be called from the browser, because a browser could otherwise hand in a `who`
// of its own. Only the Server Actions (which work out `who` from the session) and the schedule runner (which works it out from a
// stored schedule row) import it.
import { revalidatePath } from "next/cache";
import { checkId, checkSteps } from "@/lib/validate";
import { practiceRun, readSavedResults, isRequestStep, isLinearLookup, isCalendarLookup, isGmailLookup, isDriveLookup, isLinearCreate, isAppLookup, isActionStep, isSheetsRow, isAiStep, isApprovable, isWriteStep, SETUP_MESSAGE } from "@/lib/run-engine";
import { fetchPublic, checkRequestUrl } from "@/lib/connectors/http";
import { openMcp } from "@/lib/connectors/mcp";
import { getGroqKey } from "@/lib/ai/key";
import { runAgent, summarizeData } from "@/lib/ai/agent";
import { looksSensitive } from "@/lib/ai/plan";
import { getLinearKey } from "@/lib/connectors/linear-env";
import { getApp, getConnectionsKey } from "@/lib/connectors/oauth-env";
import { findApp } from "@/lib/connectors/app-list";
import { loadAccess } from "@/lib/connections/store";
import { fetchUpcomingEvents } from "@/lib/connectors/google-calendar";
import { fetchInbox } from "@/lib/connectors/google-gmail";
import { fetchRecentFiles } from "@/lib/connectors/google-drive";
import { appendRow, fillAnswer, parseCells, parseSheetUrl } from "@/lib/connectors/google-sheets";
import { ANSWERS_TAG, fillActionDetails, fillAnswerText, findAnswer, findAnswers, wasApproved } from "@/lib/run-answer";
import { createIssue } from "@/lib/connectors/linear-create";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { findComposioApp } from "@/lib/connectors/composio-apps";
import { checkComposioConnections, runActionTool, runReadTool } from "@/lib/connectors/composio";
import { EXAMPLE_NOTICE, MY_EMAIL, checkTarget, findAction, isExampleTarget, resolveTarget } from "@/lib/connectors/composio-actions";
import { fetchLinearIssues } from "@/lib/connectors/linear";
import { makeLimiter } from "@/lib/ai/limits";
import { takeDbSlot } from "@/lib/db-limits";

// Server Action behind the "Practice run" button. It loads the person's own workflow, walks its steps with the
// practice engine (lib/run-engine.js: nothing leaves the app) and saves the result as a row in the "runs" table.
// Same four habits as lib/actions/drafts.js: requireUser first, validate, talk to the database (user_id is filled in by
// the database), return a SMALL object. Raw database errors are never returned.

// "42P01" / "PGRST205" = the runs table does not exist yet (supabase/runs.sql has not been pasted into Supabase).
const NO_TABLE = new Set(["42P01", "PGRST205"]);

// AUTO MODE. The person chose "Auto" for this run: instead of waiting for an Approve click on each step, the steps are done now, one after
// the other, by the very same actions the Approve buttons call (so every check, limit and safety rule applies exactly as before). It stops
// at the first step that does not work, so a failed step never lets later steps run on top of it. At most 20 steps. Returns
// { done: how many steps were done, stoppedAt: the step number it stopped at, or 0 }.
const AUTO_ACTIONS = [
  [isAiStep, (input, who) => approveAiStep(input, who)], [isLinearLookup, (input, who) => approveLinearLookup(input, who)], [isCalendarLookup, (input, who) => approveCalendarLookup(input, who)],
  [isGmailLookup, (input, who) => approveGmailLookup(input, who)], [isDriveLookup, (input, who) => approveDriveLookup(input, who)], [isLinearCreate, (input, who) => approveLinearCreate(input, who)],
  [isAppLookup, (input, who) => approveAppLookup(input, who)], [isActionStep, (input, who) => approveActionStep(input, who)], [isSheetsRow, (input, who) => approveSheetsRow(input, who)], [isRequestStep, (input, who) => approveWebCall(input, who)],
];
// When Auto mode (or a schedule) stops at a step, the REASON is saved as a small record under that step (never edited into the run itself: runs
// are never changed once saved), so the Runs page can say why instead of leaving the person to guess. `run` = { id, user_id, workflow_id, workflow_name }.
async function saveStopNote(supabase, run, index, step, reason) {
  const title = `Stopped at step ${index + 1}${step?.title ? `: ${String(step.title).slice(0, 80)}` : ""}`;
  return saveLiveRun(supabase, { ...run, stepIndex: index }, { icon: "CircleAlert", title, detail: "", status: "failed", outcome: String(reason).slice(0, 400) });
}

export async function runAutomatically(runId, results, who, { allowWrites = true, run = null } = {}) {
  let done = 0;
  for (let index = 0; index < Math.min(results.length, 20); index += 1) {
    const step = results[index];
    if (!isApprovable(step)) continue;
    if (!allowWrites && isWriteStep(step)) continue; // a scheduled run only writes when the person ticked "allow writing" for that schedule
    const action = AUTO_ACTIONS.find(([matches]) => matches(step))?.[1];
    if (!action) continue;
    const outcome = await action({ runId, index }, who);
    if (outcome?.error) {
      if (run) await saveStopNote(who.supabase, run, index, step, outcome.error);
      return { done, stoppedAt: index + 1, reason: String(outcome.error).slice(0, 400) };
    }
    done += 1;
  }
  return { done, stoppedAt: 0 };
}

export async function startPracticeRun(input, who) {
  const { user, supabase } = who;
  const id = checkId(input?.id);
  if (id.error) return { error: id.error };

  const { data: rows, error: loadError } = await supabase.from("workflows").select("id, name, plan").eq("id", id.value).eq("user_id", user.id);
  if (loadError) {
    console.error("startPracticeRun load failed:", loadError.code);
    return { error: "Could not start the run. Check your connection and try again." };
  }
  const workflow = rows?.[0];
  if (!workflow) return { error: "That workflow no longer exists." };

  const run = practiceRun(workflow.plan);
  if (run.status === "failed") return { error: "This workflow has no steps to run. Add a step in the Builder first." };
  // A run started by a schedule says WHICH schedule started it, instead of repeating the Start step's words (they can differ).
  if (typeof input?.startedBy === "string" && input.startedBy && run.results[0]?.kind === "trigger") {
    run.results[0] = { ...run.results[0], outcome: `Started by its schedule: ${input.startedBy.slice(0, 120)}.` };
  }

  const { data, error } = await supabase
    .from("runs")
    .insert({ ...ownerOf(supabase, user.id), workflow_id: workflow.id, workflow_name: workflow.name, mode: "practice", status: run.status, results: run.results })
    .select("id");
  if (error) {
    console.error("startPracticeRun save failed:", error.code);
    return { error: NO_TABLE.has(error.code) ? SETUP_MESSAGE : "The run finished but could not be saved. Try again." };
  }
  revalidatePath("/app", "layout");
  const runId = String(data?.[0]?.id ?? "");
  // Only an explicit true switches Auto on; anything else is the normal, ask-first Manual mode.
  if (input?.auto === true && runId) return { ok: true, runId, auto: await runAutomatically(runId, run.results, who, { allowWrites: input?.allowWrites !== false, run: { id: runId, user_id: user.id, workflow_id: workflow.id, workflow_name: workflow.name } }) };
  return { ok: true, runId };
}

// Real actions are rare and deliberate, so the limits are small. They live in the server's memory (a restart forgets
// them), like the AI limits. Web calls and Linear lookups: 5 a minute and 30 a day per person (each counted separately).
const MINUTE = 60_000;
const DAY = 86_400_000;
const limiters = (name, perMinute, perDay) => (globalThis[name] ??= { minute: makeLimiter({ max: perMinute, windowMs: MINUTE }), day: makeLimiter({ max: perDay, windowMs: DAY, calendar: true }) });
const webCallLimits = () => limiters("__hushworkWebCallLimits", 5, 30);
const linearLimits = () => limiters("__hushworkLinearLimits", 5, 30);
const calendarLimits = () => limiters("__hushworkCalendarLimits", 5, 30);
const gmailLimits = () => limiters("__hushworkGmailLimits", 5, 30);
const driveLimits = () => limiters("__hushworkDriveLimits", 5, 30);
const linearCreateLimits = () => limiters("__hushworkLinearCreateLimits", 3, 15);
const actionLimits = () => limiters("__hushworkActionLimits", 3, 15);
const appLimits = () => limiters("__hushworkAppLimits", 5, 30);
const sheetsLimits = () => limiters("__hushworkSheetsLimits", 5, 30);
const aiLimits = () => limiters("__hushworkAiStepLimits", 3, 15);

// Used by the "Approve" action. The browser only says WHICH run and WHICH step; this re-reads the saved practice
// run from the database (only the person's own, thanks to user_id and the database rules) and returns the saved step.
async function loadPracticeStep(supabase, user, input, allowed) {
  const id = checkId(input?.runId);
  const index = input?.index;
  if (id.error || !Number.isInteger(index) || index < 0 || index > 50) return { error: "That run no longer exists." };
  const { data: rows, error } = await supabase.from("runs").select("user_id, workflow_id, workflow_name, mode, results, created_at").eq("id", id.value).eq("user_id", user.id);
  if (error) {
    console.error("loading a run to approve failed:", error.code);
    return { error: "Could not load that run. Check your connection and try again." };
  }
  const run = rows?.[0];
  let step = run ? readSavedResults(run.results)[index] : null;
  // A person can write their own rows into the runs table with the public key, so a saved step is never trusted: its kind and
  // blanks go through the same checks as any step a person types (right choices, right lengths) before anything is acted on.
  if (step?.kind) {
    const checked = checkSteps([{ kind: step.kind, fields: step.fields }]);
    step = checked.value ? { ...step, fields: checked.value[0].fields } : null;
  }
  if (!run || run.mode !== "practice" || !allowed(step)) return { error: "That step cannot be sent." };
  return { run: { ...run, id: id.value, stepIndex: index }, step };
}

// A signed-in person's rows get their user_id from the database. The schedule runner has no session (lib/supabase/admin.js marks its
// client), so it must say whose row it is.
const ownerOf = (supabase, userId) => (supabase.__hushworkAdmin === true ? { user_id: userId } : {});

// The same kind of check against the DATABASE count (supabase/usage.sql), which holds across servers. It USES a slot when there is room,
// so call it after the in-memory check has passed. Returns a sentence, or "" when there is room (or the database count is not set up yet).
async function dbLimitError(supabase, bucket, perMinute, perDay, what) {
  const slot = await takeDbSlot(supabase, bucket, perMinute, perDay);
  if (slot.ok) return "";
  return slot.why === "limit_minute" ? "You did that a moment ago. Try again in a minute." : `You have reached today's limit for ${what}. It resets at midnight UTC.`;
}

// Checks the person's limits, without using a slot yet.
function limitError(limits, userId, now, what) {
  if (limits.minute.left(userId, now) < 1) return `You did that a moment ago. Try again in a minute.`;
  if (limits.day.left(userId, now) < 1) return `You have reached today's limit for ${what}. It resets at midnight UTC.`;
  return "";
}

// Saves what really happened as a separate "live" run. Best effort: the real action already happened, so a failure to
// save is reported but never turned into "it failed".
async function saveLiveRun(supabase, run, record) {
  const { data, error } = await supabase
    .from("runs")
    .insert({ ...ownerOf(supabase, run.user_id), workflow_id: run.workflow_id, workflow_name: run.workflow_name, mode: "live", status: "done", results: [{ ...record, from: run.id, fromStep: run.stepIndex }] })
    .select("id");
  if (error) {
    console.error("saving the live run failed:", error.code);
    return { ok: true, runId: "", note: "It was done, but the record could not be saved." };
  }
  revalidatePath("/app", "layout");
  return { ok: true, runId: String(data?.[0]?.id ?? "") };
}

// The "Approve and call the address" button for a web-call step. lib/connectors/http.js does the careful part (https
// only, public addresses only, no redirects, size and time limits); the answer is kept as a short text excerpt.
export async function approveWebCall(input, who) {
  const { user, supabase } = who;
  const loaded = await loadPracticeStep(supabase, user, input, isRequestStep);
  if (loaded.error) return loaded;
  const { run, step } = loaded;

  const now = Date.now();
  const tooMany = limitError(webCallLimits(), user.id, now, "web calls");
  if (tooMany) return { error: tooMany };
  webCallLimits().minute.take(user.id, now);
  webCallLimits().day.take(user.id, now);

  if (looksSensitive(step.fields.url)) return { error: "That address looks like it holds a secret key, so it was not used. Remove the key from the address." };
  const answer = await fetchPublic(step.fields.url);
  if (!answer.ok) return { error: answer.error };

  const reply = answer.status >= 300 && answer.status < 400 ? `${answer.status} (a redirect, not followed)` : String(answer.status);
  const outcome = `Asked ${step.fields.url}. It answered ${reply}${answer.type ? ` (${answer.type})` : ""}.${answer.excerpt ? ` Start of the answer: ${answer.excerpt}` : ""}`;
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: outcome.slice(0, 700) });
}

// Whose Linear? The person's own connection (the Connect button) first; else the personal key from .env.local (the owner
// testing on their own computer). Returns the Authorization value for Linear, or null when there is neither.
// Steps that write somewhere can be approved only once per practice run (go back to Workflows and run again for another copy).
const ALREADY = "This step already ran in this run, so it was not done a second time. To do it again, run the workflow again.";
const COMPOSIO_OFF = "More apps is not switched on. Add COMPOSIO_API_KEY to .env.local first (see Connections).";
const LINEAR_OFF = "Linear is not connected yet. Open Connections and press Connect Linear.";
async function linearAuthorization(supabase, userId) {
  const secretKey = getConnectionsKey();
  const app = getApp(findApp("linear"));
  if (secretKey && app) {
    const access = await loadAccess({ supabase, userId, provider: "linear", key: secretKey, app });
    if (access) return `Bearer ${access.token}`;
  }
  // The personal key in .env.local is for the owner testing on their own computer. It must never be used on a real (production) server,
  // where every signed-in person would otherwise read the owner's Linear.
  return process.env.NODE_ENV === "production" ? null : getLinearKey();
}

// Google works only through the Connect button (there is no personal-key shortcut). Returns "Bearer <token>" or null.
const GOOGLE_OFF = "Google is not connected yet. Open Connections and press Connect Google.";
async function googleAuthorization(supabase, userId) {
  const secretKey = getConnectionsKey();
  const app = getApp(findApp("google"));
  if (!secretKey || !app) return null;
  const access = await loadAccess({ supabase, userId, provider: "google", key: secretKey, app });
  return access ? `Bearer ${access.token}` : null;
}

// One line per message for the Runs page and the AI: "2026-10-20 03:45  Ana Lopez: Lunch tomorrow?".
const mailLines = (mails) => mails.map((mail) => `- ${mail.time ? `${mail.time}  ` : ""}${mail.from}: ${mail.subject}`).join("\n");

// One line per file for the Runs page and the AI: "2026-10-20 03:45  Sheet: Budget 2026".
const fileLines = (files) => files.map((file) => `- ${file.time ? `${file.time}  ` : ""}${file.kind}: ${file.name}`).join("\n");

// One line per event for the Runs page and the AI: "Tue 20 Oct, 09:00  Maths test".
const eventLines = (events) => events.map((event) => `- ${event.start}  ${event.title}`).join("\n");

// What a lookup saves as its result: a clear AI summary FIRST, then the app's own list exactly as it answered (so a summary can never
// hide the facts). The summary is skipped without any error when the AI is off, the person's AI limit is used up, or the AI fails: the
// result is then just the app's own list. `goal` says what the person wants to know; `note` is the step's own note (the person's words).
async function withSummary({ supabase, userId, appName, header, list, goal, note }) {
  const plain = `Asked ${appName}. ${header}\n${list}`;
  const groqKey = getGroqKey();
  const now = Date.now();
  if (!groqKey || aiLimits().minute.left(userId, now) < 1 || aiLimits().day.left(userId, now) < 1) return plain;
  if (!(await takeDbSlot(supabase, "ai_step", 3, 15)).ok) return plain; // the database count (see supabase/usage.sql) is the one that holds across servers
  aiLimits().minute.take(userId, now);
  aiLimits().day.take(userId, now);
  const summary = await summarizeData({ goal: note ? `${goal} The person's own note: ${note}` : goal, data: `${header}\n${list}`, groqKey });
  return summary.ok ? `${summary.text}\n\nThe list from ${appName}, exactly as it answered:\n${list}` : plain;
}

// The "Approve and ask Linear" button. READ-ONLY: lib/connectors/linear.js can only ask, never change. Only a Look something
// up step set to Linear qualifies, and the key comes from .env.local on the server.
export async function approveLinearLookup(input, who) {
  const { user, supabase } = who;
  const loaded = await loadPracticeStep(supabase, user, input, isLinearLookup);
  if (loaded.error) return loaded;
  const { run, step } = loaded;

  const authorization = await linearAuthorization(supabase, user.id);
  if (!authorization) return { error: LINEAR_OFF };

  const now = Date.now();
  const tooMany = limitError(linearLimits(), user.id, now, "Linear lookups");
  if (tooMany) return { error: tooMany };
  linearLimits().minute.take(user.id, now);
  linearLimits().day.take(user.id, now);

  const answer = await fetchLinearIssues({ authorization });
  if (!answer.ok) return { error: answer.error };

  const list = answer.issues.map((issue) => `- ${issue.id} ${issue.title}${issue.state ? ` (${issue.state})` : ""}`).join("\n");
  const outcome = answer.issues.length
    ? await withSummary({ supabase, userId: user.id, appName: "Linear", header: `You have ${answer.issues.length} open ${answer.issues.length === 1 ? "task" : "tasks"}:`, list, note: step.fields.what, goal: "The person asked Linear for their open tasks. Summarise them: how many there are, which look most important or urgent and why, and say which one to do first." })
    : "Asked Linear. You have no open tasks.";
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: outcome.slice(0, 4000) });
}

// The "Approve and ask the AI" button. The AI gets ONE read-only tool at most, decided by the saved step (never by the
// model): "My Linear tasks" or "the web address written in the step". lib/ai/agent.js is the loop; it cannot change anything.
export async function approveAiStep(input, who) {
  const { user, supabase } = who;
  const groqKey = getGroqKey();
  if (!groqKey) return { error: "AI is switched off. Add the Groq key to .env.local first." };
  const loaded = await loadPracticeStep(supabase, user, input, isAiStep);
  if (loaded.error) return loaded;
  const { run, step } = loaded;
  const { task, uses, address } = step.fields;
  if (looksSensitive(task)) return { error: "That request looks like it holds a card number or a secret key, so it was not sent. Remove it and try again." };

  // Counted BEFORE anything goes out (an MCP step connects to an outside server), so a loop of Approves cannot be used as a request relay.
  const now = Date.now();
  const tooMany = limitError(aiLimits(), user.id, now, "AI steps");
  if (tooMany) return { error: tooMany };
  const dbSlot = await takeDbSlot(supabase, "ai_step", 3, 15);
  if (!dbSlot.ok) return { error: dbSlot.why === "limit_minute" ? "You did that a moment ago. Try again in a minute." : "You have reached today's limit for AI steps. It resets at midnight UTC." };
  aiLimits().minute.take(user.id, now);
  aiLimits().day.take(user.id, now);

  // When a built-in tool fails (for example Google refused), the person is told the real reason instead of the AI's vague sentence about it.
  let toolError = "";
  const failed = (message) => {
    toolError = message;
    return message;
  };
  const tools = Object.create(null); // no prototype, so a tool called __proto__ is just a name
  if (uses === "linear") {
    const authorization = await linearAuthorization(supabase, user.id);
    if (!authorization) return { error: LINEAR_OFF };
    tools.linear_open_tasks = {
      description: "Lists the person's open Linear tasks (up to 10) with their status.",
      run: async () => {
        const answer = await fetchLinearIssues({ authorization });
        if (!answer.ok) return failed(answer.error);
        return answer.issues.length ? answer.issues.map((issue) => `${issue.id} ${issue.title}${issue.state ? ` (${issue.state})` : ""}`).join("\n") : "There are no open tasks.";
      },
    };
  } else if (uses === "calendar") {
    const authorization = await googleAuthorization(supabase, user.id);
    if (!authorization) return { error: GOOGLE_OFF };
    tools.calendar_next_events = {
      description: "Lists the person's next events in Google Calendar (up to 10, in the next 7 days).",
      run: async () => {
        const answer = await fetchUpcomingEvents({ authorization });
        if (!answer.ok) return failed(answer.error);
        return answer.events.length ? answer.events.map((event) => `${event.start}  ${event.title}`).join("\n") : "There are no events in the next 7 days.";
      },
    };
  } else if (uses === "gmail") {
    const authorization = await googleAuthorization(supabase, user.id);
    if (!authorization) return { error: GOOGLE_OFF };
    tools.gmail_latest_mail = {
      description: "Lists the latest 10 messages in the person's Gmail inbox: time, sender and subject (never the text of an email).",
      run: async () => {
        const answer = await fetchInbox({ authorization });
        if (!answer.ok) return failed(answer.error);
        return answer.mails.length ? answer.mails.map((mail) => `${mail.time}  ${mail.from}: ${mail.subject}`).join("\n") : "The inbox is empty.";
      },
    };
  } else if (uses === "drive") {
    const authorization = await googleAuthorization(supabase, user.id);
    if (!authorization) return { error: GOOGLE_OFF };
    tools.drive_recent_files = {
      description: "Lists the 10 files in the person's Google Drive that changed most recently: time, kind and name (never what is inside a file).",
      run: async () => {
        const answer = await fetchRecentFiles({ authorization });
        if (!answer.ok) return failed(answer.error);
        return answer.files.length ? answer.files.map((file) => `${file.time}  ${file.kind}: ${file.name}`).join("\n") : "There are no files.";
      },
    };
  } else if (uses === "app") {
    // The app is named in the step's address box and must be one from lib/connectors/composio-apps.js; the tool is always that app's one read-only tool.
    const app = findComposioApp(typeof address === "string" ? address.trim().toLowerCase() : "");
    if (!app) return { error: "Write the short name of the app in this step first (for example todoist, github or slack: the names are on the Connections page)." };
    const composioKey = getComposioKey();
    if (!composioKey) return { error: COMPOSIO_OFF };
    tools.app_read = {
      description: `Reads ${app.what} from ${app.name} (read-only).`,
      run: async () => {
        const answer = await runReadTool({ key: composioKey, userId: user.id, app });
        return answer.ok ? answer.text : failed(withSaid(answer));
      },
    };
  } else if (uses === "mcp") {
    // The tools come from the ONE server written in the step; only its read-only tools are offered (lib/connectors/mcp.js).
    const checked = checkRequestUrl(address);
    if (checked.error) return { error: `This step's MCP server address cannot be used: ${checked.error}` };
    if (looksSensitive(address)) return { error: "That address looks like it holds a secret key, so it was not used. Remove the key from the address." };
    const mcp = await openMcp(checked.value);
    if (!mcp.ok) return { error: mcp.error };
    for (const tool of mcp.tools) tools[tool.name] = { description: tool.description, parameters: tool.parameters, run: (input) => mcp.call(tool.name, input) };
  } else if (uses === "web") {
    const checked = checkRequestUrl(address);
    if (checked.error) return { error: `This step's web address cannot be used: ${checked.error}` };
    if (looksSensitive(address)) return { error: "That address looks like it holds a secret key, so it was not used. Remove the key from the address." };
    tools.read_web_page = {
      description: "Reads the start of the one web page the person chose for this step.",
      run: async () => {
        const page = await fetchPublic(checked.value, { excerptChars: 1500 });
        return page.ok ? `Status ${page.status}. ${page.excerpt || "(no readable text)"}` : page.error;
      },
    };
  }

  const answer = await runAgent({ task, tools, groqKey });
  if (!answer.ok) return { error: answer.error };
  if (toolError) return { error: toolError };
  const lookedAt = !answer.calls.length ? "" : uses === "linear" ? "your Linear tasks" : uses === "calendar" ? "your calendar" : uses === "gmail" ? "your Gmail inbox" : uses === "drive" ? "your Google Drive" : uses === "app" ? "a connected app" : uses === "mcp" ? `the MCP server, using ${[...new Set(answer.calls)].join(", ")}` : "the web address";
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: `${answer.text}${lookedAt ? `\n\nThe AI looked at ${lookedAt}.` : ""}`.slice(0, 4000), answer: answer.text.slice(0, 700) });
}

// The "Approve and look at my calendar" button. READ-ONLY (the permission Google gave is read-only, and
// lib/connectors/google-calendar.js only sends a GET). Only a Look something up step set to Calendar qualifies.
export async function approveCalendarLookup(input, who) {
  const { user, supabase } = who;
  const loaded = await loadPracticeStep(supabase, user, input, isCalendarLookup);
  if (loaded.error) return loaded;
  const { run, step } = loaded;
  const authorization = await googleAuthorization(supabase, user.id);
  if (!authorization) return { error: GOOGLE_OFF };

  const now = Date.now();
  const tooMany = limitError(calendarLimits(), user.id, now, "calendar lookups");
  if (tooMany) return { error: tooMany };
  calendarLimits().minute.take(user.id, now);
  calendarLimits().day.take(user.id, now);

  const answer = await fetchUpcomingEvents({ authorization });
  if (!answer.ok) return { error: answer.error };
  const outcome = answer.events.length
    ? await withSummary({ supabase, userId: user.id, appName: "Google Calendar", header: `You have ${answer.events.length} ${answer.events.length === 1 ? "event" : "events"} in the next 7 days:`, list: eventLines(answer.events), note: step.fields.what, goal: "The person asked Google Calendar for their events in the next 7 days. Summarise the week: how many events there are, which days are busy or free, and what they should prepare." })
    : "Asked Google Calendar. You have no events in the next 7 days.";
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: outcome.slice(0, 4000) });
}

// The "Approve and look at my inbox" button. READ-ONLY (the permission Google gave cannot send, change or delete mail, and
// lib/connectors/google-gmail.js only sends GET requests for sender, subject and time). Only a Look something up step set to
// Inbox qualifies. Mail subjects are saved in the person's own run, so they are private to the person like any other run.
export async function approveGmailLookup(input, who) {
  const { user, supabase } = who;
  const loaded = await loadPracticeStep(supabase, user, input, isGmailLookup);
  if (loaded.error) return loaded;
  const { run, step } = loaded;
  const authorization = await googleAuthorization(supabase, user.id);
  if (!authorization) return { error: GOOGLE_OFF };

  const now = Date.now();
  const tooMany = limitError(gmailLimits(), user.id, now, "inbox lookups");
  if (tooMany) return { error: tooMany };
  gmailLimits().minute.take(user.id, now);
  gmailLimits().day.take(user.id, now);

  const answer = await fetchInbox({ authorization });
  if (!answer.ok) return { error: answer.error };
  const outcome = answer.mails.length
    ? await withSummary({ supabase, userId: user.id, appName: "Gmail", header: `The latest ${answer.mails.length} ${answer.mails.length === 1 ? "message" : "messages"} in your inbox (senders, subjects and times only; the text inside each email was not read):`, list: mailLines(answer.mails), note: step.fields.what, goal: "The person asked Gmail for the latest messages in their inbox. Only the sender, subject and time of each message were read, never the text inside, so judge only from those. Summarise who wrote and what each message seems to be about, say which ones probably need an answer first and why, and say clearly that you only saw senders and subjects." })
    : "Asked Gmail. Your inbox is empty.";
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: outcome.slice(0, 4000) });
}

// The "Approve and look at my files" button. READ-ONLY (the permission Google gave only sees file names and details, and
// lib/connectors/google-drive.js only sends one GET request). Only a Look something up step set to Files qualifies.
export async function approveDriveLookup(input, who) {
  const { user, supabase } = who;
  const loaded = await loadPracticeStep(supabase, user, input, isDriveLookup);
  if (loaded.error) return loaded;
  const { run, step } = loaded;
  const authorization = await googleAuthorization(supabase, user.id);
  if (!authorization) return { error: GOOGLE_OFF };

  const now = Date.now();
  const tooMany = limitError(driveLimits(), user.id, now, "file lookups");
  if (tooMany) return { error: tooMany };
  driveLimits().minute.take(user.id, now);
  driveLimits().day.take(user.id, now);

  const answer = await fetchRecentFiles({ authorization });
  if (!answer.ok) return { error: answer.error };
  const outcome = answer.files.length
    ? await withSummary({ supabase, userId: user.id, appName: "Google Drive", header: `The ${answer.files.length} ${answer.files.length === 1 ? "file" : "files"} you changed most recently (names, kinds and times only; nothing inside a file was read):`, list: fileLines(answer.files), note: step.fields.what, goal: "The person asked Google Drive for the files they changed most recently. Only the name, kind and time of each file were read, never what is inside. Summarise what they seem to have worked on lately judging from the names, group them by kind or topic, and say clearly that you only saw names." })
    : "Asked Google Drive. There are no files.";
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: outcome.slice(0, 4000) });
}

// The "Approve and create the task" button. This WRITES one thing: a new task in Linear (lib/connectors/linear-create.js sends one
// fixed request; what is written travels as separate values). Only a Create a Linear task step with a title qualifies, it can be
// approved once per practice run, and the title and details the person read on the Runs page are built again here from the saved run.
export async function approveLinearCreate(input, who) {
  const { user, supabase } = who;
  const loaded = await loadPracticeStep(supabase, user, input, isLinearCreate);
  if (loaded.error) return loaded;
  const { run, step } = loaded;
  if (await wasApproved(supabase, user.id, run, "issue")) return { error: ALREADY };

  const usesAnswer = `${step.fields.title}${step.fields.details}`.includes("{answer}");
  const answer = usesAnswer ? await findAnswer(supabase, user.id, run) : "";
  const title = fillAnswerText(step.fields.title, answer, 200);
  const details = fillAnswerText(step.fields.details, answer, 1500);
  if (title.error || details.error) return { error: title.error ?? details.error };
  if (looksSensitive(title.text) || looksSensitive(details.text)) return { error: "That looks like it holds a card number or a secret key, so it was not sent to Linear. Remove it and try again." };

  const authorization = await linearAuthorization(supabase, user.id);
  if (!authorization) return { error: LINEAR_OFF };

  const now = Date.now();
  const tooMany = limitError(linearCreateLimits(), user.id, now, "created tasks");
  if (tooMany) return { error: tooMany };
  const dbFull = await dbLimitError(supabase, "linear_create", 3, 15, "created tasks");
  if (dbFull) return { error: dbFull };
  linearCreateLimits().minute.take(user.id, now);
  linearCreateLimits().day.take(user.id, now);

  const made = await createIssue({ authorization, title: title.text, details: details.text, team: step.fields.team });
  if (!made.ok) return { error: made.error };
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: `Created the task ${made.id} in Linear: ${title.text}${made.url ? ` (${made.url})` : ""}`.slice(0, 700) });
}

// The "Approve and look in the app" button. READ-ONLY: the tool is always the one written in the app's list entry, called with nothing
// to fill in, through Composio (lib/connectors/composio.js). Only a Look in another app step naming an app from the list qualifies.
export async function approveAppLookup(input, who) {
  const { user, supabase } = who;
  const loaded = await loadPracticeStep(supabase, user, input, isAppLookup);
  if (loaded.error) return loaded;
  const { run, step } = loaded;
  const app = findComposioApp(step.fields.app);
  const composioKey = getComposioKey();
  if (!composioKey) return { error: COMPOSIO_OFF };

  const now = Date.now();
  const tooMany = limitError(appLimits(), user.id, now, "app lookups");
  if (tooMany) return { error: tooMany };
  appLimits().minute.take(user.id, now);
  appLimits().day.take(user.id, now);

  const answer = await runReadTool({ key: composioKey, userId: user.id, app });
  if (!answer.ok) return { error: withSaid(answer) };
  const outcome = await withSummary({ supabase, userId: user.id, appName: app.name, header: `${app.name} answered with ${app.what}:`, list: answer.text, note: step.fields.what, goal: `The person asked ${app.name} for ${app.what}. Summarise what the answer shows in plain words.` });
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: outcome.slice(0, 4000) });
}

// A Composio failure as one message: our own sentence, then (when the app said something we can show) what it actually said, so the real reason
// is on screen instead of a guess. `said` was already cleaned and cut short by lib/connectors/composio.js.
const withSaid = (result) => `${result.error}${result.said ? ` The app said: "${result.said}".` : ""}`;

// The signed-in person's own email address, for a step that writes {myEmail}. A signed-in person's session has it; a scheduled run has only
// the person's id, so the all-access client looks it up (for that one person). Returns "" when there is none.
async function accountEmail({ user, supabase }) {
  if (typeof user.email === "string" && user.email) return user.email;
  if (supabase.__hushworkAdmin !== true) return "";
  try {
    const { data } = await supabase.auth.admin.getUserById(user.id);
    return data?.user?.email ?? "";
  } catch {
    return "";
  }
}

// The "Approve and send it" button for a Do something in another app step. This WRITES one thing in an app (a Slack message, a GitHub
// issue, a Todoist task) through Composio. Only a step naming an action from lib/connectors/composio-actions.js qualifies; its words are
// built again here from the saved run (never from the browser), checked, and shown in full on the approval card first; it can be approved
// once per run; and lib/connectors/composio.js sends nothing unless the tool's real inputs match what we fill in.
export async function approveActionStep(input, who) {
  const { user, supabase } = who;
  const loaded = await loadPracticeStep(supabase, user, input, isActionStep);
  if (loaded.error) return loaded;
  const { run, step } = loaded;
  const action = findAction(step.fields.action);
  const checked = checkTarget(action, step.fields.target);
  if (checked.error) return { error: checked.error };
  const target = resolveTarget(action, checked.value, checked.value === MY_EMAIL ? await accountEmail(who) : "");
  if (target.error) return { error: target.error };
  if (isExampleTarget(action, target.value)) return { error: EXAMPLE_NOTICE };
  if (await wasApproved(supabase, user.id, run, "action")) return { error: ALREADY };

  const usesAnswer = `${step.fields.title}${step.fields.details}`.includes("{answer}");
  const answer = usesAnswer ? await findAnswer(supabase, user.id, run) : "";
  const title = fillAnswerText(step.fields.title, answer, 150);
  const answers = String(step.fields.details).includes(ANSWERS_TAG) ? await findAnswers(supabase, user.id, run) : [];
  const details = action.noDetails ? { text: "" } : fillActionDetails(action.id, step.fields.details, answer, answers);
  if (title.error || details.error) return { error: title.error ?? details.error };
  if (looksSensitive(title.text) || looksSensitive(details.text)) return { error: "That looks like it holds a card number or a secret key, so it was not sent. Remove it and try again." };
  const composioKey = getComposioKey();
  if (!composioKey) return { error: COMPOSIO_OFF };

  const now = Date.now();
  const tooMany = limitError(actionLimits(), user.id, now, "sent actions");
  if (tooMany) return { error: tooMany };
  const dbFull = await dbLimitError(supabase, "action", 3, 15, "sent actions");
  if (dbFull) return { error: dbFull };
  actionLimits().minute.take(user.id, now);
  actionLimits().day.take(user.id, now);

  const values = { target: target.value, title: title.text, details: details.text };
  const done = await runActionTool({ key: composioKey, userId: user.id, action, values });
  if (!done.ok) return { error: withSaid(done) };
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: `${action.done(values)}: ${title.text}${details.text ? `\n${details.text}` : ""}`.slice(0, 700) });
}

// The "Approve and add the row" button. The ONE action that writes into somebody's Google account, so: the sheet address and the
// boxes come from the SAVED run (never from the browser), they are checked again here, the person saw the exact boxes on the
// approval card, and lib/connectors/google-sheets.js can only append a row (it cannot read, change or delete cells).
export async function approveSheetsRow(input, who) {
  const { user, supabase } = who;
  const loaded = await loadPracticeStep(supabase, user, input, isSheetsRow);
  if (loaded.error) return loaded;
  const { run, step } = loaded;
  if (await wasApproved(supabase, user.id, run, "row")) return { error: ALREADY };
  const sheet = parseSheetUrl(step.fields.to);
  const parsed = parseCells(step.fields.values);
  if (sheet.error || parsed.error) return { error: sheet.error ?? parsed.error };
  // {answer} in a box is replaced by what the Ask the AI step of this workflow said (the same words the Runs page showed before the Approve).
  const row = fillAnswer(parsed.cells, await findAnswer(supabase, user.id, run));
  if (row.error) return { error: row.error };
  const authorization = await googleAuthorization(supabase, user.id);
  if (!authorization) return { error: GOOGLE_OFF };

  const now = Date.now();
  const tooMany = limitError(sheetsLimits(), user.id, now, "added rows");
  if (tooMany) return { error: tooMany };
  const dbFull = await dbLimitError(supabase, "sheets_row", 5, 30, "added rows");
  if (dbFull) return { error: dbFull };
  sheetsLimits().minute.take(user.id, now);
  sheetsLimits().day.take(user.id, now);

  const added = await appendRow({ authorization, spreadsheetId: sheet.id, cells: row.cells });
  if (!added.ok) return { error: added.error };
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: `Added one row to your Google Sheet (${row.cells.length} ${row.cells.length === 1 ? "box" : "boxes"}): ${row.cells.join(" | ")}`.slice(0, 700) });
}

// "Test all my connections": a REAL but harmless look at every connection this person has. Only reads (a few calendar events, a few email
// headers, a few file names, a task list, each app's one lookup) and only a check that each action's inputs match: nothing is sent, written or
// changed anywhere. Returns { groups: [{ title, rows: [{ name, state: "ok" | "problem" | "off", note, actions? }] }], off: [app names] } or { error }.
const testLimits = () => (globalThis.__hushworkConnectionTestLimit ??= makeLimiter({ max: 4, windowMs: 5 * 60_000 }));

export async function testAllConnections(who) {
  const { user, supabase } = who;
  const now = Date.now();
  if (testLimits().left(user.id, now) < 1) return { error: "You just ran this. Wait a few minutes and try again." };
  testLimits().take(user.id, now);

  // One real look. A throw becomes a plain sentence, so one broken connection never hides the others.
  const attempt = async (name, look) => {
    try {
      const answer = await look();
      return answer.ok ? { name, state: "ok", note: "Works." } : { name, state: "problem", note: String(answer.error ?? "It did not work.").slice(0, 300) };
    } catch {
      return { name, state: "problem", note: "It did not answer. Try again in a minute." };
    }
  };

  const groups = [];
  const google = await googleAuthorization(supabase, user.id);
  groups.push({
    title: "Google",
    rows: google
      ? [
        await attempt("Google Calendar", () => fetchUpcomingEvents({ authorization: google })),
        await attempt("Gmail (reading)", () => fetchInbox({ authorization: google })),
        await attempt("Google Drive", () => fetchRecentFiles({ authorization: google })),
      ]
      : [{ name: "Google (Calendar, Gmail, Drive, Sheets)", state: "off", note: "Not connected. Open Connections and press Connect Google." }],
  });

  const linear = await linearAuthorization(supabase, user.id);
  groups.push({ title: "Linear", rows: [linear ? await attempt("Linear", () => fetchLinearIssues({ authorization: linear })) : { name: "Linear", state: "off", note: "Not connected. Open Connections and press Connect Linear." }] });

  const composioKey = getComposioKey();
  if (!composioKey) {
    groups.push({ title: "More apps (through Composio)", rows: [{ name: "Composio", state: "problem", note: COMPOSIO_OFF }] });
    return { groups, off: [] };
  }
  const composio = await checkComposioConnections({ key: composioKey, userId: user.id });
  if (composio.error) {
    groups.push({ title: "More apps (through Composio)", rows: [{ name: "Composio", state: "problem", note: composio.error }] });
    return { groups, off: [] };
  }
  groups.push({
    title: "More apps (through Composio)",
    rows: composio.rows.length
      ? composio.rows.map((row) => ({ name: row.name, state: row.ok ? "ok" : "problem", note: row.note, actions: row.actions.map((action) => ({ name: action.name, state: action.ok ? "ok" : "problem", note: action.note })) }))
      : [{ name: "No apps connected yet", state: "off", note: "Open Connections and press Connect on an app, such as Gmail (send) or Slack." }],
  });
  return { groups, off: composio.off };
}

