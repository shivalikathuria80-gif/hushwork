import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptText } from "./crypto.js";
import { loadLinearAccess, removeLinearConnection, saveLinearConnection } from "./linear-store.js";

const key = randomBytes(32).toString("base64");
const app = { clientId: "cid", clientSecret: "sec" };

// A pretend database with just enough of Supabase's query style for these functions. One table, rows kept in `rows`.
function pretendDatabase(rows = []) {
  const calls = [];
  const api = {
    rows, calls,
    from(table) {
      assert.equal(table, "connections");
      const state = { filters: {} };
      const builder = {
        select() { return builder; },
        eq(column, value) { state.filters[column] = value; return builder; },
        limit() { return Promise.resolve({ data: rows.filter((row) => Object.entries(state.filters).every(([c, v]) => row[c] === v)), error: null }); },
        // Like the real table: a person can add a row, but there is no permission to "upsert" (change the provider column).
        insert(row) { calls.push(["insert", row]); rows.push({ user_id: "u1", ...row }); return Promise.resolve({ error: null }); },
        upsert() { throw new Error("upsert is not allowed on connections"); },
        update(values) { state.update = values; return builder; },
        delete() { state.delete = true; return builder; },
        then(resolve) {
          const hit = rows.filter((row) => Object.entries(state.filters).every(([c, v]) => row[c] === v));
          if (state.update) { calls.push(["update", state.update]); hit.forEach((row) => Object.assign(row, state.update)); }
          if (state.delete) { calls.push(["delete"]); for (const row of hit) rows.splice(rows.indexOf(row), 1); }
          resolve({ error: null });
        },
      };
      return builder;
    },
  };
  return api;
}

test("saving scrambles both tokens, and a second save replaces the first", async () => {
  const db = pretendDatabase();
  const result = await saveLinearConnection({ supabase: db, key, tokens: { accessToken: "ACCESS1", refreshToken: "REFRESH1", expiresAt: Date.parse("2030-01-01T00:00:00Z") } });
  assert.deepEqual(result, { ok: true });
  const row = db.rows[0];
  assert.ok(!JSON.stringify(row).includes("ACCESS1") && !JSON.stringify(row).includes("REFRESH1"), "nothing readable is stored");
  assert.equal(decryptText(row.access_token_enc, key), "ACCESS1");
  assert.equal(row.expires_at, "2030-01-01T00:00:00.000Z");
  await saveLinearConnection({ supabase: db, key, tokens: { accessToken: "ACCESS2", refreshToken: null, expiresAt: null } });
  assert.equal(db.rows.length, 1);
  assert.equal(decryptText(db.rows[0].access_token_enc, key), "ACCESS2");
  assert.equal(db.rows[0].refresh_token_enc, null);
});

test("loading gives the token back while it is fresh, and nothing for a person who never connected", async () => {
  const db = pretendDatabase();
  await saveLinearConnection({ supabase: db, key, tokens: { accessToken: "ACCESS1", refreshToken: "R1", expiresAt: 10 * 60_000 } });
  db.rows[0].user_id = "u1";
  assert.deepEqual(await loadLinearAccess({ supabase: db, userId: "u1", key, app, now: () => 0 }), { token: "ACCESS1" });
  assert.equal(await loadLinearAccess({ supabase: db, userId: "someone-else", key, app, now: () => 0 }), null);
});

test("an expired token is renewed, the new pair is saved scrambled, and a failed renewal gives nothing", async () => {
  const db = pretendDatabase();
  await saveLinearConnection({ supabase: db, key, tokens: { accessToken: "OLD", refreshToken: "R1", expiresAt: 1000 } });
  db.rows[0].user_id = "u1";
  const fetchImpl = async (_url, init) => {
    assert.equal(new URLSearchParams(init.body).get("refresh_token"), "R1");
    return { ok: true, status: 200, json: async () => ({ access_token: "NEW", refresh_token: "R2", expires_in: 86400 }) };
  };
  const result = await loadLinearAccess({ supabase: db, userId: "u1", key, app, now: () => 5_000_000, fetchImpl });
  assert.deepEqual(result, { token: "NEW" });
  assert.equal(decryptText(db.rows[0].access_token_enc, key), "NEW");
  assert.equal(decryptText(db.rows[0].refresh_token_enc, key), "R2");

  const db2 = pretendDatabase();
  await saveLinearConnection({ supabase: db2, key, tokens: { accessToken: "OLD", refreshToken: "R1", expiresAt: 1000 } });
  db2.rows[0].user_id = "u1";
  const refused = async () => ({ ok: false, status: 400, json: async () => ({}) });
  assert.equal(await loadLinearAccess({ supabase: db2, userId: "u1", key, app, now: () => 5_000_000, fetchImpl: refused }), null);
  const noRefresh = pretendDatabase();
  await saveLinearConnection({ supabase: noRefresh, key, tokens: { accessToken: "OLD", refreshToken: null, expiresAt: 1000 } });
  noRefresh.rows[0].user_id = "u1";
  assert.equal(await loadLinearAccess({ supabase: noRefresh, userId: "u1", key, app, now: () => 5_000_000 }), null);
});

test("a changed scrambling key means 'not connected', not a crash or a wrong token", async () => {
  const db = pretendDatabase();
  await saveLinearConnection({ supabase: db, key, tokens: { accessToken: "A", refreshToken: "R", expiresAt: 10 * 60_000 } });
  db.rows[0].user_id = "u1";
  assert.equal(await loadLinearAccess({ supabase: db, userId: "u1", key: randomBytes(32).toString("base64"), app, now: () => 0 }), null);
});

test("disconnecting asks Linear to cancel the permission and removes the row", async () => {
  const db = pretendDatabase();
  await saveLinearConnection({ supabase: db, key, tokens: { accessToken: "ACCESS1", refreshToken: "R1", expiresAt: 10 * 60_000 } });
  db.rows[0].user_id = "u1";
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return { ok: true }; };
  assert.deepEqual(await removeLinearConnection({ supabase: db, userId: "u1", key, fetchImpl }), { ok: true });
  assert.equal(db.rows.length, 0);
  assert.deepEqual(urls, ["https://api.linear.app/oauth/revoke"]);
});
