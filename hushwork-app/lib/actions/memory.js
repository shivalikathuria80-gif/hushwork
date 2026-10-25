"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import { checkMemory } from "@/lib/ai/memory";

// Server Actions for shared workflow memory (Settings > Memory). A fact is a short sentence the AI may use as background when it plans or answers.
// Same steps as every action here: requireUser(), check the input ourselves, talk to the database (user_id is filled in by the database from the
// signed-in person, and the table's privacy rules apply), then return a SMALL object: { ok: true } or { error }.
const FAILED = {
  setup: "Memory needs one setup step: paste supabase/memory.sql into the Supabase SQL Editor and press Run.",
  save: "Could not save the fact. Check your connection and try again.",
  duplicate: "You already have a fact with that name. Delete it first, or give this one another name.",
  full: "You can keep up to 50 facts. Delete one first.",
  delete: "Could not delete. Try again.",
};
const missingTable = (error) => error?.code === "42P01" || error?.code === "PGRST205";

export async function addMemory(input) {
  await requireUser();
  const checked = checkMemory(input);
  if (checked.error) return { error: checked.error };
  const supabase = await createClient();
  const { error } = await supabase.from("workflow_memories").insert(checked.value); // only scope, key and value: source and verification keep their safe defaults
  if (error) {
    console.error("addMemory failed:", error.code);
    return { error: missingTable(error) ? FAILED.setup : error.code === "23505" ? FAILED.duplicate : error.code === "42501" ? FAILED.full : FAILED.save };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function deleteMemory(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: FAILED.delete };
  const supabase = await createClient();
  const { error } = await supabase.from("workflow_memories").delete().eq("id", id.value).eq("user_id", user.id);
  if (error) {
    console.error("deleteMemory failed:", error.code);
    return { error: FAILED.delete };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
