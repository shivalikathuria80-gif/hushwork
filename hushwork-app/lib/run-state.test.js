import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { statesFromRows, stateOf, loadStepStates, stepStatus } from "./run-state.js";

const RUN = randomUUID();
const row = (fromStep, status, extra = {}, from = RUN) => ({ results: [{ status, from, fromStep, ...extra }] });

test("a record's status word becomes one of three states", () => {
  assert.equal(stateOf("failed"), "failed");
  assert.equal(stateOf("pending"), "pending");
  for (const word of ["done", undefined, "", "anything"]) assert.equal(stateOf(word), "done");
});

test("the NEWEST record of a step decides its state; stop notes only explain and never decide", () => {
  const states = statesFromRows([row(2, "pending"), row(2, "failed"), row(2, "pending"), row(3, "pending"), row(3, "done"), row(4, "pending"), row(4, "failed", { note: true, outcome: "Stopped" })], RUN);
  assert.equal(states.get(2).status, "pending");
  assert.equal(states.get(3).status, "done");
  assert.equal(states.get(4).status, "pending", "a note after a started record does not turn it into 'failed'");
  assert.equal(states.has(0), false, "no record means not tried");
});

test("records of other runs, with bad step numbers or without results are ignored", () => {
  const other = randomUUID();
  const states = statesFromRows([row(1, "done", {}, other), row(-1, "done"), row(100, "done"), row(1.5, "done"), { results: [] }, { results: null }, null, row(5, "done")], RUN);
  assert.deepEqual([...states.keys()], [5]);
  assert.equal(statesFromRows("nope", RUN).size, 0);
});

test("a database that cannot be asked gives 'cannot check' (never 'not tried'), and a bad run id is not even asked", async () => {
  const broken = { from: () => { throw new Error("down"); } };
  assert.equal(await loadStepStates(broken, "u", RUN), null);
  assert.deepEqual(await stepStatus(broken, "u", { id: RUN, stepIndex: 1 }), { error: true });
  let asked = false;
  const spy = { from: () => { asked = true; } };
  assert.equal(await loadStepStates(spy, "u", "not-an-id"), null);
  assert.equal(asked, false);
  const failing = { from: () => { const q = { select: () => q, eq: () => q, contains: () => q, order: () => q, limit: async () => ({ data: null, error: { code: "x" } }) }; return q; } };
  assert.equal(await loadStepStates(failing, "u", RUN), null);
});

test("the question is asked for this person's live records, with the run id handed over as JSON text", async () => {
  const seen = [];
  const q = { select: () => q, eq: (n, v) => { seen.push([n, v]); return q; }, contains: (n, v) => { seen.push([n, v]); return q; }, order: () => q, limit: async () => ({ data: [row(1, "done")], error: null }) };
  assert.deepEqual(await stepStatus({ from: () => q }, "u1", { id: RUN, stepIndex: 1 }), { status: "done" });
  assert.deepEqual(await stepStatus({ from: () => q }, "u1", { id: RUN, stepIndex: 7 }), { status: null });
  assert.deepEqual(seen.slice(0, 3), [["user_id", "u1"], ["mode", "live"], ["results", JSON.stringify([{ from: RUN }])]]);
});
