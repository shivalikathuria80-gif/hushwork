import test from "node:test";
import assert from "node:assert/strict";
import { createIssue, LINEAR_CREATE_FAILED } from "./linear-create.js";

const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TEAM_B = "22222222-2222-4222-8222-222222222222";
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// A pretend Linear: answers the teams question and the create request, and remembers what it was sent.
function linear({ teams = [{ id: TEAM_A, key: "ENG" }, { id: TEAM_B, key: "OPS" }], create } = {}) {
  const sent = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ url, init, body });
    if (body.query.startsWith("query")) return json({ data: { teams: { nodes: teams } } });
    return create ? create(body) : json({ data: { issueCreate: { success: true, issue: { identifier: "ENG-42", url: "https://linear.app/acme/issue/ENG-42/x" } } } });
  };
  return { fetchImpl, sent };
}

test("creates one task in the first team, sending the title and details as separate values", async () => {
  const { fetchImpl, sent } = linear();
  const result = await createIssue({ authorization: "Bearer tok", title: "  Reply to   Ana ", details: "She asked\nabout the invoice", fetchImpl });
  assert.deepEqual(result, { ok: true, id: "ENG-42", url: "https://linear.app/acme/issue/ENG-42/x" });
  assert.equal(sent.length, 2);
  assert.ok(sent.every((entry) => entry.url === "https://api.linear.app/graphql" && entry.init.method === "POST" && entry.init.headers.authorization === "Bearer tok"));
  assert.match(sent[1].body.query, /issueCreate/);
  assert.deepEqual(sent[1].body.variables, { input: { teamId: TEAM_A, title: "Reply to Ana", description: "She asked\nabout the invoice" } });
  assert.ok(!sent[1].body.query.includes("Reply to Ana"), "what is written is never part of the request text");
});

test("a team key picks that team (any capitals); an unknown or odd key is refused before anything is created", async () => {
  const picked = linear();
  await createIssue({ authorization: "k", title: "t", team: "ops", fetchImpl: picked.fetchImpl });
  assert.equal(picked.sent[1].body.variables.input.teamId, TEAM_B);
  const none = linear();
  assert.deepEqual(await createIssue({ authorization: "k", title: "t", team: "NOPE", fetchImpl: none.fetchImpl }), { ok: false, error: LINEAR_CREATE_FAILED.team });
  assert.equal(none.sent.length, 1, "only the teams question was sent");
  const odd = linear();
  assert.deepEqual(await createIssue({ authorization: "k", title: "t", team: "E N G!", fetchImpl: odd.fetchImpl }), { ok: false, error: LINEAR_CREATE_FAILED.team });
  assert.equal(odd.sent.length, 0);
  assert.deepEqual(await createIssue({ authorization: "k", title: "t", fetchImpl: linear({ teams: [] }).fetchImpl }), { ok: false, error: LINEAR_CREATE_FAILED.team });
  assert.deepEqual(await createIssue({ authorization: "k", title: "t", fetchImpl: linear({ teams: [{ id: "../x", key: "ENG" }] }).fetchImpl }), { ok: false, error: LINEAR_CREATE_FAILED.team });
});

test("an empty title sends nothing; long text is cut; the url is kept only if it is a linear.app address", async () => {
  const empty = linear();
  assert.equal((await createIssue({ authorization: "k", title: "   ", fetchImpl: empty.fetchImpl })).ok, false);
  assert.equal(empty.sent.length, 0);
  const long = linear();
  await createIssue({ authorization: "k", title: "x".repeat(500), details: "y".repeat(5000), fetchImpl: long.fetchImpl });
  assert.equal(long.sent[1].body.variables.input.title.length, 200);
  assert.equal(long.sent[1].body.variables.input.description.length, 1500);
  const evil = linear({ create: () => json({ data: { issueCreate: { success: true, issue: { identifier: "ENG-1", url: "https://evil.example/x" } } } }) });
  assert.deepEqual(await createIssue({ authorization: "k", title: "t", fetchImpl: evil.fetchImpl }), { ok: true, id: "ENG-1", url: "" });
});

test("a refused permission, a busy Linear, a half answer and a network error become fixed sentences", async () => {
  const token = "Bearer lin_oauth_SECRET";
  const reply = (status) => async () => json({}, status);
  assert.deepEqual(await createIssue({ authorization: token, title: "t", fetchImpl: reply(401) }), { ok: false, error: LINEAR_CREATE_FAILED.auth });
  assert.deepEqual(await createIssue({ authorization: token, title: "t", fetchImpl: reply(429) }), { ok: false, error: LINEAR_CREATE_FAILED.busy });
  assert.deepEqual(await createIssue({ authorization: token, title: "t", fetchImpl: async () => json({ errors: [{ message: "SECRET detail" }] }) }), { ok: false, error: LINEAR_CREATE_FAILED.auth });
  const refused = linear({ create: () => json({ errors: [{ message: "forbidden SECRET" }] }) });
  assert.deepEqual(await createIssue({ authorization: token, title: "t", fetchImpl: refused.fetchImpl }), { ok: false, error: LINEAR_CREATE_FAILED.auth });
  const half = linear({ create: () => json({ data: { issueCreate: { success: false } } }) });
  assert.deepEqual(await createIssue({ authorization: token, title: "t", fetchImpl: half.fetchImpl }), { ok: false, error: LINEAR_CREATE_FAILED.network });
  const thrown = await createIssue({ authorization: token, title: "t", fetchImpl: async () => { throw new Error(`boom ${token}`); } });
  assert.deepEqual(thrown, { ok: false, error: LINEAR_CREATE_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
});
