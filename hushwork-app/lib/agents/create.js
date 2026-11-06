// AGENTS: describe a task in plain English and Hushwork makes it, saves it and runs it. One sentence in, one saved agent out.
//
// An agent is a workflow underneath (a row in `workflows` with kind = 'agent', see supabase/agents.sql), so everything that already keeps
// workflows safe keeps agents safe too: the same AI planner and safety nets (lib/ai/preview.js, finishSteps), the same strict step check
// (cleanPlan), the same run engine and write gates (lib/run-core.js), the same schedules and clock (lib/schedule-sync.js, the tick). The only
// differences are what the person does: they never see a plan to approve first, the agent runs straight away, and a time in their sentence
// ("every Monday at 9") becomes its schedule by itself. Builder fans can still open any agent in the Builder: it is a workflow.
//
// What an agent's first run may do by itself: read, look things up and ask the AI. A step that writes (send an email, add a row, create a task)
// is NOT done by itself; it waits on the Runs page for the person's Approve, exactly like a Manual run. A scheduled run writes only when the
// person ticks "Let it write by itself" on its schedule (new schedules start with it off).
//
// No imports from Next.js here (run-core's revalidatePath is handled by the test loader), so `node --test` can run it with a pretend database.
import { makePreview } from "../ai/preview.js";
import { keywordPlan } from "../ai/keyword-plan.js";
import { planToSteps, STEP_KINDS } from "../steps.js";
import { cleanPlan, defaultName } from "../validate.js";
import { parseWhen } from "../schedule-text.js";
import { syncStartSchedule } from "../schedule-sync.js";
import { startPracticeRun } from "../run-core.js";
import { isWriteStep } from "../run-engine.js";
import { AGENT_KIND, NO_KIND_COLUMN, SETUP } from "./kinds.js";

const FAILED_SAVE = "Could not save your agent. Check your connection and try again.";

// Finds the "when" in a sentence: "every weekday at 9", "each Monday at 4pm", "daily at 17:30", "every hour". Returns the words that
// lib/schedule-text.js can read, or "". Only used when the plan's own Start step does not already say when, so the AI's reading wins.
const WHEN_PATTERNS = [
  /\b(?:every|each)\s+hour(?:\s*,?\s*\d{1,2}\s*minutes?\s*past)?\b/i,
  /\bhourly\b/i,
  /\b(?:every|each)\s+(?:week\s+on\s+)?[a-z]+\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?/i,
  /\b(?:daily|weekdays?|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?/i,
];
export function findWhen(sentence) {
  const text = String(sentence ?? "").replace(/\s+/g, " ");
  for (const pattern of WHEN_PATTERNS) {
    const match = text.match(pattern);
    const words = match?.[0]?.trim().replace(/\s+/g, " ").slice(0, STEP_KINDS.trigger.fields[1].max);
    if (words && parseWhen(words)) return words;
  }
  return "";
}

// If the plan's Start step does not already say a readable "when" and the person's sentence does, the Start step says it. A watch Start keeps
// "watch" (it is a schedule with quiet rules); any other Start becomes "On a schedule". With no time in the sentence the plan is unchanged.
export function withSentenceSchedule(steps, sentence) {
  const start = steps[0];
  if (start?.kind !== "trigger") return steps;
  const how = start.fields?.how;
  if ((how === "schedule" || how === "watch") && parseWhen(String(start.fields?.when ?? ""))) return steps;
  const when = findWhen(sentence);
  if (!when) return steps;
  return [{ ...start, fields: { ...start.fields, how: how === "watch" ? "watch" : "schedule", when } }, ...steps.slice(1)];
}

// The steps for an agent: the AI's plan when it wrote one, otherwise the keyword plan (the same fallback the workspace uses), then the strict
// gate every saved plan passes. Returns { steps, notice? } or { error }.
export async function planAgent({ prompt, userId, groqKey, memory, dbTake, fetchImpl, now, limiters, log }) {
  const preview = await makePreview({ prompt, userId, groqKey, memory, dbTake, fetchImpl, ...(now ? { now } : {}), ...(limiters ? { limiters } : {}), ...(log ? { log } : {}) });
  const raw = preview.source === "ai" && Array.isArray(preview.steps) ? preview.steps : planToSteps(keywordPlan(prompt));
  const checked = cleanPlan(JSON.stringify(withSentenceSchedule(raw, prompt)));
  if (checked.error) return { error: "Hushwork could not turn that into steps. Try saying it another way." };
  // A plan that is only "Describe a work task" (the AI's answer to something that is not a task) is not worth saving as an agent.
  if (!checked.value.some((step) => step.kind && step.kind !== "trigger" && step.kind !== "approve")) {
    return { error: "Hushwork could not find a task in that. Describe something it should look at, write or send, like \"Every Monday at 9, sum up my week in Linear and email it to me\"." };
  }
  return { steps: checked.value, ...(preview.source === "keyword" ? { notice: preview.notice } : {}) };
}

// The whole of "Create agent": plan it, save it, schedule it if the sentence says when, and run it once now.
// Returns { ok: true, id, name, runId?, auto?, scheduleText, waiting, notice? } or { error }. The agent is saved even if its first run cannot start:
// the answer then has `runError` instead of `runId`, and the agent waits on the Agents page for Run now.
export async function createAgent({ prompt, user, supabase, groqKey, memory = "", dbTake, tzOffset = 0, fetchImpl, now, limiters, log, run = startPracticeRun }) {
  const planned = await planAgent({ prompt, userId: user.id, groqKey, memory, dbTake, fetchImpl, now, limiters, log });
  if (planned.error) return { error: planned.error };

  const { data, error } = await supabase.from("workflows").insert({ name: defaultName(prompt), prompt, plan: planned.steps, kind: AGENT_KIND }).select("id, name");
  if (error) {
    console.error("createAgent save failed:", error.code);
    return { error: NO_KIND_COLUMN.has(error.code) ? SETUP : FAILED_SAVE };
  }
  const saved = data?.[0];
  if (!saved?.id) return { error: FAILED_SAVE };
  const id = String(saved.id);

  const offset = Number.isInteger(tzOffset) && Math.abs(tzOffset) <= 14 * 60 ? tzOffset : 0;
  const schedule = await syncStartSchedule({ supabase, userId: user.id, workflowId: id, plan: planned.steps, tzOffset: offset });
  const scheduleText = schedule.text ? schedule.text.replace(/the Workflows page/g, "its card on the Agents page") : "";

  const started = await run({ id, auto: true, allowWrites: false }, { user, supabase });
  // `waiting`: how many steps write, so the screen can say they wait for the person's Approve on the Runs page.
  const waiting = planned.steps.filter((step) => isWriteStep(step)).length;
  const base = { ok: true, id, name: String(saved.name), scheduleText, waiting, ...(planned.notice ? { notice: planned.notice } : {}) };
  if (started?.error) return { ...base, runError: started.error };
  return { ...base, runId: started.runId, auto: started.auto };
}
