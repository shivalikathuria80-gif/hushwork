import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { countWaiting, loadWaiting } from "./run-waiting.js";

const ai = { kind: "ai", title: "Ask the AI", fields: { task: "Sum it up", uses: "nothing", address: "" } };
const row = { kind: "issue", title: "Create a Linear task", fields: { title: "{answer}", details: "", team: "" } }; // a step that writes
const note = { title: "A note" };
const rec = (fromStep, status = "done", extra = {}) => ({ fromStep, status, ...extra });

test("a step that can be approved and has no record is waiting; done, stopped and unsure steps are not", () => {
  const plan = [note, ai, row, row, row];
  assert.equal(countWaiting(plan, []), 4);
  assert.equal(countWaiting(plan, [rec(1)]), 3, "the AI step ran");
  assert.equal(countWaiting(plan, [rec(1), rec(2, "failed"), rec(3, "pending")]), 1, "stopped and unsure steps are shown as such, not as waiting");
  assert.equal(countWaiting(plan, [rec(1), rec(2, "pending"), rec(2, "done"), rec(3), rec(4)]), 0);
  assert.equal(countWaiting([note], []), 0, "a plan-only step never waits");
});

test("a watch run that ended quietly has nothing waiting, and bad input counts nothing", () => {
  assert.equal(countWaiting([ai, row], [rec(0, "done", { quiet: true })]), 0);
  assert.equal(countWaiting(null, null), 0);
  assert.equal(countWaiting([ai], [null, { status: "done" }]), 1);
});

// A fake database client: it remembers each query's filters and answers from `answers` in order.
function fake(answers) {
  const asked = [];
  return {
    asked,
    from(table) {
      const q = { table, filters: [] };
      asked.push(q);
      const at = asked.length - 1;
      const chain = {
        select: (cols) => { q.cols = cols; return chain; },
        eq: (k, v) => { q.filters.push(["eq", k, v]); return chain; },
        in: (k, v) => { q.filters.push(["in", k, v]); return chain; },
        gte: (k, v) => { q.filters.push(["gte", k, v]); return chain; },
        order: () => chain,
        limit: async (n) => { q.limit = n; return answers[at]; },
      };
      return chain;
    },
  };
}

test("each agent's newest run is counted, and the queries are the person's own and bounded", async () => {
  const [w1, w2, r1, rOld, r2] = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const db = fake([
    { data: [
      { id: r1, workflow_id: w1, results: [ai, row], created_at: "2026-11-05T10:00:00Z" },
      { id: r2, workflow_id: w2, results: [ai], created_at: "2026-11-04T10:00:00Z" },
      { id: rOld, workflow_id: w1, results: [row, row, row], created_at: "2026-11-01T10:00:00Z" },
    ], error: null },
    { data: [
      { results: [{ status: "done", from: r1, fromStep: 0 }] },
      { results: [{ status: "done", from: r2, fromStep: 0 }] },
    ], error: null },
  ]);
  const waiting = await loadWaiting(db, "user-1", [w1, w2]);
  assert.deepEqual([...waiting], [[w1, { runId: r1, waiting: 1 }]], "an agent with nothing waiting is left out");
  for (const q of db.asked) {
    assert.ok(q.filters.some(([op, k, v]) => op === "eq" && k === "user_id" && v === "user-1"));
    assert.ok(q.limit > 0 && q.limit <= 300);
  }
  assert.deepEqual(db.asked[1].filters.find(([op]) => op === "gte"), ["gte", "created_at", "2026-11-04T10:00:00Z"]);
});

test("any failure, or too many records to be sure, shows no count", async () => {
  const w = randomUUID();
  const run = { data: [{ id: randomUUID(), workflow_id: w, results: [ai], created_at: "2026-11-05T10:00:00Z" }], error: null };
  assert.equal((await loadWaiting(fake([{ data: null, error: { code: "x" } }]), "u", [w])).size, 0);
  assert.equal((await loadWaiting(fake([run, { data: null, error: { code: "x" } }]), "u", [w])).size, 0);
  assert.equal((await loadWaiting(fake([run, { data: Array.from({ length: 300 }, () => ({ results: [] })), error: null }]), "u", [w])).size, 0);
  assert.equal((await loadWaiting({ from: () => { throw new Error("down"); } }, "u", [w])).size, 0);
  const none = fake([]);
  assert.equal((await loadWaiting(none, "u", [])).size, 0);
  assert.equal(none.asked.length, 0, "no agents, no query");
});
