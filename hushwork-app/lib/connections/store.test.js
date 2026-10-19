import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptText } from "./crypto.js";
import { loadAccess, removeConnection, saveConnection } from "./store.js";

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
  const result = await saveConnection({ supabase: db, provider: "linear", key, tokens: { accessToken: "ACCESS1", refreshToken: "REFRESH1", expiresAt: Date.parse("2030-01-01T00:00:00Z") } });
  assert.deepEqual(result, { ok: true });
  const row = db.rows[0];
  assert.ok(!JSON.stringify(row).includes("ACCESS1") && !JSON.stringify(row).includes("REFRESH1"), "nothing readable is stored");
  assert.equal(decryptText(row.access_token_enc, key), "ACCESS1");
  assert.equal(row.expires_at, "2030-01-01T00:00:00.000Z");
  await saveConnection({ supabase: db, provider: "linear", key, tokens: { accessToken: "ACCESS2", refreshToken: null, expiresAt: null } });
  assert.equal(db.rows.length, 1);
  assert.equal(decryptText(db.rows[0].access_token_enc, key), "ACCESS2");
  assert.equal(db.rows[0].refresh_token_enc, null);
});

test("loading gives the token back while it is fresh, and nothing for a person who never connected", async () => {
  const db = pretendDatabase();
  await saveConnection({ supabase: db, provider: "linear", key, tokens: { accessToken: "ACCESS1", refreshToken: "R1", expiresAt: 10 * 60_000 } });
  db.rows[0].user_id = "u1";
  assert.deepEqual(await loadAccess({ supabase: db, userId: "u1", provider: "linear", key, app, now: () => 0 }), { token: "ACCESS1" });
  assert.equal(await loadAccess({ supabase: db, userId: "someone-else", provider: "linear", key, app, now: () => 0 }), null);
});

test("an expired token is renewed, the new pair is saved scrambled, and a failed renewal gives nothing", async () => {
  const db = pretendDatabase();
  await saveConnection({ supabase: db, provider: "linear", key, tokens: { accessToken: "OLD", refreshToken: "R1", expiresAt: 1000 } });
  db.rows[0].user_id = "u1";
  const fetchImpl = async (_url, init) => {
    assert.equal(new URLSearchParams(init.body).get("refresh_token"), "R1");
    return { ok: true, status: 200, json: async () => ({ access_token: "NEW", refresh_token: "R2", expires_in: 86400 }) };
  };
  const result = await loadAccess({ supabase: db, userId: "u1", provider: "linear", key, app, now: () => 5_000_000, fetchImpl });
  assert.deepEqual(result, { token: "NEW" });
  assert.equal(decryptText(db.rows[0].access_token_enc, key), "NEW");
  assert.equal(decryptText(db.rows[0].refresh_token_enc, key), "R2");

  const db2 = pretendDatabase();
  await saveConnection({ supabase: db2, provider: "linear", key, tokens: { accessToken: "OLD", refreshToken: "R1", expiresAt: 1000 } });
  db2.rows[0].user_id = "u1";
  const refused = async () => ({ ok: false, status: 400, json: async () => ({}) });
  assert.equal(await loadAccess({ supabase: db2, userId: "u1", provider: "linear", key, app, now: () => 5_000_000, fetchImpl: refused }), null);
  const noRefresh = pretendDatabase();
  await saveConnection({ supabase: noRefresh, provider: "linear", key, tokens: { accessToken: "OLD", refreshToken: null, expiresAt: 1000 } });
  noRefresh.rows[0].user_id = "u1";
  assert.equal(await loadAccess({ supabase: noRefresh, userId: "u1", provider: "linear", key, app, now: () => 5_000_000 }), null);
});

test("a changed scrambling key means 'not connected', not a crash or a wrong token", async () => {
  const db = pretendDatabase();
  await saveConnection({ supabase: db, provider: "linear", key, tokens: { accessToken: "A", refreshToken: "R", expiresAt: 10 * 60_000 } });
  db.rows[0].user_id = "u1";
  assert.equal(await loadAccess({ supabase: db, userId: "u1", provider: "linear", key: randomBytes(32).toString("base64"), app, now: () => 0 }), null);
});

test("disconnecting asks Linear to cancel the permission and removes the row", async () => {
  const db = pretendDatabase();
  await saveConnection({ supabase: db, provider: "linear", key, tokens: { accessToken: "ACCESS1", refreshToken: "R1", expiresAt: 10 * 60_000 } });
  db.rows[0].user_id = "u1";
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return { ok: true }; };
  assert.deepEqual(await removeConnection({ supabase: db, userId: "u1", provider: "linear", key, fetchImpl }), { ok: true });
  assert.equal(db.rows.length, 0);
  assert.deepEqual(urls, ["https://api.linear.app/oauth/revoke"]);
});

test("Google: an expired token is renewed and the OLD refresh token is kept (Google sends no new one); revoking goes to Google", async () => {
  const db = pretendDatabase();
  await saveConnection({ supabase: db, provider: "google", key, tokens: { accessToken: "OLD", refreshToken: "GR1", expiresAt: 1000 } });
  db.rows[0].user_id = "u1";
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return { ok: true, status: 200, json: async () => ({ access_token: "NEW", expires_in: 3599 }) }; };
  assert.deepEqual(await loadAccess({ supabase: db, userId: "u1", provider: "google", key, app, now: () => 5_000_000, fetchImpl }), { token: "NEW" });
  assert.equal(decryptText(db.rows[0].refresh_token_enc, key), "GR1");
  assert.equal(urls[0], "https://oauth2.googleapis.com/token");
  db.rows[0].expires_at = new Date(10 * 60_000).toISOString();
  assert.deepEqual(await removeConnection({ supabase: db, userId: "u1", provider: "google", key, fetchImpl }), { ok: true });
  assert.equal(urls.at(-1), "https://oauth2.googleapis.com/revoke");
});

test("one person can hold a Linear and a Google connection side by side, and an unknown app is refused everywhere", async () => {
  const db = pretendDatabase();
  await saveConnection({ supabase: db, provider: "linear", key, tokens: { accessToken: "L", refreshToken: null, expiresAt: null } });
  await saveConnection({ supabase: db, provider: "google", key, tokens: { accessToken: "G", refreshToken: null, expiresAt: null } });
  db.rows.forEach((row) => { row.user_id = "u1"; });
  assert.equal(db.rows.length, 2);
  assert.deepEqual(await loadAccess({ supabase: db, userId: "u1", provider: "google", key, app }), { token: "G" });
  assert.deepEqual(await loadAccess({ supabase: db, userId: "u1", provider: "linear", key, app }), { token: "L" });
  for (const bad of ["slack", "__proto__", "constructor", "", null, undefined, 5]) {
    assert.deepEqual(await saveConnection({ supabase: db, provider: bad, key, tokens: { accessToken: "x" } }), { ok: false, code: "unknown_app" });
    assert.equal(await loadAccess({ supabase: db, userId: "u1", provider: bad, key, app }), null);
    assert.deepEqual(await removeConnection({ supabase: db, userId: "u1", provider: bad, key }), { ok: false });
  }
  assert.equal(db.rows.length, 2);
});

test("two requests renewing at once: when the renewal fails because the other request just saved a fresh token, that fresh token is used", async () => {
  const db = pretendDatabase();
  await saveConnection({ supabase: db, provider: "linear", key, tokens: { accessToken: "OLD", refreshToken: "R1", expiresAt: 1000 } });
  db.rows[0].user_id = "u1";
  // The renewal is refused (the other request already used refresh token R1). Meanwhile that request saved a new token.
  const fetchImpl = async () => {
    const { encryptText } = await import("./crypto.js");
    // a NEW row object, like a real database would return (not the same object the first read got)
    db.rows[0] = { ...db.rows[0], access_token_enc: encryptText("FRESH", key), expires_at: new Date(10_000_000).toISOString() };
    return { ok: false, status: 400, json: async () => ({}) };
  };
  assert.deepEqual(await loadAccess({ supabase: db, userId: "u1", provider: "linear", key, app, now: () => 5_000_000, fetchImpl }), { token: "FRESH" });
  // But when nobody saved anything new, a refused renewal still means "not connected".
  const db2 = pretendDatabase();
  await saveConnection({ supabase: db2, provider: "linear", key, tokens: { accessToken: "OLD", refreshToken: "R1", expiresAt: 1000 } });
  db2.rows[0].user_id = "u1";
  const refused = async () => ({ ok: false, status: 400, json: async () => ({}) });
  assert.equal(await loadAccess({ supabase: db2, userId: "u1", provider: "linear", key, app, now: () => 5_000_000, fetchImpl: refused }), null);
});
