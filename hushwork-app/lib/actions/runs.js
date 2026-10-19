"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import { practiceRun, readSavedResults, isTelegramSend, telegramMessage, SETUP_MESSAGE } from "@/lib/run-engine";
import { getTelegram } from "@/lib/connectors/telegram-env";
import { sendTelegram } from "@/lib/connectors/telegram";
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

// Real sends are rare and deliberate, so the limits are small: 3 a minute and 20 a day per person. They live in the
// server's memory (a restart forgets them), like the AI limits.
const MINUTE = 60_000;
const DAY = 86_400_000;
const limits = () => (globalThis.__hushworkSendLimits ??= { minute: makeLimiter({ max: 3, windowMs: MINUTE }), day: makeLimiter({ max: 20, windowMs: DAY, calendar: true }) });

// The "Approve and send" button. It re-reads the saved practice run from the database, so the message sent is the one
// built from that saved step (the browser only says WHICH run and WHICH step). Only a send step set to Telegram can be
// sent, and only to the owner's own chat from .env.local. The real send is saved as a separate "live" run.
export async function approveTelegramSend(input) {
  const user = await requireUser();
  const id = checkId(input?.runId);
  const index = input?.index;
  if (id.error || !Number.isInteger(index) || index < 0 || index > 50) return { error: "That run no longer exists." };

  const telegram = getTelegram();
  if (!telegram) return { error: "Telegram is not connected yet. The Connections page explains the two settings to add." };

  const supabase = await createClient();
  const { data: rows, error: loadError } = await supabase.from("runs").select("workflow_id, workflow_name, mode, results").eq("id", id.value).eq("user_id", user.id);
  if (loadError) {
    console.error("approveTelegramSend load failed:", loadError.code);
    return { error: "Could not load that run. Check your connection and try again." };
  }
  const run = rows?.[0];
  const step = run ? readSavedResults(run.results)[index] : null;
  if (!run || run.mode !== "practice" || !isTelegramSend(step)) return { error: "That step cannot be sent." };

  const now = Date.now();
  if (limits().minute.left(user.id, now) < 1) return { error: "You sent several messages a moment ago. Try again in a minute." };
  if (limits().day.left(user.id, now) < 1) return { error: "You have reached today's limit of 20 sent messages. It resets at midnight UTC." };

  const sent = await sendTelegram({ ...telegram, text: telegramMessage(run.workflow_name, step) });
  if (!sent.ok) return { error: sent.error };
  limits().minute.take(user.id, now);
  limits().day.take(user.id, now);

  // The message is out. Saving the record is best effort: if it fails, say so but do not pretend the send failed.
  const record = { ...step, status: "done", outcome: "Sent to your Telegram chat after you approved it." };
  const { data, error } = await supabase
    .from("runs")
    .insert({ workflow_id: run.workflow_id, workflow_name: run.workflow_name, mode: "live", status: "done", results: [record] })
    .select("id");
  if (error) {
    console.error("approveTelegramSend save failed:", error.code);
    return { ok: true, runId: "", note: "The message was sent, but the record could not be saved." };
  }
  revalidatePath("/app", "layout");
  return { ok: true, runId: String(data?.[0]?.id ?? "") };
}
