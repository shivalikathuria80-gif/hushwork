// Talks to Composio (https://backend.composio.dev, API version 3.1) so a person can connect an app from lib/connectors/composio-apps.js
// with one click and Hushwork can READ one thing from it. Composio holds each person's sign-in for the app; Hushwork never sees
// it. The API key is handed in from lib/connectors/composio-env.js (a header named x-api-key), `fetchImpl` can be replaced so tests
// never call the real Composio, and failures come back as short fixed sentences, never Composio's own text, and never the key.
//
// What keeps this read-only:
//   - the tool that runs is always the ONE tool written in the app's list entry (never text from a person or from the AI),
//     and it is always called with no arguments;
//   - the sign-in Hushwork asks Composio to create for an app is limited to that same one tool (restrict_to_following_tools), so
//     Composio itself refuses every other tool for it;
//   - the person is identified to Composio by their Hushwork account id (a random id, never an email).

import { actionsForApp, buildArguments, readToolInputs } from "./composio-actions.js";

const BASE = "https://backend.composio.dev/api/v3.1";
const TIMEOUT_MS = 15_000;

export const COMPOSIO_FAILED = {
  key: "Composio refused the key. In Composio open Settings, then Project Settings, then API Keys, and copy the Project API key (it starts with ak_). Put it in .env.local as COMPOSIO_API_KEY, then restart the app.",
  wrongKey: "That is a different kind of Composio key (it starts with ck_ or uak_; those are for connecting AI apps, not for Hushwork). In Composio open Settings, then Project Settings, then API Keys, and copy the Project API key (it starts with ak_).",
  allowance: "The free allowance at Composio is used up for now. Try again later.",
  notConnected: "This app is not connected yet. Open Connections and press Connect for it.",
  noSignIn: "Composio could not make a sign-in for this app. It may not be offered without extra set-up at Composio.",
  failed: "The app did not answer. Try again in a minute.",
  cannotFill: "Composio asks for something Hushwork does not know how to fill in for this action, so nothing was sent.",
  notFound: "The app could not find what the step points to. Check the page id, repository or channel in the step. For Notion, the page must also be shared with the connection (open the page, press the three dots, then Connections).",
  forbidden: "The app says Hushwork is not allowed to do that. For Notion, share the page with the connection (three dots, then Connections); for GitHub, check that you can write to that repository. If it keeps happening, press Disconnect and then Connect for the app.",
  invalid: "The app refused what was sent as not valid. Check the step's words and its place (page id, repository, channel or date).",
  busy: "Composio is busy right now. Try again in a minute.",
  network: "Could not reach Composio. Check your connection and try again.",
};

const flat = (value, max) => (typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

// Turns what an app said when it refused an action into ONE of our own sentences (never the app's own words: they could hold anything). The order
// matters: "no connected account" must not be mistaken for "not found".
const FAILURE_REASONS = [
  [/connected.?account|not connected|no connection|connection.*(expired|revoked)/i, "notConnected"],
  [/forbidden|permission|not allowed|insufficient|restricted|access denied|not shared|403/i, "forbidden"],
  [/not.?found|could not find|does not exist|no such|404/i, "notFound"],
  [/invalid|validation|malformed|bad request|400|required|must be/i, "invalid"],
  [/unauthor|auth|connect|account/i, "notConnected"],
];
export const explainFailure = (said) => {
  const text = String(said ?? "");
  const found = FAILURE_REASONS.find(([pattern]) => pattern.test(text));
  return COMPOSIO_FAILED[found ? found[1] : "failed"];
};

// One request. Returns { body } or { error } (a fixed sentence). `notFound` is the sentence used for a 404.
async function call(key, method, path, { query, body, fetchImpl = fetch, notFound = COMPOSIO_FAILED.failed } = {}) {
  if (typeof key === "string" && (key.startsWith("uak_") || key.startsWith("ck_"))) return { error: COMPOSIO_FAILED.wrongKey }; // a consumer key (ck_) or user key (uak_) is a different kind of key with its own header: never sent as this one
  const url = new URL(`${BASE}${path}`);
  for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, String(value));
  try {
    const response = await fetchImpl(url.toString(), {
      method,
      headers: { "x-api-key": key, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) return { error: COMPOSIO_FAILED.key };
    if (response.status === 402) return { error: COMPOSIO_FAILED.allowance };
    if (response.status === 404) return { error: notFound };
    if (response.status === 429 || response.status >= 500) return { error: COMPOSIO_FAILED.busy };
    if (!response.ok) return { error: COMPOSIO_FAILED.failed };
    return { body: response.status === 204 ? {} : await response.json() };
  } catch {
    return { error: COMPOSIO_FAILED.network };
  }
}

// The tools an app's sign-in is limited to at Composio: its ONE read-only lookup, plus the tools of the actions Hushwork can do in it
// (composio-actions.js). Nothing else can be run with that sign-in, whatever anyone asks.
export const allowedTools = (app) => [app.tool, ...actionsForApp(app.id).map((action) => action.tool)];
const sameTools = (list, wanted) => Array.isArray(list) && list.length === wanted.length && wanted.every((tool) => list.includes(tool));

// The sign-in blueprint ("auth config") for an app, limited to its allowed tools. Found if it already exists, made if not.
// Returns { id } or { error }.
export async function ensureAuthConfig({ key, app, fetchImpl }) {
  const allowed = allowedTools(app);
  const found = await call(key, "GET", "/auth_configs", { query: { toolkit_slug: app.toolkit, is_composio_managed: "true", limit: 50 }, fetchImpl });
  if (found.error) return { error: found.error };
  const same = (Array.isArray(found.body?.items) ? found.body.items : []).find((item) =>
    item?.toolkit?.slug === app.toolkit && item?.is_composio_managed === true && item?.status !== "DISABLED" && typeof item?.id === "string"
    && sameTools(item.restrict_to_following_tools, allowed));
  if (same) return { id: same.id };
  const made = await call(key, "POST", "/auth_configs", {
    body: { toolkit: { slug: app.toolkit }, auth_config: { type: "use_composio_managed_auth", restrict_to_following_tools: allowed } },
    fetchImpl, notFound: COMPOSIO_FAILED.noSignIn,
  });
  if (made.error) return { error: made.error === COMPOSIO_FAILED.failed ? COMPOSIO_FAILED.noSignIn : made.error };
  const id = made.body?.auth_config?.id;
  return typeof id === "string" && id ? { id } : { error: COMPOSIO_FAILED.noSignIn };
}

// A one-time page at Composio where the person signs in to the app. Returns { url } (https only) or { error }.
export async function startLink({ key, authConfigId, userId, callbackUrl, fetchImpl }) {
  const made = await call(key, "POST", "/connected_accounts/link", { body: { auth_config_id: authConfigId, user_id: userId, callback_url: callbackUrl }, fetchImpl, notFound: COMPOSIO_FAILED.noSignIn });
  if (made.error) return { error: made.error };
  const url = made.body?.redirect_url;
  return typeof url === "string" && url.startsWith("https://") && url.length < 2000 ? { url } : { error: COMPOSIO_FAILED.noSignIn };
}

// Which apps this person has connected: { accounts: [{ id, toolkit }] } (only working ones) or { error }.
export async function listConnected({ key, userId, fetchImpl }) {
  const listed = await call(key, "GET", "/connected_accounts", { query: { user_ids: userId, statuses: "ACTIVE", limit: 100 }, fetchImpl });
  if (listed.error) return { error: listed.error };
  const items = Array.isArray(listed.body?.items) ? listed.body.items : [];
  return { accounts: items.filter((item) => typeof item?.id === "string" && typeof item?.toolkit?.slug === "string").map((item) => ({ id: item.id, toolkit: item.toolkit.slug })) };
}

// Disconnect: removes this person's connections to one app at Composio. Returns { ok: true } or { error }.
export async function disconnect({ key, userId, app, fetchImpl }) {
  const listed = await listConnected({ key, userId, fetchImpl });
  if (listed.error) return { error: listed.error };
  for (const account of listed.accounts.filter((entry) => entry.toolkit === app.toolkit)) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(account.id)) continue; // an id goes into an address, so only plain ones are used
    const removed = await call(key, "DELETE", `/connected_accounts/${account.id}`, { fetchImpl });
    if (removed.error) return { error: removed.error };
  }
  return { ok: true };
}

// Runs the app's ONE read-only tool for this person, with nothing to fill in. Returns { ok: true, text } (the answer as plain text,
// cut to 1500 characters) or { ok: false, error }.
export async function runReadTool({ key, userId, app, fetchImpl }) {
  const ran = await call(key, "POST", `/tools/execute/${app.tool}`, { body: { user_id: userId, arguments: {} }, fetchImpl, notFound: COMPOSIO_FAILED.notConnected });
  if (ran.error) return { ok: false, error: ran.error };
  if (ran.body?.successful !== true) return { ok: false, error: /connect|account|auth/i.test(String(ran.body?.error ?? "")) ? COMPOSIO_FAILED.notConnected : COMPOSIO_FAILED.failed };
  let text;
  try {
    text = JSON.stringify(ran.body.data ?? null);
  } catch {
    return { ok: false, error: COMPOSIO_FAILED.failed };
  }
  const answer = flat(text, 1500);
  return { ok: true, text: answer && answer !== "null" ? answer : "(nothing found)" };
}

// Does ONE write in an app (send a message, create an issue, add a task) for this person. `action` is an entry of composio-actions.js
// and `values` is { target, title, details } (already checked and cut by the caller). First Composio is asked what inputs the action's tool
// really takes; the request is built only from those (buildArguments), and if the tool needs something we do not fill in, or has no home
// for something we want to say, NOTHING is sent. Returns { ok: true, text } (what the app answered, as short plain text) or { ok: false, error }.
export async function runActionTool({ key, userId, action, values, fetchImpl }) {
  const described = await call(key, "GET", `/tools/${action.tool}`, { fetchImpl, notFound: COMPOSIO_FAILED.cannotFill });
  if (described.error) return { ok: false, error: described.error };
  const built = buildArguments(action, values, readToolInputs(described.body));
  if (built.error) return { ok: false, error: COMPOSIO_FAILED.cannotFill };

  const ran = await call(key, "POST", `/tools/execute/${action.tool}`, { body: { user_id: userId, arguments: built.arguments }, fetchImpl, notFound: COMPOSIO_FAILED.notConnected });
  if (ran.error) return { ok: false, error: ran.error };
  if (ran.body?.successful !== true) return { ok: false, error: explainFailure(ran.body?.error) };
  let text = "";
  try {
    text = flat(JSON.stringify(ran.body.data ?? null), 300);
  } catch {
    // the action worked; there is just nothing to show
  }
  return { ok: true, text: text && text !== "null" ? text : "" };
}

// Removes EVERY app this person connected through Composio (used when an account is deleted). Returns { ok: true } or { error }.
export async function disconnectEverything({ key, userId, fetchImpl }) {
  const listed = await listConnected({ key, userId, fetchImpl });
  if (listed.error) return { error: listed.error };
  for (const account of listed.accounts) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(account.id)) continue; // an id goes into an address, so only plain ones are used
    const removed = await call(key, "DELETE", `/connected_accounts/${account.id}`, { fetchImpl });
    if (removed.error) return { error: removed.error };
  }
  return { ok: true };
}
