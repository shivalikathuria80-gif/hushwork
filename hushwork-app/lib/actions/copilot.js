"use server";

import { requireUser } from "@/lib/auth";
import { getGroqKey } from "@/lib/ai/key";
import { askCopilot, COPILOT_LIMITS } from "@/lib/ai/copilot";
import { makePreview } from "@/lib/ai/preview";
import { AI_LIMITS, looksSensitive } from "@/lib/ai/plan";
import { takeDbSlot } from "@/lib/db-limits";
import { loadMemory } from "@/lib/ai/memory";
import { createClient } from "@/lib/supabase/server";

// The Server Action behind Hushwork AI in the Builder. It reads the Groq key on the server (lib/ai/key.js: the Groq key in
// .env.local and on Vercel), never sends it to the page, and counts every turn in the database (bucket "ai_chat").
// When the AI decides the workflow should be built or changed, the normal plan writer makes the steps (and counts as a plan).
// Returns { reply, steps?, notice? } or { error, why }. Nothing here runs, sends or saves a workflow.
const SAY = {
  off: "AI is off on this server: the Groq key setting is missing.",
  sensitive: "That looks like it has a password, key or card number in it, so it was not sent to the AI. Take it out and try again.",
  limit_minute: "That is a lot of messages in a minute. Wait a moment and try again.",
  limit_day: "You have used today's Hushwork AI messages. They come back tomorrow.",
  busy: "Groq is busy right now. Try again in a minute.",
  timeout: "Groq took too long to answer. Try again.",
  auth: "The Groq key was refused. Check the Groq key on Vercel and redeploy.",
};

export async function copilotTurn(input) {
  const user = await requireUser();
  const message = typeof input?.message === "string" ? input.message.trim() : "";
  if (!message) return { error: "Write a message first.", why: "empty" };
  if (message.length > COPILOT_LIMITS.messageMax) return { error: `Use ${COPILOT_LIMITS.messageMax} characters or fewer.`, why: "too_long" };
  const groqKey = getGroqKey();
  if (!groqKey) return { error: SAY.off, why: "off" };
  if (looksSensitive(message)) return { error: SAY.sensitive, why: "sensitive" };
  const supabase = await createClient();
  const slot = await takeDbSlot(supabase, "ai_chat", COPILOT_LIMITS.perUserMinute, COPILOT_LIMITS.perUserDay);
  if (!slot.ok) return { error: SAY[slot.why], why: slot.why };

  const history = Array.isArray(input?.history) ? input.history.slice(-COPILOT_LIMITS.historyTurns) : [];
  const lines = Array.isArray(input?.lines) ? input.lines.filter((line) => typeof line === "string").slice(0, 12) : [];
  const turn = await askCopilot({ message, history, lines, groqKey });
  if (!turn.ok) {
    console.log(`ai-copilot failed why=${turn.why}`);
    return { error: SAY[turn.why] ?? "Hushwork AI could not answer that. Try again.", why: turn.why };
  }
  console.log(`ai-copilot ok build=${turn.request ? 1 : 0}`);
  if (!turn.request) return { reply: turn.reply };

  const plan = await makePreview({ prompt: turn.request, userId: user.id, groqKey, memory: await loadMemory(supabase, user.id), dbTake: () => takeDbSlot(supabase, "ai_plan", AI_LIMITS.perUserMinute, AI_LIMITS.perUserDay) });
  if (plan?.source === "ai" && Array.isArray(plan.steps) && plan.steps.length) return { reply: turn.reply, steps: plan.steps, request: turn.request };
  // The plan writer could not answer (limit, busy...): the page makes the quick plan from the same request and says why.
  return { reply: turn.reply, request: turn.request, notice: plan?.notice ?? "The AI plan could not be written, so this is the quick plan." };
}
