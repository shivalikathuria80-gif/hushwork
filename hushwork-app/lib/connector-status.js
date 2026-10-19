import { io } from "next/cache";
import { getLinearKey } from "./connectors/linear-env.js";
import { getConnectionsKey, getLinearApp } from "./connectors/oauth-env.js";
import { parseKey } from "./connections/crypto.js";

// "42P01" / "PGRST205" = the connections table does not exist yet (supabase/connections.sql has not been run).
const NO_TABLE = new Set(["42P01", "PGRST205"]);

// What the pages may know about Linear: yes or no answers only, never a key or token (same idea as ai-status.js).
//   connected      this person pressed Connect Linear and the permission is saved
//   personalKey    the owner's own key is in .env.local (works on this computer only)
//   appReady       the three one-time settings are in .env.local (Linear app id, its secret, the scrambling key)
//   tableMissing   supabase/connections.sql has not been run yet
// It must run on every visit, so it waits for a real request first; call it from a component inside <Suspense>.
export async function connectorStatus(supabase, userId) {
  await io();
  const hasApp = Boolean(getLinearApp());
  const hasKey = Boolean(parseKey(getConnectionsKey()));
  const personalKey = Boolean(getLinearKey());
  let connected = false;
  let tableMissing = false;
  try {
    const { data, error } = await supabase.from("connections").select("provider").eq("user_id", userId).eq("provider", "linear").limit(1);
    if (error) tableMissing = NO_TABLE.has(error.code);
    else connected = data.length > 0;
  } catch {
    // for example the network is down: shown as not connected
  }
  return { linear: { connected, personalKey, hasApp, hasKey, tableMissing, usable: connected || personalKey } };
}
