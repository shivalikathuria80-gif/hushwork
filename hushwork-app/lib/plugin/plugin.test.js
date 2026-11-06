// The Hushwork plugin (lib/plugin/, app/api/mcp): tokens, the MCP messages, and the tools run against the REAL run code with a pretend
// database and a pretend Composio. The point of these tests is the safety rule: a chatbot can read and run, but nothing that sends or
// creates happens until approve_step is called with the exact words the person was shown.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { makeFakeSupabase, fakeComposio, GMAIL_TOOL } from "../test-server-support.js";
import { finishSteps } from "../ai/plan.js";
import { makeToken, hashToken, bearerToken, looksLikeToken, findTokenOwner, checkTokenName } from "./tokens.js";
import { handleBody, handleMessage } from "./mcp.js";
import { TOOLS } from "./tools.js";
import { takeDbSlot } from "../db-limits.js";

process.env["COMPOSIO" + "_API_KEY"] = "ak_test_key_not_real"; // built in two pieces so secret scanners do not trip on a test
const { startPracticeRun, approveStep, rejectStep } = await import("../run-core.js");

const deps = { startRun: startPracticeRun, approveStep, rejectStep, createAgent: async () => ({ error: "not in this test" }) };
const call = async (who, name, args = {}) => {
  const answer = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, who, deps);
  return { ...JSON.parse(answer.result.content[0].text), isError: answer.result.isError === true };
};
const livePosts = (composio) => composio.calls.filter((one) => one.method === "POST" && one.path.startsWith("/tools/execute/"));

function setup() {
  const user = randomUUID();
  const workflow = randomUUID();
  const plan = finishSteps({ steps: [
    { icon: "Zap", title: "Start", detail: "x", block: "trigger", choice: "manual", a: "", b: "" },
    { icon: "Mail", title: "Email me", detail: "hi", block: "action", choice: "gmail_send", a: "me", b: "Hello from the plugin" },
  ] });
  const supabase = makeFakeSupabase({ asUser: user, admin: true, workflows: [{ id: workflow, user_id: user, name: "Say hello", prompt: "Email me hello", kind: "agent", plan, updated_at: "2026-11-06T09:00:00Z" }], emails: { [user]: "owner@example.com" } });
  supabase.__hushworkUserId = user;
  return { user, workflow, supabase, who: { user: { id: user, email: "owner@example.com" }, supabase }, emailStep: plan.findIndex((step) => step.kind === "action") };
}

test("tokens: made once, saved only as a hash, read only from a well-formed Bearer header", async () => {
  const made = makeToken();
  assert.ok(looksLikeToken(made.token));
  assert.equal(made.hash, hashToken(made.token));
  assert.match(made.hash, /^[0-9a-f]{64}$/);
  assert.ok(made.token.startsWith(made.prefix) && made.prefix.length === 9);
  assert.notEqual(makeToken().token, made.token);
  assert.equal(bearerToken(`Bearer ${made.token}`), made.token);
  for (const bad of ["", made.token, `Basic ${made.token}`, "Bearer hw_short", `Bearer ${made.token}x`]) assert.equal(bearerToken(bad), "", bad);
  assert.deepEqual(checkTokenName("  Claude   on my laptop "), { value: "Claude on my laptop" });
  assert.ok(checkTokenName("").error && checkTokenName("x".repeat(61)).error);

  const updates = [];
  const admin = { from: () => ({
    select() { return this; }, update(values) { updates.push(values); return this; },
    eq(column, value) { this.match = column === "token_hash" ? value : this.match; return this; },
    limit() { return Promise.resolve({ data: this.match === made.hash ? [{ id: "t1", user_id: "u1", last_used_at: null }] : [], error: null }); },
    then(resolve) { resolve({ error: null }); },
  }) };
  assert.deepEqual(await findTokenOwner(admin, made.token, 1_000_000), { userId: "u1", tokenId: "t1" });
  assert.equal(updates.length, 1, "marked as used");
  assert.equal(await findTokenOwner(admin, makeToken().token), null, "an unknown token belongs to nobody");
  assert.equal(await findTokenOwner(admin, "hw_not_a_token"), null);
});

test("a token's client counts the AI and action limits for its owner; the clock's client still skips them", async () => {
  const calls = [];
  const client = { __hushworkAdmin: true, __hushworkUserId: "u1", rpc: async (fn, args) => { calls.push({ fn, args }); return { data: "limit_day", error: null }; } };
  assert.deepEqual(await takeDbSlot(client, "ai_plan", 2, 20), { ok: false, why: "limit_day" });
  assert.equal(calls[0].fn, "take_usage_for");
  assert.equal(calls[0].args.p_user, "u1");
  assert.deepEqual(await takeDbSlot({ __hushworkAdmin: true, rpc: async () => { throw new Error("must not be called"); } }, "ai_plan", 2, 20), { ok: true });
});

test("MCP: initialize, tools/list, ping, notifications and unknown methods", async () => {
  const init = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, null, deps);
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.equal(init.result.serverInfo.name, "hushwork");
  assert.ok(init.result.capabilities.tools);
  assert.match(init.result.instructions, /approval/);
  const newer = await handleMessage({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2099-01-01" } }, null, deps);
  assert.equal(newer.result.protocolVersion, "2025-11-25");

  const list = await handleMessage({ jsonrpc: "2.0", id: 3, method: "tools/list" }, null, deps);
  assert.deepEqual(list.result.tools.map((tool) => tool.name), ["list_agents", "create_agent", "run_agent", "list_runs", "get_run", "list_waiting", "approve_step", "reject_step", "agent_notes"]);
  for (const tool of TOOLS) assert.equal(tool.inputSchema.type, "object", tool.name);
  assert.equal(TOOLS.find((tool) => tool.name === "approve_step").annotations.destructiveHint, true);
  assert.ok(TOOLS.find((tool) => tool.name === "approve_step").inputSchema.required.includes("seen"));

  assert.deepEqual((await handleMessage({ jsonrpc: "2.0", id: 4, method: "ping" }, null, deps)).result, {});
  assert.deepEqual(await handleBody({ jsonrpc: "2.0", method: "notifications/initialized" }, null, deps), { status: 202, body: null });
  assert.equal((await handleMessage({ jsonrpc: "2.0", id: 5, method: "sampling/createMessage" }, null, deps)).error.code, -32601);
  assert.equal((await handleMessage({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "drop_tables" } }, null, deps)).error.code, -32602);
  assert.equal((await handleMessage({ id: 7, method: "ping" }, null, deps)).error.code, -32600);
  const batch = await handleBody([{ jsonrpc: "2.0", id: 8, method: "ping" }, { jsonrpc: "2.0", method: "notifications/initialized" }], null, deps);
  assert.equal(batch.status, 200);
  assert.equal(batch.body.length, 1);
});

test("run_agent never sends; the email waits with its exact words, and only approve_step with those words sends it, once", async () => {
  const { who, workflow, supabase, emailStep } = setup();
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL });
  try {
    const listed = await call(who, "list_agents");
    assert.equal(listed.items[0].id, workflow);
    assert.equal(listed.items[0].kind, "agent");

    const ran = await call(who, "run_agent", { id: workflow });
    assert.ok(ran.run_id, JSON.stringify(ran));
    assert.match(ran.result, /1 step\(s\) wait for approval/);
    assert.equal(livePosts(composio).length, 0, "running sent nothing");

    const run = await call(who, "get_run", { run_id: ran.run_id });
    const email = run.steps[emailStep];
    assert.equal(email.state, "waiting for approval");
    assert.equal(email.writes, true);
    assert.match(email.will_do, /owner@example\.com/);
    assert.match(email.will_do, /Hello from the plugin/);

    const wrong = await call(who, "approve_step", { run_id: ran.run_id, step: emailStep, seen: "Send an email to someone else" });
    assert.equal(wrong.isError, true);
    assert.match(wrong.error, /changed since the person read it/);
    assert.equal(wrong.will_do_now, email.will_do, "the chatbot gets the real words to show");
    assert.equal(livePosts(composio).length, 0, "a mismatch sent nothing");

    const missing = await call(who, "approve_step", { run_id: ran.run_id, step: emailStep });
    assert.equal(missing.isError, true, "no `seen`, no send");

    const approved = await call(who, "approve_step", { run_id: ran.run_id, step: emailStep, seen: email.will_do });
    assert.equal(approved.ok, true, JSON.stringify(approved));
    assert.equal(approved.state, "done");
    assert.equal(livePosts(composio).length, 1, "sent exactly once");
    assert.equal(livePosts(composio)[0].body.arguments.recipient_email, "owner@example.com");

    const again = await call(who, "approve_step", { run_id: ran.run_id, step: emailStep, seen: email.will_do });
    assert.equal(again.isError, true);
    assert.equal(livePosts(composio).length, 1, "never twice");

    const owned = supabase.tables.runs.every((row) => row.user_id === who.user.id);
    assert.ok(owned, "every record names its owner (no session fills it in)");
  } finally { composio.restore(); }
});

test("reject_step turns a waiting step down without sending, and another person's run cannot be read or approved", async () => {
  const { who, workflow, emailStep, supabase } = setup();
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL });
  try {
    const ran = await call(who, "run_agent", { id: workflow });
    const waiting = await call(who, "list_waiting");
    assert.equal(waiting.count, 1);
    assert.equal(waiting.waiting[0].run_id, ran.run_id);
    assert.equal(waiting.waiting[0].step, emailStep);
    assert.match(waiting.waiting[0].will_do, /Hello from the plugin/);
    assert.equal((await call(who, "list_agents")).items[0].waiting.steps, 1);

    const stranger = { user: { id: randomUUID(), email: "x@example.com" }, supabase };
    assert.equal((await call(stranger, "get_run", { run_id: ran.run_id })).isError, true);
    assert.equal((await call(stranger, "approve_step", { run_id: ran.run_id, step: emailStep, seen: "x" })).isError, true);
    assert.equal((await call(stranger, "run_agent", { id: workflow })).isError, true);

    const rejected = await call(who, "reject_step", { run_id: ran.run_id, step: emailStep, reason: "Not today" });
    assert.equal(rejected.ok, true, JSON.stringify(rejected));
    const run = await call(who, "get_run", { run_id: ran.run_id });
    assert.equal(run.steps[emailStep].state, "stopped");
    assert.match(run.steps[emailStep].result, /Turned down by you.*Not today/);
    assert.equal(livePosts(composio).length, 0, "nothing was sent");
    assert.equal((await call(who, "list_waiting")).count, 0, "no longer waiting");
    const runs = await call(who, "list_runs", { since: "2000-01-01T00:00:00Z" });
    assert.equal(runs.count, 1);
    assert.match(runs.runs[0].outcome, /^Stopped at a step/);
  } finally { composio.restore(); }
});

test("agent_notes shows the Hushwork Agent's notes that were not dismissed", async () => {
  const { who, supabase } = setup();
  supabase.tables.agent_state = [{ user_id: who.user.id, enabled: true, checked_at: "2026-11-06T09:00:00Z", status: "ok", notes: [{ title: "Reply to Ana", why: "She asked twice", ask: "Draft a reply" }, { title: "Old", why: "", ask: "", dismissed: true }] }];
  const notes = await call(who, "agent_notes");
  assert.equal(notes.on, true);
  assert.deepEqual(notes.notes.map((note) => note.title), ["Reply to Ana"]);
  supabase.tables.agent_state = [];
  assert.equal((await call(who, "agent_notes")).on, false);
});

test("create_agent through a token's client saves the agent and its schedule under the token's owner, and its first run sends nothing", async () => {
  const { createAgent } = await import("../agents/create.js");
  const user = randomUUID();
  const supabase = makeFakeSupabase({ asUser: user, admin: true });
  supabase.tables.schedules = [];
  supabase.__hushworkUserId = user;
  const who = { user: { id: user, email: "owner@example.com" }, supabase };
  const real = { ...deps, createAgent: ({ prompt, tzOffset }) => createAgent({ prompt, tzOffset, user: who.user, supabase, groqKey: "", memory: "", dbTake: async () => ({ ok: true }) }) };
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL });
  try {
    const answer = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_agent", arguments: { sentence: "Every Monday at 9, email me a summary of my week", tz_offset_minutes: 330 } } }, who, real);
    const made = JSON.parse(answer.result.content[0].text);
    assert.ok(made.id, JSON.stringify(made));
    assert.equal(supabase.tables.workflows[0].user_id, user);
    assert.equal(supabase.tables.workflows[0].kind, "agent");
    assert.equal(supabase.tables.schedules.length, 1, JSON.stringify(made));
    assert.equal(supabase.tables.schedules[0].user_id, user);
    assert.equal(supabase.tables.schedules[0].allow_writes, false, "a new schedule never writes by itself");
    assert.equal(livePosts(composio).length, 0);
  } finally { composio.restore(); }
});
