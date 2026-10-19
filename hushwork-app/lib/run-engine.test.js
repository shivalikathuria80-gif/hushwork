import test from "node:test";
import assert from "node:assert/strict";
import { practiceRun, practiceStep, readSavedResults, isTelegramSend, telegramMessage } from "./run-engine.js";
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

test("only a send step set to Telegram can be approved, and the message is built from the saved step", () => {
  const send = (how) => practiceStep({ icon: "Send", title: "Send a message", detail: `x`, kind: "send", fields: { how, to: "me", about: "" } });
  assert.equal(isTelegramSend(send("telegram")), true);
  assert.equal(isTelegramSend(send("email")), false);
  assert.equal(isTelegramSend(practiceStep({ icon: "", title: "t", detail: "d", kind: "find", fields: { where: "inbox", what: "x" } })), false);
  assert.equal(isTelegramSend(null), false);
  const saved = readSavedResults([send("telegram")])[0];
  assert.equal(saved.fields.how, "telegram");
  assert.ok(telegramMessage("Invoices", { detail: "On Telegram, to me" }).startsWith("Hushwork: Invoices\nOn Telegram, to me\n"));
  assert.ok(telegramMessage("n".repeat(999), { detail: "d".repeat(999) }).length < 700);
});
