// The bundle workflows, RUN with the real server code (lib/run-core.js), a pretend database and a pretend Composio/Groq: what a person gets after turning a bundle on
// and pressing Run. Proves that a bundle workflow does exactly what its words promise, writes only after the approval step, and is safe to continue after a stop.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { makeFakeSupabase, fakeComposio, GMAIL_TOOL } from "../test-server-support.js";
import { enableBundle } from "./enable.js";

process.env["COMPOSIO" + "_API_KEY"] = "ak_test_key_not_real";
process.env["GROQ" + "_API_KEY"] = "gsk_test_key_not_real";
const { startPracticeRun, resumeRun } = await import("../run-core.js");

const OK = { successful: true, data: {} };
const posts = (composio) => composio.calls.filter((call) => call.method === "POST" && call.path.startsWith("/tools/execute/"));
const sends = (composio) => posts(composio).filter((call) => call.path === "/tools/execute/GMAIL_SEND_EMAIL");

// A person who turned a bundle on, and the id of one of the workflows it saved.
async function withBundle(bundleId, title) {
  const user = randomUUID();
  const supabase = makeFakeSupabase({ asUser: user });
  supabase.tables.enabled_bundles = [];
  supabase.unique = { enabled_bundles: ["user_id", "bundle_id"] };
  assert.equal((await enableBundle(supabase, user, bundleId)).ok, true);
  const workflow = supabase.tables.workflows.find((row) => row.name === title);
  return { supabase, workflow, who: { user: { id: user, email: "me@example.com" }, supabase } };
}
const emailAt = (workflow) => workflow.plan.findIndex((step) => step.kind === "action");

test("Weekly Money Report: reads Stripe, then emails the summary to the person once, after the approval step", async () => {
  const { workflow, who, supabase } = await withBundle("finance-ops", "Weekly Money Report");
  const composio = fakeComposio({ STRIPE_LIST_CHARGES: { answer: OK }, GMAIL_SEND_EMAIL: GMAIL_TOOL }, { groq: ["TOOL", "12 payments, 3,400 in total."] });
  try {
    const run = await startPracticeRun({ id: workflow.id, auto: true }, who);
    assert.equal(run.auto.stoppedAt, 0);
    assert.equal(posts(composio)[0].path, "/tools/execute/STRIPE_LIST_CHARGES", "read first");
    assert.equal(sends(composio).length, 1);
    assert.equal(sends(composio)[0].body.arguments.recipient_email, "me@example.com");
    assert.equal(sends(composio)[0].body.arguments.subject, "Your weekly money report");
    assert.equal(sends(composio)[0].body.arguments.body, "12 payments, 3,400 in total.");
    const again = await resumeRun({ runId: run.runId }, who);
    assert.deepEqual(again.auto, { done: 0, stoppedAt: 0, skipped: 2 }, "a finished run is safe to continue: nothing repeats");
    assert.equal(sends(composio).length, 1);
    assert.equal(supabase.tables.runs.filter((row) => row.mode === "practice").length, 1);
  } finally { composio.restore(); }
});

test("Weekly Dev Digest: two reads, one email that carries both answers in order", async () => {
  const { workflow, who } = await withBundle("dev-admin", "Weekly Dev Digest");
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL }, { groq: ["TOOL", "GitHub: 2 reviews waiting.", "TOOL", "PagerDuty: no open incidents."] });
  try {
    const run = await startPracticeRun({ id: workflow.id, auto: true }, who);
    assert.equal(run.auto.stoppedAt, 0);
    assert.deepEqual(posts(composio).map((call) => call.path), ["/tools/execute/GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER", "/tools/execute/PAGERDUTY_FETCH_INCIDENT_LIST", "/tools/execute/GMAIL_SEND_EMAIL"]);
    assert.equal(sends(composio)[0].body.arguments.body, "GitHub: 2 reviews waiting.\n\nPagerDuty: no open incidents.");
  } finally { composio.restore(); }
});

test("Weekly Post Ideas: the AI thinks (reads no app), the email goes to the person", async () => {
  const { workflow, who } = await withBundle("marketing-growth", "Weekly Post Ideas");
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL }, { groq: ["1. Why I stopped saying yes to everything"] });
  try {
    const run = await startPracticeRun({ id: workflow.id, auto: true }, who);
    assert.equal(run.auto.stoppedAt, 0);
    assert.equal(posts(composio).length, 1, "only the email touched an app");
    assert.match(sends(composio)[0].body.arguments.body, /^1\. Why I stopped/);
  } finally { composio.restore(); }
});

test("Invoice Chaser without Google connected stops at the Gmail step with a clear reason, writes nothing, and can be continued later", async () => {
  const { workflow, who } = await withBundle("finance-ops", "Invoice Chaser");
  const composio = fakeComposio({ STRIPE_LIST_INVOICES: { answer: OK }, GMAIL_SEND_EMAIL: GMAIL_TOOL }, { groq: ["TOOL", "Ana: 500, 9 days late."] });
  try {
    const run = await startPracticeRun({ id: workflow.id, auto: true }, who);
    const gmailStep = workflow.plan.findIndex((step) => step.kind === "ai" && step.fields.uses === "gmail");
    assert.equal(run.auto.stoppedAt, gmailStep + 1);
    assert.match(run.auto.reason, /Google/);
    assert.equal(sends(composio).length, 0, "nothing was written");
    assert.equal(emailAt(workflow) > gmailStep, true);
    const resumed = await resumeRun({ runId: run.runId }, who);
    assert.equal(resumed.auto.skipped, 1, "the Stripe step that already worked is not asked again");
    assert.equal(posts(composio).filter((call) => call.path === "/tools/execute/STRIPE_LIST_INVOICES").length, 1);
  } finally { composio.restore(); }
});
