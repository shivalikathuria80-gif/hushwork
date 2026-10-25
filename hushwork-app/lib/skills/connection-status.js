import "server-only";
import { connectorStatus } from "@/lib/connector-status";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { listConnected } from "@/lib/connectors/composio";
import { APP_LIST } from "@/lib/connectors/app-list";
import { COMPOSIO_APPS } from "@/lib/connectors/composio-apps";

// Which apps this person has connected, for the Skills page and the Builder: { [connectionId]: true | false | null | "unavailable" }.
//   true = connected, false = not connected, null = could not be checked (for example Composio is not set up on this server),
//   "unavailable" = an app that cannot be connected at all yet.
// Yes/no answers only: never a key or a token. It reads the session's data, so call it from inside <Suspense>.
export async function connectionStates(supabase, userId) {
  const own = await connectorStatus(supabase, userId);
  const key = getComposioKey();
  const listed = key ? await listConnected({ key, userId }) : null;
  const toolkits = listed && !listed.error ? new Set(listed.accounts.map((account) => account.toolkit)) : null;
  const states = {};
  for (const app of APP_LIST) states[app.id] = Boolean(own[app.id]?.usable);
  for (const app of COMPOSIO_APPS) states[app.id] = app.unavailable ? "unavailable" : toolkits ? toolkits.has(app.toolkit) : null;
  return states;
}
