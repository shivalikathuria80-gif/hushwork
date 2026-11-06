import test from "node:test";
import assert from "node:assert/strict";

// schedule-notify.js starts with `import "server-only"`. The failure notice is checked from the source text; the nudge below is run for real,
// through the loader npm test uses (scripts/test-hooks.mjs).
import fs from "node:fs";
const source = fs.readFileSync(new URL("./schedule-notify.js", import.meta.url), "utf8");

test("the failure notice: names only the workflow, says where to look, is sent through the person's own Gmail connection to their own address, and never throws", () => {
  assert.match(source, /^import "server-only";/m);
  assert.ok(source.includes('findAction("gmail_send")') && source.includes("found?.user?.email"), "to the person's own address, through Gmail (send)");
  assert.ok(source.includes('.eq("user_id", userId)'), "the workflow name is looked up for that person only");
  assert.ok(source.includes("catch {") && source.includes('return "error"'), "a problem is never thrown at the clock");
  const problemNotice = source.slice(0, source.indexOf("// ---- THE NUDGE")); // the nudge part below saves its own small "Told you" record, so it is checked in watch-mode.test.js
  assert.ok(!/results|answer|outcome/.test(problemNotice.replace(/\/\/.*$/gm, "")), "nothing from the run itself goes into the email");
  assert.ok(source.indexOf('if (!key || !WHAT[status]) return "off"') < source.indexOf("getUserById"), "nothing is looked up when notices are off");
});

// ---- the nudge, run for real (npm test loads "server-only" through scripts/test-hooks.mjs) -----------------------------------------------------------
// The watch wording and its limits are covered in watch-mode.test.js; these check the "waiting" wording (a plain schedule or an agent whose
// writing steps were skipped) and that it keeps every limit the watch nudge has.
const { notifyWatch, watchText } = await import("./schedule-notify.js");
const { makeFakeSupabase } = await import("./test-server-support.js");
const { randomUUID } = await import("node:crypto");
const SITE = "https://hushwork.test";
const MORNING = Date.parse("2026-10-24T09:00:00Z"); // 09:00 for tzOffset 0

function nudgeSetup() {
  const user = randomUUID();
  const workflow = randomUUID();
  const supabase = makeFakeSupabase({ asUser: user, admin: true, workflows: [{ id: workflow, user_id: user, name: "Weekly supplier follow-up", plan: [] }], emails: { [user]: "owner@example.com" } });
  const sent = [];
  const send = async (call) => { sent.push(call); return { ok: true }; };
  const nudge = (more = {}) => notifyWatch({ admin: supabase, userId: user, workflowId: workflow, runId: "run-1", tzOffset: 0, now: MORNING, send, key: "k", siteUrl: SITE, reason: "waiting", ...more });
  return { user, supabase, sent, nudge };
}

test("the 'waiting' nudge: one plain email to the person themself, worded for a step waiting (not 'noticed something'), one link to the Runs page, and a 'Told you' record", async () => {
  const { user, supabase, sent, nudge } = nudgeSetup();
  supabase.tables.runs.push({ id: "run-1", user_id: user, mode: "practice", status: "done", created_at: "2026-10-24T08:00:00.000Z", results: [{ title: "Draft to Acme", detail: "SECRET-STEP-TEXT", outcome: "SECRET-DRAFT" }] });
  assert.equal(await nudge(), "sent");
  assert.equal(sent.length, 1);
  const [call] = sent;
  assert.equal(call.values.target, "owner@example.com");
  assert.equal(call.values.title, "Hushwork: a step is waiting for you");
  assert.equal(call.values.details, `Your scheduled workflow "Weekly supplier follow-up" ran and has a step waiting for you. Open the Runs page to read it and approve only what you want: ${SITE}/app/runs`);
  assert.equal(call.values.details, watchText("Weekly supplier follow-up", SITE, "waiting"));
  assert.ok(!/noticed/.test(call.values.details + call.values.title), "not worded as a watch");
  assert.ok(!/SECRET|Acme/.test(JSON.stringify(call.values)), "nothing from the run");
  assert.deepEqual(call.values.details.match(/https?:\/\/\S+/g), [`${SITE}/app/runs`], "one link, nothing that approves");
  const records = supabase.tables.runs.filter((run) => run.results[0].spoke === true);
  assert.equal(records.length, 1);
  assert.equal(records[0].results[0].from, "run-1");
  assert.match(records[0].results[0].outcome, /a step is waiting for you\. Nothing was approved or sent for you\./);
});

test("the 'waiting' nudge keeps the watch limits: never 20:00 to 08:00 their time, at most 3 a day counted together with watch nudges", async () => {
  const night = nudgeSetup();
  for (const now of ["2026-10-24T20:00:00Z", "2026-10-24T07:59:00Z"]) assert.equal(await night.nudge({ now: Date.parse(now) }), "quiet_hours", now);
  assert.equal(await night.nudge({ tzOffset: 330, now: Date.parse("2026-10-24T16:00:00Z") }), "quiet_hours", "21:30 in India");
  assert.equal(night.sent.length, 0);
  assert.equal(night.supabase.tables.runs.length, 0, "nothing sent, nothing recorded");

  const busy = nudgeSetup();
  assert.equal(await busy.nudge({ reason: "watch" }), "sent");
  assert.equal(await busy.nudge(), "sent");
  assert.equal(await busy.nudge(), "sent");
  assert.equal(await busy.nudge(), "capped", "the 4th of the day is refused, whatever the reason");
  assert.equal(await busy.nudge({ reason: "watch" }), "capped");
  assert.equal(busy.sent.length, 3);
});

test("the nudge wording: the watch email is unchanged, and an unknown reason falls back to it", () => {
  assert.equal(watchText("Invoices", SITE), `Hushwork noticed something in "Invoices". Open the Runs page to read it and approve only what you want: ${SITE}/app/runs`);
  assert.equal(watchText("Invoices", SITE, "watch"), watchText("Invoices", SITE));
  assert.equal(watchText("Invoices", SITE, "something else"), watchText("Invoices", SITE));
  assert.equal(watchText("x".repeat(200), SITE, "waiting").match(/"(x+)"/)[1].length, 80, "the name is cut to 80 characters");
});
