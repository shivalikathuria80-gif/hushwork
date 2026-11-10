// The tools a chatbot gets through the Hushwork plugin (app/api/mcp/route.js speaks MCP; this file does the work). Every tool takes
// `who` = { user: { id, email }, supabase }, worked out by the route from the person's API token, exactly like a schedule's run is worked
// out from its stored row (lib/schedule-runner.js). Nothing here trusts the chatbot with "who".
//
// THE SAFETY RULE IS THE APP'S RULE. Reading, looking things up and asking the AI happen by themselves. A step that WRITES (sends an email,
// creates a task, adds a row) is never done by create_agent or run_agent: it waits, as on the Runs page. Only approve_step does it, and only
// with `seen` = the exact words the person was shown (get_run / list_waiting give them as `will_do`); if those words changed since,
// nothing is sent (the same "changed since you read it" check the Approve button uses).
import { checkId, checkPrompt } from "../validate.js";
import {
  readSavedResults, stepState, isApprovable, isWriteStep, runOutcome, aiSummary, linearSummary, calendarSummary, gmailSummary, driveSummary,
  linearCreateSummary, appSummary, actionSummary, sheetsSummary, requestSummary, isAiStep, isLinearLookup, isCalendarLookup, isGmailLookup,
  isDriveLookup, isLinearCreate, isAppLookup, isActionStep, isSheetsRow,
  incomingOf,
} from "../run-engine.js";
import { ANSWERS_TAG, findAnswer, findAnswers } from "../run-answer.js";
import { describeSchedule } from "../schedule.js";
import { loadWaiting } from "../run-waiting.js";
import { cleanNotes } from "../agent/brain.js";
import { AGENT_KIND, NO_KIND_COLUMN } from "../agents/kinds.js";

const NO_TABLE = new Set(["42P01", "PGRST205"]);
const TRY_AGAIN = "Hushwork could not read that. Try again in a moment.";
const cut = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");

// ---- the tool list, as MCP describes tools -----------------------------------------------------------------------------------------------
const object = (properties = {}, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const RUN_ID = { type: "string", description: "The run's id, from run_agent, list_runs or list_waiting." };
const STEP = { type: "integer", minimum: 0, maximum: 50, description: "The step number (index) from get_run or list_waiting. The Start step is 0." };

export const TOOLS = [
  {
    name: "list_agents",
    title: "List agents and workflows",
    description: "Lists the person's Hushwork agents and workflows, newest first, with each one's schedule and how many steps of its latest run wait for approval.",
    inputSchema: object({ kind: { type: "string", enum: ["all", "agent", "workflow"], description: "Only agents, only workflows, or both (default)." } }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "create_agent",
    title: "Create an agent",
    description: "Creates a Hushwork agent from one plain sentence, like \"Every Monday at 9, sum up my calendar for the week and email it to me\". A time in the sentence becomes its schedule. It runs once straight away: reading and AI steps happen, and any step that sends or creates something waits for approval (see list_waiting). Confirm the sentence with the person before calling.",
    inputSchema: object({
      sentence: { type: "string", minLength: 3, maxLength: 2000, description: "The task in the person's own words, including when it should run if they said." },
      tz_offset_minutes: { type: "integer", minimum: -840, maximum: 840, description: "The person's time zone as minutes east of UTC (India is 330, New York in winter is -300), so \"at 9\" means their 9 o'clock. Default 0 (UTC)." },
    }, ["sentence"]),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "run_agent",
    title: "Run an agent or workflow now",
    description: "Runs one agent or workflow now. Reading, look-ups and AI steps happen by themselves; a step that sends or creates something is NOT done, it waits for approval. Returns the run id; read it with get_run.",
    inputSchema: object({ id: { type: "string", description: "The agent's or workflow's id, from list_agents." } }, ["id"]),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "list_runs",
    title: "List recent runs",
    description: "Lists recent runs, newest first, each with a one-line outcome (completed, needs approval, stopped...). Use `since` for a weekly review.",
    inputSchema: object({
      workflow_id: { type: "string", description: "Only runs of this agent or workflow." },
      since: { type: "string", description: "Only runs started at or after this time (ISO 8601, like 2026-11-01T00:00:00Z)." },
      limit: { type: "integer", minimum: 1, maximum: 25, description: "How many runs (default 10)." },
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_run",
    title: "Read one run",
    description: "Reads one run step by step: what each step found or wrote, and for each step that waits, `will_do` (the exact words it would send). Show `will_do` to the person before approve_step.",
    inputSchema: object({ run_id: RUN_ID }, ["run_id"]),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_waiting",
    title: "List steps waiting for approval",
    description: "Every step, across the latest run of each agent and workflow, that waits for the person's approval, with `will_do`: the exact words it would send, add or create.",
    inputSchema: object(),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "approve_step",
    title: "Approve a waiting step",
    description: "Does ONE waiting step for real (this may send an email, post a message, create a task or add a row). ONLY call it after showing the person the step's `will_do` words and getting a clear yes in this conversation. Pass those exact words as `seen`: if the step would now send something different, nothing is sent and you get the new words to show.",
    inputSchema: object({
      run_id: RUN_ID, step: STEP,
      seen: { type: "string", maxLength: 4000, description: "The step's `will_do` text exactly as get_run or list_waiting returned it and as the person read it." },
      confirm_retry: { type: "boolean", description: "Only when the step was started before but Hushwork never saw it finish, AND the person checked the other app and says it was NOT done." },
    }, ["run_id", "step", "seen"]),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "reject_step",
    title: "Turn down a waiting step",
    description: "Turns down one waiting step: nothing is sent, and it stops counting as waiting. The person can still approve it later in Hushwork.",
    inputSchema: object({ run_id: RUN_ID, step: STEP, reason: { type: "string", maxLength: 200, description: "Optional: why, in the person's words." } }, ["run_id", "step"]),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "agent_notes",
    title: "Read the Hushwork Agent's notes",
    description: "Reads the always-on Hushwork Agent's current notes (\"what needs you today\"), built from the apps the person connected, and when it last looked.",
    inputSchema: object(),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

// ---- helpers -----------------------------------------------------------------------------------------------------------------------------

// The records saved under one practice run (lib/run-state.js), sorted the way the Runs page sorts them. Returns { done, stopped, unknown }
// (Maps step number -> record) or null when they could not be read.
async function loadRecords(supabase, userId, runId, since) {
  try {
    const { data, error } = await supabase.from("runs").select("results, created_at")
      .eq("user_id", userId).eq("mode", "live").contains("results", JSON.stringify([{ from: runId }]))
      .gte("created_at", typeof since === "string" && since ? since : "1970-01-01T00:00:00Z") // records come after their run (see loadStepStates in lib/run-state.js)
      .order("created_at", { ascending: true }).limit(60);
    if (error || !Array.isArray(data)) return null;
    const done = new Map(); const stopped = new Map(); const unknown = new Map();
    for (const row of data) {
      const raw = Array.isArray(row?.results) ? row.results[0] : null;
      const first = readSavedResults(row?.results)[0];
      if (!first || first.from !== runId || !Number.isInteger(first.fromStep)) continue;
      const record = { ...first, answer: typeof raw?.answer === "string" ? raw.answer : "", quiet: raw?.quiet === true };
      if (first.status === "failed") { stopped.set(first.fromStep, record); if (!first.note) unknown.delete(first.fromStep); }
      else if (first.status === "pending") { unknown.set(first.fromStep, record); stopped.delete(first.fromStep); }
      else { done.set(first.fromStep, record); stopped.delete(first.fromStep); unknown.delete(first.fromStep); }
    }
    return { done, stopped, unknown };
  } catch {
    return null;
  }
}

// The exact words the Runs page's approval card shows for a step (components/app/RunsViewer.js does the same), so `seen` can be checked.
function willDo(step, answer, answers, email, incoming = null) {
  if (isAiStep(step)) return aiSummary(step);
  if (isLinearLookup(step)) return linearSummary(step);
  if (isCalendarLookup(step)) return calendarSummary(step);
  if (isGmailLookup(step)) return gmailSummary(step);
  if (isDriveLookup(step)) return driveSummary(step);
  if (isLinearCreate(step)) return linearCreateSummary(step, answer);
  if (isAppLookup(step)) return appSummary(step);
  if (isActionStep(step)) return actionSummary(step, answer, answers, email, incoming);
  if (isSheetsRow(step)) return sheetsSummary(step, answer, incoming);
  return requestSummary(step);
}

const STATE_WORDS = { done: "done", unsure: "started, end unknown", stopped: "stopped", waiting: "waiting for approval", "plan-only": "plan only, never carried out", nothing: "nothing to do" };

// One practice run, read in full. Returns { run } or { error }.
async function readRun(who, runId) {
  const { user, supabase } = who;
  const { data, error } = await supabase.from("runs").select("id, workflow_id, workflow_name, mode, results, created_at").eq("id", runId).eq("user_id", user.id).limit(1);
  if (error) return { error: NO_TABLE.has(error.code) ? "Runs are not set up on this Hushwork server yet." : TRY_AGAIN };
  const row = data?.[0];
  if (!row || row.mode !== "practice") return { error: "That run does not exist, or it is a record of one step (open the run it came from)." };
  const steps = readSavedResults(row.results);
  const rawSteps = Array.isArray(row.results) ? row.results : [];
  const records = await loadRecords(supabase, user.id, String(row.id), row.created_at);
  if (!records) return { error: TRY_AGAIN };
  const { done, stopped, unknown } = records;
  const quiet = [...done.values(), ...stopped.values()].some((record) => record.quiet);

  const waitingSteps = steps.map((step, index) => ({ step, index })).filter(({ step, index }) => !done.has(index) && isApprovable(step));
  const needsAnswer = waitingSteps.some(({ step }) => `${step.fields?.title}${step.fields?.details}${step.fields?.values}`.includes("{answer}"));
  const needsAnswers = waitingSteps.some(({ step }) => isActionStep(step) && String(step.fields?.details).includes(ANSWERS_TAG));
  const ref = { id: String(row.id), workflow_id: row.workflow_id, created_at: row.created_at };
  const answer = needsAnswer ? await findAnswer(supabase, user.id, ref) : "";
  const answers = needsAnswers ? await findAnswers(supabase, user.id, ref) : [];

  const outcome = runOutcome(steps, done, stopped, unknown);
  return {
    run: {
      id: String(row.id),
      workflow_id: row.workflow_id ? String(row.workflow_id) : null,
      name: String(row.workflow_name),
      started_at: row.created_at,
      outcome: quiet ? "Nothing new: a watch check that found nothing to tell." : `${outcome.label}. ${outcome.text}`,
      steps: steps.map((step, index) => {
        const state = stepState(step, index, done, stopped, unknown);
        const record = done.get(index) ?? unknown.get(index) ?? stopped.get(index);
        const result = record ? cut(record.answer || record.outcome, 3000) : index === 0 ? cut(step.outcome, 300) : "";
        return {
          step: index,
          title: cut(step.title, 120),
          ...(cut(rawSteps[index]?.detail, 300) ? { detail: cut(rawSteps[index].detail, 300) } : {}),
          state: STATE_WORDS[state] ?? state,
          writes: isWriteStep(step),
          ...(result ? { result } : {}),
          ...(isApprovable(step) && !done.has(index) ? { will_do: willDo(step, answer, answers, who.user.email ?? "", incomingOf(steps)) } : {}),
        };
      }),
    },
  };
}

// ---- the tools ---------------------------------------------------------------------------------------------------------------------------

async function listAgents(args, who) {
  const { user, supabase } = who;
  const kind = ["agent", "workflow"].includes(args?.kind) ? args.kind : "all";
  let read = await supabase.from("workflows").select("id, name, prompt, kind, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50);
  if (read.error && NO_KIND_COLUMN.has(read.error.code)) read = await supabase.from("workflows").select("id, name, prompt, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50);
  if (read.error) return { error: NO_TABLE.has(read.error.code) ? "Workflows are not set up on this Hushwork server yet." : TRY_AGAIN };
  const rows = (read.data ?? []).filter((row) => kind === "all" || (kind === "agent") === (row.kind === AGENT_KIND));

  const schedules = new Map();
  try {
    const { data } = await supabase.from("schedules").select("workflow_id, frequency, hour, minute, weekday, tz_offset, enabled, allow_writes, last_status, next_run_at").eq("user_id", user.id);
    for (const row of data ?? []) schedules.set(String(row.workflow_id), row);
  } catch { /* shown without schedules */ }
  const waiting = await loadWaiting(supabase, user.id, rows.map((row) => String(row.id)));

  return {
    count: rows.length,
    items: rows.map((row) => {
      const id = String(row.id);
      const schedule = schedules.get(id);
      const wait = waiting.get(id);
      return {
        id, name: String(row.name), kind: row.kind === AGENT_KIND ? "agent" : "workflow", sentence: cut(row.prompt, 300), updated_at: row.updated_at,
        schedule: schedule
          ? { when: `${describeSchedule({ frequency: schedule.frequency, hour: schedule.hour, minute: schedule.minute, weekday: schedule.weekday })} (their time)`, on: schedule.enabled !== false, writes_by_itself: schedule.allow_writes === true, last_status: schedule.last_status ?? null, next_run_at: schedule.next_run_at ?? null }
          : null,
        ...(wait ? { waiting: { run_id: wait.runId, steps: wait.waiting } } : {}),
      };
    }),
  };
}

async function createAgentTool(args, who, deps) {
  const prompt = checkPrompt(args?.sentence);
  if (prompt.error) return { error: prompt.error };
  const tzOffset = Number.isInteger(args?.tz_offset_minutes) ? args.tz_offset_minutes : 0;
  const made = await deps.createAgent({ prompt: prompt.value, tzOffset, ...who });
  if (made.error) return { error: made.error };
  return {
    id: made.id, name: made.name,
    ...(made.scheduleText ? { schedule: made.scheduleText } : {}),
    ...(made.runId ? { first_run_id: made.runId, first_run: autoWords(made.auto) } : { first_run: `It was saved, but its first run did not start: ${made.runError}` }),
    steps_that_wait_for_approval: made.waiting,
    ...(made.notice ? { notice: made.notice } : {}),
  };
}

function autoWords(auto) {
  if (!auto) return "Started.";
  const parts = [`${auto.done ?? 0} step(s) done`];
  if (auto.waiting) parts.push(`${auto.waiting} step(s) wait for approval`);
  if (auto.stoppedAt) parts.push(`stopped at step ${auto.stoppedAt - 1}${auto.reason ? `: ${auto.reason}` : ""}`);
  if (auto.quiet) parts.push("nothing new found");
  return `${parts.join(", ")}.`;
}

async function runAgentTool(args, who, deps) {
  const id = checkId(args?.id);
  if (id.error) return { error: "That agent or workflow does not exist. Use list_agents to find its id." };
  const started = await deps.startRun({ id: id.value, auto: true, allowWrites: false }, who);
  if (started?.error) return { error: started.error };
  return { run_id: started.runId, result: autoWords(started.auto), next: "Read it with get_run. Steps that send or create wait for approval." };
}

async function listRuns(args, who) {
  const { user, supabase } = who;
  const limit = Number.isInteger(args?.limit) ? Math.min(Math.max(args.limit, 1), 25) : 10;
  let query = supabase.from("runs").select("id").eq("user_id", user.id).eq("mode", "practice");
  if (args?.workflow_id) {
    const id = checkId(args.workflow_id);
    if (id.error) return { error: "That agent or workflow does not exist." };
    query = query.eq("workflow_id", id.value);
  }
  if (typeof args?.since === "string" && args.since) {
    const since = Date.parse(args.since);
    if (Number.isNaN(since)) return { error: "`since` must be a time like 2026-11-01T00:00:00Z." };
    query = query.gte("created_at", new Date(since).toISOString());
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) return { error: NO_TABLE.has(error.code) ? "Runs are not set up on this Hushwork server yet." : TRY_AGAIN };
  const runs = [];
  for (const row of data ?? []) {
    const read = await readRun(who, String(row.id));
    if (read.run) {
      const { steps, ...rest } = read.run;
      runs.push({ ...rest, waiting: steps.filter((step) => step.will_do && step.state === "waiting for approval").length });
    }
  }
  return { count: runs.length, runs };
}

async function getRun(args, who) {
  const id = checkId(args?.run_id);
  if (id.error) return { error: "That run does not exist." };
  const read = await readRun(who, id.value);
  return read.error ? { error: read.error } : read.run;
}

async function listWaiting(args, who) {
  const listed = await listAgents({ kind: "all" }, who);
  if (listed.error) return listed;
  const waiting = [];
  for (const item of listed.items.filter((one) => one.waiting)) {
    const read = await readRun(who, item.waiting.run_id);
    if (!read.run) continue;
    for (const step of read.run.steps) {
      if (step.state !== "waiting for approval") continue;
      waiting.push({ run_id: read.run.id, agent: item.name, agent_id: item.id, step: step.step, title: step.title, writes: step.writes, will_do: step.will_do });
    }
  }
  return { count: waiting.length, waiting, note: waiting.some((one) => one.writes) ? "Steps with writes: true send or create something. Show will_do and get a clear yes before approve_step." : undefined };
}

async function approveStepTool(args, who, deps) {
  const id = checkId(args?.run_id);
  if (id.error || !Number.isInteger(args?.step)) return { error: "That step does not exist. Use get_run to find it." };
  if (typeof args?.seen !== "string" || !args.seen) return { error: "Pass `seen`: the step's will_do words, exactly as the person read them." };
  const done = await deps.approveStep({ runId: id.value, index: args.step, seen: args.seen, ...(args.confirm_retry === true ? { confirmRetry: true } : {}) }, who);
  if (done?.error) {
    if (done.changed) {
      const read = await readRun(who, id.value);
      const now = read.run?.steps?.[args.step]?.will_do;
      return { error: "What this step would send changed since the person read it, so nothing was sent. Show them the new words and ask again.", ...(now ? { will_do_now: now } : {}) };
    }
    return { error: done.error };
  }
  const read = await readRun(who, id.value);
  const step = read.run?.steps?.[args.step];
  return { ok: true, state: step?.state ?? "done", ...(step?.result ? { result: step.result } : {}), ...(done.note ? { note: done.note } : {}) };
}

async function rejectStepTool(args, who, deps) {
  const id = checkId(args?.run_id);
  if (id.error || !Number.isInteger(args?.step)) return { error: "That step does not exist. Use get_run to find it." };
  const done = await deps.rejectStep({ runId: id.value, index: args.step, reason: args?.reason }, who);
  return done?.error ? { error: done.error } : { ok: true, result: "Turned down. Nothing was sent." };
}

async function agentNotes(args, who) {
  const { user, supabase } = who;
  const { data, error } = await supabase.from("agent_state").select("enabled, checked_at, next_check_at, status, notes").eq("user_id", user.id).limit(1);
  if (error) return { error: NO_TABLE.has(error.code) ? "The Hushwork Agent is not set up on this server yet." : TRY_AGAIN };
  const row = data?.[0];
  if (!row?.enabled) return { on: false, notes: [], tip: "The Hushwork Agent is off. The person can turn it on at the top of their Hushwork workspace." };
  return {
    on: true, last_look: row.checked_at ?? null, next_look: row.next_check_at ?? null, last_status: row.status ?? null,
    notes: cleanNotes(row.notes).filter((note) => !note.dismissed).map(({ title, why, ask }) => ({ title, why, ask })),
  };
}

const HANDLERS = {
  list_agents: listAgents, create_agent: createAgentTool, run_agent: runAgentTool, list_runs: listRuns, get_run: getRun,
  list_waiting: listWaiting, approve_step: approveStepTool, reject_step: rejectStepTool, agent_notes: agentNotes,
};

// Calls one tool. `deps` = { createAgent, startRun, approveStep, rejectStep } (the route hands in the real ones; tests hand in pretend ones).
// Returns the tool's answer (a small object), or { error } with a plain sentence. Never throws.
export async function callTool(name, args, who, deps) {
  const handler = Object.hasOwn(HANDLERS, name) ? HANDLERS[name] : null;
  if (!handler) return { error: `There is no tool called ${String(name).slice(0, 40)}.`, unknownTool: true };
  try {
    return await handler(args && typeof args === "object" ? args : {}, who, deps);
  } catch {
    console.error(`plugin tool ${name} crashed`); // no detail: it could hold something private
    return { error: "Something went wrong in Hushwork. Try again in a moment." };
  }
}
