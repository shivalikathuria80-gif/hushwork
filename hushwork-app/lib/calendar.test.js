import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendar, dayStart, occurrences, untilText, DAYS } from "./calendar.js";

const NOW = Date.parse("2026-11-09T10:30:00Z"); // a Monday
const H = 3600_000;
const D = 24 * H;
const sched = (extra) => ({ frequency: "daily", hour: 9, minute: 0, weekday: 1, tzOffset: 0, allowWrites: false, enabled: true, ...extra });

test("occurrences lists every due time in the window, in order", () => {
  const times = occurrences(sched({ frequency: "weekdays" }), NOW, NOW + 7 * D);
  assert.equal(times.length, 5); // Tue to Fri, then next Monday (today's 9:00 has passed)
  assert.deepEqual(times.map((t) => new Date(t).getUTCDay()), [2, 3, 4, 5, 1]);
  assert.ok(times.every((t, i) => i === 0 || t > times[i - 1]));
});

test("dayStart follows the visitor's time zone", () => {
  assert.equal(new Date(dayStart(NOW, 0)).toISOString(), "2026-11-09T00:00:00.000Z");
  // India (+5:30): 10:30 UTC is 16:00 local, the local day began at 18:30 UTC the day before
  assert.equal(new Date(dayStart(NOW, 330)).toISOString(), "2026-11-08T18:30:00.000Z");
  // west of UTC
  assert.equal(new Date(dayStart(Date.parse("2026-11-09T02:00:00Z"), -300)).toISOString(), "2026-11-08T05:00:00.000Z");
});

test("planned runs land on their days, with the next one and the totals", () => {
  const cal = buildCalendar({
    now: NOW,
    items: [
      { workflowId: "a", name: "Morning briefing", schedule: sched({ hour: 8 }) },
      { workflowId: "b", name: "Invoice chaser", schedule: sched({ frequency: "weekly", weekday: 3, hour: 15, allowWrites: true }) },
      { workflowId: "c", name: "Paused one", schedule: sched({ enabled: false }) },
      { workflowId: "d", name: "No schedule" },
    ],
  });
  assert.equal(cal.days.length, DAYS);
  assert.equal(cal.days[0].events.length, 0); // 8:00 today is gone
  assert.deepEqual(cal.days[1].events.map((e) => e.name), ["Morning briefing"]);
  assert.deepEqual(cal.days[2].events.map((e) => [e.name, e.sends]), [["Morning briefing", false], ["Invoice chaser", true]]);
  assert.equal(cal.stats.planned, 7); // 6 briefings (Tue..Sun) + 1 chaser
  assert.equal(cal.stats.sending, 1);
  assert.equal(cal.stats.agents, 2);
  assert.equal(cal.stats.busiest, 2);
  assert.equal(cal.next.name, "Morning briefing");
  assert.equal(new Date(cal.next.at).toISOString(), "2026-11-10T08:00:00.000Z");
  assert.deepEqual(cal.paused.map((p) => p.name), ["Paused one"]);
});

test("an hourly schedule becomes one chip a day with a count", () => {
  const cal = buildCalendar({ now: NOW, items: [{ workflowId: "h", name: "Inbox watch", schedule: sched({ frequency: "hourly", minute: 15 }) }] });
  assert.equal(cal.days[0].events.length, 1);
  assert.equal(cal.days[0].events[0].kind, "hourly");
  assert.equal(cal.days[0].events[0].count, 13); // 11:15 .. 23:15
  assert.equal(cal.days[1].events[0].count, 24);
  assert.equal(cal.stats.planned, 13 + 6 * 24);
});

test("today's runs show up, older or future ones do not", () => {
  const cal = buildCalendar({
    now: NOW,
    items: [],
    runs: [
      { t: new Date(NOW - 2 * H).toISOString(), tone: "good", name: "Ran", workflowId: "a" },
      { t: new Date(NOW - 20 * H).toISOString(), tone: "bad", name: "Yesterday", workflowId: "a" },
      { t: "not a date", tone: "good", name: "Broken", workflowId: "a" },
    ],
  });
  assert.deepEqual(cal.days[0].events.map((e) => [e.kind, e.name, e.tone]), [["ran", "Ran", "good"]]);
  assert.equal(cal.next, null);
  assert.equal(cal.stats.busiest, -1);
});

test("untilText reads like a person", () => {
  assert.equal(untilText(10_000), "now");
  assert.equal(untilText(4 * 60_000), "in 4 min");
  assert.equal(untilText(2 * H + 5 * 60_000), "in 2 h 5 min");
  assert.equal(untilText(3 * H), "in 3 h");
  assert.equal(untilText(50 * H), "in 2 days");
});
