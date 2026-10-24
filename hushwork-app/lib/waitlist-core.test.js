import test from "node:test";
import assert from "node:assert/strict";
import { joinWaitlistCore } from "./waitlist-core.js";
import { makeLimiter } from "./ai/limits.js";

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const fresh = () => ({ perVisitor: makeLimiter({ max: 5, windowMs: 600_000 }), everyone: makeLimiter({ max: 100, windowMs: 3_600_000 }) });
const settings = { url: "https://example.supabase.co", key: "publishable-key" };
const answer = (status) => async (url, init) => { answer.last = { url, init }; return { ok: status >= 200 && status < 300, status }; };

test("waitlist: a good email is saved with the public key only; a duplicate and a failure are told apart", async () => {
  const base = { ...settings, email: " Ana@Example.com ", now: NOW, limits: fresh() };
  assert.equal(await joinWaitlistCore({ ...base, fetchImpl: answer(201) }), "ok");
  assert.equal(answer.last.url, "https://example.supabase.co/rest/v1/waitlist");
  assert.equal(answer.last.init.headers.apikey, "publishable-key");
  assert.deepEqual(JSON.parse(answer.last.init.body), { email: "Ana@Example.com" }, "trimmed, nothing else sent");
  assert.equal(await joinWaitlistCore({ ...base, fetchImpl: answer(409) }), "duplicate");
  assert.equal(await joinWaitlistCore({ ...base, fetchImpl: answer(500) }), "error");
  assert.equal(await joinWaitlistCore({ ...base, fetchImpl: async () => { throw new Error("offline"); } }), "error");
});

test("waitlist: bots, bad emails and a missing setup are stopped before any request is made", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, status: 201 }; };
  assert.equal(await joinWaitlistCore({ ...settings, email: "a@b.co", trap: "http://spam", limits: fresh(), fetchImpl }), "ok", "a bot is told ok");
  for (const email of ["", "nope", "a@b", "a b@c.de", "@c.de", "a@@c.de", undefined, null, 5, `${"a".repeat(250)}@b.co`]) assert.equal(await joinWaitlistCore({ ...settings, email, limits: fresh(), fetchImpl }), "invalid", String(email).slice(0, 20));
  assert.equal(await joinWaitlistCore({ email: "a@b.co", url: "", key: "", limits: fresh(), fetchImpl }), "not-connected");
  assert.equal(calls, 0, "nothing was sent to the database");
});

test("waitlist: 5 tries in 10 minutes per visitor and 100 an hour for everybody; another visitor and the next window are fine", async () => {
  const limits = fresh();
  const base = { ...settings, email: "a@b.co", now: NOW, limits, fetchImpl: answer(201) };
  for (let i = 0; i < 5; i += 1) assert.equal(await joinWaitlistCore({ ...base, visitor: "1.1.1.1" }), "ok");
  assert.equal(await joinWaitlistCore({ ...base, visitor: "1.1.1.1" }), "slow");
  assert.equal(await joinWaitlistCore({ ...base, visitor: "2.2.2.2" }), "ok", "somebody else is not affected");
  assert.equal(await joinWaitlistCore({ ...base, visitor: "1.1.1.1", now: NOW + 601_000 }), "ok", "ten minutes later it is allowed again");
  const crowd = fresh();
  for (let i = 0; i < 100; i += 1) assert.equal(await joinWaitlistCore({ ...base, limits: crowd, visitor: `10.0.0.${i}` }), "ok");
  assert.equal(await joinWaitlistCore({ ...base, limits: crowd, visitor: "10.9.9.9" }), "slow", "everybody together is capped too");
});
