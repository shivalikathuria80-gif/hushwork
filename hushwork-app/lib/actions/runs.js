"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId, checkSteps } from "@/lib/validate";
import { practiceRun, readSavedResults, isRequestStep, isLinearLookup, isCalendarLookup, isSheetsRow, isAiStep, SETUP_MESSAGE } from "@/lib/run-engine";
import { fetchPublic, checkRequestUrl } from "@/lib/connectors/http";
import { openMcp } from "@/lib/connectors/mcp";
import { getGroqKey } from "@/lib/ai/key";
import { runAgent } from "@/lib/ai/agent";
import { looksSensitive } from "@/lib/ai/plan";
import { getLinearKey } from "@/lib/connectors/linear-env";
import { getConnectionsKey, getGoogleApp, getLinearApp } from "@/lib/connectors/oauth-env";
import { loadAccess } from "@/lib/connections/store";
import { fetchUpcomingEvents } from "@/lib/connectors/google-calendar";
import { appendRow, parseCells, parseSheetUrl } from "@/lib/connectors/google-sheets";
import { fetchLinearIssues } from "@/lib/connectors/linear";
import { makeLimiter } from "@/lib/ai/limits";

// Server Action behind the "Practice run" button. It loads the person's own workflow, walks its steps with the
// practice engine (lib/run-engine.js: nothing leaves the app) and saves the result as a row in the "runs" table.
// Same four habits as lib/actions/drafts.js: requireUser first, validate, talk to the database (user_id is filled in by
// the database), return a SMALL object. Raw database errors are never returned.

// "42P01" / "PGRST205" = the runs table does not exist yet (supabase/runs.sql has not been pasted into Supabase).
const NO_TABLE = new Set(["42P01", "PGRST205"]);

export async function startPracticeRun(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: id.error };

  const supabase = await createClient();
  const { data: rows, error: loadError } = await supabase.from("workflows").select("id, name, plan").eq("id", id.value).eq("user_id", user.id);
  if (loadError) {
    console.error("startPracticeRun load failed:", loadError.code);
    return { error: "Could not start the run. Check your connection and try again." };
  }
  const workflow = rows?.[0];
  if (!workflow) return { error: "That workflow no longer exists." };

  const run = practiceRun(workflow.plan);
  if (run.status === "failed") return { error: "This workflow has no steps to run. Add a step in the Builder first." };

  const { data, error } = await supabase
    .from("runs")
    .insert({ workflow_id: workflow.id, workflow_name: workflow.name, mode: "practice", status: run.status, results: run.results })
    .select("id");
  if (error) {
    console.error("startPracticeRun save failed:", error.code);
    return { error: NO_TABLE.has(error.code) ? SETUP_MESSAGE : "The run finished but could not be saved. Try again." };
  }
  revalidatePath("/app", "layout");
  return { ok: true, runId: String(data?.[0]?.id ?? "") };
}

// Real actions are rare and deliberate, so the limits are small. They live in the server's memory (a restart forgets
// them), like the AI limits. Web calls and Linear lookups: 5 a minute and 30 a day per person (each counted separately).
const MINUTE = 60_000;
const DAY = 86_400_000;
const limiters = (name, perMinute, perDay) => (globalThis[name] ??= { minute: makeLimiter({ max: perMinute, windowMs: MINUTE }), day: makeLimiter({ max: perDay, windowMs: DAY, calendar: true }) });
const webCallLimits = () => limiters("__hushworkWebCallLimits", 5, 30);
const linearLimits = () => limiters("__hushworkLinearLimits", 5, 30);
const calendarLimits = () => limiters("__hushworkCalendarLimits", 5, 30);
const sheetsLimits = () => limiters("__hushworkSheetsLimits", 5, 30);
const aiLimits = () => limiters("__hushworkAiStepLimits", 3, 15);

// Used by the "Approve" action. The browser only says WHICH run and WHICH step; this re-reads the saved practice
// run from the database (only the person's own, thanks to user_id and the database rules) and returns the saved step.
async function loadPracticeStep(supabase, user, input, allowed) {
  const id = checkId(input?.runId);
  const index = input?.index;
  if (id.error || !Number.isInteger(index) || index < 0 || index > 50) return { error: "That run no longer exists." };
  const { data: rows, error } = await supabase.from("runs").select("workflow_id, workflow_name, mode, results").eq("id", id.value).eq("user_id", user.id);
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
  return { run, step };
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
    .insert({ workflow_id: run.workflow_id, workflow_name: run.workflow_name, mode: "live", status: "done", results: [record] })
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
export async function approveWebCall(input) {
  const user = await requireUser();
  const supabase = await createClient();
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
const LINEAR_OFF = "Linear is not connected yet. Open Connections and press Connect Linear.";
async function linearAuthorization(supabase, userId) {
  const secretKey = getConnectionsKey();
  const app = getLinearApp();
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
  const app = getGoogleApp();
  if (!secretKey || !app) return null;
  const access = await loadAccess({ supabase, userId, provider: "google", key: secretKey, app });
  return access ? `Bearer ${access.token}` : null;
}

// One line per event for the Runs page and the AI: "Tue 20 Oct, 09:00  Maths test".
const eventLines = (events) => events.map((event) => `${event.start}  ${event.title}`).join("; ");

// The "Approve and ask Linear" button. READ-ONLY: lib/connectors/linear.js can only ask, never change. Only a Look something
// up step set to Linear qualifies, and the key comes from .env.local on the server.
export async function approveLinearLookup(input) {
  const user = await requireUser();
  const supabase = await createClient();
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

  const list = answer.issues.map((issue) => `${issue.id} ${issue.title}${issue.state ? ` (${issue.state})` : ""}`).join("; ");
  const outcome = answer.issues.length ? `Asked Linear. You have ${answer.issues.length} open ${answer.issues.length === 1 ? "task" : "tasks"}: ${list}` : "Asked Linear. You have no open tasks.";
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: outcome.slice(0, 900) });
}

// The "Approve and ask the AI" button. The AI gets ONE read-only tool at most, decided by the saved step (never by the
// model): "My Linear tasks" or "the web address written in the step". lib/ai/agent.js is the loop; it cannot change anything.
export async function approveAiStep(input) {
  const user = await requireUser();
  const groqKey = getGroqKey();
  if (!groqKey) return { error: "AI is switched off. Add the Groq key to .env.local first." };
  const supabase = await createClient();
  const loaded = await loadPracticeStep(supabase, user, input, isAiStep);
  if (loaded.error) return loaded;
  const { run, step } = loaded;
  const { task, uses, address } = step.fields;
  if (looksSensitive(task)) return { error: "That request looks like it holds a card number or a secret key, so it was not sent. Remove it and try again." };

  // Counted BEFORE anything goes out (an MCP step connects to an outside server), so a loop of Approves cannot be used as a request relay.
  const now = Date.now();
  const tooMany = limitError(aiLimits(), user.id, now, "AI steps");
  if (tooMany) return { error: tooMany };
  aiLimits().minute.take(user.id, now);
  aiLimits().day.take(user.id, now);

  const tools = Object.create(null); // no prototype, so a tool called __proto__ is just a name
  if (uses === "linear") {
    const authorization = await linearAuthorization(supabase, user.id);
    if (!authorization) return { error: LINEAR_OFF };
    tools.linear_open_tasks = {
      description: "Lists the person's open Linear tasks (up to 10) with their status.",
      run: async () => {
        const answer = await fetchLinearIssues({ authorization });
        if (!answer.ok) return answer.error;
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
        if (!answer.ok) return answer.error;
        return answer.events.length ? answer.events.map((event) => `${event.start}  ${event.title}`).join("\n") : "There are no events in the next 7 days.";
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
  const looked = answer.calls.length ? ` (it looked at ${uses === "linear" ? "your Linear tasks" : uses === "calendar" ? "your calendar" : uses === "mcp" ? `the MCP server, using ${[...new Set(answer.calls)].join(", ")}` : "the web address"})` : "";
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: `The AI answered${looked}: ${answer.text}`.slice(0, 1700) });
}

// The "Approve and look at my calendar" button. READ-ONLY (the permission Google gave is read-only, and
// lib/connectors/google-calendar.js only sends a GET). Only a Look something up step set to Calendar qualifies.
export async function approveCalendarLookup(input) {
  const user = await requireUser();
  const supabase = await createClient();
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
  const outcome = answer.events.length ? `Asked Google Calendar. You have ${answer.events.length} ${answer.events.length === 1 ? "event" : "events"} in the next 7 days: ${eventLines(answer.events)}` : "Asked Google Calendar. You have no events in the next 7 days.";
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: outcome.slice(0, 900) });
}

// The "Delete this run" button. A run is only a record, so deleting it changes nothing outside Hushwork. Only the person's
// own run can go (user_id filter plus the database rules; there is no way to delete somebody else's). Returns { ok: true } or { error }.
export async function deleteRun(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: "That run no longer exists." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("runs").delete().eq("id", id.value).eq("user_id", user.id).select("id");
  if (error) {
    console.error("deleteRun failed:", error.code);
    return { error: "Could not delete. Try again." };
  }
  if (!data?.length) return { error: "That run no longer exists." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

// The "Approve and add the row" button. The ONE action that writes into somebody's Google account, so: the sheet address and the
// boxes come from the SAVED run (never from the browser), they are checked again here, the person saw the exact boxes on the
// approval card, and lib/connectors/google-sheets.js can only append a row (it cannot read, change or delete cells).
export async function approveSheetsRow(input) {
  const user = await requireUser();
  const supabase = await createClient();
  const loaded = await loadPracticeStep(supabase, user, input, isSheetsRow);
  if (loaded.error) return loaded;
  const { run, step } = loaded;
  const sheet = parseSheetUrl(step.fields.to);
  const row = parseCells(step.fields.values);
  if (sheet.error || row.error) return { error: sheet.error ?? row.error };
  const authorization = await googleAuthorization(supabase, user.id);
  if (!authorization) return { error: GOOGLE_OFF };

  const now = Date.now();
  const tooMany = limitError(sheetsLimits(), user.id, now, "added rows");
  if (tooMany) return { error: tooMany };
  sheetsLimits().minute.take(user.id, now);
  sheetsLimits().day.take(user.id, now);

  const added = await appendRow({ authorization, spreadsheetId: sheet.id, cells: row.cells });
  if (!added.ok) return { error: added.error };
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: `Added one row to your Google Sheet (${row.cells.length} ${row.cells.length === 1 ? "box" : "boxes"}): ${row.cells.join(" | ")}`.slice(0, 700) });
}
