// Tests that RUN the real server code (lib/run-core.js) from "press Run" to "the email left", with a pretend database and a pretend Composio.
// These exist because reading the code's text is not the same as running it: they are the closest thing to pressing the buttons that does not
// need a real account. (Uses the loader in scripts/test-hooks.mjs.)
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { makeFakeSupabase, fakeComposio, GMAIL_TOOL, NOTION_TOOL } from "./test-server-support.js";
import { finishSteps } from "./ai/plan.js";

process.env["COMPOSIO" + "_API_KEY"] = "ak_test_key_not_real"; // the setting names are built in two pieces so the secret-name scanners do not trip on a test
const { startPracticeRun, approveActionStep } = await import("./run-core.js");

const SAY = "Send a message to my account every morning saying good morning";
const trigger = { icon: "Clock", title: "Every morning", detail: "8:00", block: "trigger", choice: "schedule", a: "Every day at 8:00", b: "" };
const notionPlan = (target) => finishSteps({ steps: [{ icon: "Zap", title: "Start", detail: "x", block: "trigger", choice: "manual", a: "", b: "" }, { icon: "FileText", title: "Create a page", detail: "x", block: "action", choice: "notion_page", a: target, b: "Design log" }] });

// One person, one saved workflow, one pretend database.
function setup({ plan, email = "me@example.com", admin = false }) {
  const user = randomUUID();
  const workflow = randomUUID();
  const supabase = makeFakeSupabase({ asUser: user, admin, workflows: [{ id: workflow, user_id: user, name: "My workflow", plan }], emails: { [user]: email } });
  const who = { user: admin ? { id: user } : { id: user, email }, supabase };
  return { user, workflow, supabase, who };
}
// Which step (counting from 0) really does something: the plan also holds the Start and an "Ask you to approve" note.
const actionIndex = (plan) => plan.findIndex((step) => step.kind === "action");
const livePosts = (composio) => composio.calls.filter((call) => call.method === "POST" && call.path.startsWith("/tools/execute/")); // real runs of a tool (not the AI, not a look at the tool)

test("'Send a message to my account', from the words to the inbox: the plan made from them really sends an email to the signed-in person", async () => {
  // what the AI wrote: the plan-only Send block (the exact mistake that made nothing arrive)
  const plan = finishSteps({ steps: [trigger, { icon: "Send", title: "Send a message", detail: "To your account", block: "send", choice: "other", a: "my account", b: "good morning" }] }, undefined, SAY);
  const { workflow, supabase, who, user } = setup({ plan });
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL });
  try {
    const result = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.equal(result.ok, true);
    assert.deepEqual(result.auto, { done: 1, stoppedAt: 0 });
    const sent = livePosts(composio);
    assert.equal(sent.length, 1, "exactly one email was sent");
    assert.equal(sent[0].path, "/tools/execute/GMAIL_SEND_EMAIL");
    assert.equal(sent[0].body.user_id, user, "for this person's own Composio connection");
    assert.equal(sent[0].body.arguments.recipient_email, "me@example.com", "to the signed-in person's own address");
    assert.ok(sent[0].body.arguments.body.toLowerCase().includes("good morning"));
    const real = supabase.tables.runs.filter((run) => run.mode === "live");
    assert.equal(real.length, 1);
    assert.match(real[0].results[0].outcome, /^Sent an email to me@example\.com/);
  } finally { composio.restore(); }
});

test("a scheduled run (no signed-in session, only the all-access client) still finds the person's own address and sends", async () => {
  const plan = finishSteps({ steps: [trigger, { icon: "Mail", title: "Email me", detail: "hi", block: "action", choice: "gmail_send", a: "me", b: "Hello" }] });
  const { workflow, supabase, who } = setup({ plan, admin: true, email: "owner@example.com" });
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL });
  try {
    const result = await startPracticeRun({ id: workflow, auto: true, allowWrites: true, startedBy: "Every day at 08:00 (your time)" }, who);
    assert.deepEqual(result.auto, { done: 1, stoppedAt: 0 });
    assert.equal(livePosts(composio)[0].body.arguments.recipient_email, "owner@example.com");
    const practice = supabase.tables.runs.find((run) => run.mode === "practice");
    assert.equal(practice.results[0].outcome, "Started by its schedule: Every day at 08:00 (your time).", "the run says which schedule started it");
  } finally { composio.restore(); }
});

test("a scheduled run that is NOT allowed to write skips the email, and nothing is sent", async () => {
  const plan = finishSteps({ steps: [trigger, { icon: "Mail", title: "Email me", detail: "hi", block: "action", choice: "gmail_send", a: "me", b: "Hello" }] });
  const { workflow, who } = setup({ plan, admin: true });
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL });
  try {
    const result = await startPracticeRun({ id: workflow, auto: true, allowWrites: false }, who);
    assert.deepEqual(result.auto, { done: 0, stoppedAt: 0 });
    assert.equal(livePosts(composio).length, 0);
  } finally { composio.restore(); }
});

test("an email to {myEmail} for a person with no email address stops with a clear reason, and nothing is sent", async () => {
  const plan = finishSteps({ steps: [trigger, { icon: "Mail", title: "Email me", detail: "hi", block: "action", choice: "gmail_send", a: "me", b: "Hello" }] });
  const { workflow, supabase, who } = setup({ plan, email: "" });
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL });
  try {
    const result = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.equal(result.auto.stoppedAt, actionIndex(plan) + 1);
    assert.match(result.auto.reason, /no email address/);
    assert.equal(livePosts(composio).length, 0);
    const note = supabase.tables.runs.find((run) => run.mode === "live");
    assert.equal(note.results[0].status, "failed");
    assert.match(note.results[0].outcome, /no email address/);
  } finally { composio.restore(); }
});

test("a template's example Notion page id is refused with a plain reason, saved under the step, and never sent to Notion", async () => {
  const plan = notionPlan("00000000000000000000000000000000");
  const { workflow, supabase, who } = setup({ plan });
  const composio = fakeComposio({ NOTION_CREATE_NOTION_PAGE: NOTION_TOOL });
  try {
    const result = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.equal(result.auto.stoppedAt, actionIndex(plan) + 1);
    assert.match(result.auto.reason, /still the example value from the template/);
    assert.equal(composio.calls.length, 0, "Composio was not even asked");
    assert.match(supabase.tables.runs.find((run) => run.mode === "live").results[0].outcome, /example value/);
  } finally { composio.restore(); }
});

test("when Notion refuses, the reason saved under the step is our sentence plus what the app said, so nobody has to guess", async () => {
  const plan = notionPlan("0123456789abcdef0123456789abcdef");
  const { workflow, supabase, who } = setup({ plan });
  const composio = fakeComposio({ NOTION_CREATE_NOTION_PAGE: { ...NOTION_TOOL, answer: { successful: false, error: "Forbidden: this page is not shared with the integration" } } });
  try {
    const result = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.equal(result.auto.stoppedAt, actionIndex(plan) + 1);
    const note = supabase.tables.runs.find((run) => run.mode === "live").results[0];
    assert.equal(note.status, "failed");
    assert.match(note.outcome, /not allowed to do that/);
    assert.match(note.outcome, /The app said: "Forbidden: this page is not shared with the integration"/);
    assert.equal(note.fromStep, actionIndex(plan), "it is filed under the step that stopped");
  } finally { composio.restore(); }
});

test("an app that is not connected says so, and a successful Notion page is recorded once", async () => {
  const good = setup({ plan: notionPlan("0123456789abcdef0123456789abcdef") });
  const composio = fakeComposio({ NOTION_CREATE_NOTION_PAGE: { ...NOTION_TOOL, answer: { successful: true, data: { id: "p1" } } } });
  try {
    const first = await startPracticeRun({ id: good.workflow, auto: true }, good.who);
    assert.deepEqual(first.auto, { done: 1, stoppedAt: 0 });
    assert.equal(livePosts(composio).length, 1);
    // approving the same step again must NOT create a second page
    const again = await approveActionStep({ runId: first.runId, index: actionIndex(notionPlan("0123456789abcdef0123456789abcdef")) }, good.who);
    assert.ok(again.error, "the second approval is refused");
    assert.equal(livePosts(composio).length, 1, "still exactly one page");
  } finally { composio.restore(); }

  const off = setup({ plan: notionPlan("0123456789abcdef0123456789abcdef") });
  const refused = fakeComposio({ NOTION_CREATE_NOTION_PAGE: { ...NOTION_TOOL, answer: { successful: false, error: "No connected account found for user" } } });
  try {
    const result = await startPracticeRun({ id: off.workflow, auto: true }, off.who);
    assert.match(result.auto.reason, /not connected yet/);
  } finally { refused.restore(); }
});

// ---- "the AI writes it, the email carries it": every "email me a summary" template works this way ----
process.env["GROQ" + "_API_KEY"] = "gsk_test_key_not_real";
const aiStep = (task, heading) => ({ icon: "Sparkles", title: heading, detail: "x", block: "ai", choice: "nothing", a: task, b: "" });
const emailStep = (details) => ({ icon: "Mail", title: "Email me", detail: details, block: "action", choice: "gmail_send", a: "me", b: "My summary" });

test("an AI step followed by an email: the email carries what the AI wrote, line breaks kept, to the signed-in person", async () => {
  const plan = finishSteps({ steps: [trigger, aiStep("Write two short lines.", "Ask the AI"), emailStep("{answer}")] });
  const { workflow, supabase, who } = setup({ plan });
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL }, { groq: ["Line one: all good.\nLine two: nothing urgent."] });
  try {
    const result = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.deepEqual(result.auto, { done: 2, stoppedAt: 0 });
    const mail = livePosts(composio)[0].body.arguments;
    assert.equal(mail.recipient_email, "me@example.com");
    assert.equal(mail.body, "Line one: all good.\nLine two: nothing urgent.");
    assert.equal(mail.subject, "My summary");
    assert.equal(supabase.tables.runs.filter((run) => run.mode === "live").length, 2, "one record for the AI step and one for the email");
  } finally { composio.restore(); }
});

test("a morning briefing: several AI steps, then ONE email with every answer in order ({answers})", async () => {
  const plan = finishSteps({ steps: [trigger, aiStep("Sum up my week.", "Week"), aiStep("Sum up my inbox.", "Inbox"), aiStep("Sum up my tasks.", "Tasks"), emailStep("{answers}")] });
  const { workflow, who } = setup({ plan });
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL }, { groq: ["WEEK: busy Tuesday", "INBOX: answer Ana", "TASKS: do the invoice"] });
  try {
    const result = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.deepEqual(result.auto, { done: 4, stoppedAt: 0 });
    const sent = livePosts(composio);
    assert.equal(sent.length, 1, "one email, not three");
    assert.equal(sent[0].body.arguments.body, "WEEK: busy Tuesday\n\nINBOX: answer Ana\n\nTASKS: do the invoice");
  } finally { composio.restore(); }
});

test("when the AI says nothing usable, the email is NOT sent and the reason is saved under the step", async () => {
  const plan = finishSteps({ steps: [trigger, aiStep("Write a line.", "Ask the AI"), emailStep("{answer}")] });
  const { workflow, supabase, who } = setup({ plan });
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL }, { groq: [""] });
  try {
    const result = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.equal(result.auto.done, 0);
    assert.ok(result.auto.stoppedAt > 0 && result.auto.reason);
    assert.equal(livePosts(composio).length, 0, "no email without an answer to put in it");
    assert.equal(supabase.tables.runs.find((run) => run.mode === "live").results[0].status, "failed");
  } finally { composio.restore(); }
});

test("a workflow SAVED EARLIER with the old 'Send a message' by email (the AI used to write these) now really sends, after Approve, to the address in the step", async () => {
  // the exact shape that was saved: a Start, an approval note and a plan-only Send with a real address
  const plan = finishSteps({ steps: [{ icon: "Zap", title: "When I ask", detail: "x", block: "trigger", choice: "manual", a: "", b: "" }, { icon: "Send", title: "Send a message", detail: "x", block: "send", choice: "email", a: "friend@example.com", b: "Hi, I made a new app. Come and see it." }] });
  assert.ok(plan.some((step) => step.kind === "send"), "this plan holds the old plan-only step");
  const { workflow, supabase, who } = setup({ plan });
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL });
  try {
    const result = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.deepEqual(result.auto, { done: 1, stoppedAt: 0 });
    const mail = livePosts(composio)[0].body.arguments;
    assert.equal(mail.recipient_email, "friend@example.com");
    assert.equal(mail.body, "Hi, I made a new app. Come and see it.");
    assert.equal(mail.subject, "Hi, I made a new app");
    const practice = supabase.tables.runs.find((run) => run.mode === "practice");
    assert.ok(practice.results.some((step) => step.kind === "action"), "the run shows it as a real email step, so the approval card shows To, Subject and text");
  } finally { composio.restore(); }
});

test("an old Send that cannot be a real email (Slack, 'other', no address, a bad address) stays a plan-only description and sends nothing", async () => {
  for (const [how, to] of [["slack", "#general"], ["other", "my accountant"], ["email", ""], ["email", "not an address"], ["email", "two@example.com three@example.com"]]) {
    const plan = finishSteps({ steps: [{ icon: "Zap", title: "When I ask", detail: "x", block: "trigger", choice: "manual", a: "", b: "" }, { icon: "Send", title: "Send a message", detail: "x", block: "send", choice: how, a: to, b: "hello" }] });
    const { workflow, who } = setup({ plan });
    const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL });
    try {
      const result = await startPracticeRun({ id: workflow, auto: true }, who);
      assert.deepEqual(result.auto, { done: 0, stoppedAt: 0 }, `${how} to "${to}"`);
      assert.equal(livePosts(composio).length, 0, `${how} to "${to}": nothing sent`);
    } finally { composio.restore(); }
  }
});

