import test from "node:test";
import assert from "node:assert/strict";
import { fetchLinearIssues, LINEAR_FAILED } from "./linear.js";

const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("a good answer becomes a short list, and the request goes to Linear with the key and no way to change anything", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => ({ data: { viewer: { assignedIssues: { nodes: [{ identifier: "ENG-1", title: "  Fix   the\nlogin ", state: { name: "In Progress" } }, { identifier: "ENG-2", title: "x".repeat(500), state: null }] } } } }) };
  };
  const result = await fetchLinearIssues({ key: "lin_api_fake", fetchImpl });
  assert.deepEqual(result.issues[0], { id: "ENG-1", title: "Fix the login", state: "In Progress" });
  assert.equal(result.issues[1].title.length, 100);
  assert.equal(result.issues[1].state, "");
  assert.equal(seen.url, "https://api.linear.app/graphql");
  assert.equal(seen.init.headers.authorization, "lin_api_fake");
  assert.ok(!/mutation/i.test(seen.init.body), "only a read query is ever sent");
});

test("errors become fixed sentences that never contain the key", async () => {
  const key = "lin_api_SECRET";
  assert.deepEqual(await fetchLinearIssues({ key, fetchImpl: reply(401, {}) }), { ok: false, error: LINEAR_FAILED.key });
  assert.deepEqual(await fetchLinearIssues({ key, fetchImpl: reply(400, { errors: [{ message: `bad ${key}` }] }) }), { ok: false, error: LINEAR_FAILED.key });
  assert.deepEqual(await fetchLinearIssues({ key, fetchImpl: reply(200, { errors: [{ message: `bad ${key}` }] }) }), { ok: false, error: LINEAR_FAILED.key });
  assert.deepEqual(await fetchLinearIssues({ key, fetchImpl: reply(429, {}) }), { ok: false, error: LINEAR_FAILED.busy });
  assert.deepEqual(await fetchLinearIssues({ key, fetchImpl: reply(200, { data: {} }) }), { ok: false, error: LINEAR_FAILED.network });
  const thrown = await fetchLinearIssues({ key, fetchImpl: async () => { throw new Error(`boom ${key}`); } });
  assert.deepEqual(thrown, { ok: false, error: LINEAR_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
});
