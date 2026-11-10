"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import { isPaused } from "@/lib/app-controls";
import { makeLimiter } from "@/lib/ai/limits";
import { WATCH_SETUP } from "@/lib/app-events";
import { runDueWatches } from "@/lib/app-event-runner";
import { watchDeps } from "@/lib/schedule-tick";

// The "From your apps" part of the Start links page: switch a watch on or off, and "Check now". A watch is MADE by saving a workflow whose Start
// says "When an email arrives" or "When a calendar event is added" (lib/app-event-sync.js), never here. Same habits as every action: requireUser
// first, validate, the person's own database client for their own rows, small answers.
const GONE = "That watch no longer exists. Save its workflow in the Builder again.";
const NO_TABLE = new Set(["42P01", "PGRST205"]);
const offsetOf = (value) => (Number.isInteger(value) && value >= -840 && value <= 840 ? value : 0);
const checkLimits = () => (globalThis.__hushworkWatchCheckNow ??= makeLimiter({ max: 4, windowMs: 60_000 }));

export async function setWatchEnabled(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error || typeof input?.enabled !== "boolean") return { error: GONE };
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_watches").update({ enabled: input.enabled, tz_offset: offsetOf(input?.tzOffset) }).eq("id", id.value).eq("user_id", user.id).select("id");
  if (error) {
    console.error("switching a watch failed:", error.code);
    return { error: NO_TABLE.has(error.code) ? WATCH_SETUP : "Could not save that. Try again." };
  }
  if (!data?.length) return { error: GONE };
  revalidatePath("/app/links");
  return { ok: true };
}

// Looks at ONE of the person's watches right now, due or not, through the very same path the clock uses (so a new email from a minute ago starts
// the workflow the same way). Only reads; the run it may start still waits for Approve.
const WORDS = {
  new: "Found something new and started the workflow. Its run is under Arrivals.",
  ok: "Nothing new since the last look.",
  limited: "Something new arrived, but you reached the limit for runs started by your apps. It was written down and not run.",
  failed: "It found something new, but the workflow could not start. Open it in the Builder and check its steps.",
};
export async function checkWatchNow(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: GONE };
  if (!checkLimits().take(user.id, Date.now())) return { error: "You pressed that a moment ago. Try again in a minute." };
  const admin = createAdminClient();
  if (!admin) return { error: "Starting from your apps is not switched on on this server yet (the server has no all-access database key)." };
  if (await isPaused(admin)) return { error: "Hushwork is paused right now, so nothing is checked. Try again later." };
  const summary = await runDueWatches({ ...watchDeps(admin), onlyId: id.value, userId: user.id }).catch(() => null);
  revalidatePath("/app/links");
  if (!summary) return { error: "Could not look just now. Try again in a minute." };
  if (summary.setup) return { error: WATCH_SETUP };
  if (summary.due === 0) return { error: "This watch is switched off, or no longer exists. Switch it on first." };
  if (summary.looked === 0) return { error: "It is looking right now already. Try again in a minute." };
  if (summary.status === "not_connected" || (summary.status === "failed" && summary.failed === 0)) return { error: "Hushwork could not look. The reason is on the card." };
  return { ok: true, words: WORDS[summary.status] ?? WORDS.ok };
}
