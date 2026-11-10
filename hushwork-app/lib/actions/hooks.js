"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import { HOOK_LIMITS, HOOK_SETUP, NO_TABLE, makeCode } from "@/lib/hooks";

// The Start links page: make, switch, renew and remove the private address of a workflow (lib/hooks.js, supabase/hooks.sql). Same habits as
// every action: requireUser first, validate, the person's own database client (user_id is filled in by the database, and the database itself
// refuses a link for somebody else's workflow), small answers. What ARRIVES at a link never passes through here: see app/api/hooks/[code].

const GONE = "That start link no longer exists.";
const offsetOf = (value) => (Number.isInteger(value) && value >= -840 && value <= 720 ? value : 0);

export async function createHook(input) {
  const user = await requireUser();
  const workflow = checkId(input?.workflowId);
  if (workflow.error) return { error: "Choose a workflow first." };
  const supabase = await createClient();
  const { data: own, error: ownError } = await supabase.from("workflows").select("id, plan").eq("id", workflow.value).eq("user_id", user.id).limit(1);
  if (ownError) {
    console.error("loading a workflow for a link failed:", ownError.code);
    return { error: "Could not make the link. Check your connection and try again." };
  }
  if (!own?.[0]) return { error: "That workflow no longer exists." };
  if (own[0].plan?.[0]?.kind !== "trigger") return { error: "This workflow has no Start step, so a link cannot start it. Open it in the Builder and add a Start step first." };
  const { count, error: countError } = await supabase.from("hooks").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (countError) {
    console.error("counting links failed:", countError.code);
    return { error: NO_TABLE.has(countError.code) ? HOOK_SETUP : "Could not make the link. Try again." };
  }
  if ((count ?? 0) >= HOOK_LIMITS.maxLinks) return { error: `You can keep up to ${HOOK_LIMITS.maxLinks} start links. Remove one you no longer use first.` };
  const made = makeCode();
  const { error } = await supabase.from("hooks").insert({ workflow_id: workflow.value, code: made.code, code_hash: made.hash, tz_offset: offsetOf(input?.tzOffset) });
  if (error) {
    console.error("saving a link failed:", error.code);
    if (error.code === "23505") return { error: "This workflow already has a start link." };
    return { error: NO_TABLE.has(error.code) ? HOOK_SETUP : "Could not make the link. Try again." };
  }
  revalidatePath("/app/links");
  return { ok: true };
}

export async function setHookEnabled(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error || typeof input?.enabled !== "boolean") return { error: GONE };
  const supabase = await createClient();
  const { data, error } = await supabase.from("hooks").update({ enabled: input.enabled, tz_offset: offsetOf(input?.tzOffset) }).eq("id", id.value).eq("user_id", user.id).select("id");
  if (error) {
    console.error("switching a link failed:", error.code);
    return { error: "Could not save that. Try again." };
  }
  if (!data?.length) return { error: GONE };
  revalidatePath("/app/links");
  return { ok: true };
}

// "Make a new address": the old one stops working at once (for when it leaked, or a form tool should no longer reach the workflow).
export async function renewHook(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: GONE };
  const supabase = await createClient();
  const made = makeCode();
  const { data, error } = await supabase.from("hooks").update({ code: made.code, code_hash: made.hash }).eq("id", id.value).eq("user_id", user.id).select("id");
  if (error) {
    console.error("renewing a link failed:", error.code);
    return { error: "Could not make a new address. Try again." };
  }
  if (!data?.length) return { error: GONE };
  revalidatePath("/app/links");
  return { ok: true };
}

export async function deleteHook(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: GONE };
  const supabase = await createClient();
  const { data, error } = await supabase.from("hooks").delete().eq("id", id.value).eq("user_id", user.id).select("id");
  if (error) {
    console.error("removing a link failed:", error.code);
    return { error: "Could not remove it. Try again." };
  }
  if (!data?.length) return { error: GONE };
  revalidatePath("/app/links");
  return { ok: true };
}
