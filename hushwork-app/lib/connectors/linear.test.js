import test from "node:test";
import assert from "node:assert/strict";
import { fetchLinearIssues, issueLine, LINEAR_FAILED } from "./linear.js";

const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("a good answer becomes a short list, and the request goes to Linear with the key and no way to change anything", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => ({ data: { viewer: { assignedIssues: { nodes: [{ identifier: "ENG-1", title: "  Fix   the\nlogin ", state: { name: "In Progress" } }, { identifier: "ENG-2", title: "x".repeat(500), state: null }] } } } }) };
  };
  const bearer = await fetchLinearIssues({ authorization: "Bearer tok", fetchImpl: async (_u, init) => { assert.equal(init.headers.authorization, "Bearer tok"); return { ok: true, status: 200, json: async () => ({ data: { viewer: { assignedIssues: { nodes: [] } } } }) }; } });
  assert.deepEqual(bearer, { ok: true, issues: [] });
  const result = await fetchLinearIssues({ authorization: "lin_api_fake", fetchImpl });
  assert.deepEqual(result.issues[0], { id: "ENG-1", title: "Fix the login", state: "In Progress", due: "", priority: "" });
  assert.equal(result.issues[1].title.length, 100);
  assert.equal(result.issues[1].state, "");
  assert.equal(seen.url, "https://api.linear.app/graphql");
  assert.equal(seen.init.headers.authorization, "lin_api_fake");
  assert.ok(!/mutation/i.test(seen.init.body), "only a read query is ever sent");
});

test("errors become fixed sentences that never contain the key", async () => {
  const key = "lin_api_SECRET";
  assert.deepEqual(await fetchLinearIssues({ authorization: key, fetchImpl: reply(401, {}) }), { ok: false, error: LINEAR_FAILED.key });
  assert.deepEqual(await fetchLinearIssues({ authorization: key, fetchImpl: reply(400, { errors: [{ message: `bad ${key}` }] }) }), { ok: false, error: LINEAR_FAILED.key });
  assert.deepEqual(await fetchLinearIssues({ authorization: key, fetchImpl: reply(200, { errors: [{ message: `bad ${key}` }] }) }), { ok: false, error: LINEAR_FAILED.key });
  assert.deepEqual(await fetchLinearIssues({ authorization: key, fetchImpl: reply(429, {}) }), { ok: false, error: LINEAR_FAILED.busy });
  assert.deepEqual(await fetchLinearIssues({ authorization: key, fetchImpl: reply(200, { data: {} }) }), { ok: false, error: LINEAR_FAILED.network });
  const thrown = await fetchLinearIssues({ authorization: key, fetchImpl: async () => { throw new Error(`boom ${key}`); } });
  assert.deepEqual(thrown, { ok: false, error: LINEAR_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
});

test("due dates and priorities are asked for, kept only when they look right, and shown on one line", async () => {
  let body;
  const nodes = [
    { identifier: "ENG-3", title: "Ship invoices", state: { name: "Todo" }, dueDate: "2026-11-20", priority: 1 },
    { identifier: "ENG-4", title: "Tidy", state: { name: "Backlog" }, dueDate: "next week <b>", priority: 9 },
    { identifier: "ENG-5", title: "Docs", state: null, dueDate: null, priority: 0 },
    { identifier: "ENG-6", title: "Call", state: { name: "Todo" }, dueDate: "2026-12-01T10:00:00Z", priority: 4 },
  ];
  const result = await fetchLinearIssues({ authorization: "k", fetchImpl: async (_u, init) => { body = init.body; return { ok: true, status: 200, json: async () => ({ data: { viewer: { assignedIssues: { nodes } } } }) }; } });
  assert.match(body, /dueDate/);
  assert.match(body, /priority/);
  assert.deepEqual(result.issues.map((issue) => [issue.due, issue.priority]), [["2026-11-20", "Urgent"], ["", ""], ["", ""], ["", "Low"]]);
  assert.equal(issueLine(result.issues[0]), "ENG-3 Ship invoices (Todo, due 2026-11-20, Urgent)");
  assert.equal(issueLine(result.issues[1]), "ENG-4 Tidy (Backlog)");
  assert.equal(issueLine(result.issues[2]), "ENG-5 Docs");
  assert.equal(issueLine(result.issues[3]), "ENG-6 Call (Todo, Low)");
});
