// Run with: npm test   (or: node --test lib/ai/provider.test.js)
import test from "node:test";
import assert from "node:assert/strict";
import { writePlan } from "./provider.js";
import { blockRealFetch } from "./test-support.js";

blockRealFetch();

const keys = { groqKey: "not-a-real-key" };
const good = { ok: true, steps: [{ icon: "Clock", title: "t", detail: "d" }], usage: { in: 1, out: 1, reasoning: 0 } };

test("a good answer from the first company is passed straight through", async () => {
  let secondCalled = false;
  const result = await writePlan("x", keys, [async () => good, async () => { secondCalled = true; return good; }]);
  assert.equal(result, good);
  assert.equal(secondCalled, false);
});

test("trouble (busy, timeout, retired model) falls through to the next company", async () => {
  for (const why of ["busy", "timeout", "model_missing"]) {
    const result = await writePlan("x", keys, [async () => ({ ok: false, why }), async () => good]);
    assert.equal(result.ok, true, why);
  }
});

test("other failures stop right there (the next company is not asked)", async () => {
  for (const why of ["auth", "rejected", "unusable", "refused", "off"]) {
    let secondCalled = false;
    const result = await writePlan("x", keys, [async () => ({ ok: false, why }), async () => { secondCalled = true; return good; }]);
    assert.deepEqual([result.ok, result.why, secondCalled], [false, why, false], why);
  }
});

test("if every company is in trouble the last answer is returned; with none, AI is off", async () => {
  const result = await writePlan("x", keys, [async () => ({ ok: false, why: "busy" }), async () => ({ ok: false, why: "timeout" })]);
  assert.equal(result.why, "timeout");
  assert.deepEqual(await writePlan("x", keys, []), { ok: false, why: "off" });
});

test("the real list holds Groq only, and with no key it is off without any network call", async () => {
  assert.deepEqual(await writePlan("x", {}), { ok: false, why: "off" });
});
