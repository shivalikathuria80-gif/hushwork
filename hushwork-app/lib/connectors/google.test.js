import test from "node:test";
import assert from "node:assert/strict";
import { fetchUpcomingEvents, CALENDAR_FAILED } from "./google-calendar.js";

const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

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
