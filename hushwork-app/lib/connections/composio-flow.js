import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { findComposioApp } from "@/lib/connectors/composio-apps";
import { ensureAuthConfig, startLink } from "@/lib/connectors/composio";
import { makeLimiter } from "@/lib/ai/limits";

// "Connect <app>" for the apps reached through Composio (lib/connectors/composio-apps.js). The person pressed the button: make
// sure Composio has a sign-in for the app that is limited to the one read-only tool, ask Composio for a one-time sign-in page,
// and send the person there. Composio holds the permission; nothing secret passes through Hushwork or an address. The person
// comes back to the Connections page with ?composio=done (or setup, failed, slow). An id that is not in the list is a 404.
const limits = () => (globalThis.__hushworkComposioConnectLimit ??= makeLimiter({ max: 5, windowMs: 60_000 }));
const back = (result) => redirect(`/app/connections?composio=${result}`);

export async function startComposioConnect(appId, request) {
  const app = findComposioApp(appId);
  if (!app) notFound();
  const user = await requireUser();
  if (app.unavailable) back("unavailable"); // Composio has no ready-made sign-in for it (see composio-apps.js) // signed out -> sent to /login
  const key = getComposioKey();
  if (!key) back("setup");

  const now = Date.now();
  if (limits().left(user.id, now) < 1) back("slow");
  limits().take(user.id, now);

  const config = await ensureAuthConfig({ key, app });
  if (config.error) {
    console.error(`composio sign-in for ${app.id} could not be prepared`); // no detail: it could hold a key
    back("failed");
  }
  const link = await startLink({ key, authConfigId: config.id, userId: user.id, callbackUrl: `${new URL(request.url).origin}/app/connections?composio=done` });
  if (link.error) back("failed");
  redirect(link.url);
}
