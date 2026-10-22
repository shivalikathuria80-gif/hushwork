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

test("the Add a row summary shows the real words for {answer}, or says to approve the AI step first", async () => {
  const { sheetsSummary } = await import("./run-engine.js");
  const row = { kind: "row", fields: { to: "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit", values: "20 Oct, {answer}" } };
  assert.match(sheetsSummary(row, "Three emails need a reply."), /2\. Three emails need a reply\./);
  assert.match(sheetsSummary(row, ""), /Approve the Ask the AI step of this workflow first/);
  assert.match(sheetsSummary(row), /2\. \{answer\}/);
  assert.doesNotMatch(sheetsSummary({ ...row, fields: { ...row.fields, values: "a, b" } }, "x"), /Approve the Ask/);
});

test("a real run remembers the practice run it came from, but only a plain id is read back", () => {
  const id = "0b3f7c1e-8a52-4d6b-9c41-2f6a7d8e9b10";
  assert.equal(readSavedResults([{ title: "t", from: id }])[0].from, id);
  for (const bad of ["../../x", "", 5, null, undefined, `${id}; drop table runs`, "<script>"]) assert.equal("from" in readSavedResults([{ title: "t", from: bad }])[0], false, String(bad));
});

test("a Create a Linear task step with a title can be approved; the summary shows the exact words, the team and any missing answer", async () => {
  const { isLinearCreate, linearCreateSummary } = await import("./run-engine.js");
  const issue = (fields) => ({ kind: "issue", fields: { title: "", details: "", team: "", ...fields } });
  assert.equal(isLinearCreate(issue({ title: "Reply to Ana" })), true);
  assert.equal(isLinearCreate(issue({ title: "   " })), false);
  assert.equal(isLinearCreate({ kind: "find", fields: { title: "x" } }), false);
  assert.equal(isLinearCreate(null), false);
  const plain = linearCreateSummary(issue({ title: "Reply to Ana", details: "About the invoice", team: "ENG" }));
  assert.match(plain, /ONE new task/);
  assert.match(plain, /Title: Reply to Ana/);
  assert.match(plain, /Details: About the invoice/);
  assert.match(plain, /Team: ENG/);
  assert.match(linearCreateSummary(issue({ title: "x" })), /Team: your first team/);
  assert.match(linearCreateSummary(issue({ title: "Do: {answer}" }), "Call Ana back"), /Title: Do: Call Ana back/);
  assert.match(linearCreateSummary(issue({ title: "Do: {answer}" }), ""), /Approve the Ask the AI step of this workflow first/);
  assert.match(practiceStep({ icon: "", title: "t", detail: "d", kind: "issue", fields: { title: "Reply", details: "", team: "ENG" } }).outcome, /Would create a Linear task: Reply \(team ENG\)\. Nothing was created\./);
});

test("a Look in another app step naming an app from the list can be approved; the summary names the app, what it reads and Composio", async () => {
  const { isAppLookup, appSummary } = await import("./run-engine.js");
  const app = (id, what = "") => ({ kind: "app", fields: { app: id, what } });
  assert.equal(isAppLookup(app("todoist")), true);
  assert.equal(isAppLookup(app("notion")), true);
  for (const bad of ["", "nope", "__proto__", "TODOIST", undefined]) assert.equal(isAppLookup(app(bad)), false, String(bad));
  assert.equal(isAppLookup({ kind: "find", fields: { app: "todoist" } }), false);
  assert.equal(isAppLookup(null), false);
  const summary = appSummary(app("todoist", "what is due first"));
  assert.match(summary, /Todoist for your open tasks/);
  assert.match(summary, /only reads/);
  assert.match(summary, /Composio/);
  assert.match(summary, /Your note: what is due first/);
  assert.match(practiceStep({ icon: "", title: "t", detail: "d", kind: "app", fields: { app: "notion", what: "" } }).outcome, /Would look in Notion\. Nothing was opened\./);
  assert.match(aiSummary(practiceStep({ icon: "", title: "t", detail: "d", kind: "ai", fields: { task: "x", uses: "app", address: "jira" } })), /Jira \(your projects, through Composio\)/);
  assert.match(aiSummary(practiceStep({ icon: "", title: "t", detail: "d", kind: "ai", fields: { task: "x", uses: "app", address: "nope" } })), /a connected app/);
});

test("Auto mode: the list of steps with a real action is the same one the Runs page offers Approve for, and only adding a row or creating a task counts as writing", async () => {
  const { isApprovable, isWriteStep } = await import("./run-engine.js");
  const sheet = "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit";
  const approvable = [
    { kind: "request", fields: { url: "https://example.com/a", why: "" } }, { kind: "find", fields: { where: "linear", what: "x" } }, { kind: "find", fields: { where: "calendar", what: "x" } },
    { kind: "find", fields: { where: "inbox", what: "x" } }, { kind: "find", fields: { where: "files", what: "x" } }, { kind: "issue", fields: { title: "Reply", details: "", team: "" } },
    { kind: "app", fields: { app: "todoist", what: "" } }, { kind: "row", fields: { to: sheet, values: "a, b" } }, { kind: "ai", fields: { task: "Think", uses: "nothing", address: "" } },
  ];
  for (const step of approvable) assert.equal(isApprovable(step), true, step.kind + JSON.stringify(step.fields));
  for (const step of [{ kind: "trigger", fields: { how: "manual", when: "" } }, { kind: "approve", fields: { what: "" } }, { kind: "write", fields: { what: "email", about: "" } }, { kind: "send", fields: { how: "email", to: "x", about: "" } }, { kind: "find", fields: { where: "other", what: "x" } }, { kind: "row", fields: { to: "Tracker", values: "a" } }, { title: "A note" }, null, undefined]) assert.equal(isApprovable(step), false);
  assert.deepEqual(approvable.filter(isWriteStep).map((step) => step.kind), ["issue", "row"]);
});

test("a real run remembers which step of the practice run it did (a small whole number, nothing else)", () => {
  const id = "0b3f7c1e-8a52-4d6b-9c41-2f6a7d8e9b10";
  assert.equal(readSavedResults([{ title: "t", from: id, fromStep: 2 }])[0].fromStep, 2);
  for (const bad of [-1, 100, 1.5, "2", null, undefined, {}, NaN]) assert.equal("fromStep" in readSavedResults([{ title: "t", from: id, fromStep: bad }])[0], false, String(bad));
});

test("a Do something in another app step: only a listed action with a good place and a title counts, it is a write, and the summary shows exactly what will be sent", async () => {
  const { isActionStep, actionSummary, isWriteStep, isApprovable } = await import("./run-engine.js");
  const step = (fields) => ({ kind: "action", fields });
  const slack = step({ action: "slack_message", target: "general", title: "Deploy done", details: "" });
  assert.equal(isActionStep(slack), true);
  assert.equal(isWriteStep(slack), true);
  assert.equal(isApprovable(slack), true);
  assert.equal(isActionStep(step({ action: "todoist_task", target: "", title: "Buy milk", details: "2 litres" })), true);
  for (const bad of [
    step({ action: "slack_message", target: "two words", title: "x" }), step({ action: "slack_message", target: "", title: "x" }),
    step({ action: "todoist_task", target: "inbox", title: "x" }), step({ action: "slack_message", target: "general", title: "  " }),
    step({ action: "__proto__", target: "", title: "x" }), step({ action: "nope", target: "", title: "x" }), { kind: "find", fields: slack.fields }, null,
  ]) assert.equal(isActionStep(bad), false);
  const text = actionSummary(step({ action: "github_issue", target: "acme/website", title: "Broken link", details: "On the pricing page" }));
  for (const part of ["ONE thing", "Create a GitHub issue", "Where: acme/website", "Title: Broken link", "Details: On the pricing page", "Composio"]) assert.ok(text.includes(part), part);
  assert.ok(actionSummary(step({ action: "slack_message", target: "general", title: "Hi {answer}" }), "all good").includes("Message: Hi all good"));
  assert.match(practiceStep({ icon: "Send", title: "t", detail: "d", ...slack }).outcome, /^Would do: .*Nothing was sent\.$/);
});
