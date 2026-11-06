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
// (An action that needs two calls also allows its second tool; an app with no lookup, `noLookup`, allows only its actions; a lookup that also reads each
// conversation it finds, `threadTool`, allows that read too.)
export const allowedTools = (app) => [...new Set(COMPOSIO_APPS.filter((one) => one.toolkit === app.toolkit).flatMap((one) => [one.tool, one.threadTool, ...actionsForApp(one.id).flatMap((action) => [action.tool, action.then?.tool])]).filter(Boolean))];
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

// Runs one read-only tool from the apps list with the arguments given. Returns { ok: true, data } or { ok: false, error, said }.
async function executeTool({ key, userId, tool, args, fetchImpl }) {
  const ran = await call(key, "POST", `/tools/execute/${tool}`, { body: { user_id: userId, arguments: args }, fetchImpl, notFound: COMPOSIO_FAILED.notConnected });
  if (ran.error) return { ok: false, error: ran.error, said: ran.said };
  if (ran.body?.successful !== true) {
    const said = cleanSaid(ran.body?.error, key);
    return { ok: false, error: explainFailure(said || ran.body?.error), said };
  }
  return { ok: true, data: ran.body.data ?? null };
}

// Reads the latest messages of one Slack channel (read only). `channel` is a name ("general") or an id ("C0123ABCD"): a name is first looked up in the
// person's own channel list (the Slack app's one lookup). Returns { ok: true, text } or { ok: false, error, said }.
export async function runChannelMessages({ key, userId, app, channel, fetchImpl }) {
  const execute = (tool, args) => executeTool({ key, userId, tool, args, fetchImpl });
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

// ---- Gmail search: which conversations got a reply ---------------------------------------------------------------------------------------------------------------
// Runs ONE Gmail search the person wrote in the step (Gmail's own search words, checked by the app's `input.pattern`), then reads each conversation it found (up to
// MAX_THREADS) to see who wrote last. Only the sender, the "to", the subject, the time and Gmail's labels are used: never the text of an email, even when Composio's
// answer holds it. A conversation whose newest message carries Gmail's SENT label is "waiting for a reply" (you wrote last); any other is "replied".
// Composio is asked for each tool's inputs first (like an action), and if a tool needs something we do not fill in, nothing is run.
const MAX_SEARCH = 10;
const MAX_THREADS = 8;
const QUERY_INPUTS = ["query", "q", "search_query"];
const MAX_INPUTS = ["max_results", "maxResults", "limit"];
const THREAD_INPUTS = ["thread_id", "threadId", "id"];
const PLAIN_ID = /^[A-Za-z0-9_-]{6,80}$/;

// A time Composio gave (milliseconds as a number or text, seconds, or a date text) -> milliseconds, or NaN.
export function mailTime(value) {
  if (typeof value === "number" || (typeof value === "string" && /^\d{9,14}$/.test(value.trim()))) {
    const n = Number(value);
    return n > 1e11 ? n : n * 1000;
  }
  return typeof value === "string" ? Date.parse(value) : Number.NaN;
}
const firstText = (item, keys) => { for (const key of keys) if (typeof item[key] === "string" && item[key].trim()) return item[key]; return ""; };
const labelsOf = (item) => (Array.isArray(item.labelIds) ? item.labelIds : Array.isArray(item.label_ids) ? item.label_ids : Array.isArray(item.labels) ? item.labels : []).filter((one) => typeof one === "string");

// The messages in an answer, found by their shape (a thread id and a message id), newest last: [{ id, thread, from, to, subject, time, sent }].
export function mailMessages(data) {
  const found = [];
  const seen = new Set();
  walkAnswer(data, (item) => {
    const thread = firstText(item, ["threadId", "thread_id"]);
    const id = firstText(item, ["messageId", "message_id", "id"]);
    if (!PLAIN_ID.test(thread) || !PLAIN_ID.test(id) || seen.has(id)) return;
    seen.add(id);
    const headers = Array.isArray(item.payload?.headers) ? item.payload.headers : [];
    const header = (name) => headers.find((h) => typeof h?.name === "string" && h.name.toLowerCase() === name && typeof h.value === "string")?.value ?? "";
    found.push({
      id, thread,
      from: flat(firstText(item, ["sender", "from"]) || header("from"), 80),
      to: flat(firstText(item, ["to", "recipient"]) || header("to"), 80),
      subject: flat(firstText(item, ["subject"]) || (typeof item.preview?.subject === "string" ? item.preview.subject : "") || header("subject"), 100),
      time: mailTime(item.messageTimestamp ?? item.internalDate ?? item.internal_date ?? item.date ?? header("date")),
      sent: labelsOf(item).includes("SENT"),
    });
  });
  return found.map((one, index) => ({ ...one, index })).sort((a, b) => (Number.isFinite(a.time) && Number.isFinite(b.time) ? a.time - b.time : a.index - b.index));
}

// One conversation in one line: subject, who it is with, when the newest message came and whether someone answered.
export function threadLine(number, messages) {
  const newest = messages.at(-1);
  const theirs = [...messages].reverse().find((one) => !one.sent);
  const who = (theirs ? theirs.from : newest.to) || "someone";
  const when = Number.isFinite(newest.time) ? niceTime(newest.time) : "";
  const state = newest.sent ? "WAITING FOR A REPLY (you wrote last)" : "REPLIED (they wrote last)";
  return `${number}. ${messages[0].subject || messages.find((one) => one.subject)?.subject || "(no subject)"} | with ${who} | ${messages.length} message${messages.length === 1 ? "" : "s"}${when ? ` | newest ${when}` : ""} | ${state}`;
}

export async function runMailSearch({ key, userId, app, query, fetchImpl }) {
  const inputsOf = async (tool) => {
    const described = await call(key, "GET", `/tools/${tool}`, { fetchImpl, notFound: COMPOSIO_FAILED.cannotFill });
    return described.error ? { error: described } : readToolInputs(described.body);
  };
  const execute = (tool, args) => executeTool({ key, userId, tool, args, fetchImpl });
  // Only the inputs we fill (and ones the tool does not insist on) may exist: anything else required means nothing is run.
  const fits = (inputs, filled) => [...inputs.required].every((name) => filled.includes(name) || name === "user_id");

  const [search, thread] = await Promise.all([inputsOf(app.tool), inputsOf(app.threadTool)]);
  if (search.error) return { ok: false, error: search.error.error, said: search.error.said };
  if (thread.error) return { ok: false, error: thread.error.error, said: thread.error.said };
  const queryName = QUERY_INPUTS.find((name) => search.names.has(name));
  const maxName = MAX_INPUTS.find((name) => search.names.has(name));
  const threadName = THREAD_INPUTS.find((name) => thread.names.has(name));
  if (!queryName || !threadName || !fits(search, [queryName, maxName]) || !fits(thread, [threadName])) return { ok: false, error: COMPOSIO_FAILED.cannotFill };

  const args = { [queryName]: query, ...(maxName ? { [maxName]: MAX_SEARCH } : {}), ...(search.names.has("include_payload") ? { include_payload: false } : {}) };
  const found = await execute(app.tool, args);
  if (!found.ok) return found;
  const threads = [...new Set(mailMessages(found.data).reverse().map((one) => one.thread))].slice(0, MAX_THREADS); // newest conversations first
  if (!threads.length) return { ok: true, text: `Nothing in Gmail matches the search "${query}".` };

  const read = await Promise.all(threads.map((id) => execute(app.threadTool, { [threadName]: id })));
  const broken = read.find((one) => !one.ok);
  if (broken) return { ok: false, error: `${broken.error} If you connected Gmail (send) before Gmail search was added, open Connections, press Disconnect for Gmail (send) and Connect once more.`, said: broken.said };
  const lines = read.map((one, index) => {
    const messages = mailMessages(one.data).filter((m) => m.thread === threads[index]);
    return messages.length ? threadLine(index + 1, messages) : `${index + 1}. (Gmail did not return this conversation)`;
  });
  const waiting = lines.filter((line) => line.includes("WAITING FOR A REPLY")).length;
  return { ok: true, text: `Gmail search "${query}": ${threads.length} conversation${threads.length === 1 ? "" : "s"}, ${waiting} waiting for a reply.\n${lines.join("\n")}`.slice(0, 1500) };
}

// Does ONE write in an app (send a message, create an issue, add a task) for this person. `action` is an entry of composio-actions.js
// and `values` is { target, title, details } (already checked and cut by the caller). First Composio is asked what inputs the action's tool
// really takes; the request is built only from those (buildArguments), and if the tool needs something we do not fill in, or has no home
// for something we want to say, NOTHING is sent. Returns { ok: true, text, link?, note? } (what the app answered as short plain text; `link` = the address of a
// file it made, only ever a docs.google.com or drive.google.com one; `note` = set when a two-call action made the file but the second call failed) or { ok: false, error }.
// The time zone of the person's main calendar in a calendar-list answer (found by shape: the entry marked primary, else the first one they own),
// or "" when there is none. Only a plain IANA name ("Asia/Kolkata", "UTC") is kept.
const ZONE = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/;
export function calendarZone(data) {
  const found = [];
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      if (typeof value.timeZone === "string" && ZONE.test(value.timeZone)) found.push(value);
      Object.values(value).forEach(walk);
    }
  };
  walk(data);
  return (found.find((one) => one.primary === true) ?? found.find((one) => one.accessRole === "owner"))?.timeZone ?? "";
}
export const NO_ZONE = "Hushwork could not read your calendar's time zone, so it did not add the event (it would have landed at the wrong time). Try again in a minute.";

export async function runActionTool({ key, userId, action, values: given, fetchImpl }) {
  let values = given;
  if (action.zoneTool) {
    const listed = await executeTool({ key, userId, tool: action.zoneTool, args: {}, fetchImpl });
    if (!listed.ok) return { ok: false, error: listed.error, said: listed.said };
    const zone = calendarZone(listed.data);
    if (!zone) return { ok: false, error: NO_ZONE };
    values = { ...given, timezone: zone };
  }
  const described = await call(key, "GET", `/tools/${action.tool}`, { fetchImpl, notFound: COMPOSIO_FAILED.cannotFill });
  if (described.error) return { ok: false, error: described.error, status: described.status, said: described.said };
  const built = buildArguments(action, values, readToolInputs(described.body));
  if (built.error) return { ok: false, error: COMPOSIO_FAILED.cannotFill };

  // A file that needs a second call (make the sheet, then write the rows): the second tool is checked BEFORE anything is made, with a made-up id, so if it
  // does not fit nothing at all is created.
  const second = action.then?.when(values) ? action.then : null;
  let secondInputs = null;
  if (second) {
    const looked = await call(key, "GET", `/tools/${second.tool}`, { fetchImpl, notFound: COMPOSIO_FAILED.cannotFill });
    if (looked.error) return { ok: false, error: looked.error, status: looked.status, said: looked.said };
    secondInputs = readToolInputs(looked.body);
    if (buildArguments(second, values, secondInputs, { id: "check" }).error) return { ok: false, error: COMPOSIO_FAILED.cannotFill };
  }

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
  const made = findCreated(ran.body.data);
  const result = { ok: true, text: text && text !== "null" ? text : "", ...(made.link ? { link: made.link } : {}) };
  if (!second) return result;

  // From here the file EXISTS. Whatever goes wrong is told as it is (done, with a note), never retried, and never makes a second file.
  const partial = (why) => ({ ...result, note: `${second.partial} ${why} Hushwork will not try again by itself: open the file, check it and add the rest by hand.` });
  if (!made.id) return partial("Hushwork could not find the new file's id in the answer, so it wrote nothing into it.");
  const built2 = buildArguments(second, values, secondInputs, made);
  if (built2.error) return partial("The second step did not fit what Hushwork knows how to fill in.");
  const ran2 = await call(key, "POST", `/tools/execute/${second.tool}`, { body: { user_id: userId, arguments: built2.arguments }, fetchImpl, notFound: COMPOSIO_FAILED.notConnected });
  if (ran2.error) return partial(`Reason: ${ran2.error}${ran2.said ? ` The app said: "${ran2.said}".` : ""}`);
  if (ran2.body?.successful !== true) {
    const said = cleanSaid(ran2.body?.error, key);
    return partial(`Reason: ${explainFailure(said || ran2.body?.error)}${said ? ` The app said: "${said}".` : ""}`);
  }
  return result;
}

// What a "make a file" answer holds: the file's id and the address to open it. Composio answers with differently shaped JSON for different tools, so the answer is
// searched for the right kind of value instead of one exact shape. The address is kept ONLY if it is a docs.google.com or drive.google.com one (cleaned, at
// most 200 characters); the id must be a plain Google file id. Returns { id, link } with "" for what was not found.
const LINK_IN_TEXT = /https:\/\/(?:docs|drive)\.google\.com\/[A-Za-z0-9_\-./?=&%#]{1,200}/;
const ID_KEYS = ["spreadsheetId", "spreadsheet_id", "documentId", "document_id", "presentationId", "presentation_id", "folderId", "folder_id", "fileId", "file_id", "id"];
const GOOGLE_ID = /^[A-Za-z0-9_-]{15,120}$/;
export function findCreated(data) {
  let link = "";
  const objects = [];
  walkAnswer(data, (item) => {
    objects.push(item);
    if (link) return;
    for (const value of Object.values(item)) {
      const found = typeof value === "string" ? value.match(LINK_IN_TEXT) : null;
      if (found) { link = found[0].replace(/[.,;]+$/, ""); break; }
    }
  });
  let id = "";
  for (const key of ID_KEYS) {
    const holder = objects.find((item) => typeof item[key] === "string" && GOOGLE_ID.test(item[key]));
    if (holder) { id = holder[key]; break; }
  }
  if (!id && link) id = link.match(/\/(?:d|folders)\/([A-Za-z0-9_-]{15,120})/)?.[1] ?? "";
  return { id, link };
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
