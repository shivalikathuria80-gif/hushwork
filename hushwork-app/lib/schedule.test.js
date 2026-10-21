import test from "node:test";
import assert from "node:assert/strict";
import { checkSchedule, nextRun, describeSchedule, FREQUENCIES } from "./schedule.js";

const at = (iso) => Date.parse(iso);
const iso = (ms) => new Date(ms).toISOString();

test("a good form is cleaned; anything odd is refused with a plain sentence", () => {
  assert.deepEqual(checkSchedule({ frequency: "weekdays", hour: 9, minute: 30, tzOffset: 330, allowWrites: true }).value, { frequency: "weekdays", hour: 9, minute: 30, weekday: 0, tzOffset: 330, allowWrites: true, enabled: true });
  assert.deepEqual(checkSchedule({ frequency: "hourly", hour: 99, minute: 15, tzOffset: 0 }).value, { frequency: "hourly", hour: 0, minute: 15, weekday: 0, tzOffset: 0, allowWrites: false, enabled: true }, "the hour is ignored for hourly");
  assert.equal(checkSchedule({ frequency: "weekly", hour: 18, minute: 0, weekday: 1, tzOffset: -300 }).value.weekday, 1);
  for (const bad of [
    null, {}, { frequency: "nope", hour: 1, minute: 1, tzOffset: 0 }, { frequency: "__proto__", hour: 1, minute: 1, tzOffset: 0 }, { frequency: "daily", hour: 24, minute: 0, tzOffset: 0 },
    { frequency: "daily", hour: 1.5, minute: 0, tzOffset: 0 }, { frequency: "daily", hour: "9", minute: 0, tzOffset: 0 }, { frequency: "daily", hour: 9, minute: 60, tzOffset: 0 },
    { frequency: "weekly", hour: 9, minute: 0, weekday: 7, tzOffset: 0 }, { frequency: "weekly", hour: 9, minute: 0, tzOffset: 0 }, { frequency: "daily", hour: 9, minute: 0, tzOffset: 9999 }, { frequency: "daily", hour: 9, minute: 0 },
  ]) assert.ok(checkSchedule(bad).error, JSON.stringify(bad));
  assert.equal(checkSchedule({ frequency: "daily", hour: 9, minute: 0, tzOffset: 0, allowWrites: "yes" }).value.allowWrites, false, "only a real true allows writing");
  assert.equal(checkSchedule({ frequency: "daily", hour: 9, minute: 0, tzOffset: 0, enabled: false }).value.enabled, false);
});

test("daily: the next 09:00 in the person's own time, today if it is still ahead, otherwise tomorrow", () => {
  const india = { frequency: "daily", hour: 9, minute: 0, weekday: 0, tzOffset: 330 }; // 09:00 in India = 03:30 UTC
  assert.equal(iso(nextRun(india, at("2026-10-21T01:00:00Z"))), "2026-10-21T03:30:00.000Z");
  assert.equal(iso(nextRun(india, at("2026-10-21T03:30:00Z"))), "2026-10-22T03:30:00.000Z", "exactly on time counts as already done");
  assert.equal(iso(nextRun(india, at("2026-10-21T20:00:00Z"))), "2026-10-22T03:30:00.000Z");
  const us = { frequency: "daily", hour: 9, minute: 0, weekday: 0, tzOffset: -300 };
  assert.equal(iso(nextRun(us, at("2026-10-21T10:00:00Z"))), "2026-10-21T14:00:00.000Z");
});

test("weekdays skip Saturday and Sunday; weekly waits for its day", () => {
  const weekdays = { frequency: "weekdays", hour: 9, minute: 0, weekday: 0, tzOffset: 0 };
  assert.equal(iso(nextRun(weekdays, at("2026-10-23T10:00:00Z"))), "2026-10-26T09:00:00.000Z", "Friday after 9am -> Monday");
  assert.equal(iso(nextRun(weekdays, at("2026-10-24T08:00:00Z"))), "2026-10-26T09:00:00.000Z", "Saturday -> Monday");
  assert.equal(iso(nextRun(weekdays, at("2026-10-21T08:00:00Z"))), "2026-10-21T09:00:00.000Z");
  const monday = { frequency: "weekly", hour: 18, minute: 30, weekday: 1, tzOffset: 0 };
  assert.equal(iso(nextRun(monday, at("2026-10-21T00:00:00Z"))), "2026-10-26T18:30:00.000Z");
  assert.equal(iso(nextRun(monday, at("2026-10-26T18:30:00Z"))), "2026-11-02T18:30:00.000Z");
});

test("hourly: the next time the clock shows the chosen minute (also for a half-hour time zone)", () => {
  const quarter = { frequency: "hourly", hour: 0, minute: 15, weekday: 0, tzOffset: 0 };
  assert.equal(iso(nextRun(quarter, at("2026-10-21T10:10:00Z"))), "2026-10-21T10:15:00.000Z");
  assert.equal(iso(nextRun(quarter, at("2026-10-21T10:15:00Z"))), "2026-10-21T11:15:00.000Z");
  assert.equal(iso(nextRun({ ...quarter, tzOffset: 330 }, at("2026-10-21T10:10:00Z"))), "2026-10-21T10:45:00.000Z", "India is half an hour off UTC: :15 on its clock is :45 in UTC");
});

test("the next run is always in the future, whatever the schedule and the moment", () => {
  for (const frequency of Object.keys(FREQUENCIES)) {
    for (const tzOffset of [-720, -330, 0, 60, 330, 840]) {
      for (let step = 0; step < 60; step += 1) {
        const from = at("2026-01-01T00:00:00Z") + step * 6_043_000 * 7;
        const schedule = { frequency, hour: step % 24, minute: (step * 7) % 60, weekday: step % 7, tzOffset };
        const next = nextRun(schedule, from);
        assert.ok(next > from && next - from <= 8 * 86_400_000, `${frequency} ${tzOffset} ${iso(from)} -> ${iso(next)}`);
      }
    }
  }
});

test("a schedule is described in plain words", () => {
  assert.equal(describeSchedule({ frequency: "daily", hour: 9, minute: 5 }), "Every day at 09:05");
  assert.equal(describeSchedule({ frequency: "weekdays", hour: 18, minute: 0 }), "Every weekday at 18:00");
  assert.equal(describeSchedule({ frequency: "weekly", hour: 7, minute: 30, weekday: 3 }), "Every week on Wednesday at 07:30");
  assert.equal(describeSchedule({ frequency: "hourly", hour: 0, minute: 0 }), "Every hour, on the hour");
  assert.equal(describeSchedule({ frequency: "hourly", hour: 0, minute: 20 }), "Every hour, 20 minutes past");
});
