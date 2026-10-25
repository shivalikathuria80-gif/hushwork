import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRun } from "./run-summary.js";
import { findSkill, BUNDLES, buildWorkflow } from "../skills/bundles.js";

const maps = (done = [], stopped = {}, unknown = []) => ({
  doneAt: new Map(done.map((i) => [i, { status: "done" }])),
  stoppedAt: new Map(Object.entries(stopped).map(([i, outcome]) => [Number(i), { status: "failed", outcome }])),
  unknownAt: new Map(unknown.map((i) => [i, { status: "pending" }])),
});
const chaser = () => buildWorkflow(BUNDLES[0], BUNDLES[0].workflows[0]).steps; // Start, Stripe invoices, Gmail clients, reminder draft, approve, email

test("run summary: nothing has run yet, and a run with nothing that can run says nothing", () => {
  const steps = chaser();
  assert.deepEqual(summarizeRun({ steps, ...maps() }), { line: "Nothing has run yet: 4 steps are waiting for your approval.", state: "waiting" });
  assert.deepEqual(summarizeRun({ steps: [], ...maps() }), { line: "", state: "empty" });
  assert.deepEqual(summarizeRun({ steps: [{ icon: "Zap", title: "x", detail: "y" }], ...maps() }), { line: "", state: "empty" });
  assert.deepEqual(summarizeRun({ steps: undefined, ...maps() }), { line: "", state: "empty" });
});

test("run summary: a finished run says what was looked at, written and sent, in steps (never made-up item counts)", () => {
  const steps = chaser();
  const all = summarizeRun({ steps, ...maps([1, 2, 3, 5]) });
  assert.equal(all.state, "done");
  assert.equal(all.line, "All 4 steps done: looked in Stripe and Google, the AI wrote 1 text and sent 1 email.");
  assert.ok(!/\b\d+ (files|emails|payments|invoices)\b/.test(all.line.replace(/1 email\./, "")), "no item counts it cannot know");
});

test("run summary: a stop names the step and the saved reason; an unknown step says check before trying again; waiting steps are counted", () => {
  const steps = chaser();
  const stopped = summarizeRun({ steps, ...maps([1], { 2: "Google is not connected yet. Open Connections and press Connect Google." }) });
  assert.equal(stopped.state, "stopped");
  assert.equal(stopped.line, "1 of 4 steps done: looked in Stripe. 1 step could not run: step 3 (Google is not connected yet. Open Connections and press Connect Google.). 2 still wait for your approval.");
  const unsure = summarizeRun({ steps, ...maps([1, 2, 3], {}, [5]) });
  assert.equal(unsure.state, "unsure");
  assert.match(unsure.line, /Step 6 may or may not have happened: check the app before trying it again\./);
  assert.match(summarizeRun({ steps, ...maps([1], { 2: "x".repeat(300) }) }).line, /\(x{89}…\)/, "a long reason is cut");
});

test("run summary: a step that failed and was later done counts as done only, and many writes are added up", () => {
  const steps = chaser();
  const both = summarizeRun({ steps, doneAt: new Map([[1, {}], [2, {}], [3, {}], [5, {}]]), stoppedAt: new Map([[5, { outcome: "old failure" }]]), unknownAt: new Map() });
  assert.equal(both.state, "done");
  assert.ok(!both.line.includes("old failure"));
  const two = [{ ...findSkill("email-me").step, kind: "action", fields: { action: "gmail_send", target: "a@b.co", title: "x", details: "y" } }, { kind: "action", fields: { action: "gmail_send", target: "c@d.co", title: "x", details: "y" } }, { kind: "issue", fields: { title: "t", details: "", team: "" } }];
  assert.equal(summarizeRun({ steps: two, ...maps([0, 1, 2]) }).line, "All 3 steps done: sent 2 emails and created 1 Linear task.");
});
