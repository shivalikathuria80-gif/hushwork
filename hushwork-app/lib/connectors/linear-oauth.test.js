import test from "node:test";
import assert from "node:assert/strict";
import { authorizeUrl, exchangeCode, refreshTokens, revokeToken, LINEAR_OAUTH_FAILED } from "./linear-oauth.js";

const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("the sign-in address asks for read access only and carries the state", () => {
  const url = new URL(authorizeUrl({ clientId: "cid", redirectUri: "http://localhost:3100/api/connect/linear/callback", state: "abc" }));
  assert.equal(url.origin + url.pathname, "https://linear.app/oauth/authorize");
  assert.equal(url.searchParams.get("scope"), "read");
  assert.equal(url.searchParams.get("state"), "abc");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3100/api/connect/linear/callback");
});

test("swapping the code sends a form to Linear and reads the tokens and when they run out", async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ access_token: "A", refresh_token: "R", expires_in: 86399 }) }; };
  const result = await exchangeCode({ clientId: "cid", clientSecret: "sec", redirectUri: "http://x/cb", code: "code1", fetchImpl, now: () => 1000 });
  assert.deepEqual(result, { ok: true, accessToken: "A", refreshToken: "R", expiresAt: 1000 + 86399 * 1000 });
  assert.equal(seen.url, "https://api.linear.app/oauth/token");
  assert.equal(seen.init.headers["content-type"], "application/x-www-form-urlencoded");
  const body = new URLSearchParams(seen.init.body);
  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(body.get("code"), "code1");
  assert.equal(body.get("client_secret"), "sec");
});

test("refreshing sends the refresh token and returns the new pair", async () => {
  let body;
  const fetchImpl = async (_url, init) => { body = new URLSearchParams(init.body); return { ok: true, status: 200, json: async () => ({ access_token: "A2", refresh_token: "R2", expires_in: 100 }) }; };
  const result = await refreshTokens({ clientId: "cid", clientSecret: "sec", refreshToken: "R1", fetchImpl, now: () => 0 });
  assert.deepEqual(result, { ok: true, accessToken: "A2", refreshToken: "R2", expiresAt: 100000 });
  assert.equal(body.get("grant_type"), "refresh_token");
  assert.equal(body.get("refresh_token"), "R1");
});

test("bad answers and errors become fixed sentences that never hold a secret", async () => {
  const args = { clientId: "cid", clientSecret: "SECRET", redirectUri: "http://x/cb", code: "c" };
  assert.deepEqual(await exchangeCode({ ...args, fetchImpl: reply(400, { error: "invalid_grant SECRET" }) }), { ok: false, error: LINEAR_OAUTH_FAILED.failed });
  assert.deepEqual(await exchangeCode({ ...args, fetchImpl: reply(502, {}) }), { ok: false, error: LINEAR_OAUTH_FAILED.network });
  assert.deepEqual(await exchangeCode({ ...args, fetchImpl: reply(200, {}) }), { ok: false, error: LINEAR_OAUTH_FAILED.failed });
  assert.deepEqual(await exchangeCode({ ...args, fetchImpl: reply(200, { access_token: "x".repeat(2000) }) }), { ok: false, error: LINEAR_OAUTH_FAILED.failed });
  const thrown = await exchangeCode({ ...args, fetchImpl: async () => { throw new Error("boom SECRET"); } });
  assert.deepEqual(thrown, { ok: false, error: LINEAR_OAUTH_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
  const noExpiry = await exchangeCode({ ...args, fetchImpl: reply(200, { access_token: "A", expires_in: "soon" }) });
  assert.deepEqual(noExpiry, { ok: true, accessToken: "A", refreshToken: null, expiresAt: null });
});

test("revoking never throws, even when the network is down", async () => {
  await revokeToken({ token: "T", fetchImpl: async () => { throw new Error("down"); } });
  let seen;
  await revokeToken({ token: "T", fetchImpl: async (url, init) => { seen = { url, body: init.body }; return { ok: true }; } });
  assert.equal(seen.url, "https://api.linear.app/oauth/revoke");
  assert.equal(new URLSearchParams(seen.body).get("token"), "T");
});
