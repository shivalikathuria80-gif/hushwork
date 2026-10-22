import test from "node:test";
import assert from "node:assert/strict";
import { COMPOSIO_ACTIONS, buildArguments, checkTarget, findAction, readToolInputs, actionsForApp } from "./composio-actions.js";
import { COMPOSIO_APPS, findComposioApp } from "./composio-apps.js";
import { runActionTool, allowedTools, ensureAuthConfig, COMPOSIO_FAILED } from "./composio.js";

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const slack = findAction("slack_message");
const github = findAction("github_issue");
const todoist = findAction("todoist_task");

// A pretend Composio: remembers every request. `tool` is what GET /tools/<slug> answers; `execute` is what running it answers.
function composio({ tool, execute = { successful: true, data: { ok: true } } } = {}) {
  const sent = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    sent.push({ method: init.method, path: u.pathname, body: init.body ? JSON.parse(init.body) : undefined });
    return init.method === "GET" ? json(tool) : json(execute);
  };
  return { fetchImpl, sent };
}

test("the list: each action belongs to a real app, names one tool written Composio's way that is NOT the app's read-only lookup, and has a way to say each thing", () => {
  assert.ok(COMPOSIO_ACTIONS.length >= 3);
  assert.equal(new Set(COMPOSIO_ACTIONS.map((action) => action.id)).size, COMPOSIO_ACTIONS.length);
  assert.equal(new Set(COMPOSIO_ACTIONS.map((action) => action.tool)).size, COMPOSIO_ACTIONS.length);
  for (const action of COMPOSIO_ACTIONS) {
    const app = findComposioApp(action.app);
    assert.ok(app, `${action.id}: its app exists`);
    assert.match(action.tool, new RegExp(`^${app.toolkit.toUpperCase()}_[A-Z0-9_]+$`), `${action.id}: the tool belongs to the toolkit`);
    assert.notEqual(action.tool, app.tool);
    assert.ok(action.name && typeof action.done === "function" && typeof action.meaning === "function");
    const meant = action.meaning({ target: action.needsTarget ? (action.id === "github_issue" ? "acme/site" : "general") : "", title: "T", details: "D" });
    for (const meaning of Object.keys(meant)) assert.ok(action.candidates[meaning]?.length, `${action.id}: a name for ${meaning}`);
  }
  for (const bad of ["", "nope", "__proto__", "constructor", 5, null, undefined]) assert.equal(findAction(bad), null, String(bad));
  assert.deepEqual(actionsForApp("slack").map((action) => action.id), ["slack_message"]);
  assert.deepEqual(actionsForApp("notion"), []);
});

test("the sign-in at Composio is limited to the app's lookup plus the tools of its actions, and nothing else", () => {
  assert.deepEqual(allowedTools(findComposioApp("slack")), ["SLACK_LIST_ALL_CHANNELS", "SLACK_SEND_MESSAGE"]);
  assert.deepEqual(allowedTools(findComposioApp("notion")), ["NOTION_SEARCH_NOTION_PAGE"]);
  assert.deepEqual(allowedTools(findComposioApp("todoist")), ["TODOIST_GET_ALL_TASKS", "TODOIST_CREATE_TASK"]);
  for (const app of COMPOSIO_APPS) assert.ok(allowedTools(app).length >= 1);
});

test("a blueprint is reused only when its limit is exactly the allowed tools; otherwise one is made with them", async () => {
  const wanted = ["SLACK_LIST_ALL_CHANNELS", "SLACK_SEND_MESSAGE"];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    if (init.method === "GET") return json({ items: [{ id: "ac_old", toolkit: { slug: "slack" }, is_composio_managed: true, status: "ENABLED", restrict_to_following_tools: ["SLACK_LIST_ALL_CHANNELS"] }] });
    return json({ auth_config: { id: "ac_new" } }, 201);
  };
  assert.deepEqual(await ensureAuthConfig({ key: "k", app: findComposioApp("slack"), fetchImpl }), { id: "ac_new" });
  assert.deepEqual(calls[1].body.auth_config.restrict_to_following_tools, wanted);
  const reuse = async () => json({ items: [{ id: "ac_ok", toolkit: { slug: "slack" }, is_composio_managed: true, status: "ENABLED", restrict_to_following_tools: [...wanted].reverse() }] });
  assert.deepEqual(await ensureAuthConfig({ key: "k", app: findComposioApp("slack"), fetchImpl: reuse }), { id: "ac_ok" });
});

test("where a message or issue goes is checked before any request: a plain channel or owner/name, never anything with odd characters", () => {
  for (const good of ["general", "#general", "team-updates", "C0123ABCD", "dev.ops_1"]) assert.deepEqual(checkTarget(slack, good), { value: good }, good);
  for (const bad of ["", "two words", "a/b", "../x", "<script>", "x".repeat(81), "general\nsecret", 5, null]) assert.ok(checkTarget(slack, bad).error, String(bad));
  for (const good of ["acme/website", "my-org/repo.name", "a/b"]) assert.deepEqual(checkTarget(github, good), { value: good }, good);
  for (const bad of ["acme", "acme/", "/repo", "acme/re po", "acme/repo/extra", "-acme/repo", "ac me/repo", "../../etc/passwd", "acme/..%2f"]) assert.ok(checkTarget(github, bad).error, bad);
  assert.deepEqual(checkTarget(todoist, ""), { value: "" });
  assert.ok(checkTarget(todoist, "inbox").error, "an action with no place refuses one");
});

test("reading a tool's inputs works for a plain list and for a JSON schema; odd names are ignored", () => {
  const plain = readToolInputs({ input_parameters: { channel: { required: true }, markdown_text: { required: true }, thread_ts: {}, "bad name!": { required: true } } });
  assert.deepEqual([...plain.names].sort(), ["channel", "markdown_text", "thread_ts"]);
  assert.deepEqual([...plain.required].sort(), ["channel", "markdown_text"]);
  const schema = readToolInputs({ input_parameters: { type: "object", properties: { owner: {}, repo: {}, title: {}, body: {} }, required: ["owner", "repo", "title"] } });
  assert.deepEqual([...schema.names].sort(), ["body", "owner", "repo", "title"]);
  assert.deepEqual([...schema.required].sort(), ["owner", "repo", "title"]);
  for (const odd of [null, undefined, {}, { input_parameters: null }, { input_parameters: "x" }]) assert.deepEqual([...readToolInputs(odd).names], []);
});

test("the request is built only from inputs the tool really has; a missing home or an extra required input means nothing is sent", () => {
  const values = { target: "#general", title: "Deploy done", details: "All green" };
  assert.deepEqual(buildArguments(slack, values, readToolInputs({ input_parameters: { channel: { required: true }, markdown_text: { required: true }, thread_ts: {} } })), { arguments: { channel: "general", markdown_text: "Deploy done\nAll green" } });
  assert.deepEqual(buildArguments(slack, { ...values, details: "" }, readToolInputs({ input_parameters: { channel: { required: true }, text: { required: true } } })).arguments, { channel: "general", text: "Deploy done" });
  assert.ok(buildArguments(slack, values, readToolInputs({ input_parameters: { channel: { required: true } } })).error, "no input for the message");
  assert.ok(buildArguments(slack, values, readToolInputs({ input_parameters: { channel: { required: true }, text: { required: true }, bot_token: { required: true } } })).error, "an input we do not fill in is required");
  const issue = { target: "acme/website", title: "Broken link", details: "" };
  assert.deepEqual(buildArguments(github, issue, readToolInputs({ input_parameters: { type: "object", properties: { owner: {}, repo: {}, title: {}, body: {} }, required: ["owner", "repo", "title"] } })).arguments, { owner: "acme", repo: "website", title: "Broken link" });
  assert.deepEqual(buildArguments(github, issue, readToolInputs({ input_parameters: { repo_name: { required: true }, title: { required: true } } })).arguments, { repo_name: "acme/website", title: "Broken link" }, "one box for owner/name");
  assert.deepEqual(buildArguments(todoist, { target: "", title: "Buy milk", details: "2 litres" }, readToolInputs({ input_parameters: { content: { required: true }, description: {}, project_id: {} } })).arguments, { content: "Buy milk", description: "2 litres" });
});

test("doing an action: the tool's inputs are asked for first, then ONE request with exactly the built inputs for this person; nothing else is ever sent", async () => {
  const pretend = composio({ tool: { input_parameters: { channel: { required: true }, markdown_text: { required: true } } }, execute: { successful: true, data: { ok: true, ts: "1.2" } } });
  const result = await runActionTool({ key: "k", userId: "u-1", action: slack, values: { target: "general", title: "Hello team", details: "" }, fetchImpl: pretend.fetchImpl });
  assert.equal(result.ok, true);
  assert.deepEqual(pretend.sent.map((entry) => [entry.method, entry.path]), [["GET", "/api/v3.1/tools/SLACK_SEND_MESSAGE"], ["POST", "/api/v3.1/tools/execute/SLACK_SEND_MESSAGE"]]);
  assert.deepEqual(pretend.sent[1].body, { user_id: "u-1", arguments: { channel: "general", markdown_text: "Hello team" } });
});

test("nothing is sent when the tool does not match what we know, and every problem is a fixed sentence", async () => {
  const mismatch = composio({ tool: { input_parameters: { channel: { required: true }, markdown_text: { required: true }, api_secret: { required: true } } } });
  assert.deepEqual(await runActionTool({ key: "k", userId: "u", action: slack, values: { target: "general", title: "x", details: "" }, fetchImpl: mismatch.fetchImpl }), { ok: false, error: COMPOSIO_FAILED.cannotFill });
  assert.equal(mismatch.sent.filter((entry) => entry.method === "POST").length, 0, "no write request was sent");
  const refused = async () => json({}, 401);
  assert.deepEqual(await runActionTool({ key: "ak_SECRET", userId: "u", action: slack, values: { target: "general", title: "x", details: "" }, fetchImpl: refused }), { ok: false, error: COMPOSIO_FAILED.key });
  const notConnected = composio({ tool: { input_parameters: { channel: { required: true }, text: { required: true } } }, execute: { successful: false, error: "No connected account for user" } });
  assert.deepEqual(await runActionTool({ key: "k", userId: "u", action: slack, values: { target: "general", title: "x", details: "" }, fetchImpl: notConnected.fetchImpl }), { ok: false, error: COMPOSIO_FAILED.notConnected });
  const odd = composio({ tool: { input_parameters: { channel: { required: true }, text: { required: true } } }, execute: { successful: false, error: "weird SECRET text" } });
  const failed = await runActionTool({ key: "k", userId: "u", action: slack, values: { target: "general", title: "x", details: "" }, fetchImpl: odd.fetchImpl });
  assert.deepEqual(failed, { ok: false, error: COMPOSIO_FAILED.failed });
  assert.ok(!JSON.stringify(failed).includes("SECRET"));
});
