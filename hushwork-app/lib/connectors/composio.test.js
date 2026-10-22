import test from "node:test";
import assert from "node:assert/strict";
import { ensureAuthConfig, startLink, listConnected, disconnect, runReadTool, COMPOSIO_FAILED } from "./composio.js";
import { COMPOSIO_APPS, COMPOSIO_IDS, findComposioApp } from "./composio-apps.js";

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
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
  for (const wrong of ["uak_whatever", "ck_whatever"]) assert.deepEqual(await runReadTool({ key: wrong, userId: "u", app: todoist, fetchImpl: sent.fetchImpl }), { ok: false, error: COMPOSIO_FAILED.wrongKey }, wrong);
  assert.equal(sent.sent.length, 0, "nothing was sent");
  assert.match(COMPOSIO_FAILED.wrongKey, /Project API key/);
  assert.match(COMPOSIO_FAILED.key, /Project API key.*ak_/);
});

test("every problem becomes a fixed sentence that never holds the key or Composio's own words", async () => {
  const key = "ak_SECRETKEY";
  const run = (status, body = {}) => runReadTool({ key, userId: "u", app: todoist, fetchImpl: composio(() => json(body, status)).fetchImpl });
  assert.deepEqual(await run(401), { ok: false, error: COMPOSIO_FAILED.key });
  assert.deepEqual(await run(402), { ok: false, error: COMPOSIO_FAILED.allowance });
  assert.deepEqual(await run(404), { ok: false, error: COMPOSIO_FAILED.notConnected });
  assert.deepEqual(await run(429), { ok: false, error: COMPOSIO_FAILED.busy });
  assert.deepEqual(await run(422), { ok: false, error: COMPOSIO_FAILED.failed });
  assert.deepEqual(await run(200, { successful: false, error: "No connected account found for user" }), { ok: false, error: COMPOSIO_FAILED.notConnected });
  assert.deepEqual(await run(200, { successful: false, error: `weird SECRET ${key}` }), { ok: false, error: COMPOSIO_FAILED.failed });
  const thrown = await runReadTool({ key, userId: "u", app: todoist, fetchImpl: async () => { throw new Error(`boom ${key}`); } });
  assert.deepEqual(thrown, { ok: false, error: COMPOSIO_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
});
