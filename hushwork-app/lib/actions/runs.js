"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import { practiceRun, readSavedResults, isTelegramSend, isRequestStep, telegramMessage, SETUP_MESSAGE } from "@/lib/run-engine";
import { getTelegram } from "@/lib/connectors/telegram-env";
import { sendTelegram } from "@/lib/connectors/telegram";
import { fetchPublic } from "@/lib/connectors/http";
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
// them), like the AI limits. Telegram: 3 a minute and 20 a day per person. Web calls: 5 a minute and 30 a day.
const MINUTE = 60_000;
const DAY = 86_400_000;
const limiters = (name, perMinute, perDay) => (globalThis[name] ??= { minute: makeLimiter({ max: perMinute, windowMs: MINUTE }), day: makeLimiter({ max: perDay, windowMs: DAY, calendar: true }) });
const telegramLimits = () => limiters("__hushworkSendLimits", 3, 20);
const webCallLimits = () => limiters("__hushworkWebCallLimits", 5, 30);

// Shared by the two "Approve" actions. The browser only says WHICH run and WHICH step; this re-reads the saved practice
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
  const step = run ? readSavedResults(run.results)[index] : null;
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

// The "Approve and send" button for a Telegram step. Only a send step set to Telegram can be sent, and only to the owner's
// own chat from .env.local.
export async function approveTelegramSend(input) {
  const user = await requireUser();
  const telegram = getTelegram();
  if (!telegram) return { error: "Telegram is not connected yet. The Connections page explains the two settings to add." };

  const supabase = await createClient();
  const loaded = await loadPracticeStep(supabase, user, input, isTelegramSend);
  if (loaded.error) return loaded;
  const { run, step } = loaded;

  const now = Date.now();
  const tooMany = limitError(telegramLimits(), user.id, now, "sent messages");
  if (tooMany) return { error: tooMany };

  const sent = await sendTelegram({ ...telegram, text: telegramMessage(run.workflow_name, step) });
  if (!sent.ok) return { error: sent.error };
  telegramLimits().minute.take(user.id, now);
  telegramLimits().day.take(user.id, now);

  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: "Sent to your Telegram chat after you approved it." });
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

  const answer = await fetchPublic(step.fields.url);
  if (!answer.ok) return { error: answer.error };

  const reply = answer.status >= 300 && answer.status < 400 ? `${answer.status} (a redirect, not followed)` : String(answer.status);
  const outcome = `Asked ${step.fields.url}. It answered ${reply}${answer.type ? ` (${answer.type})` : ""}.${answer.excerpt ? ` Start of the answer: ${answer.excerpt}` : ""}`;
  return saveLiveRun(supabase, run, { ...step, status: "done", outcome: outcome.slice(0, 700) });
}
