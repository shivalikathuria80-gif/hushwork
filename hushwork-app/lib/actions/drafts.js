"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId, cleanDraft, cleanName } from "@/lib/validate";
import { updatePlan } from "@/lib/update-plan";

// Server Actions for saved drafts. A draft is only a saved "Preview plan": the task text and the steps shown on
// screen. Nothing here runs anything.
//
// Each action does the same four things:
//   1. requireUser()  - who is asking? (signed out -> sent to /login)
//   2. validate the input ourselves (the browser can send anything)
//   3. talk to the database; user_id is never sent, the database fills it in from the signed-in person
//   4. revalidatePath("/app", "layout") so every page under /app (workspace, workflows, builder) shows the change, then return a SMALL object: { ok: true } or { error }
// Raw database errors are never returned to the browser; only the error code is logged.

const FAILED = {
  save: "Could not save your draft. Check your connection and try again.",
  rename: "Could not rename. Try again.",
  delete: "Could not delete. Try again.",
  gone: "That draft no longer exists.",
};

export async function saveDraft(input) {
  await requireUser();
  const draft = cleanDraft(input);
  if (draft.error) return { error: draft.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("workflows").insert(draft.value).select("id, name, updated_at");
  if (error) {
    console.error("saveDraft failed:", error.code);
    return { error: FAILED.save };
  }
  revalidatePath("/app", "layout");
  // The saved draft's id, name and version go back so the screen can change THIS draft later instead of saving a copy.
  const saved = data?.[0];
  return saved ? { ok: true, id: String(saved.id), name: String(saved.name), version: String(saved.updated_at) } : { ok: true };
}

// Saves new steps into a draft that already exists. Only the `plan` column is written. The caller sends the draft's
// `version` (its updated_at as the server gave it when the draft was opened); if the draft was changed since, nothing is
// written and the answer says so (see lib/update-plan.js). Answers { ok: true, version } or { error, why }.
export async function updateDraft(input) {
  const user = await requireUser();
  const supabase = await createClient();
  const result = await updatePlan(supabase, { userId: user.id, id: input?.id, version: input?.version, plan: input?.plan });
  if (result.ok) revalidatePath("/app", "layout");
  return result;
}

export async function renameDraft(input) {
  await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: id.error };
  const name = cleanName(input?.name);
  if (name.error) return { error: name.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("workflows").update({ name: name.value }).eq("id", id.value).select("id, updated_at");
  if (error) {
    console.error("renameDraft failed:", error.code);
    return { error: FAILED.rename };
  }
  // The database hides other people's rows, so "0 rows changed" means gone or not yours. Same sentence for both.
  if (data.length === 0) return { error: FAILED.gone };
  revalidatePath("/app", "layout");
  // A rename also moves the draft's version (updated_at). It goes back so the screen can keep saving this draft without
  // a false "changed somewhere else".
  return { ok: true, version: String(data[0].updated_at) };
}

export async function deleteDraft(input) {
  await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: id.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("workflows").delete().eq("id", id.value).select("id");
  if (error) {
    console.error("deleteDraft failed:", error.code);
    return { error: FAILED.delete };
  }
  if (data.length === 0) return { error: FAILED.gone };
  revalidatePath("/app", "layout");
  return { ok: true };
}
