"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId, cleanDraft, cleanName } from "@/lib/validate";

// Server Actions for saved drafts. A draft is only a saved "Preview plan": the task text and the steps shown on
// screen. Nothing here runs anything.
//
// Each action does the same four things:
//   1. requireUser()  - who is asking? (signed out -> sent to /login)
//   2. validate the input ourselves (the browser can send anything)
//   3. talk to the database; user_id is never sent, the database fills it in from the signed-in person
//   4. revalidatePath("/app") so the page shows the change, then return a SMALL object: { ok: true } or { error }
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
  const { error } = await supabase.from("workflows").insert(draft.value);
  if (error) {
    console.error("saveDraft failed:", error.code);
    return { error: FAILED.save };
  }
  revalidatePath("/app");
  return { ok: true };
}

export async function renameDraft(input) {
  await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: id.error };
  const name = cleanName(input?.name);
  if (name.error) return { error: name.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("workflows").update({ name: name.value }).eq("id", id.value).select("id");
  if (error) {
    console.error("renameDraft failed:", error.code);
    return { error: FAILED.rename };
  }
  // The database hides other people's rows, so "0 rows changed" means gone or not yours. Same sentence for both.
  if (data.length === 0) return { error: FAILED.gone };
  revalidatePath("/app");
  return { ok: true };
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
  revalidatePath("/app");
  return { ok: true };
}
