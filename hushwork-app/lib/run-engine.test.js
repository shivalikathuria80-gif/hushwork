import test from "node:test";
import assert from "node:assert/strict";
import { practiceRun, practiceStep, readSavedResults, isRequestStep, requestSummary, isLinearLookup, linearSummary, isAiStep, aiSummary, isCalendarLookup, calendarSummary } from "./run-engine.js";
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

test("only a Look-something-up step set to Linear can be approved", () => {
  const find = (where) => practiceStep({ icon: "Search", title: "t", detail: "d", kind: "find", fields: { where, what: "my tasks" } });
  assert.equal(isLinearLookup(find("linear")), true);
  assert.equal(isLinearLookup(readSavedResults([find("linear")])[0]), true);
  assert.equal(isLinearLookup(find("inbox")), false);
  assert.equal(isLinearLookup(null), false);
  assert.ok(linearSummary(find("linear")).includes("my tasks"));
});

test("only a Look-something-up step set to Calendar can be approved, and the preview says it only reads", () => {
  const find = (where) => practiceStep({ icon: "Search", title: "t", detail: "d", kind: "find", fields: { where, what: "today" } });
  assert.equal(isCalendarLookup(find("calendar")), true);
  assert.equal(isCalendarLookup(readSavedResults([find("calendar")])[0]), true);
  assert.equal(isCalendarLookup(find("linear")), false);
  assert.equal(isCalendarLookup(null), false);
  assert.match(calendarSummary(find("calendar")), /read-only/);
  assert.match(aiSummary(practiceStep({ icon: "", title: "t", detail: "d", kind: "ai", fields: { task: "x", uses: "calendar", address: "" } })), /Google Calendar/);
});

test("only an Ask-the-AI step with a task can be approved, and the preview says what the AI may look at", () => {
  const ai = (fields) => practiceStep({ icon: "Sparkles", title: "t", detail: "d", kind: "ai", fields });
  assert.equal(isAiStep(ai({ task: "Which first?", uses: "linear", address: "" })), true);
  assert.equal(isAiStep(readSavedResults([ai({ task: "x", uses: "nothing", address: "" })])[0]), true);
  assert.equal(isAiStep(ai({ task: "  ", uses: "nothing", address: "" })), false);
  assert.equal(isAiStep(null), false);
  assert.match(aiSummary(ai({ task: "Which first?", uses: "linear", address: "" })), /your Linear tasks/);
  assert.match(aiSummary(ai({ task: "x", uses: "web", address: "https://example.com/a" })), /https:\/\/example.com\/a/);
  assert.match(aiSummary(ai({ task: "x", uses: "nothing", address: "" })), /only think/);
  assert.match(aiSummary(ai({ task: "x", uses: "nothing", address: "" })), /Groq/);
});

test("only a web-call step with an address can be approved, and the preview shows the address", () => {
  const call = practiceStep({ icon: "Plug", title: "Call a web address", detail: "x", kind: "request", fields: { url: "https://api.example.com/a", why: "check" } });
  assert.equal(isRequestStep(call), true);
  assert.equal(isRequestStep(readSavedResults([call])[0]), true);
  assert.equal(isRequestStep({ kind: "request", fields: {} }), false);
  assert.equal(isRequestStep({ kind: "send", fields: { url: "https://x.com" } }), false);
  assert.match(call.outcome, /^Would ask https:\/\/api.example.com\/a/);
  assert.ok(requestSummary(call).includes("https://api.example.com/a") && requestSummary(call).includes("check"));
});

test("a Look something up step set to Inbox can be approved, and the summary says it reads only sender, subject and time", async () => {
  const { isGmailLookup, gmailSummary } = await import("./run-engine.js");
  const find = (where, what = "") => ({ kind: "find", fields: { where, what } });
  assert.equal(isGmailLookup(find("inbox")), true);
  assert.equal(isGmailLookup(find("calendar")), false);
  assert.equal(isGmailLookup({ kind: "write", fields: { where: "inbox" } }), false);
  assert.equal(isGmailLookup(null), false);
  const summary = gmailSummary(find("inbox", "invoices"));
  assert.match(summary, /sender|who sent/i);
  assert.match(summary, /never reads the text/);
  assert.match(summary, /Your note: invoices/);
  assert.match(aiSummary(practiceStep({ icon: "", title: "t", detail: "d", kind: "ai", fields: { task: "x", uses: "gmail", address: "" } })), /Gmail inbox/);
});

test("a Look something up step set to Files can be approved, and the summary says it never opens a file", async () => {
  const { isDriveLookup, driveSummary } = await import("./run-engine.js");
  const find = (where, what = "") => ({ kind: "find", fields: { where, what } });
  assert.equal(isDriveLookup(find("files")), true);
  assert.equal(isDriveLookup(find("inbox")), false);
  assert.equal(isDriveLookup({ kind: "write", fields: { where: "files" } }), false);
  assert.equal(isDriveLookup(undefined), false);
  const summary = driveSummary(find("files", "reports"));
  assert.match(summary, /never opens a file/);
  assert.match(summary, /Your note: reports/);
  assert.match(aiSummary(practiceStep({ icon: "", title: "t", detail: "d", kind: "ai", fields: { task: "x", uses: "drive", address: "" } })), /Google Drive/);
});
