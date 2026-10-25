import test from "node:test";
import assert from "node:assert/strict";
import { ensureAuthConfig, startLink, listConnected, disconnect, runReadTool, COMPOSIO_FAILED } from "./composio.js";
import { COMPOSIO_APPS, COMPOSIO_IDS, findComposioApp } from "./composio-apps.js";

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
const todoist = findComposioApp("todoist");

// A pretend Composio: remembers every request, answers from `answer(method, url, init)`.
function composio(answer) {
  const sent = [];
  const fetchImpl = async (url, init) => { const u = new URL(url); sent.push({ method: init.method, path: u.pathname, query: Object.fromEntries(u.searchParams), headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined }); return answer(init.method, u, init); };
  return { fetchImpl, sent };
}

test("the list: every app has an id, a plain name, a toolkit and ONE read-only tool named in Composio's way; ids and tools are unique; a made-up id is not found", () => {
  assert.ok(COMPOSIO_APPS.length >= 5);
  for (const app of COMPOSIO_APPS) {
    assert.match(app.id, /^[a-z][a-z0-9_]{1,30}$/);
    assert.match(app.toolkit, /^[a-z0-9_]+$/);
    assert.match(app.tool, new RegExp(`^${app.toolkit.toUpperCase()}_[A-Z0-9_]+$`), `${app.id}: the tool belongs to the toolkit`);
    assert.match(app.tool, /_(?:LIST|GET|SEARCH|READ|FETCH)_/, `${app.id}: the tool name says it only reads`);
    assert.doesNotMatch(app.tool, /(?:CREATE|UPDATE|DELETE|ADD|SEND|REMOVE|SET|MERGE|ARCHIVE|UPSERT|WRITE|POST|PUT|PATCH|UPLOAD|MOVE|REPLACE)/, `${app.id}: no writing word`);
    for (const key of ["name", "what", "about"]) assert.ok(app[key] && typeof app[key] === "string");
  }
  assert.equal(new Set(COMPOSIO_IDS).size, COMPOSIO_IDS.length);
  assert.equal(new Set(COMPOSIO_APPS.map((app) => app.tool)).size, COMPOSIO_APPS.length);
  for (const bad of ["", "nope", "__proto__", "constructor", "TODOIST", 5, null, undefined, {}]) assert.equal(findComposioApp(bad), null, String(bad));
});

test("a sign-in blueprint is reused when one limited to the same tool exists, and made (managed, limited to that one tool) when not", async () => {
  const have = composio(() => json({ items: [
    { id: "ac_other", toolkit: { slug: "todoist" }, is_composio_managed: true, status: "ENABLED", restrict_to_following_tools: ["TODOIST_CREATE_TASK"] },
    { id: "ac_wide", toolkit: { slug: "todoist" }, is_composio_managed: true, status: "ENABLED", restrict_to_following_tools: [] },
    { id: "ac_good", toolkit: { slug: "todoist" }, is_composio_managed: true, status: "ENABLED", restrict_to_following_tools: ["TODOIST_GET_ALL_TASKS", "TODOIST_CREATE_TASK"] },
  ] }));
  assert.deepEqual(await ensureAuthConfig({ key: "k1", app: todoist, fetchImpl: have.fetchImpl }), { id: "ac_good" });
  assert.equal(have.sent.length, 1);
  assert.equal(have.sent[0].headers["x-api-key"], "k1");
  assert.deepEqual([have.sent[0].query.toolkit_slug, have.sent[0].query.is_composio_managed], ["todoist", "true"]);

  const none = composio((method) => (method === "GET" ? json({ items: [] }) : json({ toolkit: { slug: "todoist" }, auth_config: { id: "ac_new" } }, 201)));
  assert.deepEqual(await ensureAuthConfig({ key: "k1", app: todoist, fetchImpl: none.fetchImpl }), { id: "ac_new" });
  assert.deepEqual(none.sent[1].body, { toolkit: { slug: "todoist" }, auth_config: { type: "use_composio_managed_auth", restrict_to_following_tools: ["TODOIST_GET_ALL_TASKS", "TODOIST_CREATE_TASK"] } });
  const broken = composio((method) => (method === "GET" ? json({ items: [] }) : json({}, 201)));
  assert.deepEqual(await ensureAuthConfig({ key: "k", app: todoist, fetchImpl: broken.fetchImpl }), { error: COMPOSIO_FAILED.noSignIn });
  const refused = composio((method) => (method === "GET" ? json({ items: [] }) : json({}, 400)));
  assert.deepEqual(await ensureAuthConfig({ key: "k", app: todoist, fetchImpl: refused.fetchImpl }), { error: COMPOSIO_FAILED.noSignIn });
});

test("the sign-in link: the person's id and callback go to Composio, and only an https page comes back", async () => {
  const ok = composio(() => json({ redirect_url: "https://connect.composio.dev/link/ln_1" }, 201));
  assert.deepEqual(await startLink({ key: "k", authConfigId: "ac_1", userId: "u-1", callbackUrl: "http://localhost:3100/app/connections?composio=done", fetchImpl: ok.fetchImpl }), { url: "https://connect.composio.dev/link/ln_1" });
  assert.deepEqual(ok.sent[0].body, { auth_config_id: "ac_1", user_id: "u-1", callback_url: "http://localhost:3100/app/connections?composio=done" });
  for (const url of ["http://evil.example/x", "javascript:alert(1)", "", 5, undefined]) {
    const bad = composio(() => json({ redirect_url: url }, 201));
    assert.deepEqual(await startLink({ key: "k", authConfigId: "a", userId: "u", callbackUrl: "x", fetchImpl: bad.fetchImpl }), { error: COMPOSIO_FAILED.noSignIn }, String(url));
  }
});

test("connected apps: only working accounts with plain ids are listed, and disconnect removes only that app's accounts", async () => {
  const list = composio((method) => (method === "GET" ? json({ items: [
    { id: "ca_1", toolkit: { slug: "todoist" } }, { id: "ca_2", toolkit: { slug: "notion" } }, { id: 7, toolkit: { slug: "x" } }, { id: "ca_3" }, null,
  ] }) : json({}, 200)));
  assert.deepEqual(await listConnected({ key: "k", userId: "u-1", fetchImpl: list.fetchImpl }), { accounts: [{ id: "ca_1", toolkit: "todoist" }, { id: "ca_2", toolkit: "notion" }] });
  assert.deepEqual([list.sent[0].query.user_ids, list.sent[0].query.statuses], ["u-1", "ACTIVE"]);
  assert.deepEqual(await disconnect({ key: "k", userId: "u-1", app: todoist, fetchImpl: list.fetchImpl }), { ok: true });
  const deletes = list.sent.filter((entry) => entry.method === "DELETE");
  assert.deepEqual(deletes.map((entry) => entry.path), ["/api/v3.1/connected_accounts/ca_1"], "the Notion connection is untouched");
  const evil = composio((method) => (method === "GET" ? json({ items: [{ id: "../../projects", toolkit: { slug: "todoist" } }] }) : json({})));
  await disconnect({ key: "k", userId: "u", app: todoist, fetchImpl: evil.fetchImpl });
  assert.equal(evil.sent.filter((entry) => entry.method === "DELETE").length, 0, "an id that is not plain is never put into an address");
});

test("running the read tool: always the tool from the list, with no arguments, for this person; the answer is plain text, cut short", async () => {
  const ran = composio(() => json({ successful: true, data: { tasks: [{ content: "Buy milk\nnow" }], big: "x".repeat(5000) } }));
  const result = await runReadTool({ key: "k", userId: "u-1", app: todoist, fetchImpl: ran.fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.text.length, 1500);
  assert.ok(!/[\n\r\t]/.test(result.text));
  assert.equal(ran.sent[0].method, "POST");
  assert.equal(ran.sent[0].path, "/api/v3.1/tools/execute/TODOIST_GET_ALL_TASKS");
  assert.deepEqual(ran.sent[0].body, { user_id: "u-1", arguments: {} });
  assert.deepEqual(await runReadTool({ key: "k", userId: "u", app: todoist, fetchImpl: composio(() => json({ successful: true, data: null })).fetchImpl }), { ok: true, text: "(nothing found)" });
});

test("a Composio consumer key (ck_...) or User key (uak_...) is never sent: the owner is told which key to copy, and the 401 sentence says where to find the right one", async () => {
  const sent = composio(() => json({}));
  for (const wrong of ["uak_whatever", "ck_whatever"]) assert.deepEqual(sentence(await runReadTool({ key: wrong, userId: "u", app: todoist, fetchImpl: sent.fetchImpl })), { ok: false, error: COMPOSIO_FAILED.wrongKey }, wrong);
  assert.equal(sent.sent.length, 0, "nothing was sent");
  assert.match(COMPOSIO_FAILED.wrongKey, /Project API key/);
  assert.match(COMPOSIO_FAILED.key, /Project API key.*ak_/);
});

// The sentence part of a result (a refusal also carries `status` and `said`, tested separately below).
const sentence = (result) => ({ ok: result.ok, error: result.error });

test("every problem becomes one of our own sentences; the key is never in the answer", async () => {
  const key = "ak_SECRETKEY";
  const run = (status, body = {}) => runReadTool({ key, userId: "u", app: todoist, fetchImpl: composio(() => json(body, status)).fetchImpl });
  assert.deepEqual(sentence(await run(401)), { ok: false, error: COMPOSIO_FAILED.key });
  assert.deepEqual(sentence(await run(402)), { ok: false, error: COMPOSIO_FAILED.allowance });
  assert.deepEqual(sentence(await run(404)), { ok: false, error: COMPOSIO_FAILED.notConnected });
  assert.deepEqual(sentence(await run(429)), { ok: false, error: COMPOSIO_FAILED.busy });
  assert.deepEqual(sentence(await run(422)), { ok: false, error: COMPOSIO_FAILED.failed });
  assert.deepEqual(sentence(await run(200, { successful: false, error: "No connected account found for user" })), { ok: false, error: COMPOSIO_FAILED.notConnected });
  const echoed = await run(200, { successful: false, error: `weird ${key}` });
  assert.deepEqual(sentence(echoed), { ok: false, error: COMPOSIO_FAILED.failed });
  assert.ok(!JSON.stringify(echoed).includes("SECRETKEY"), "an app that echoes our key back is never quoted");
  const thrown = await runReadTool({ key, userId: "u", app: todoist, fetchImpl: async () => { throw new Error(`boom ${key}`); } });
  assert.deepEqual(sentence(thrown), { ok: false, error: COMPOSIO_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
});

test("when an app refuses, its own cleaned words come back as `said` so the real reason can be shown; long, odd or secret-looking words are cut or dropped", async () => {
  const { cleanSaid } = await import("./composio.js");
  const key = "ak_SECRETKEY";
  const refuse = (status, body) => runReadTool({ key, userId: "u", app: todoist, fetchImpl: composio(() => json(body, status)).fetchImpl });
  const bad = await refuse(400, { error: { message: "Could not find page with ID: 0000" } });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, COMPOSIO_FAILED.notFound, "the sentence is chosen from what the app said");
  assert.equal(bad.said, "Could not find page with ID: 0000");
  assert.equal(bad.status, 400);
  const refused = await refuse(200, { successful: false, error: "Forbidden: page not shared with the integration" });
  assert.equal(refused.error, COMPOSIO_FAILED.forbidden);
  assert.equal(refused.said, "Forbidden: page not shared with the integration");

  assert.equal(cleanSaid("line one\nline two\ttab"), "line one line two tab");
  assert.equal(cleanSaid("x".repeat(500)).length, 160);
  assert.equal(cleanSaid(`my key ${"gsk_" + "a".repeat(30)}`), "", "secret-looking words are dropped");
  assert.equal(cleanSaid(`it said ${key}`, key), "", "our own key is dropped");
  assert.equal(cleanSaid({ message: "from an object" }), "from an object");
  for (const nothing of [undefined, null, "", "   ", 5, []]) assert.equal(cleanSaid(nothing), "", String(nothing));
});

test("disconnecting everything: lists this person's connected apps once, removes each by its plain id, skips odd ids, and stops with a sentence on a failure", async () => {
  const { disconnectEverything } = await import("./composio.js");
  const seen = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    seen.push(`${init.method} ${u.pathname}${u.search}`);
    if (init.method === "GET") return { ok: true, status: 200, json: async () => ({ items: [{ id: "ca_1", toolkit: { slug: "slack" } }, { id: "../evil", toolkit: { slug: "x" } }, { id: "ca_2", toolkit: { slug: "gmail" } }] }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  assert.deepEqual(await disconnectEverything({ key: "k", userId: "u-1", fetchImpl }), { ok: true });
  assert.deepEqual(seen, ["GET /api/v3.1/connected_accounts?user_ids=u-1&statuses=ACTIVE&limit=100", "DELETE /api/v3.1/connected_accounts/ca_1", "DELETE /api/v3.1/connected_accounts/ca_2"]);
  const refused = async () => ({ ok: false, status: 401, json: async () => ({}) });
  assert.ok((await disconnectEverything({ key: "ak_SECRET", userId: "u-1", fetchImpl: refused })).error);
});

test("apps Composio cannot sign in for are marked with a plain reason, and nothing else is: Vercel, Xero and Cloudflare", async () => {
  const { COMPOSIO_APPS } = await import("./composio-apps.js");
  assert.deepEqual(COMPOSIO_APPS.filter((app) => app.unavailable).map((app) => app.id).sort(), ["cloudflare", "vercel", "xero"]);
  for (const app of COMPOSIO_APPS.filter((one) => one.unavailable)) assert.match(app.unavailable, /Not available yet\.$/, app.id);
});


test("test all connections (Composio part): only connected apps are tried, a working app is ok, a refusing app shows what it said, an action that does not fit is flagged, and nothing is ever sent", async () => {
  const { checkComposioConnections } = await import("./composio.js");
  const seen = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    seen.push(`${init.method} ${u.pathname.replace("/api/v3.1", "")}`);
    const path = u.pathname.replace("/api/v3.1", "");
    if (path === "/connected_accounts") return json({ items: [{ id: "ca_1", toolkit: { slug: "slack" } }, { id: "ca_2", toolkit: { slug: "notion" } }] });
    if (path === "/tools/execute/SLACK_LIST_ALL_CHANNELS") return json({ successful: true, data: { channels: [] } });
    if (path === "/tools/execute/NOTION_SEARCH_NOTION_PAGE") return json({ successful: false, error: "Forbidden: page not shared with the integration" });
    if (path === "/tools/SLACK_SEND_MESSAGE") return json({ input_parameters: { channel: { required: true }, markdown_text: { required: true } } });
    if (path === "/tools/NOTION_CREATE_NOTION_PAGE") return json({ input_parameters: { parent_id: { required: true }, title: { required: true }, markdown: {}, bot_token: { required: true } } });
    return json({}, 404);
  };
  const result = await checkComposioConnections({ key: "ak_k", userId: "u-1", fetchImpl });
  assert.deepEqual(result.rows.map((row) => [row.name, row.ok]), [["Notion", false], ["Slack", true]].sort((a, b) => result.rows.findIndex((r) => r.name === a[0]) - result.rows.findIndex((r) => r.name === b[0])));
  const slack = result.rows.find((row) => row.name === "Slack");
  const notion = result.rows.find((row) => row.name === "Notion");
  assert.match(slack.note, /^Works\./);
  assert.deepEqual(slack.actions.map((a) => [a.name, a.ok]), [["Send a Slack message", true]]);
  assert.match(notion.note, /not allowed to do that.*The app said: "Forbidden: page not shared with the integration"/);
  assert.deepEqual(notion.actions.map((a) => [a.name, a.ok]), [["Create a Notion page", false]]);
  assert.match(notion.actions[0].note, /bot_token/, "it says which input the tool wants that Hushwork cannot fill in");
  assert.ok(result.off.includes("Todoist") && result.off.includes("Vercel") && !result.off.includes("Slack") && !result.off.includes("Notion"));
  assert.ok(seen.every((line) => line.startsWith("GET ") || /^POST \/tools\/execute\/(SLACK_LIST_ALL_CHANNELS|NOTION_SEARCH_NOTION_PAGE)$/.test(line)), "only the two read-only lookups were run; no action was executed");
  assert.ok(!seen.some((line) => line.includes("SLACK_SEND_MESSAGE") && line.startsWith("POST")));

  const refused = await checkComposioConnections({ key: "ak_k", userId: "u-1", fetchImpl: async () => json({}, 401) });
  assert.equal(refused.rows, undefined);
  assert.equal(refused.error, COMPOSIO_FAILED.key);
});
