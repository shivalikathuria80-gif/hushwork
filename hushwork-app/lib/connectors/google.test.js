import test from "node:test";
import assert from "node:assert/strict";
import { authorizeUrl, exchangeCode, refreshTokens, revokeToken, GOOGLE_SCOPES } from "./google-oauth.js";
import { fetchUpcomingEvents, CALENDAR_FAILED } from "./google-calendar.js";
import { OAUTH_FAILED } from "./oauth-common.js";

const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("the Google sign-in address asks for exactly two permissions (read the calendar, add rows to sheets), offline renewal and the state", () => {
  const url = new URL(authorizeUrl({ clientId: "cid", redirectUri: "http://localhost:3100/api/connect/google/callback", state: "abc" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/spreadsheets");
  assert.deepEqual(GOOGLE_SCOPES, ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/spreadsheets"]);
  assert.ok(!url.searchParams.get("scope").includes("auth/calendar ") && !/gmail|drive/.test(url.searchParams.get("scope")), "no permission to change the calendar, read mail or reach Drive");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "abc");
  assert.equal(url.searchParams.get("response_type"), "code");
});

test("swapping the code and renewing talk to Google's token address; a renewal answer without a new refresh token is fine", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, body: new URLSearchParams(init.body) }); return { ok: true, status: 200, json: async () => ({ access_token: "A", expires_in: 3599 }) }; };
  const swapped = await exchangeCode({ clientId: "cid", clientSecret: "sec", redirectUri: "http://x/cb", code: "c1", fetchImpl, now: () => 0 });
  assert.deepEqual(swapped, { ok: true, accessToken: "A", refreshToken: null, expiresAt: 3599000 });
  const renewed = await refreshTokens({ clientId: "cid", clientSecret: "sec", refreshToken: "R1", fetchImpl, now: () => 0 });
  assert.equal(renewed.refreshToken, null);
  assert.equal(seen[0].url, "https://oauth2.googleapis.com/token");
  assert.equal(seen[0].body.get("grant_type"), "authorization_code");
  assert.equal(seen[1].body.get("grant_type"), "refresh_token");
  assert.equal(seen[1].body.get("refresh_token"), "R1");
});

test("Google errors become fixed sentences without secrets; revoking never throws", async () => {
  const args = { clientId: "cid", clientSecret: "SECRET", redirectUri: "http://x/cb", code: "c" };
  assert.deepEqual(await exchangeCode({ ...args, fetchImpl: reply(400, { error: "invalid_grant SECRET" }) }), { ok: false, error: OAUTH_FAILED.failed });
  assert.deepEqual(await exchangeCode({ ...args, fetchImpl: reply(503, {}) }), { ok: false, error: OAUTH_FAILED.network });
  const thrown = await exchangeCode({ ...args, fetchImpl: async () => { throw new Error("boom SECRET"); } });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
  await revokeToken({ token: "T", fetchImpl: async () => { throw new Error("down"); } });
  let seen;
  await revokeToken({ token: "T", fetchImpl: async (url, init) => { seen = { url, body: init.body }; return { ok: true }; } });
  assert.equal(seen.url, "https://oauth2.googleapis.com/revoke");
});

test("upcoming events: a GET for the next 7 days, soonest first, cut to short plain text", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url: new URL(url), init };
    return { ok: true, status: 200, json: async () => ({ items: [
      { summary: "  Maths   test ", start: { dateTime: "2026-10-20T09:00:00+05:30" } },
      { summary: "x".repeat(300), start: { date: "2026-10-21" } },
      { start: {} },
      null,
    ] }) };
  };
  const result = await fetchUpcomingEvents({ authorization: "Bearer tok", fetchImpl, now: () => Date.parse("2026-10-19T00:00:00Z") });
  assert.deepEqual(result.events[0], { start: "2026-10-20T09:00:00+05:30", title: "Maths test" });
  assert.equal(result.events[1].title.length, 100);
  assert.deepEqual(result.events[2], { start: "", title: "(no title)" });
  assert.equal(seen.init.method, "GET");
  assert.equal(seen.init.headers.authorization, "Bearer tok");
  assert.equal(seen.url.pathname, "/calendar/v3/calendars/primary/events");
  assert.equal(seen.url.searchParams.get("timeMin"), "2026-10-19T00:00:00.000Z");
  assert.equal(seen.url.searchParams.get("timeMax"), "2026-10-26T00:00:00.000Z");
  assert.equal(seen.url.searchParams.get("maxResults"), "10");
});

test("calendar errors become fixed sentences that never contain the token", async () => {
  const token = "Bearer ya29.SECRET";
  assert.deepEqual(await fetchUpcomingEvents({ authorization: token, fetchImpl: reply(401, {}) }), { ok: false, error: CALENDAR_FAILED.auth });
  assert.deepEqual(await fetchUpcomingEvents({ authorization: token, fetchImpl: reply(403, {}) }), { ok: false, error: CALENDAR_FAILED.auth });
  assert.deepEqual(await fetchUpcomingEvents({ authorization: token, fetchImpl: reply(429, {}) }), { ok: false, error: CALENDAR_FAILED.busy });
  assert.deepEqual(await fetchUpcomingEvents({ authorization: token, fetchImpl: reply(200, {}) }), { ok: false, error: CALENDAR_FAILED.network });
  const thrown = await fetchUpcomingEvents({ authorization: token, fetchImpl: async () => { throw new Error(`boom ${token}`); } });
  assert.deepEqual(thrown, { ok: false, error: CALENDAR_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
});
