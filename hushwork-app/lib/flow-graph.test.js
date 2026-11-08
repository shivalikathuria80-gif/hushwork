import { test } from "node:test";
import assert from "node:assert/strict";
import { nodeFor, nodesFor, planLines, logoId } from "./flow-graph.js";
import { runRows } from "./builder-runs.js";

const row = (key, kind, fields) => ({ key, icon: "Zap", title: "", detail: "", kind, fields });

test("the Start step is the start card", () => {
  const node = nodeFor(row(1, "trigger", { how: "schedule", when: "every weekday at 9am" }), 0);
  assert.equal(node.start, true);
  assert.equal(node.title, "every weekday at 9am");
  assert.equal(node.sub, "On a schedule");
});

test("an AI step has a looks-at side card and the model card", () => {
  const node = nodeFor(row(2, "ai", { task: "Sum up my week", uses: "calendar", address: "" }), 1);
  assert.equal(node.tone, "ai");
  assert.deepEqual(node.bullets, ["Sum up my week"]);
  assert.deepEqual(node.sides.map((s) => s.label), ["looks at", "model"]);
  assert.equal(node.sides[0].logo, "calendar");
  const alone = nodeFor(row(3, "ai", { task: "Think", uses: "nothing", address: "" }), 1);
  assert.deepEqual(alone.sides.map((s) => s.label), ["model"]);
});

test("an approval is a fork, and a real email shows Gmail", () => {
  assert.ok(nodeFor(row(4, "approve", { what: "" }), 2).fork);
  const email = nodeFor(row(5, "action", { action: "gmail_send", target: "a@b.co", title: "Hello", details: "" }), 3);
  assert.equal(email.logo, "gmail");
  assert.equal(email.title, "Hello");
  assert.equal(email.tone, "write");
});

test("a note and odd rows never throw", () => {
  assert.equal(nodeFor({ key: 9, title: "Mine", detail: "" }, 0).title, "Mine");
  assert.equal(nodeFor(undefined, 0).tone, "note");
  assert.deepEqual(nodesFor(null), []);
  assert.equal(logoId("gmailsend"), "gmail");
  assert.equal(logoId(undefined), null);
  assert.equal(planLines([row(1, "trigger", { how: "manual", when: "" })])[0], "Start: When I ask");
});

test("runRows reads the runs of one workflow, newest first, and skips junk", () => {
  const rows = runRows([
    { id: "a", mode: "practice", created_at: "2026-11-01T10:00:00Z", results: [{ title: "Start", status: "done" }] },
    { id: "b", mode: "live", created_at: "2026-11-02T10:00:00Z", results: [{ title: "Send", status: "failed" }] },
    { id: 5, mode: "practice" },
  ]);
  assert.deepEqual(rows.map((r) => r.id), ["b", "a"]);
  assert.equal(rows[0].tone, "bad");
  assert.equal(rows[0].live, true);
  assert.equal(rows[1].steps, 1);
});
