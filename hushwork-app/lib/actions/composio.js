"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { findComposioApp } from "@/lib/connectors/composio-apps";
import { disconnect } from "@/lib/connectors/composio";

// The Disconnect button for an app reached through Composio. It removes this person's connection to that one app at Composio.
// `appId` must be an id from the list. Returns { ok: true } or { error }.
export async function disconnectComposioApp(appId) {
  const user = await requireUser();
  const app = findComposioApp(appId);
  const key = getComposioKey();
  if (!app || !key) return { error: "Could not disconnect. Try again." };
  const result = await disconnect({ key, userId: user.id, app });
  if (result.error) return { error: result.error };
  revalidatePath("/app/connections");
  return { ok: true };
}
