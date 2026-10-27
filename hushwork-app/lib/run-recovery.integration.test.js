// SAFE RUN RECOVERY, tested by running the real server code (lib/run-core.js) against a pretend database and a pretend Composio/Groq.
// The promise: a run that failed halfway can be continued, steps that are done are never done again, and a real write whose end Hushwork never
// saw (a dropped connection, a crash) is never sent a second time by itself, so an email or a task can never be duplicated.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { makeFakeSupabase, fakeComposio, GMAIL_TOOL } from "./test-server-support.js";
import { finishSteps } from "./ai/plan.js";

process.env["COMPOSIO" + "_API_KEY"] = "ak_test_key_not_real";
process.env["GROQ" + "_API_KEY"] = "gsk_test_key_not_real";
const { startPracticeRun, resumeRun, approveActionStep } = await import("./run-core.js");

const trigger = { icon: "Zap", title: "Start", detail: "x", block: "trigger", choice: "manual", a: "", b: "" };
const ask = { icon: "Sparkles", title: "Ask the AI", detail: "x", block: "ai", choice: "nothing", a: "Write one line.", b: "" };
const email = { icon: "Mail", title: "Email me", detail: "{answer}", block: "action", choice: "gmail_send", a: "me", b: "Summary" };
const briefing = () => finishSteps({ steps: [trigger, ask, email] });
const plainMail = () => finishSteps({ steps: [trigger, { ...email, detail: "hello" }] }); // no AI step before it, so a manual run can approve it straight away

function setup(plan = briefing()) {
  const user = randomUUID();
  const workflow = randomUUID();
  const supabase = makeFakeSupabase({ asUser: user, workflows: [{ id: workflow, user_id: user, name: "Daily summary", plan }] });
  return { user, workflow, supabase, who: { user: { id: user, email: "me@example.com" }, supabase } };
}
const actionIndex = (plan) => plan.findIndex((step) => step.kind === "action");
const sends = (composio) => composio.calls.filter((call) => call.method === "POST" && call.path === "/tools/execute/GMAIL_SEND_EMAIL");
const asked = (composio) => composio.calls.filter((call) => call.path === "groq");
// every record of one step, oldest first: [status, ...] (stop notes included)
const history = (supabase, runId, index) => supabase.tables.runs.filter((row) => row.mode === "live" && row.results[0].from === runId && row.results[0].fromStep === index).map((row) => row.results[0].status);
const mail = (answer) => ({ ...GMAIL_TOOL, answer });
const OK = { successful: true, data: {} };

test("a failed run is CONTINUED, not restarted: the finished AI step is skipped (not asked again) and the email goes out exactly once", async () => {
  const plan = briefing();
  const { workflow, supabase, who } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: mail([{ successful: false, error: "Forbidden: not allowed" }, OK]) }, { groq: ["All quiet today."] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.equal(first.auto.stoppedAt, index + 1, "it stopped at the email");
    assert.equal(asked(composio).length, 1);
    assert.deepEqual(history(supabase, first.runId, index), ["pending", "failed", "failed"], "started, refused, and the stop note");

    const again = await resumeRun({ runId: first.runId }, who);
    assert.deepEqual(again.auto, { done: 1, stoppedAt: 0, skipped: 1 }, "one step done now, one skipped");
    assert.equal(asked(composio).length, 1, "the AI was NOT asked a second time");
    assert.equal(sends(composio).length, 2, "one refused try and one real send");
    assert.equal(sends(composio)[1].body.arguments.body, "All quiet today.", "the email carries the AI's earlier answer");
    assert.equal(history(supabase, first.runId, index).at(-1), "done");

    const third = await resumeRun({ runId: first.runId }, who);
    assert.deepEqual(third.auto, { done: 0, stoppedAt: 0, skipped: 2 }, "everything is done: nothing runs");
    assert.equal(sends(composio).length, 2, "no second copy of the email");
  } finally { composio.restore(); }
});

test("a dropped connection leaves the step UNKNOWN: Resume and Approve refuse to send again, and only 'it was not done' sends it", async () => {
  const plan = briefing();
  const { workflow, supabase, who } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: mail(["drop", OK]) }, { groq: ["Line."] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.match(first.auto.reason, /could not tell whether it went through/);
    assert.equal(sends(composio).length, 1, "one attempt, and it dropped");
    assert.deepEqual(history(supabase, first.runId, index), ["pending", "failed"], "only the started record and the stop note");

    const resumed = await resumeRun({ runId: first.runId }, who);
    assert.equal(resumed.auto.stoppedAt, index + 1);
    assert.match(resumed.auto.reason, /never saw whether it finished/);
    assert.equal(sends(composio).length, 1, "Resume did NOT send it again");

    const approved = await approveActionStep({ runId: first.runId, index }, who);
    assert.equal(approved.pending, true);
    assert.match(approved.error, /never saw whether it finished/);
    assert.equal(sends(composio).length, 1, "Approve did NOT send it again either");

    const retried = await approveActionStep({ runId: first.runId, index, confirmRetry: true }, who);
    assert.equal(retried.error, undefined);
    assert.equal(sends(composio).length, 2, "after 'it was not done', it is sent once");
    assert.equal(history(supabase, first.runId, index).at(-1), "done");

    const last = await approveActionStep({ runId: first.runId, index, confirmRetry: true }, who);
    assert.match(last.error, /already/i, "done is done: even with confirmRetry nothing goes out twice");
    assert.equal(sends(composio).length, 2);
  } finally { composio.restore(); }
});

test("a 'started' record left behind by a crash (nothing after it) blocks a second send", async () => {
  const plan = plainMail();
  const { workflow, supabase, who } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: mail(OK) }, { groq: ["Line."] });
  try {
    // the first run goes fine up to the email, which a pretend crash left "pending": rebuild exactly that
    const first = await startPracticeRun({ id: workflow, auto: false }, who);
    supabase.tables.runs.push({ id: randomUUID(), user_id: who.user.id, workflow_id: workflow, workflow_name: "x", mode: "live", status: "done", created_at: "2026-10-24T09:00:00.000Z", results: [{ icon: "Mail", title: "Email me", status: "pending", from: first.runId, fromStep: index }] });
    const outcome = await resumeRun({ runId: first.runId }, who);
    assert.equal(outcome.auto.stoppedAt, index + 1);
    assert.equal(sends(composio).length, 0, "nothing was sent: the crashed step might already have gone out");
  } finally { composio.restore(); }
});

test("pressing Approve twice at the same time-ish sends one email (the second press sees 'done')", async () => {
  const plan = briefing();
  const { workflow, who } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: mail(OK) }, { groq: ["Line."] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.equal(first.auto.stoppedAt, 0);
    const second = await approveActionStep({ runId: first.runId, index }, who);
    assert.match(second.error, /already/i);
    assert.equal(sends(composio).length, 1);
  } finally { composio.restore(); }
});

test("when Hushwork cannot check what already ran, writes are blocked (it never guesses 'not tried')", async () => {
  const plan = plainMail();
  const { workflow, supabase, who } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: mail(OK) }, { groq: ["Line."] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: false }, who);
    supabase.breakStateReads = true;
    const approved = await approveActionStep({ runId: first.runId, index }, who);
    assert.match(approved.error, /could not check whether this step already ran/);
    assert.equal(sends(composio).length, 0);
    supabase.breakStateReads = false;
    const fine = await approveActionStep({ runId: first.runId, index }, who);
    assert.equal(fine.error, undefined);
    assert.equal(sends(composio).length, 1);
  } finally { composio.restore(); }
});

test("a busy server (HTTP 503) is also UNKNOWN, but a clear refusal (HTTP 403 words) is failed and may simply be tried again", async () => {
  const plan = briefing();
  const index = actionIndex(plan);
  for (const [answer, expectedLast] of [[503, "pending"], [{ successful: false, error: "Forbidden: not allowed" }, "failed"]]) {
    const { workflow, supabase, who } = setup(plan);
    const composio = fakeComposio({ GMAIL_SEND_EMAIL: mail([answer, OK]) }, { groq: ["Line."] });
    try {
      const first = await startPracticeRun({ id: workflow, auto: true }, who);
      const states = supabase.tables.runs.filter((row) => row.results[0].fromStep === index && !row.results[0].note).map((row) => row.results[0].status);
      assert.equal(states.at(-1), expectedLast, JSON.stringify(answer));
      const resumed = await resumeRun({ runId: first.runId }, who);
      assert.equal(sends(composio).length, expectedLast === "pending" ? 1 : 2, "an unknown step is not re-sent; a refused one is");
      assert.ok(resumed.auto);
    } finally { composio.restore(); }
  }
});

test("a step whose 'started' record cannot be saved is NOT sent", async () => {
  const plan = plainMail();
  const { workflow, supabase, who } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: mail(OK) }, { groq: ["Line."] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: false }, who);
    const realFrom = supabase.from;
    supabase.from = (name) => {
      const query = realFrom(name);
      if (name === "runs") query.insert = () => { query.then = (resolve) => resolve({ data: null, error: { code: "XX000" } }); return query; };
      return query;
    };
    const approved = await approveActionStep({ runId: first.runId, index }, who);
    assert.match(approved.error, /could not record that this step was starting/);
    assert.equal(sends(composio).length, 0);
  } finally { composio.restore(); }
});

// ---- the pause switch and the "changed since you read it" guard ----
const pausedDatabase = (supabase) => { supabase.tables.app_controls = [{ name: "paused", value: true }]; return supabase; };

test("while Hushwork is paused nothing that writes starts and the AI is not asked, and the stop is not recorded as a failure; unpausing brings it back", async () => {
  const plan = briefing();
  const { workflow, supabase, who } = setup(plan);
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: mail(OK) }, { groq: ["Line."] });
  try {
    pausedDatabase(supabase);
    const first = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.match(first.auto.reason, /Hushwork is paused right now/);
    assert.equal(first.auto.done, 0);
    assert.equal(composio.calls.length, 0, "no AI call and no send");
    const writes = supabase.tables.runs.filter((row) => row.mode === "live" && row.results[0].status === "pending");
    assert.equal(writes.length, 0, "no 'started' record either: nothing was tried");
    supabase.tables.app_controls[0].value = false;
    const again = await resumeRun({ runId: first.runId }, who);
    assert.equal(again.auto.stoppedAt, 0);
    assert.equal(sends(composio).length, 1);
  } finally { composio.restore(); }
});

test("a step is NOT sent when its words changed after the person read the card (the AI step ran again), but a matching card, or no card at all (Auto mode), sends", async () => {
  const { actionSummary } = await import("./run-engine.js");
  const plan = briefing();
  const { workflow, supabase, who } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: mail(OK) }, { groq: ["First answer.", "A different answer."] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: false }, who);
    const { approveAiStep } = await import("./run-core.js");
    assert.equal((await approveAiStep({ runId: first.runId, index: 1 }, who)).error, undefined);
    const email = plan[index];
    const card = actionSummary(email, "First answer.", [], "me@example.com");
    // the AI step is approved again somewhere else: the words now read differently
    assert.equal((await approveAiStep({ runId: first.runId, index: 1 }, who)).error, undefined);
    const stale = await approveActionStep({ runId: first.runId, index, seen: card }, who);
    assert.equal(stale.changed, true);
    assert.match(stale.error, /changed after you opened this page/);
    assert.equal(sends(composio).length, 0, "nothing was sent");
    assert.deepEqual(history(supabase, first.runId, index), [], "and nothing was recorded as started");
    const fresh = await approveActionStep({ runId: first.runId, index, seen: actionSummary(email, "A different answer.", [], "me@example.com") }, who);
    assert.equal(fresh.error, undefined);
    assert.equal(sends(composio).length, 1);
    assert.equal(sends(composio)[0].body.arguments.body, "A different answer.");
  } finally { composio.restore(); }
});
