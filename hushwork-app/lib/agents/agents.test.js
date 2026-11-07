// Agents (lib/agents/create.js): one sentence in, a saved agent out, scheduled if the sentence says when, run once straight away.
// These run the real code with a pretend database (lib/test-server-support.js) and no AI key, so the plan is the keyword plan.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { makeFakeSupabase } from "../test-server-support.js";
import { findWhen, withSentenceSchedule, planAgent, createAgent } from "./create.js";
import { SETUP } from "./kinds.js";
import { parseWhen } from "../schedule-text.js";

const quiet = () => {};
const person = () => {
  const id = randomUUID();
  return { user: { id, email: "me@example.com" }, supabase: makeFakeSupabase({ asUser: id }) };
};

test("findWhen picks the time out of a whole sentence, in words the schedule reader understands", () => {
  const cases = [
    ["Every weekday at 9, sum up today's meetings and email them to me", { frequency: "weekdays", hour: 9, minute: 0 }],
    ["Every Friday at 4pm, list my unpaid invoices", { frequency: "weekly", hour: 16, minute: 0, weekday: 5 }],
    ["Please check my inbox every day at 17:30 and tell me who needs a reply", { frequency: "daily", hour: 17, minute: 30 }],
    ["Daily at 8 am, tell me the weather", { frequency: "daily", hour: 8, minute: 0 }],
    ["Look at my Stripe payments every hour", { frequency: "hourly", minute: 0 }],
  ];
  for (const [sentence, want] of cases) {
    const words = findWhen(sentence);
    assert.ok(words, `found a time in: ${sentence}`);
    const read = parseWhen(words);
    for (const [key, value] of Object.entries(want)) assert.equal(read[key], value, `${sentence}: ${key}`);
  }
  for (const sentence of ["Tell me which task to do first", "Email me 5 post ideas", "Remind me about the 3 invoices", ""]) assert.equal(findWhen(sentence), "", `no time in: ${sentence}`);
});

test("withSentenceSchedule: the sentence's time fills a Start step that has none; the AI's own readable time and a watch Start are kept", () => {
  const manual = [{ icon: "Zap", title: "When I ask", detail: "", kind: "trigger", fields: { how: "manual", when: "" } }, { icon: "Sparkles", title: "Ask the AI", detail: "x", kind: "ai", fields: { task: "x", uses: "nothing", address: "" } }];
  const made = withSentenceSchedule(manual, "Every Monday at 9, tell me my week");
  assert.equal(made[0].fields.how, "schedule");
  assert.equal(parseWhen(made[0].fields.when).weekday, 1);
  assert.equal(made[1], manual[1], "the other steps are untouched");
  assert.equal(withSentenceSchedule(manual, "Tell me my week"), manual, "no time in the sentence: unchanged");

  const ai = [{ ...manual[0], fields: { how: "schedule", when: "Every day at 7:00" } }, manual[1]];
  assert.equal(withSentenceSchedule(ai, "Every Monday at 9, tell me my week"), ai, "the AI already wrote a readable time: it wins");
  const watch = [{ ...manual[0], fields: { how: "watch", when: "" } }, manual[1]];
  assert.equal(withSentenceSchedule(watch, "Every hour, tell me about new leads")[0].fields.how, "watch", "a watch stays a watch");
  const lone = [manual[1]];
  assert.equal(withSentenceSchedule(lone, "Every Monday at 9"), lone, "no Start step: nothing to change");
});

test("planAgent with no AI key: the keyword plan, through the same strict gate, with the sentence's schedule and an honest notice", async () => {
  const planned = await planAgent({ prompt: "Every weekday at 9, sum up my calendar and email it to me", userId: randomUUID(), groqKey: null, log: quiet });
  assert.ok(Array.isArray(planned.steps));
  assert.equal(planned.steps[0].kind, "trigger");
  assert.equal(planned.steps[0].fields.how, "schedule");
  assert.equal(parseWhen(planned.steps[0].fields.when).frequency, "weekdays");
  assert.ok(planned.steps.some((step) => step.kind === "ai" && step.fields.uses === "calendar"), "an Ask the AI step looks at the calendar");
  assert.ok(planned.steps.some((step) => step.kind === "action" && step.fields.action === "gmail_send" && step.fields.target === "{myEmail}"), "'email it to me' is a real email to the person");
  assert.match(planned.notice, /keyword preview/);
});

test("createAgent saves an agent (kind = agent), runs it once with writing held back, and says what waits for Approve", async () => {
  const { user, supabase } = person();
  const calls = [];
  const run = async (input, who) => { calls.push({ input, who }); return { ok: true, runId: "run-1", auto: { done: 1, stoppedAt: 0 } }; };
  const result = await createAgent({ prompt: "Look at my calendar and email me a summary", user, supabase, groqKey: null, log: quiet, run });
  assert.equal(result.ok, true);
  assert.equal(result.runId, "run-1");
  assert.equal(result.waiting, 1, "the email waits for Approve");
  const [row] = supabase.tables.workflows;
  assert.equal(row.kind, "agent");
  assert.equal(row.user_id, user.id);
  assert.equal(row.prompt, "Look at my calendar and email me a summary");
  assert.equal(result.id, row.id);
  assert.deepEqual(calls[0].input, { id: row.id, auto: true, allowWrites: false }, "runs by itself, but a step that writes is never done without the person's Approve");
  assert.equal(calls[0].who.user, user);
  assert.equal(result.scheduleText, "", "no time in the sentence: no schedule");
});

test("createAgent: a time in the sentence becomes a real schedule that starts with writing OFF", async () => {
  const { user, supabase } = person();
  supabase.tables.schedules = [];
  const run = async () => ({ ok: true, runId: "run-2", auto: { done: 0, stoppedAt: 0 } });
  const result = await createAgent({ prompt: "Every Monday at 9:30, sum up my Linear tasks and email them to me", user, supabase, groqKey: null, tzOffset: 330, log: quiet, run });
  assert.equal(result.ok, true);
  assert.match(result.scheduleText, /^Scheduled: Every week on Monday at 09:30/);
  assert.match(result.scheduleText, /Agents page/, "points to the Agents page, not the home page");
  const [schedule] = supabase.tables.schedules;
  assert.equal(schedule.workflow_id, result.id);
  assert.equal(schedule.frequency, "weekly");
  assert.equal(schedule.weekday, 1);
  assert.equal(schedule.hour, 9);
  assert.equal(schedule.minute, 30);
  assert.equal(schedule.tz_offset, 330, "in the person's own time");
  assert.equal(schedule.allow_writes, false, "a scheduled agent only reads by itself until the person ticks it on");
});

test("createAgent: the real run engine saves the run; with no AI key the Ask the AI step stops it, and the agent is still saved", async () => {
  const { user, supabase } = person();
  const result = await createAgent({ prompt: "Tell me which Linear task to do first", user, supabase, groqKey: null, log: quiet });
  assert.equal(result.ok, true);
  assert.ok(result.runId, "a run was saved");
  const practice = supabase.tables.runs.find((one) => one.mode === "practice");
  assert.equal(practice.workflow_id, result.id);
  assert.ok(result.auto.stoppedAt > 0, "the AI step could not run without a key, so the run says where it stopped");
  assert.equal(supabase.tables.workflows.length, 1);
});

test("createAgent: before supabase/agents.sql is run, the person is told the one setup step; a failed first run still keeps the agent", async () => {
  const { user, supabase } = person();
  const insert = supabase.from;
  supabase.from = (name) => {
    const query = insert(name);
    if (name === "workflows") query.insert = () => ({ select: async () => ({ data: null, error: { code: "PGRST204" } }) });
    return query;
  };
  assert.deepEqual(await createAgent({ prompt: "Tell me which task to do first", user, supabase, groqKey: null, log: quiet }), { error: SETUP });

  const other = person();
  const failed = await createAgent({ prompt: "Tell me which task to do first", ...other, groqKey: null, log: quiet, run: async () => ({ error: "Run history needs one setup step." }) });
  assert.equal(failed.ok, true);
  assert.equal(failed.runError, "Run history needs one setup step.");
  assert.equal(failed.runId, undefined);
  assert.equal(other.supabase.tables.workflows.length, 1);
});
