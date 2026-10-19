"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getConnectionsKey } from "@/lib/connectors/oauth-env";
import { removeLinearConnection } from "@/lib/connections/linear-store";

// The Disconnect button. It tells Linear to cancel the permission (best effort) and deletes the person's saved connection.
// Only their own row can be touched (user_id filter plus the database rules). Returns { ok: true } or { error }.
export async function disconnectLinear() {
  const user = await requireUser();
  const result = await removeLinearConnection({ supabase: await createClient(), userId: user.id, key: getConnectionsKey() ?? "" });
  if (!result.ok) return { error: "Could not disconnect. Try again." };
  revalidatePath("/app/connections");
  return { ok: true };
}
