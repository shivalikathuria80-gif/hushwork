"use server";

import { requireUser } from "@/lib/auth";
import { checkPrompt } from "@/lib/validate";
import { getGroqKey } from "@/lib/ai/key";
import { makePreview } from "@/lib/ai/preview";
import { AI_LIMITS } from "@/lib/ai/plan";
import { takeDbSlot } from "@/lib/db-limits";
import { loadMemory } from "@/lib/ai/memory";
import { createClient } from "@/lib/supabase/server";

// The Server Action behind "Preview plan" when AI planning is on. A Server Action is a function the page can call
// directly while the code runs on the server. It does four things, in this order:
//   1. requireUser()  - who is asking? (signed out -> sent to /login)
//   2. checkPrompt()  - is the text 1 to 2000 characters? (the browser can send anything)
//   3. getGroqKey()   - is there a key? (no key -> AI is off)
//   4. makePreview()  - secret guard, limits, the Groq call, cleaning the answer (lib/ai/preview.js)
// It returns a SMALL object: { source: "ai", steps, remaining }, { source: "keyword", why, notice, ... } or
// { error }. Never the key, the prompt, ids or the AI company's error text. Nothing here runs a workflow.
export async function previewPlan(input) {
  const user = await requireUser();
  const prompt = checkPrompt(input?.prompt);
  if (prompt.error) return { error: prompt.code }; // "empty" or "too_long": the screen has its own wording
  const supabase = await createClient();
  return makePreview({ prompt: prompt.value, userId: user.id, groqKey: getGroqKey(), memory: await loadMemory(supabase, user.id), dbTake: () => takeDbSlot(supabase, "ai_plan", AI_LIMITS.perUserMinute, AI_LIMITS.perUserDay) });
}
