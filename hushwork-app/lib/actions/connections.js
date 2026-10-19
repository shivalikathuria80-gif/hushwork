"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getConnectionsKey } from "@/lib/connectors/oauth-env";
import { APP_NAMES, removeConnection } from "@/lib/connections/store";

// The Disconnect button. It tells the app (Linear or Google) to cancel the permission (best effort) and deletes the person's
// saved connection. Only their own row can be touched (user_id filter plus the database rules). `app` must be one of the known
// app names. Returns { ok: true } or { error }.
export async function disconnectApp(app) {
  const user = await requireUser();
  if (typeof app !== "string" || !APP_NAMES.includes(app)) return { error: "Could not disconnect. Try again." };
  const result = await removeConnection({ supabase: await createClient(), userId: user.id, provider: app, key: getConnectionsKey() ?? "" });
  if (!result.ok) return { error: "Could not disconnect. Try again." };
  revalidatePath("/app/connections");
  return { ok: true };
}
