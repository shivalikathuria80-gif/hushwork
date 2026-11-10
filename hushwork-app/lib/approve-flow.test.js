// APPROVE FROM A NOTIFICATION, end to end with the real run code, a pretend database and a pretend Composio/Groq (lib/test-server-support.js):
// a start-link-style run leaves an email step waiting -> the person is told with a single-use link -> the page shows the exact words -> Approve
// does the step once. Plus: the words changed, Turn down, a used link, the digest. Uses the loader in scripts/test-hooks.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { makeFakeSupabase, fakeComposio, GMAIL_TOOL } from "./test-server-support.js";
import { finishSteps } from "./ai/plan.js";
import { sha256 } from "./approve-links.js";

process.env["COMPOSIO" + "_API_KEY"] = "ak_test_key_not_real";
process.env["GROQ" + "_API_KEY"] = "gsk_test_key_not_real";
const { startPracticeRun, approveStep, rejectStep } = await import("./run-core.js");
const { notifyWatch } = await import("./schedule-notify.js");
const { readRun } = await import("./plugin/tools.js");
const { runDigests } = await import("./approve-notify.js");
const { viewLink, decideLink } = await import("./approve-decide.js");

const SITE = "https://hushwork.test";
const MORNING = Date.parse("2026-11-10T09:00:00Z");
const start = { icon: "Link", title: "Start", detail: "x", block: "trigger", choice: "manual", a: "", b: "" };
const ask = { icon: "Sparkles", title: "Draft a reply", detail: "x", block: "ai", choice: "nothing", a: "Draft a short friendly reply", b: "" };
const email = { icon: "Mail", title: "Send an email (Gmail)", detail: "{answer}", block: "action", choice: "gmail_send", a: "me", b: "Reply draft" };
const forgetLimits = () => { delete globalThis.__hushworkAiStepLimits; delete globalThis.__hushworkActionLimits; };

async function setup({ settings = { email: true, links: true }, groq = ["Hi Ana, thanks for writing! SECRET-DRAFT"] } = {}) {
  forgetLimits();
  const user = randomUUID();
  const workflow = randomUUID();
  const supabase = makeFakeSupabase({ admin: true, workflows: [{ id: workflow, user_id: user, name: "Lead replies", plan: finishSteps({ steps: [start, ask, email] }) }], emails: { [user]: "owner@example.com" }, extra: ["notify_settings", "approve_links", "push_subscriptions"] });
  if (settings) supabase.tables.notify_settings.push({ user_id: user, email: true, slack: false, push: false, links: false, digest: false, digest_hour: 9, tz_offset: 0, ...settings });
  const composio = fakeComposio({ GMAIL_SEND_EMAIL: GMAIL_TOOL }, { groq });
  const run = await startPracticeRun({ id: workflow, auto: true, allowWrites: false }, { user: { id: user }, supabase });
  assert.equal(run.auto.waiting, 1, "the email step waits");
  const deps = { admin: supabase, readRun, approveStep, rejectStep, clientFor: () => supabase, now: MORNING };
  const posts = () => composio.calls.filter((call) => call.method === "POST" && call.path === "/tools/execute/GMAIL_SEND_EMAIL");
  const notify = (more = {}) => notifyWatch({ admin: supabase, userId: user, workflowId: workflow, runId: run.runId, tzOffset: 0, now: MORNING, key: "k", siteUrl: SITE, reason: "arrived", pushKeys: {}, ...more });
  return { user, workflow, supabase, composio, run, deps, posts, notify };
}
const codeIn = (text) => text.match(/\/a\/(hwa_[A-Za-z0-9_-]{43})/)?.[1];

test("told -> page shows the exact words -> Approve does the step once; the link is then used", async () => {
  const t = await setup();
  try {
    assert.equal(await t.notify(), "sent");
    const [told] = t.posts();
    assert.equal(told.body.arguments.recipient_email, "owner@example.com", "to the person themself");
    assert.ok(told.body.arguments.body.includes("Send an email (Gmail)"), "names the step by its title");
    assert.ok(!told.body.arguments.body.includes("SECRET"), "never what it would send");
    const code = codeIn(told.body.arguments.body);
    assert.ok(code, "carries a review link");
    assert.equal(t.supabase.tables.approve_links.length, 1);
    assert.ok(!JSON.stringify(t.supabase.tables.approve_links).includes(code), "only the hash of the code is saved");

    const page = await viewLink(t.deps, code);
    assert.ok(page.view, JSON.stringify(page));
    assert.ok(page.view.words.includes("SECRET-DRAFT"), "the page shows the exact words");
    assert.equal(page.view.changed, false);
    assert.equal(sha256(page.view.words), t.supabase.tables.approve_links[0].words_hash);
    assert.equal(t.posts().length, 1, "opening the page sent nothing");

    const done = await decideLink(t.deps, { code, decision: "approve", seen: page.view.words });
    assert.equal(done.ok, true, JSON.stringify(done));
    assert.equal(t.posts().length, 2, "the step itself was done");
    assert.ok(t.posts()[1].body.arguments.body.includes("SECRET-DRAFT"));

    const again = await decideLink(t.deps, { code, decision: "approve", seen: page.view.words });
    assert.equal(again.problem, "used");
    assert.equal(t.posts().length, 2, "never twice");
    assert.equal((await viewLink(t.deps, code)).problem, "used");
  } finally { t.composio.restore(); }
});

test("words that changed after the page was read: nothing is sent, the new words come back, and the link can be used again", async () => {
  const t = await setup();
  try {
    await t.notify();
    const code = codeIn(t.posts()[0].body.arguments.body);
    const out = await decideLink(t.deps, { code, decision: "approve", seen: "Some older words the person read" });
    assert.equal(out.changed, true);
    assert.ok(out.wordsNow.includes("SECRET-DRAFT"));
    assert.equal(t.posts().length, 1, "nothing was sent");
    assert.equal(t.supabase.tables.approve_links[0].used_at, null, "the claim was given back");
    assert.equal((await decideLink(t.deps, { code, decision: "approve", seen: out.wordsNow })).ok, true);
    assert.equal(t.posts().length, 2);
  } finally { t.composio.restore(); }
});

test("Turn down: nothing is sent, the step is marked turned down, the page then says it no longer waits", async () => {
  const t = await setup();
  try {
    await t.notify();
    const code = codeIn(t.posts()[0].body.arguments.body);
    assert.equal((await decideLink(t.deps, { code, decision: "turn_down" })).ok, true);
    assert.equal(t.posts().length, 1);
    const record = t.supabase.tables.runs.find((row) => row.mode === "live" && /Turned down by you/.test(row.results[0].outcome ?? ""));
    assert.ok(record, "a turned-down record");
    assert.equal((await viewLink(t.deps, code)).problem, "used");
  } finally { t.composio.restore(); }
});

test("refusals: bad codes, expired links, Approve without words", async () => {
  const t = await setup();
  try {
    await t.notify();
    const code = codeIn(t.posts()[0].body.arguments.body);
    assert.equal((await viewLink(t.deps, "hwa_" + "x".repeat(43))).problem, "unknown");
    assert.equal((await viewLink(t.deps, "../../etc")).problem, "unknown");
    assert.ok((await decideLink(t.deps, { code, decision: "approve" })).error, "Approve needs the words read");
    assert.ok((await decideLink(t.deps, { code, decision: "send everything" })).error);
    const late = { ...t.deps, now: MORNING + 49 * 3600_000 };
    assert.equal((await viewLink(late, code)).problem, "expired");
    assert.equal((await decideLink(late, { code, decision: "turn_down" })).problem, "expired");
    assert.equal(t.posts().length, 1);
  } finally { t.composio.restore(); }
});

test("no saved settings: exactly the old plain email (one link, to Runs)", async () => {
  const t = await setup({ settings: null });
  try {
    assert.equal(await t.notify(), "sent");
    assert.deepEqual(t.posts()[0].body.arguments.body.match(/https?:\/\/\S+/g), [`${SITE}/app/runs`]);
    assert.equal(t.supabase.tables.approve_links.length, 0);
  } finally { t.composio.restore(); }
});

test("links off: the steps are named, with no review link", async () => {
  const t = await setup({ settings: { email: true, links: false } });
  try {
    assert.equal(await t.notify(), "sent");
    const body = t.posts()[0].body.arguments.body;
    assert.ok(body.includes("Send an email (Gmail)") && !codeIn(body));
    assert.equal(t.supabase.tables.approve_links.length, 0);
  } finally { t.composio.restore(); }
});

test("the digest: the nudge waits for it, then ONE message at the person's hour lists everything waiting, once a day", async () => {
  const t = await setup({ settings: { email: true, links: true, digest: true, digest_hour: 9 } });
  try {
    assert.equal(await t.notify(), "digest");
    assert.equal(t.posts().length, 0, "nothing now");
    // the real sender, through the pretend Composio
    const { runActionTool } = await import("./connectors/composio.js");
    const send = (call) => runActionTool(call);
    assert.deepEqual(await runDigests({ admin: t.supabase, now: MORNING - 3600_000, send, key: "k", siteUrl: SITE, pushKeys: {} }), { looked: 0, sent: 0 }, "08:00 is not their hour");
    assert.deepEqual(await runDigests({ admin: t.supabase, now: MORNING, send, key: "k", siteUrl: SITE, pushKeys: {} }), { looked: 1, sent: 1 });
    const [mail] = t.posts();
    assert.equal(mail.body.arguments.subject, "Hushwork: 1 step waits for you");
    assert.ok(mail.body.arguments.body.includes("Lead replies: Send an email (Gmail)"));
    assert.ok(codeIn(mail.body.arguments.body));
    assert.equal(t.supabase.tables.approve_links[0].channel, "digest");
    assert.deepEqual(await runDigests({ admin: t.supabase, now: MORNING + 20 * 60_000, send, key: "k", siteUrl: SITE, pushKeys: {} }), { looked: 0, sent: 0 }, "once a day");
  } finally { t.composio.restore(); }
});
