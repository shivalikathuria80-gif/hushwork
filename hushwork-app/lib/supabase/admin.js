import "server-only";
import { createServerClient } from "@supabase/ssr";
import { getServiceRoleKey } from "@/lib/schedule-env";

// The all-access database client used by scheduled runs ONLY (lib/schedule-tick.js), when nobody is signed in. It ignores the database's
// privacy rules, so every query made with it must name the person it is for (.eq("user_id", ...)): lib/run-core.js and lib/schedule-runner.js
// do. It is marked (__hushworkAdmin) so the run code knows to write the owner of each row itself. Make a new one for every call; never keep it.
// Returns null when the key or the project address is missing.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getServiceRoleKey();
  if (!url || !key) return null;
  const client = createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  client.__hushworkAdmin = true;
  return client;
}

// The same client for ONE person who reached Hushwork with their own API token (app/api/mcp, lib/plugin/). Besides __hushworkAdmin it
// carries __hushworkUserId, so lib/db-limits.js counts the AI and action limits for that person (the clock's client skips them).
export function createTokenClient(userId) {
  const client = createAdminClient();
  if (client) client.__hushworkUserId = String(userId);
  return client;
}
