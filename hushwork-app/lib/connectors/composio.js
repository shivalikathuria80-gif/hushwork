// Talks to Composio (https://backend.composio.dev, API version 3.1) so a person can connect an app from lib/connectors/composio-apps.js
// with one click and Hushwork can READ one thing from it. Composio holds each person's sign-in for the app; Hushwork never sees
// it. The API key is handed in from lib/connectors/composio-env.js (a header named x-api-key), `fetchImpl` can be replaced so tests
// never call the real Composio, and failures come back as short fixed sentences of ours (and never the key). When an app REFUSES something, a
// short cleaned-up excerpt of what it said comes back too, as `said`, so the person (and we) can see the real reason instead of guessing.
//
// What keeps this read-only:
//   - the tool that runs is always the ONE tool written in the app's list entry (never text from a person or from the AI),
//     and it is always called with no arguments;
//   - the sign-in Hushwork asks Composio to create for an app is limited to that same one tool (restrict_to_following_tools), so
//     Composio itself refuses every other tool for it;
//   - the person is identified to Composio by their Hushwork account id (a random id, never an email).

import { actionsForApp, buildArguments, readToolInputs } from "./composio-actions.js";
import { COMPOSIO_APPS } from "./composio-apps.js";
import { looksSensitive } from "../ai/plan.js";
import { niceTime } from "./time-format.js";

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

// What an app said when it refused, made safe to show: one plain line, at most 160 characters, and dropped completely if it looks like it holds a
// key or card number. Always shown as plain text.
export const cleanSaid = (value, secret = "") => {
  let text = "";
  if (typeof value === "string") text = value;
  else if (value && typeof value === "object") text = String(value.message ?? value.error ?? value.detail ?? "");
  const line = text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  if (secret && text.includes(secret)) return ""; // an app that echoes our key back is never quoted
  return line && !looksSensitive(line) ? line : "";
};

const flat = (value, max) => (typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

// Turns what an app said when it refused an action into ONE of our own sentences (never the app's own words: they could hold anything). The order
// matters: "no connected account" must not be mistaken for "not found".
const FAILURE_REASONS = [
  [/connected.?account|not connected|no connection|connection.*(expired|revoked)/i, "notConnected"],
  [/forbidden|permission|not allowed|insufficient|restricted|access denied|not shared|\b403\b/i, "forbidden"],
  [/not.?found|could not find|does not exist|no such|\b404\b/i, "notFound"],
  [/invalid|validation|malformed|bad request|\b400\b|required|must be/i, "invalid"],
  [/unauthor|auth|connect|account/i, "notConnected"],
];
export const explainFailure = (said) => {
  const text = String(said ?? "");
  const found = FAILURE_REASONS.find(([pattern]) => pattern.test(text));
  return COMPOSIO_FAILED[found ? found[1] : "failed"];
};

// What a refused request said, cleaned (see cleanSaid). Never throws.
async function saidBy(response, secret) {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return cleanSaid(json?.error ?? json?.message ?? json, secret);
    } catch {
      return cleanSaid(text, secret);
    }
  } catch {
    return "";
  }
}

// One request. Returns { body } or { error, status, said } (a fixed sentence). `notFound` is the sentence used for a 404.
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
    if (response.status === 401 || response.status === 403) return { error: COMPOSIO_FAILED.key, status: response.status };
    if (response.status === 402) return { error: COMPOSIO_FAILED.allowance, status: response.status };
    if (response.status === 404) return { error: notFound, status: response.status, said: await saidBy(response, key) };
    if (response.status === 429 || response.status >= 500) return { error: COMPOSIO_FAILED.busy, status: response.status };
    if (!response.ok) {
      const said = await saidBy(response, key);
      return { error: said ? explainFailure(said) : COMPOSIO_FAILED.failed, status: response.status, said };
    }
    return { body: response.status === 204 ? {} : await response.json() };
  } catch {
    return { error: COMPOSIO_FAILED.network };
  }
}

// The tools an app's sign-in is limited to at Composio: its ONE read-only lookup, plus the tools of the actions Hushwork can do in it
// (composio-actions.js). Nothing else can be run with that sign-in, whatever anyone asks.
// (An app's second lookups, `lookupOf`, share its sign-in, so the sign-in allows all of the toolkit's lookups.)
export const allowedTools = (app) => [...new Set(COMPOSIO_APPS.filter((one) => one.toolkit === app.toolkit).flatMap((one) => [one.tool, ...actionsForApp(one.id).map((action) => action.tool)]))];
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
  if (ran.error) return { ok: false, error: ran.error, status: ran.status, said: ran.said };
  if (ran.body?.successful !== true) {
    const said = cleanSaid(ran.body?.error, key);
    return { ok: false, error: explainFailure(said || ran.body?.error), said };
  }
  let text;
  try {
    text = JSON.stringify(ran.body.data ?? null);
  } catch {
    return { ok: false, error: COMPOSIO_FAILED.failed };
  }
  const answer = flat(text, 1500);
  return { ok: true, text: answer && answer !== "null" ? answer : "(nothing found)" };
}

// ---- Slack: the latest messages of ONE channel -------------------------------------------------------------------------------------------------------------------
// Composio answers differently shaped JSON for different tools, so what we need is FOUND by looking through the answer for the right kind of object (a channel
// has a plain id and a name; a message has text and a time or a user) instead of trusting one exact shape.
const walkAnswer = (value, visit, depth = 0) => {
  if (depth > 7 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const one of value.slice(0, 1000)) walkAnswer(one, visit, depth + 1); return; }
  visit(value);
  for (const one of Object.values(value)) walkAnswer(one, visit, depth + 1);
};
export function findChannelId(data, name) {
  let found = "";
  walkAnswer(data, (item) => { if (!found && typeof item.id === "string" && /^[A-Z0-9]{6,20}$/.test(item.id) && typeof item.name === "string" && item.name.toLowerCase() === String(name).toLowerCase()) found = item.id; });
  return found;
}
export function messageLines(data) {
  const lines = [];
  walkAnswer(data, (item) => {
    if (lines.length >= 15 || typeof item.text !== "string" || !item.text.trim() || !("ts" in item || "user" in item || "username" in item)) return;
    const when = Number.parseFloat(item.ts) > 0 ? niceTime(Number.parseFloat(item.ts) * 1000) : "";
    const who = typeof item.username === "string" ? item.username : typeof item.user === "string" ? item.user : "someone";
    lines.push(`${when ? `${when}  ` : ""}${flat(who, 40)}: ${flat(item.text, 200)}`);
  });
  return lines;
}

// Reads the latest messages of one Slack channel (read only). `channel` is a name ("general") or an id ("C0123ABCD"): a name is first looked up in the
// person's own channel list (the Slack app's one lookup). Returns { ok: true, text } or { ok: false, error, said }.
export async function runChannelMessages({ key, userId, app, channel, fetchImpl }) {
  const execute = async (tool, args) => {
    const ran = await call(key, "POST", `/tools/execute/${tool}`, { body: { user_id: userId, arguments: args }, fetchImpl, notFound: COMPOSIO_FAILED.notConnected });
    if (ran.error) return { ok: false, error: ran.error, said: ran.said };
    if (ran.body?.successful !== true) {
      const said = cleanSaid(ran.body?.error, key);
      return { ok: false, error: explainFailure(said || ran.body?.error), said };
    }
    return { ok: true, data: ran.body.data ?? null };
  };
  let id = /^[A-Z0-9]{6,20}$/.test(channel) && /\d/.test(channel) ? channel : "";
  if (!id) {
    const slack = COMPOSIO_APPS.find((one) => one.id === app.lookupOf);
    const listed = await execute(slack.tool, {});
    if (!listed.ok) return listed;
    id = findChannelId(listed.data, channel);
    if (!id) return { ok: false, error: `Hushwork could not find a Slack channel called ${channel}. Check the name (letters, numbers, dots and dashes), or write the channel's id (it starts with C) instead.` };
  }
  const history = await execute(app.tool, { channel: id, limit: 10 });
  if (!history.ok) return history;
  const lines = messageLines(history.data);
  return { ok: true, text: lines.length ? lines.join("\n").slice(0, 1500) : "(no messages found)" };
}

// Does ONE write in an app (send a message, create an issue, add a task) for this person. `action` is an entry of composio-actions.js
// and `values` is { target, title, details } (already checked and cut by the caller). First Composio is asked what inputs the action's tool
// really takes; the request is built only from those (buildArguments), and if the tool needs something we do not fill in, or has no home
// for something we want to say, NOTHING is sent. Returns { ok: true, text } (what the app answered, as short plain text) or { ok: false, error }.
export async function runActionTool({ key, userId, action, values, fetchImpl }) {
  const described = await call(key, "GET", `/tools/${action.tool}`, { fetchImpl, notFound: COMPOSIO_FAILED.cannotFill });
  if (described.error) return { ok: false, error: described.error, status: described.status, said: described.said };
  const built = buildArguments(action, values, readToolInputs(described.body));
  if (built.error) return { ok: false, error: COMPOSIO_FAILED.cannotFill };

  const ran = await call(key, "POST", `/tools/execute/${action.tool}`, { body: { user_id: userId, arguments: built.arguments }, fetchImpl, notFound: COMPOSIO_FAILED.notConnected });
  if (ran.error) return { ok: false, error: ran.error, status: ran.status, said: ran.said };
  if (ran.body?.successful !== true) {
    const said = cleanSaid(ran.body?.error, key);
    return { ok: false, error: explainFailure(said || ran.body?.error), said };
  }
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

// Would this action's tool accept what Hushwork sends? Asks Composio for the tool's inputs and builds a request from a SAMPLE (nothing is sent).
// Returns { ok: true } or { ok: false, error, said }.
export async function checkActionFits({ key, action, sample, fetchImpl }) {
  const described = await call(key, "GET", `/tools/${action.tool}`, { fetchImpl, notFound: COMPOSIO_FAILED.cannotFill });
  if (described.error) return { ok: false, error: described.error, said: described.said };
  const built = buildArguments(action, sample, readToolInputs(described.body));
  return built.error ? { ok: false, error: COMPOSIO_FAILED.cannotFill, said: built.error } : { ok: true };
}

// The made-up values used to check that an action's tool has the inputs Hushwork fills in (never sent anywhere).
const SAMPLE_TARGETS = { slack_message: "general", github_issue: "acme/site", gmail_send: "a@b.co", calendar_event: "2026-11-05 15:00", notion_page: "0123456789abcdef0123456789abcdef", todoist_task: "" };

// "Test all my connections", the Composio part. For every app this person connected: run its one read-only lookup for real, and check that each
// action in it can be filled in. Apps that are not connected (or cannot be) are only listed by name. Returns { rows, off } or { error }.
//   rows: [{ name, ok, note, actions: [{ name, ok, note }] }]     off: ["Slack", ...]
export async function checkComposioConnections({ key, userId, fetchImpl }) {
  const listed = await listConnected({ key, userId, fetchImpl });
  if (listed.error) return { error: listed.error };
  const connected = new Set(listed.accounts.map((account) => account.toolkit));
  const usable = COMPOSIO_APPS.filter((app) => !app.unavailable && !app.input && connected.has(app.toolkit)); // a lookup that needs a typed channel cannot be tried with nothing to fill in
  const said = (result) => `${result.error}${result.said ? ` The app said: "${result.said}".` : ""}`;
  const rows = await Promise.all(usable.map(async (app) => {
    const read = await runReadTool({ key, userId, app, fetchImpl });
    const actions = await Promise.all(actionsForApp(app.id).map(async (action) => {
      const fit = await checkActionFits({ key, action, sample: { target: SAMPLE_TARGETS[action.id] ?? "", title: "Test", details: "Test" }, fetchImpl });
      return { name: action.name, ok: fit.ok, note: fit.ok ? "Ready: its inputs match what Hushwork sends." : said(fit) };
    }));
    return { name: app.name, ok: read.ok, note: read.ok ? `Works. It answered with ${app.what}.` : said(read), actions };
  }));
  const off = COMPOSIO_APPS.filter((app) => !app.lookupOf && (app.unavailable || !connected.has(app.toolkit))).map((app) => app.name);
  return { rows, off };
}

