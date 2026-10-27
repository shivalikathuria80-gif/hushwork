// Rules of WATCH MODE that need no database: the speaking rules (quiet hours, the daily cap, the person's own day), the quiet marker and the Runs page line.
import test from "node:test";
import assert from "node:assert/strict";
import { DAILY_CAP, canSpeak, inQuietHours, isNothingNew, isScheduledStart, isWatchPlan, isWatchStart, localDayStartMs, localHour, quietLine, quietRunIds } from "./watch-rules.js";

const at = (text) => Date.parse(text);
const INDIA = 330; // minutes east of UTC
const NEW_YORK_WINTER = -300;
const NEPAL = 345; // a time zone that is not a whole hour from UTC

test("localHour: the hour on the person's own wall clock, east and west of UTC, even across the date line", () => {
  assert.equal(localHour(at("2026-10-21T04:00:00Z"), INDIA), 9);
  assert.equal(localHour(at("2026-10-21T04:00:00Z"), NEW_YORK_WINTER), 23);
  assert.equal(localHour(at("2026-10-21T04:00:00Z"), 0), 4);
  assert.equal(localHour(at("2026-10-21T23:30:00Z"), INDIA), 5, "wraps past midnight");
  assert.equal(localHour(at("2026-10-21T04:00:00Z"), NEPAL), 9);
  assert.equal(localHour(at("2026-10-21T04:00:00Z"), "nonsense"), 4, "a broken offset counts as UTC instead of breaking");
});

test("quiet hours are 20:00 to 08:00 in the person's time: 20:00 is quiet, 08:00 is not, and midnight is inside", () => {
  // India (+5:30): 20:00 there is 14:30 UTC
  assert.equal(inQuietHours(at("2026-10-21T14:29:00Z"), INDIA), false, "19:59");
  assert.equal(inQuietHours(at("2026-10-21T14:30:00Z"), INDIA), true, "20:00");
  assert.equal(inQuietHours(at("2026-10-21T18:30:00Z"), INDIA), true, "00:00, across midnight");
  assert.equal(inQuietHours(at("2026-10-21T02:29:00Z"), INDIA), true, "07:59");
  assert.equal(inQuietHours(at("2026-10-21T02:30:00Z"), INDIA), false, "08:00");
  assert.equal(inQuietHours(at("2026-10-21T09:30:00Z"), INDIA), false, "15:00, midday");
  // New York in winter (-5:00, a NEGATIVE offset): 20:00 there is 01:00 UTC the next day
  assert.equal(inQuietHours(at("2026-10-22T00:59:00Z"), NEW_YORK_WINTER), false, "19:59");
  assert.equal(inQuietHours(at("2026-10-22T01:00:00Z"), NEW_YORK_WINTER), true, "20:00");
  assert.equal(inQuietHours(at("2026-10-22T12:59:00Z"), NEW_YORK_WINTER), true, "07:59");
  assert.equal(inQuietHours(at("2026-10-22T13:00:00Z"), NEW_YORK_WINTER), false, "08:00");
  // the SAME instant is quiet for one person and not for another
  const instant = at("2026-10-21T15:00:00Z");
  assert.equal(inQuietHours(instant, INDIA), true, "20:30 in India");
  assert.equal(inQuietHours(instant, NEW_YORK_WINTER), false, "10:00 in New York");
});

test("localDayStartMs: the person's midnight, not the server's", () => {
  assert.equal(new Date(localDayStartMs(at("2026-10-21T04:00:00Z"), INDIA)).toISOString(), "2026-10-20T18:30:00.000Z", "09:30 in India on the 21st: the day began at 00:00 India = 18:30 UTC on the 20th");
  assert.equal(new Date(localDayStartMs(at("2026-10-21T02:00:00Z"), NEW_YORK_WINTER)).toISOString(), "2026-10-20T05:00:00.000Z", "21:00 on the 20th in New York: the day began at 05:00 UTC on the 20th");
  assert.equal(new Date(localDayStartMs(at("2026-10-21T00:00:00Z"), 0)).toISOString(), "2026-10-21T00:00:00.000Z", "exactly at midnight it is the new day");
  assert.equal(new Date(localDayStartMs(at("2026-10-21T23:59:59Z"), 0)).toISOString(), "2026-10-21T00:00:00.000Z");
  assert.equal(new Date(localDayStartMs(at("2026-10-21T04:00:00Z"), NEPAL)).toISOString(), "2026-10-20T18:15:00.000Z");
  for (const tz of [INDIA, NEW_YORK_WINTER, NEPAL, 0, -720, 840]) {
    const now = at("2026-03-08T13:07:00Z");
    const start = localDayStartMs(now, tz);
    assert.ok(start <= now && now - start < 86_400_000, `${tz}: the day start is within the last 24 hours`);
    assert.equal(localHour(start, tz), 0, `${tz}: it is local midnight`);
  }
});

test("canSpeak: at most 3 a day, never in quiet hours, and both rules must allow it", () => {
  assert.equal(DAILY_CAP, 3);
  const morning = at("2026-10-21T04:00:00Z"); // 09:30 in India
  const night = at("2026-10-21T16:00:00Z"); // 21:30 in India
  assert.deepEqual([0, 1, 2, 3, 4].map((spokenToday) => canSpeak({ spokenToday, nowMs: morning, tzOffset: INDIA })), [true, true, true, false, false]);
  assert.equal(canSpeak({ spokenToday: 0, nowMs: night, tzOffset: INDIA }), false, "no speaking at night even if it has not spoken today");
  assert.equal(canSpeak({ spokenToday: 3, nowMs: night, tzOffset: INDIA }), false);
  assert.equal(canSpeak({ spokenToday: "x", nowMs: morning, tzOffset: INDIA }), false, "a count that makes no sense means stay silent");
  assert.equal(canSpeak({ spokenToday: undefined, nowMs: morning, tzOffset: INDIA }), false, "an unknown count means stay silent");
});

test("the quiet marker: NOTHING NEW at the start of an answer, any capitals, spaces ignored; nothing else counts", () => {
  for (const yes of ["NOTHING NEW", "nothing new", "  Nothing New.\n", "NOTHING NEW since 9:00", "Nothing new, all quiet"]) assert.equal(isNothingNew(yes), true, yes);
  for (const no of ["", "   ", "Something new: an invoice", "There is NOTHING NEW to report", "NOTHING NEWSLETTER", "No news", null, undefined, 5, ["NOTHING NEW"]]) assert.equal(isNothingNew(no), false, String(no));
});

test("a watch workflow is told apart by its saved Start step alone", () => {
  const watch = { kind: "trigger", fields: { how: "watch", when: "Every hour" } };
  assert.equal(isWatchPlan([watch, { kind: "ai", fields: {} }]), true);
  assert.equal(isWatchStart(watch), true);
  assert.equal(isScheduledStart(watch), true, "a watch Start makes a real schedule");
  assert.equal(isScheduledStart({ kind: "trigger", fields: { how: "schedule" } }), true);
  for (const other of [{ kind: "trigger", fields: { how: "manual" } }, { kind: "trigger", fields: { how: "email" } }, { kind: "ai", fields: { how: "watch" } }, {}, null, undefined]) {
    assert.equal(isScheduledStart(other), false);
    assert.equal(isWatchStart(other), false);
  }
  assert.equal(isWatchPlan([{ kind: "ai", fields: {} }, watch]), false, "only the FIRST step counts");
  assert.equal(isWatchPlan([]), false);
  assert.equal(isWatchPlan(null), false);
  assert.equal(isWatchPlan("watch"), false);
});

test("quietRunIds: only a practice run with a saved quiet record is quiet; the line is singular or plural", () => {
  const runs = [
    { id: "q1", live: false, results: [{ kind: "trigger" }] },
    { id: "live-quiet", live: true, results: [{ title: "Nothing new", quiet: true, from: "q1", fromStep: 1 }] },
    { id: "p2", live: false, results: [] },
    { id: "live-normal", live: true, results: [{ title: "Done", from: "p2", fromStep: 1 }] },
    { id: "live-note", live: true, results: [{ title: "Stopped", note: true, from: "p3", fromStep: 1 }] },
    { id: "q4", live: false, results: [] },
    { id: "live-quiet-2", live: true, results: [{ quiet: true, from: "q4", fromStep: 2 }] },
    { id: "live-quiet-2b", live: true, results: [{ quiet: true, from: "q4", fromStep: 2 }] },
    { id: "practice-with-flag", live: false, results: [{ quiet: true, from: "p5" }] },
  ];
  assert.deepEqual([...quietRunIds(runs)].sort(), ["q1", "q4"], "p2 and p3 are not quiet; a flag on a practice run itself is ignored; the same run counts once");
  assert.equal(quietRunIds([]).size, 0);
  assert.equal(quietRunIds(null).size, 0);
  assert.equal(quietRunIds([null, {}, { live: true }, { live: true, results: [null] }]).size, 0);
  assert.equal(quietLine(1), "1 quiet check: nothing new");
  assert.equal(quietLine(2), "2 quiet checks: nothing new");
  assert.equal(quietLine(14), "14 quiet checks: nothing new");
});
