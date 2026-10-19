import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getConnectionsKey, getGoogleApp, getLinearApp } from "@/lib/connectors/oauth-env";
import { parseKey } from "@/lib/connections/crypto";
import { saveConnection } from "@/lib/connections/store";
import * as linear from "@/lib/connectors/linear-oauth";
import * as google from "@/lib/connectors/google-oauth";

// The two halves of "Connect <app>", shared by Linear and Google. Each app's route file is a few lines that call these.
//
// startConnect (the person pressed the button): make a random "state" (a note to ourselves that proves the person who comes
// back is the same one who left), keep it in a short-lived cookie that only the server can read, and send the person to the
// app's Allow screen. Nothing is saved yet.
//
// finishConnect (the app sent the person back with a one-time code): check the state matches the cookie, swap the code for
// tokens (this needs our app's secret, so it happens here on the server), scramble them and save them for THIS signed-in
// person. Then go back to the Connections page with a short message in the address (?linear=connected, or ?google=denied,
// failed, save, setup, expired). No token ever appears in an address or a page.
const APPS = {
  linear: { getApp: getLinearApp, authorizeUrl: linear.authorizeUrl, exchangeCode: linear.exchangeCode },
  google: { getApp: getGoogleApp, authorizeUrl: google.authorizeUrl, exchangeCode: google.exchangeCode },
};

const cookieName = (provider) => `hw_${provider}_state`;
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const back = (provider, result) => redirect(`/app/connections?${provider}=${result}`);
const redirectUri = (request, provider) => `${new URL(request.url).origin}/api/connect/${provider}/callback`;

export async function startConnect(provider, request) {
  await requireUser(); // signed out -> sent to /login
  const app = APPS[provider].getApp();
  if (!app || !parseKey(getConnectionsKey())) back(provider, "setup");

  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(cookieName(provider), state, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: `/api/connect/${provider}`, maxAge: 600,
  });
  redirect(APPS[provider].authorizeUrl({ clientId: app.clientId, redirectUri: redirectUri(request, provider), state }));
}

export async function finishConnect(provider, request) {
  await requireUser(); // signed out -> sent to /login
  const url = new URL(request.url);
  const jar = await cookies();
  const expected = jar.get(cookieName(provider))?.value ?? "";
  jar.delete(cookieName(provider)); // a state is good for one try only

  if (url.searchParams.get("error")) back(provider, "denied"); // the person pressed Cancel on the app's screen
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!expected || !same(state, expected) || !code || code.length > 600) back(provider, "expired");

  const app = APPS[provider].getApp();
  const key = getConnectionsKey();
  if (!app || !parseKey(key)) back(provider, "setup");

  const tokens = await APPS[provider].exchangeCode({ clientId: app.clientId, clientSecret: app.clientSecret, redirectUri: redirectUri(request, provider), code });
  if (!tokens.ok) back(provider, "failed");

  // The row belongs to the signed-in person: the database fills in user_id from their session.
  const saved = await saveConnection({ supabase: await createClient(), provider, key, tokens });
  if (!saved.ok) {
    console.error(`saving the ${provider} connection failed:`, saved.code); // the code only, never a token
    back(provider, "save");
  }
  back(provider, "connected");
}

