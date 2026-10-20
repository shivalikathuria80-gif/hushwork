import test from "node:test";
import assert from "node:assert/strict";
import { findAnswer } from "./run-answer.js";

// A pretend database: remembers the filters it was given and answers with `rows`.
function pretend(rows, error = null) {
  const calls = [];
  const builder = { select: () => builder, eq: (name, value) => { calls.push([name, value]); return builder; }, gte: (name, value) => { calls.push([`>=${name}`, value]); return builder; }, order: () => builder, limit: async () => ({ data: rows, error }) };
  return { supabase: { from: (table) => { calls.push(["from", table]); return builder; } }, calls };
}
const run = { workflow_id: "w1", created_at: "2026-10-20T00:00:00Z" };

test("the answer is the newest real AI step of the same workflow saved after the practice run", async () => {
  const { supabase, calls } = pretend([
    { results: [{ kind: "row", outcome: "Added a row" }] },
    { results: [{ kind: "ai", outcome: "The AI answered: newest", answer: "Newest answer" }] },
    { results: [{ kind: "ai", answer: "Older answer" }] },
  ]);
  assert.equal(await findAnswer(supabase, "u1", run), "Newest answer");
  assert.deepEqual(calls, [["from", "runs"], ["user_id", "u1"], ["workflow_id", "w1"], ["mode", "live"], [">=created_at", run.created_at]]);
});

test("no answer when there is none, the data is odd, the database fails, or the run has no workflow", async () => {
  assert.equal(await findAnswer(pretend([]).supabase, "u1", run), "");
  assert.equal(await findAnswer(pretend([{ results: [{ kind: "ai", answer: "  " }] }, { results: "nope" }, { results: [null] }, {}]).supabase, "u1", run), "");
  assert.equal(await findAnswer(pretend(null, { code: "42P01" }).supabase, "u1", run), "");
  assert.equal(await findAnswer(pretend([{ results: [{ kind: "ai", answer: "x" }] }]).supabase, "u1", { created_at: run.created_at }), "");
  assert.equal(await findAnswer(pretend([{ results: [{ kind: "ai", answer: "x" }] }]).supabase, "u1", { workflow_id: "w1" }), "");
  assert.equal(await findAnswer(pretend([]).supabase, "u1", null), "");
});
