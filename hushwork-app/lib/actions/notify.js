"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { NOTIFY_SETUP, checkSettings, readSettings } from "@/lib/approve-links";
import { checkSubscription, PUSH_OFF } from "@/lib/web-push";
import { deliver, pushKeysFromEnv } from "@/lib/approve-notify";
import { runActionTool } from "@/lib/connectors/composio";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { makeLimiter } from "@/lib/ai/limits";

// Settings > Notifications: how Hushwork tells the person a step is waiting (supabase/notify.sql, lib/approve-links.js). Same habits as every
// action: requireUser first, validate, the person's own database client (the database's own rules keep each row theirs), small answers.
const NO_TABLE = new Set(["42P01", "PGRST205"]);
const TRY_AGAIN = "Could not save that. Check your connection and try again.";
const testLimiter = () => (globalThis.__hushworkNoticeTests ??= makeLimiter({ max: 2, windowMs: 60_000 }));

export async function saveNotifySettings(input) {
  const user = await requireUser();
  const checked = checkSettings(input);
  if (checked.error) return { error: checked.error };
  const supabase = await createClient();
  const row = { ...checked.value, updated_at: new Date().toISOString() };
  const { data: had, error: readError } = await supabase.from("notify_settings").select("user_id").eq("user_id", user.id).limit(1);
  if (readError) return { error: NO_TABLE.has(readError.code) ? NOTIFY_SETUP : TRY_AGAIN };
  const { error } = had?.length
    ? await supabase.from("notify_settings").update(row).eq("user_id", user.id)
    : await supabase.from("notify_settings").insert(row);
  if (error) {
    console.error("saving notification settings failed:", error.code);
    return { error: NO_TABLE.has(error.code) ? NOTIFY_SETUP : TRY_AGAIN };
  }
  revalidatePath("/app/settings");
  return { ok: true, settings: readSettings({ ...row, user_id: user.id }) };
}

// "Switch push on in this browser": the browser's own subscription (PushSubscription.toJSON()), checked before it is kept.
export async function savePushBrowser(subscription) {
  await requireUser();
  if (!pushKeysFromEnv().publicKey) return { error: PUSH_OFF };
  const checked = checkSubscription(subscription);
  if (checked.error) return { error: checked.error };
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").insert(checked.value);
  if (error && error.code !== "23505") {
    console.error("saving a push browser failed:", error.code);
    return { error: NO_TABLE.has(error.code) ? NOTIFY_SETUP : TRY_AGAIN };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function removePushBrowsers() {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (error) return { error: NO_TABLE.has(error.code) ? NOTIFY_SETUP : TRY_AGAIN };
  revalidatePath("/app/settings");
  return { ok: true };
}

// "Cancel my open links": every review link not used yet stops working at once (for a forwarded email, a lost phone).
export async function cancelApproveLinks() {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("approve_links").delete().eq("user_id", user.id).is("used_at", null);
  if (error) return { error: NO_TABLE.has(error.code) ? NOTIFY_SETUP : TRY_AGAIN };
  revalidatePath("/app/settings");
  return { ok: true };
}

// "Send me a test": the saved settings, a made-up step, and never a link (a test must not be able to approve anything). Twice a minute at most.
export async function sendTestNotice() {
  const user = await requireUser();
  if (!testLimiter().take(String(user.id), Date.now())) return { error: "You just sent a test. Wait a minute and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("notify_settings").select("email, slack, slack_to, push, links, digest, digest_hour, tz_offset").eq("user_id", user.id).limit(1);
  if (error) return { error: NO_TABLE.has(error.code) ? NOTIFY_SETUP : TRY_AGAIN };
  if (!data?.length) return { error: "Save your choices first." };
  const settings = readSettings(data[0]);
  const told = await deliver({
    admin: supabase, userId: user.id, settings, reason: "test", name: "", items: [{ runId: "", step: 1, title: "Example: Send an email (Gmail)", workflow: "Example" }],
    send: runActionTool, key: getComposioKey(), siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "", pushKeys: pushKeysFromEnv(), email: user.email ?? "",
  });
  return { ok: told.any, told: { email: told.email, slack: told.slack, push: told.push } };
}
