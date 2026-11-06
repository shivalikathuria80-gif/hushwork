"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId, checkPrompt } from "@/lib/validate";
import { getGroqKey } from "@/lib/ai/key";
import { AI_LIMITS } from "@/lib/ai/plan";
import { takeDbSlot } from "@/lib/db-limits";
import { loadMemory } from "@/lib/ai/memory";
import * as core from "@/lib/run-core";
import { createAgent as makeAgent } from "@/lib/agents/create";

// The buttons on the Agents page (app/app/agents). An agent is a workflow the person describes in one sentence; see lib/agents/create.js.
// (Not to be confused with lib/actions/agent.js: that is the always-on Hushwork Agent that leaves notes on the workspace.)
// Same habits as every other action: requireUser first, validate, the browser only sends small input and never "who", small answers.
// Rename and delete are the workflow ones (lib/actions/drafts.js): an agent is a row in the same table.

// "Create agent": one sentence in, a saved agent out, run once straight away. `tzOffset` is the person's own time zone (minutes east of UTC),
// so "every Monday at 9" means 9 o'clock where they are. Returns what lib/agents/create.js returns.
export async function createAgent(input) {
  const user = await requireUser();
  const prompt = checkPrompt(input?.prompt);
  if (prompt.error) return { error: prompt.error };
  const supabase = await createClient();
  const result = await makeAgent({
    prompt: prompt.value, user, supabase, groqKey: getGroqKey(), memory: await loadMemory(supabase, user.id),
    dbTake: () => takeDbSlot(supabase, "ai_plan", AI_LIMITS.perUserMinute, AI_LIMITS.perUserDay),
    tzOffset: Number(input?.tzOffset),
  });
  if (result.ok) revalidatePath("/app", "layout");
  return result;
}

// "Run now" on an agent's card. Reads, look-ups and Ask the AI steps happen by themselves; a step that writes waits for the person's Approve
// on the Runs page (the same rule as the agent's first run). Returns { ok: true, runId, auto } or { error }.
export async function runAgentNow(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: "That agent no longer exists." };
  return core.startPracticeRun({ id: id.value, auto: true, allowWrites: false }, { user, supabase: await createClient() });
}
