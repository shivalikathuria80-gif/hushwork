import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getConnectionsKey, getLinearApp } from "@/lib/connectors/oauth-env";
import { parseKey } from "@/lib/connections/crypto";
import { exchangeCode } from "@/lib/connectors/linear-oauth";
import { saveLinearConnection } from "@/lib/connections/linear-store";

// Step 2 of "Connect Linear": Linear sends the person back here with a one-time code. We check the "state" matches the one
// we kept in the cookie, swap the code for tokens (this needs our app's secret, so it happens here on the server), scramble
// them and save them for THIS signed-in person. Then the person goes back to the Connections page with a short message in the
// address (?linear=connected, denied, failed, save, setup or expired). No token ever appears in an address or a page.
const STATE_COOKIE = "hw_linear_state"; // the same name as the start route (a route file may only export route functions)

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const back = (result) => redirect(`/app/connections?linear=${result}`);

export async function GET(request) {
  await requireUser(); // signed out -> sent to /login
  const url = new URL(request.url);
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value ?? "";
  jar.delete(STATE_COOKIE); // a state is good for one try only

  if (url.searchParams.get("error")) back("denied"); // the person pressed Cancel on Linear's screen
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!expected || !same(state, expected) || !code || code.length > 500) back("expired");

  const app = getLinearApp();
  const key = getConnectionsKey();
  if (!app || !parseKey(key)) back("setup");

  const tokens = await exchangeCode({ clientId: app.clientId, clientSecret: app.clientSecret, redirectUri: `${url.origin}/api/connect/linear/callback`, code });
  if (!tokens.ok) back("failed");

  // The row belongs to the signed-in person: the database fills in user_id from their session.
  const saved = await saveLinearConnection({ supabase: await createClient(), key, tokens });
  if (!saved.ok) {
    console.error("saving the Linear connection failed:", saved.code); // the code only, never a token
    back("save");
  }
  back("connected");
}
