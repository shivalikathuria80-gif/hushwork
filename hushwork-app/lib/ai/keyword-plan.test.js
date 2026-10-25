import test from "node:test";
import assert from "node:assert/strict";
import { keywordPlan } from "./keyword-plan.js";
import { cleanPlan } from "../validate.js";
import { planToSteps } from "../steps.js";
import { isPlanOnly, isApprovable } from "../run-engine.js";

const steps = (task) => planToSteps(keywordPlan(task));

test("keyword preview: every kind of task becomes a Start step and ONE Ask the AI step that looks in the right place", () => {
  const cases = [
    ["Follow up new leads", "gmail", ""], ["Keep my receipts and contracts tidy", "drive", ""], ["Chase overdue invoices", "app", "stripe"],
    ["Sort my inbox every morning", "gmail", ""], ["Weekly client report", "linear", ""], ["Sum up my calendar for the week", "calendar", ""],
    ["Plan my next launch", "nothing", ""],
  ];
  for (const [task, uses, address] of cases) {
    const made = steps(task);
    assert.deepEqual(made.map((s) => s.kind), ["trigger", "ai"], task);
    assert.equal(made[1].fields.uses, uses, task);
    assert.equal(made[1].fields.address, address, task);
  }
});

test("keyword preview: nothing in it only describes, every step can be approved, and the plan passes the strict gate every saved draft passes", () => {
  for (const task of ["Chase overdue invoices", "x", "字".repeat(300), "Weekly client report", "<b>hi</b>", "Plan my launch ".repeat(40)]) {
    const made = steps(task);
    assert.ok(made.length >= 2, task.slice(0, 20));
    for (const step of made) assert.ok(step.kind === "trigger" || (isApprovable(step) && !isPlanOnly(step)), `${task.slice(0, 20)}: ${step.kind}`);
    assert.deepEqual(planToSteps(keywordPlan(task)), cleanPlan(JSON.stringify(made)).value, "unchanged by the strict gate");
    assert.ok(made.find((s) => s.kind === "ai").fields.task.length <= 110);
  }
});

test("keyword preview: 'send it to me' adds one REAL email that carries the AI's answer, behind an approval step; other tasks add no email", () => {
  const made = steps("Email me my open tasks every Monday");
  assert.deepEqual(made.map((s) => s.title), ["On a schedule", "Ask the AI", "Ask you to approve", "Send an email (Gmail)"].map((t, i) => (i === 0 ? made[0].title : t)));
  assert.deepEqual(made.map((s) => s.kind), ["trigger", "ai", undefined, "action"], "the approval step is the plain stop sign note");
  assert.equal(made.at(-1).fields.action, "gmail_send");
  assert.equal(made.at(-1).fields.target, "{myEmail}");
  assert.equal(made.at(-1).fields.details, "{answer}");
  assert.ok(!steps("Chase overdue invoices").some((s) => s.kind === "action"));
});

test("keyword preview: a task that reads 'payments' or 'pay' does not trigger a pointless approval step before a read", () => {
  assert.ok(!steps("Chase overdue invoices").some((s) => s.title === "Ask you to approve"));
});
