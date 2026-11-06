import test from "node:test";
import assert from "node:assert/strict";
import { AI_STEPS_PER_DAY, aiStepsPerRun, perRunLine, scheduleLine } from "./ai-cost.js";

const ai = (task = "Tell me which task to do first") => ({ kind: "ai", fields: { task, uses: "nothing", address: "" } });
const find = (where) => ({ kind: "find", fields: { where, what: "x" } });

test("one run counts its Ask the AI steps and the lookups that add an AI summary", () => {
  assert.equal(aiStepsPerRun([{ kind: "trigger", fields: { how: "manual", when: "" } }, ai(), ai("Sum it up")]), 2);
  assert.equal(aiStepsPerRun([find("linear"), find("calendar"), find("inbox"), find("files")]), 4, "Linear, Calendar, Gmail and Drive lookups each add a summary");
  assert.equal(aiStepsPerRun([find("sheet"), find("other"), { kind: "write", fields: { what: "email", about: "" } }, { icon: "", title: "A note", detail: "" }]), 0, "steps that never ask the AI cost nothing");
  assert.equal(aiStepsPerRun([ai("   ")]), 0, "an Ask the AI step with no job never runs");
});

test("tuples from the page count the same as step objects, and only the first 20 steps run", () => {
  assert.equal(aiStepsPerRun([["Sparkles", "Ask the AI", "", "ai", ai().fields]]), 1);
  assert.equal(aiStepsPerRun(Array.from({ length: 25 }, () => ai())), 20);
  for (const bad of [null, undefined, "plan", {}]) assert.equal(aiStepsPerRun(bad), 0);
});

test("the card line is short, and missing when nothing is used", () => {
  assert.equal(AI_STEPS_PER_DAY, 15);
  assert.equal(perRunLine(2), "Uses up to 2 of your 15 AI steps each run.");
  assert.equal(perRunLine(1), "Uses up to 1 of your 15 AI steps each run.");
  for (const none of [0, -1, 1.5, undefined]) assert.equal(perRunLine(none), "");
});

test("a schedule says about how many it uses, by how often it runs", () => {
  assert.equal(scheduleLine(2, "daily"), "About 2 AI steps a day.");
  assert.equal(scheduleLine(1, "daily"), "About 1 AI step a day.");
  assert.equal(scheduleLine(2, "weekdays"), "About 2 AI steps a day on weekdays.");
  assert.equal(scheduleLine(3, "weekly"), "About 3 AI steps a week.");
  assert.match(scheduleLine(1, "hourly"), /^About 24 AI steps a day\. That is more than your 15/);
  assert.equal(scheduleLine(0, "daily"), "");
  assert.equal(scheduleLine(2, "monthly"), "");
});
