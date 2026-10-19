import { io } from "next/cache";
import { getLinearKey } from "./connectors/linear-env.js";
import { getConnectionsKey, getGoogleApp, getLinearApp } from "./connectors/oauth-env.js";
import { parseKey } from "./connections/crypto.js";

// "42P01" / "PGRST205" = the connections table does not exist yet (supabase/connections.sql has not been run).
const NO_TABLE = new Set(["42P01", "PGRST205"]);

// What the pages may know about each app: yes or no answers only, never a key or token (same idea as ai-status.js).
//   connected      this person pressed Connect and the permission is saved
//   hasApp         the app's own id and secret are in .env.local (Linear: LINEAR_CLIENT_*, Google: GOOGLE_CLIENT_*)
//   personalKey    (Linear only) the owner's own key is in .env.local (works on this computer only)
//   usable         connected, or a personal key exists
// Shared: hasKey = the scrambling key is set; tableMissing = supabase/connections.sql has not been run yet.
// It must run on every visit, so it waits for a real request first; call it from a component inside <Suspense>.
export async function connectorStatus(supabase, userId) {
  await io();
  const hasKey = Boolean(parseKey(getConnectionsKey()));
  const connected = { linear: false, google: false };
  let tableMissing = false;
  try {
    const { data, error } = await supabase.from("connections").select("provider").eq("user_id", userId).limit(5);
    if (error) tableMissing = NO_TABLE.has(error.code);
    else for (const row of data) if (Object.hasOwn(connected, row.provider)) connected[row.provider] = true;
  } catch {
    // for example the network is down: shown as not connected
  }
  const personalKey = process.env.NODE_ENV !== "production" && Boolean(getLinearKey()); // the owner's own key works on a local computer only
  return {
    linear: { connected: connected.linear, personalKey, hasApp: Boolean(getLinearApp()), hasKey, tableMissing, usable: connected.linear || personalKey },
    google: { connected: connected.google, hasApp: Boolean(getGoogleApp()), hasKey, tableMissing, usable: connected.google },
  };
}
