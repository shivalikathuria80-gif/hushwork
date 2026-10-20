import test from "node:test";
import assert from "node:assert/strict";
import { authorizeUrl, exchangeCode, refreshTokens, revokeToken } from "./oauth-app.js";
import { APP_LIST, findApp, APP_IDS } from "./app-list.js";
import { OAUTH_FAILED } from "./oauth-common.js";

const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const linear = findApp("linear");
const google = findApp("google");

test("the list: ids are short lowercase names, each entry is complete, every address is https, and a made-up id is not found", () => {
  assert.deepEqual(APP_IDS, ["linear", "google"]);
  for (const entry of APP_LIST) {
    assert.match(entry.id, /^[a-z][a-z0-9_]{1,30}$/);
    assert.match(entry.envPrefix, /^[A-Z][A-Z0-9]+$/);
    for (const key of ["name", "heading", "about"]) assert.ok(entry[key] && typeof entry[key] === "string", `${entry.id}.${key}`);
    for (const key of ["authorizeUrl", "tokenUrl", "revokeUrl"]) assert.match(entry[key], /^https:\/\/[a-z0-9.]+\//, `${entry.id}.${key}`);
    assert.ok(Array.isArray(entry.scopes) && entry.scopes.length > 0);
    assert.ok(entry.setup.intro && entry.setup.steps.length > 0);
  }
  assert.equal(new Set(APP_IDS).size, APP_IDS.length, "ids are unique");
  assert.equal(new Set(APP_LIST.map((entry) => entry.envPrefix)).size, APP_LIST.length, "setting names are unique");
  for (const bad of ["", "nope", "__proto__", "constructor", "LINEAR", 5, null, undefined, {}]) assert.equal(findApp(bad), null, String(bad));
});

test("Linear's sign-in address asks for read access only and carries the state", () => {
  const url = new URL(authorizeUrl(linear, { clientId: "cid", redirectUri: "http://localhost:3100/api/connect/linear/callback", state: "abc" }));
  assert.equal(url.origin + url.pathname, "https://linear.app/oauth/authorize");
  assert.equal(url.searchParams.get("scope"), "read");
  assert.equal(url.searchParams.get("state"), "abc");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3100/api/connect/linear/callback");
  assert.equal(url.searchParams.get("prompt"), "consent");
});

test("Google's sign-in address asks for exactly four permissions (read the calendar, add rows to sheets, read the inbox, see file names), offline renewal and the state", () => {
  const url = new URL(authorizeUrl(google, { clientId: "cid", redirectUri: "http://localhost:3100/api/connect/google/callback", state: "abc" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  const three = ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/drive.metadata.readonly"];
  assert.equal(url.searchParams.get("scope"), three.join(" "));
  assert.deepEqual(google.scopes, three);
  assert.ok(!/auth\/drive(?:\.|\s|$)(?!metadata\.readonly)|gmail\.(?:send|modify|compose|insert|labels|settings)|mail\.google\.com/.test(url.searchParams.get("scope")), "no permission to send, change or delete mail, and Drive is names only");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "abc");
});

test("swapping the code sends a form to the app's token address and reads the tokens and when they run out (every app)", async () => {
  for (const entry of APP_LIST) {
    let seen;
    const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ access_token: "A", refresh_token: "R", expires_in: 3599 }) }; };
    const result = await exchangeCode(entry, { clientId: "cid", clientSecret: "sec", redirectUri: "http://x/cb", code: "code1", fetchImpl, now: () => 1000 });
    assert.deepEqual(result, { ok: true, accessToken: "A", refreshToken: "R", expiresAt: 1000 + 3599 * 1000 }, entry.id);
    assert.equal(seen.url, entry.tokenUrl);
    assert.equal(seen.init.headers["content-type"], "application/x-www-form-urlencoded");
    const body = new URLSearchParams(seen.init.body);
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("code"), "code1");
    assert.equal(body.get("client_secret"), "sec");
  }
});

test("refreshing sends the refresh token; a renewal answer without a new refresh token is fine", async () => {
  let body;
  const fetchImpl = async (_url, init) => { body = new URLSearchParams(init.body); return { ok: true, status: 200, json: async () => ({ access_token: "A2", expires_in: 100 }) }; };
  const result = await refreshTokens(google, { clientId: "cid", clientSecret: "sec", refreshToken: "R1", fetchImpl, now: () => 0 });
  assert.deepEqual(result, { ok: true, accessToken: "A2", refreshToken: null, expiresAt: 100000 });
  assert.equal(body.get("grant_type"), "refresh_token");
  assert.equal(body.get("refresh_token"), "R1");
});

test("bad answers and errors become fixed sentences that never hold a secret", async () => {
  const args = { clientId: "cid", clientSecret: "SECRET", redirectUri: "http://x/cb", code: "c" };
  assert.deepEqual(await exchangeCode(linear, { ...args, fetchImpl: reply(400, { error: "invalid_grant SECRET" }) }), { ok: false, error: OAUTH_FAILED.failed });
  assert.deepEqual(await exchangeCode(linear, { ...args, fetchImpl: reply(502, {}) }), { ok: false, error: OAUTH_FAILED.network });
  assert.deepEqual(await exchangeCode(linear, { ...args, fetchImpl: reply(200, {}) }), { ok: false, error: OAUTH_FAILED.failed });
  assert.deepEqual(await exchangeCode(linear, { ...args, fetchImpl: reply(200, { access_token: "x".repeat(2000) }) }), { ok: false, error: OAUTH_FAILED.failed });
  const thrown = await exchangeCode(google, { ...args, fetchImpl: async () => { throw new Error("boom SECRET"); } });
  assert.deepEqual(thrown, { ok: false, error: OAUTH_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
  const noExpiry = await exchangeCode(linear, { ...args, fetchImpl: reply(200, { access_token: "A", expires_in: "soon" }) });
  assert.deepEqual(noExpiry, { ok: true, accessToken: "A", refreshToken: null, expiresAt: null });
});

test("revoking never throws, even when the network is down, and goes to the app's own revoke address", async () => {
  for (const entry of APP_LIST) {
    await revokeToken(entry, { token: "T", fetchImpl: async () => { throw new Error("down"); } });
    let seen;
    await revokeToken(entry, { token: "T", fetchImpl: async (url, init) => { seen = { url, body: init.body }; return { ok: true }; } });
    assert.equal(seen.url, entry.revokeUrl);
    assert.equal(new URLSearchParams(seen.body).get("token"), "T");
  }
});

test("a brand-new app needs only a list entry: the same functions work for a pretend third app", async () => {
  const pretend = { id: "notes", authorizeUrl: "https://notes.example.com/allow", tokenUrl: "https://notes.example.com/token", revokeUrl: "https://notes.example.com/revoke", scopes: ["read", "list"] };
  const url = new URL(authorizeUrl(pretend, { clientId: "c", redirectUri: "http://x/cb", state: "s" }));
  assert.equal(url.searchParams.get("scope"), "read list");
  assert.equal(url.searchParams.get("prompt"), null, "no extra fields unless the entry asks for them");
  const seen = [];
  const fetchImpl = async (u) => { seen.push(u); return { ok: true, status: 200, json: async () => ({ access_token: "A" }) }; };
  assert.equal((await exchangeCode(pretend, { clientId: "c", clientSecret: "s", redirectUri: "http://x/cb", code: "c", fetchImpl })).ok, true);
  await revokeToken(pretend, { token: "T", fetchImpl });
  assert.deepEqual(seen, ["https://notes.example.com/token", "https://notes.example.com/revoke"]);
});
