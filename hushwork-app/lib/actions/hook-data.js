"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import { HOOK_DATA_SETUP, KEEP_DAYS, NO_DATA_SETUP, checkCap } from "@/lib/hook-data";

// The data controls of one start link (supabase/hooks-data.sql): how long arrivals are kept, the link's own daily limit, and "delete now".
// Same habits as lib/actions/hooks.js: requireUser first, validate, the person's own database client, small answers.

const GONE = "That start link no longer exists.";

export async function setHookData(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: GONE };
  const change = {};
  if (input?.keepDays !== undefined) {
    if (!KEEP_DAYS.includes(input.keepDays)) return { error: "Choose 1, 7, 30 or 90 days." };
    change.keep_days = input.keepDays;
  }
  if (input?.dailyCap !== undefined) {
    const cap = checkCap(input.dailyCap);
    if (cap.error) return { error: cap.error };
    change.daily_cap = cap.value;
  }
  if (!Object.keys(change).length) return { error: "Nothing to save." };
  if (Number.isInteger(input?.tzOffset) && input.tzOffset >= -720 && input.tzOffset <= 840) change.tz_offset = input.tzOffset; // keeps "today" on the owner's clock
  const supabase = await createClient();
  const { data, error } = await supabase.from("hooks").update(change).eq("id", id.value).eq("user_id", user.id).select("id");
  if (error) {
    console.error("saving a link's data settings failed:", error.code);
    return { error: NO_DATA_SETUP.has(error.code) ? HOOK_DATA_SETUP : "Could not save that. Try again." };
  }
  if (!data?.length) return { error: GONE };
  revalidatePath("/app/links");
  return { ok: true };
}

// Deletes one arrival (eventId) or every arrival of the link, and the full words its runs kept. Returns { ok, deleted }.
export async function forgetArrivals(input) {
  await requireUser();
  const id = checkId(input?.linkId);
  if (id.error) return { error: GONE };
  let event = null;
  if (input?.eventId !== undefined && input?.eventId !== null) {
    const checked = checkId(input.eventId);
    if (checked.error) return { error: "That arrival is already gone." };
    event = checked.value;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("forget_arrivals", { p_hook: id.value, p_event: event });
  if (error) {
    console.error("deleting arrivals failed:", error.code);
    return { error: NO_DATA_SETUP.has(error.code) ? HOOK_DATA_SETUP : "Could not delete that. Try again." };
  }
  if (data === -1) return { error: GONE };
  if (event && data === 0) return { error: "That arrival is already gone." };
  revalidatePath("/app/links");
  revalidatePath("/app/runs");
  return { ok: true, deleted: Number(data) || 0 };
}
