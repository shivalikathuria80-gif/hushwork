"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import { HOOK_LIMITS, HOOK_SETUP, NO_TABLE, SIGNING_STYLES, looksLikeSecret, looksLikeStyle, makeCode, makeSecret } from "@/lib/hooks";
import { REPLAY_ERRORS, hookLimiter, replayArrival } from "@/lib/hook-receive";
import { startPracticeRun } from "@/lib/run-core";
import { takeDbSlot } from "@/lib/db-limits";
import { makeLimiter } from "@/lib/ai/limits";

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

// "Replay" on an arrival: the workflow runs again with the fields that arrived then (lib/hook-receive.js). Writing stays off, so anything that
// sends still waits for Approve on the Runs page. Returns { ok: true, runId, waiting } or { error }.
export async function replayHookEvent(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: REPLAY_ERRORS.gone };
  const client = await createClient();
  const result = await replayArrival(
    { client, run: startPracticeRun, limiter: hookLimiter(makeLimiter), takeSlot: (supabase) => takeDbSlot(supabase, "hook", HOOK_LIMITS.perMinute, HOOK_LIMITS.perDay) },
    { user },
    id.value,
  );
  if (result.ok) revalidatePath("/app", "layout");
  return result;
}

// The sender check (lib/hook-sign.js). `style`: "none" or one of SIGNING_STYLES. `secret`: what the owner pasted, or `make: true` for one
// Hushwork makes (not for Stripe: Stripe makes its own). Answers { ok, secret } so the page can show the secret it now holds.
export async function setHookSigning(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: GONE };
  const style = input?.style;
  if (style !== "none" && !looksLikeStyle(style)) return { error: "Choose which app sends to this link." };
  let secret = null;
  if (style !== "none") {
    if (input?.make === true) {
      if (SIGNING_STYLES[style].secret === "paste") return { error: `${SIGNING_STYLES[style].name} makes its own secret. Copy it from there and paste it here.` };
      secret = makeSecret();
    } else {
      secret = typeof input?.secret === "string" ? input.secret.trim() : "";
      if (!looksLikeSecret(secret)) return { error: "Paste the secret exactly as the app shows it: 8 to 200 characters." };
    }
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("hooks").update({ signing_style: style, signing_secret: secret }).eq("id", id.value).eq("user_id", user.id).select("id");
  if (error) {
    console.error("saving a sender check failed:", error.code);
    if (error.code === "42703" || error.code === "PGRST204") return { error: "The sender check needs one setup step: open supabase/hooks-signing.sql and run it in Supabase." };
    return { error: "Could not save that. Try again." };
  }
  if (!data?.length) return { error: GONE };
  revalidatePath("/app/links");
  return { ok: true, secret };
}
