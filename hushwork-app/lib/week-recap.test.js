import test from "node:test";
import assert from "node:assert/strict";
import { buildWeekRecap, minutesText, weekLine, WEEK_MS, MINUTES } from "./week-recap.js";

const NOW = Date.parse("2026-11-07T12:00:00Z");
const ago = (hours) => new Date(NOW - hours * 3600_000).toISOString();
const ai = { kind: "ai", title: "Ask the AI", fields: { task: "Sum it up", uses: "nothing", address: "" } };
const issue = { kind: "issue", title: "Create a Linear task", fields: { title: "Call Sam", details: "", team: "" } };
const practice = (id, hours, results, extra = {}) => ({ id, workflowId: `wf-${id}`, name: `Flow ${id}`, live: false, createdAt: ago(hours), results, ...extra });
const live = (id, hours, first, extra = {}) => ({ id, workflowId: "", name: "Live", live: true, createdAt: ago(hours), results: [first], ...extra });

test("runs are sorted into done, waiting, stopped and quiet, and the effort is counted by kind", () => {
  const rows = [
    practice("a", 2, [ai, issue]), // both done below: good
    live("a1", 1.9, { ...ai, status: "done", from: "a", fromStep: 0 }),
    live("a2", 1.8, { ...issue, status: "done", from: "a", fromStep: 1 }),
    practice("b", 30, [ai, issue]), // AI done, the write waits: you
    live("b1", 29, { ...ai, status: "done", from: "b", fromStep: 0 }),
    practice("c", 50, [ai]), // stopped
    live("c1", 49, { ...ai, status: "failed", from: "c", fromStep: 0 }),
    practice("d", 60, [ai]), // a watch check that found nothing new
    live("d1", 59, { ...ai, status: "done", quiet: true, from: "d", fromStep: 0 }),
  ];
  const recap = buildWeekRecap(rows, NOW);
  assert.equal(recap.runs, 3, "the quiet check is not a run");
  assert.equal(recap.quiet, 1);
  assert.deepEqual([recap.ai, recap.writes, recap.reads], [2, 1, 0]);
  assert.equal(recap.stepsDone, 3);
  assert.equal(recap.minutes, 2 * MINUTES.ai + MINUTES.write + MINUTES.quiet);
  assert.equal(recap.waitingRuns, 1);
  assert.deepEqual(recap.needsYou.map((run) => [run.id, run.tone, run.waiting]), [["b", "you", 1], ["c", "bad", 0]], "newest first");
  assert.deepEqual(recap.dots.map((dot) => dot.tone), ["quiet", "bad", "you", "good"], "oldest first");
});

test("rows older than 7 days or with a bad date are left out; a live record without its run is its own dot", () => {
  const rows = [
    practice("old", WEEK_MS / 3600_000 + 1, [ai]),
    practice("bad", 1, [ai], { createdAt: "not a date" }),
    live("x", 3, { ...issue, status: "done", from: "old", fromStep: 0 }),
  ];
  const recap = buildWeekRecap(rows, NOW);
  assert.equal(recap.runs, 1);
  assert.equal(recap.dots[0].tone, "good");
  assert.equal(recap.writes, 1);
});

test("workflows are grouped by id and sorted busiest first", () => {
  const rows = [practice("a", 1, [ai]), practice("b", 2, [ai], { workflowId: "wf-a" }), practice("c", 3, [ai])];
  const recap = buildWeekRecap(rows, NOW);
  assert.deepEqual(recap.byWorkflow.map((group) => [group.key, group.total, group.you]), [["wf-a", 2, 2], ["wf-c", 1, 1]]);
});

test("bad input gives an empty week", () => {
  for (const input of [null, undefined, "x", [null, 3, {}]]) {
    const recap = buildWeekRecap(input, NOW);
    assert.equal(recap.runs, 0);
    assert.deepEqual(recap.dots, []);
  }
});

test("minutes and the sentence read naturally", () => {
  assert.equal(minutesText(0), "0 min");
  assert.equal(minutesText(40), "40 min");
  assert.equal(minutesText(60), "1 h");
  assert.equal(minutesText(85), "1 h 25 min");
  assert.match(weekLine({ runs: 0, quiet: 0 }), /Nothing ran/);
  assert.equal(weekLine({ runs: 2, quiet: 0, stepsDone: 0, writes: 0 }), "2 runs this week, all practice so far. Approve a step on the Runs page to make one real.");
  assert.equal(weekLine({ runs: 3, quiet: 1, stepsDone: 3, writes: 1 }), "Hushwork did 3 steps for real, sent or created 1 thing after your OK and checked 1 time and stayed quiet because nothing was new.");
});
