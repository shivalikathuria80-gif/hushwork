"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { enableBundle, disableBundle } from "@/lib/skills/enable";

// The buttons on the Skills page. Same steps as every action here: requireUser(), then the shared code in lib/skills/enable.js with the person's OWN
// database client (so the privacy rules apply). Raw database errors are never returned; only the error code is logged. Returns { ok: true, ... } or { error }.
export async function enableSkillBundle(input) {
  const user = await requireUser();
  const result = await enableBundle(await createClient(), user.id, input?.bundleId);
  if (result.ok) revalidatePath("/app", "layout"); // the new drafts show on the Workflows page too
  return result;
}

export async function disableSkillBundle(input) {
  const user = await requireUser();
  const result = await disableBundle(await createClient(), user.id, input?.bundleId);
  if (result.ok) revalidatePath("/app/skills");
  return result;
}
