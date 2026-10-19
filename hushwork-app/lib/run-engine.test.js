import test from "node:test";
import assert from "node:assert/strict";
import { practiceRun, practiceStep, readSavedResults } from "./run-engine.js";
import { STEP_KINDS, blankFields, describeStep } from "./steps.js";
import { TEMPLATES } from "./templates.js";

test("every kind produces a 'would do' sentence that says nothing happened", () => {
  for (const kind of Object.keys(STEP_KINDS)) {
    const fields = blankFields(kind);
    const result = practiceStep({ icon: "Zap", ...describeStep(kind, { ...fields, to: "x", what: "y", values: "z" }), kind, fields: { ...fields, to: "x", what: "y", values: "z" } });
    assert.match(result.outcome, /^Would /, kind);
    assert.equal(result.status, "done");
  }
});

test("a plain note and hostile input never throw", () => {
  assert.match(practiceStep({ icon: "Zap", title: "Call Sam", detail: "" }).outcome, /note/);
  for (const bad of [null, undefined, 5, "x", [], { kind: "__proto__", fields: 3 }, { kind: "send", fields: null }]) assert.doesNotThrow(() => practiceStep(bad));
});

test("an empty or non-list plan fails with no results", () => {
  assert.deepEqual(practiceRun([]), { status: "failed", results: [] });
  assert.equal(practiceRun("nope").status, "failed");
});

test("every template can be practice-run", () => {
  for (const template of TEMPLATES) {
    const run = practiceRun(template.steps);
    assert.equal(run.status, "done");
    assert.equal(run.results.length, template.steps.length);
  }
});

test("long text is cut and saved results are read back as plain strings", () => {
  assert.ok(practiceStep({ icon: "", title: "t".repeat(1000), detail: "" }).title.length <= 300);
  assert.deepEqual(readSavedResults("x"), []);
  assert.deepEqual(readSavedResults([{ icon: 1, title: "a", outcome: {}, status: "weird" }]), [{ icon: "", title: "a", detail: "", outcome: "", status: "done" }]);
});
