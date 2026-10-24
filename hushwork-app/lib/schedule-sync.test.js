import test from "node:test";
import assert from "node:assert/strict";
import { syncStartSchedule, MAX_SCHEDULES } from "./schedule-sync.js";

const NOW = Date.parse("2026-10-24T08:00:00Z");
const start = (when, how = "schedule") => ({ kind: "trigger", fields: { how, when } });
const ai = { kind: "ai", fields: { task: "Sum up", uses: "nothing", address: "" } };
const note = { kind: "write", fields: { what: "reply", about: "" } }; // only describes a plan: cannot really run

// A pretend database remembering what was written to schedules.
function pretend({ rows = [], loadError = null, writeError = null } = {}) {
  const log = { inserts: [], updates: [] };
  const supabase = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: loadError ? null : rows, error: loadError }) }),
      insert: async (values) => { log.inserts.push(values); return { error: writeError }; },
      update: (values) => ({ eq: () => ({ eq: async () => { log.updates.push(values); return { error: writeError }; } }) }),
    }),
  };
  return { supabase, log };
}
const run = (plan, db, extra = {}) => syncStartSchedule({ supabase: db.supabase, userId: "u1", workflowId: "w1", plan, tzOffset: 330, now: NOW, ...extra });

test("start schedule: a readable Start time makes a real schedule, in the person's time zone, with writing OFF", async () => {
  const db = pretend();
  const { text } = await run([start("Every weekday at 17:30"), ai], db);
  assert.equal(db.log.inserts.length, 1);
  assert.deepEqual({ ...db.log.inserts[0], next_run_at: undefined }, { workflow_id: "w1", frequency: "weekdays", hour: 17, minute: 30, weekday: 0, tz_offset: 330, allow_writes: false, enabled: true, next_run_at: undefined });
  assert.ok(Date.parse(db.log.inserts[0].next_run_at) > NOW, "its next run is in the future");
  assert.match(text, /^Scheduled: Every weekday at 17:30 \(your time\)\./);
  assert.match(text, /only reads by itself/);
});

test("start schedule: an existing schedule only changes its time; writing and paused stay as the person set them; the same time changes nothing", async () => {
  const same = { workflow_id: "w1", frequency: "weekdays", hour: 17, minute: 30, weekday: 0, tz_offset: 330, allow_writes: true, enabled: true };
  const db = pretend({ rows: [same] });
  assert.match((await run([start("Every weekday at 17:30"), ai], db)).text, /Already set/);
  assert.deepEqual([db.log.inserts.length, db.log.updates.length], [0, 0]);

  const moved = pretend({ rows: [{ ...same, enabled: false }] });
  const { text } = await run([start("Every Monday at 9"), ai], moved);
  assert.equal(moved.log.updates.length, 1);
  assert.equal(moved.log.updates[0].allow_writes, true, "writing stays on");
  assert.equal(moved.log.updates[0].enabled, false, "paused stays paused");
  assert.equal(moved.log.updates[0].frequency, "weekly");
  assert.match(text, /paused/);
});

test("start schedule: nothing is created when the Start is not a schedule, the time cannot be read, or nothing can really run", async () => {
  const db = pretend();
  assert.deepEqual(await run([start("", "manual"), ai], db), { text: "" });
  assert.deepEqual(await run([], db), { text: "" });
  assert.deepEqual(await run(undefined, db), { text: "" });
  assert.match((await run([start("Whenever I feel like it"), ai], db)).text, /could not be read.*Every Monday at 9:00/);
  assert.match((await run([start("Every Monday at 9"), note], db)).text, /none of this workflow's steps can really run/);
  assert.deepEqual([db.log.inserts.length, db.log.updates.length], [0, 0]);
});

test("start schedule: the limit of schedules, a missing table, a failed save and a missing time zone each get a plain sentence and never throw", async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    const full = pretend({ rows: Array.from({ length: MAX_SCHEDULES }, (_, i) => ({ workflow_id: `other${i}`, frequency: "daily", hour: 1, minute: 0, weekday: 0, tz_offset: 0, allow_writes: false, enabled: true })) });
    assert.match((await run([start("Every day at 9"), ai], full)).text, /already have 10 schedules/);
    assert.match((await run([start("Every day at 9"), ai], pretend({ loadError: { code: "42P01" } }))).text, /not set up on this server/);
    assert.match((await run([start("Every day at 9"), ai], pretend({ loadError: { code: "XX000", message: "secret detail" } }))).text, /could not be saved/);
    const failed = await run([start("Every day at 9"), ai], pretend({ writeError: { code: "XX000", message: "secret detail" } }));
    assert.ok(/could not be saved/.test(failed.text) && !failed.text.includes("secret detail"));
    assert.match((await run([start("Every day at 9"), ai], pretend(), { tzOffset: undefined })).text, /time zone/);
  } finally {
    console.error = quiet;
  }
});
