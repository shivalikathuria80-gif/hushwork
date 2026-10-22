"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import * as core from "@/lib/run-core";

// The buttons. Each one works out WHO is asking from the session (requireUser: signed out -> sent to /login) and hands that to the shared
// core (lib/run-core.js), where the real work and every safety rule live. The browser only ever sends the small input (which run, which
// step); it can never send `who`.
const asUser = async () => ({ user: await requireUser(), supabase: await createClient() });

export async function startPracticeRun(input) { return core.startPracticeRun(input, await asUser()); }
export async function approveWebCall(input) { return core.approveWebCall(input, await asUser()); }
export async function approveLinearLookup(input) { return core.approveLinearLookup(input, await asUser()); }
export async function approveAiStep(input) { return core.approveAiStep(input, await asUser()); }
export async function approveCalendarLookup(input) { return core.approveCalendarLookup(input, await asUser()); }
export async function approveGmailLookup(input) { return core.approveGmailLookup(input, await asUser()); }
export async function approveDriveLookup(input) { return core.approveDriveLookup(input, await asUser()); }
export async function approveLinearCreate(input) { return core.approveLinearCreate(input, await asUser()); }
export async function approveAppLookup(input) { return core.approveAppLookup(input, await asUser()); }
export async function approveActionStep(input) { return core.approveActionStep(input, await asUser()); }
export async function approveSheetsRow(input) { return core.approveSheetsRow(input, await asUser()); }

// The "Delete this run" button. A run is only a record, so deleting it changes nothing outside Hushwork. Only the person's
// own run can go (user_id filter plus the database rules; there is no way to delete somebody else's). Returns { ok: true } or { error }.
export async function deleteRun(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: "That run no longer exists." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("runs").delete().eq("id", id.value).eq("user_id", user.id).select("id");
  if (error) {
    console.error("deleteRun failed:", error.code);
    return { error: "Could not delete. Try again." };
  }
  if (!data?.length) return { error: "That run no longer exists." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
