import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getConnectionsKey, getLinearApp } from "@/lib/connectors/oauth-env";
import { parseKey } from "@/lib/connections/crypto";
import { authorizeUrl } from "@/lib/connectors/linear-oauth";

// Step 1 of "Connect Linear": the person pressed the button. We make a random "state" (a note to ourselves that proves the
// person who comes back is the same one who left), keep it in a short-lived cookie that only the server can read, and send
// the person to Linear's Allow screen. Nothing is saved yet.
const STATE_COOKIE = "hw_linear_state"; // the callback route uses the same name (a route file may only export route functions)

export async function GET(request) {
  await requireUser(); // signed out -> sent to /login
  const app = getLinearApp();
  if (!app || !parseKey(getConnectionsKey())) redirect("/app/connections?linear=setup");

  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/connect/linear", maxAge: 600,
  });
  const redirectUri = `${new URL(request.url).origin}/api/connect/linear/callback`;
  redirect(authorizeUrl({ clientId: app.clientId, redirectUri, state }));
}
