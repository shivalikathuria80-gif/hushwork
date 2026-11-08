import test from "node:test";
import assert from "node:assert/strict";
import { buildItems, score, search, PAGES, ACTIONS } from "./palette.js";

const items = buildItems({
  workflows: [{ id: "w1", name: "Morning briefing", agent: true }, { id: "w2", name: "Chase overdue invoices" }, null, { id: "", name: "x" }],
  needsYou: [{ id: "r1", name: "Week at risk", tone: "you" }, { id: "r2", name: "Invoice chaser", tone: "bad" }],
});

test("items: needs you first, then pages, runs and actions; bad rows are skipped", () => {
  assert.equal(items.length, 2 + PAGES.length + 2 + ACTIONS.length);
  assert.deepEqual(items.slice(0, 2).map((item) => item.href), ["/app/runs?run=r1", "/app/runs?run=r2"]);
  const run = items.find((item) => item.workflowId === "w1");
  assert.equal(run.title, 'Run "Morning briefing"');
  assert.equal(run.action, "run");
});

test("score prefers exact, then starts, then word starts, then letters in order", () => {
  assert.ok(score("Runs", "runs") > score("Runs page", "runs"));
  assert.ok(score("Runs page", "runs") > score("Your runs", "runs"));
  assert.ok(score("Your runs", "runs") > score("Yourruns", "runs"));
  assert.ok(score("new workflow", "nwf") > 0);
  assert.equal(score("Home", "zz"), 0);
  assert.equal(score("Home", ""), 1);
});

test("search ranks the best match first and finds things by their extra words", () => {
  assert.deepEqual(search(items, "invoice").map((item) => item.id).sort(), ["need:r2", "run:w2"]);
  assert.equal(search(items, "gmail")[0].id, "page:connections");
  assert.equal(search(items, "dark")[0].id, "do:theme");
  assert.equal(search(items, "qqqq").length, 0);
});

test("with no search the run list is cut to 5", () => {
  const many = buildItems({ workflows: Array.from({ length: 12 }, (_, i) => ({ id: `w${i}`, name: `Flow ${i}` })) });
  assert.equal(search(many, "").filter((item) => item.group === "Run").length, 5);
  assert.equal(search(many, "flow").filter((item) => item.group === "Run").length, 12);
});
