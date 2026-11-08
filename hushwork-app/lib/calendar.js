// The Calendar page (app/app/calendar): every run Hushwork has planned for the next 7 days, worked out from the schedules, plus what
// already ran today. Pure code (no database, no clock of its own): the caller hands in the time and the visitor's time zone offset,
// so tests can move both by hand.

import { describeSchedule, nextRun } from "./schedule.js";

const MINUTE = 60_000;
const DAY = 86_400_000;
export const DAYS = 7;
const MAX_PER_SCHEDULE = 200; // a guard; an hourly schedule over 7 days is 168

// Every moment a schedule is due after `from` and up to `to` (milliseconds).
export function occurrences(schedule, from, to) {
  const out = [];
  let at = nextRun(schedule, from);
  while (at <= to && out.length < MAX_PER_SCHEDULE) {
    out.push(at);
    at = nextRun(schedule, at);
  }
  return out;
}

// Midnight (in the visitor's own time, `tzOffset` minutes east of UTC) of the day `ms` falls on, as milliseconds.
export function dayStart(ms, tzOffset) {
  const offset = tzOffset * MINUTE;
  const local = ms + offset;
  return local - (((local % DAY) + DAY) % DAY) - offset;
}

// items: [{ workflowId, name, schedule: { frequency, hour, minute, weekday, tzOffset, allowWrites, enabled } }]
// runs:  [{ t (ISO), tone, name, workflowId }] — recent runs as lib/week-recap.js sorts them (its runDots); only today's are used
// Returns { days, next, paused, stats }. Each day: { start, events }, events sorted by time. An event is
//   { kind: "planned", at, workflowId, name, sends, when }           a run that will happen
//   { kind: "hourly", at, workflowId, name, sends, count, when }     an hourly schedule, one chip per day
//   { kind: "ran", at, workflowId, name, tone }                      a run from earlier today (tone: good, you, bad, quiet, preview)
export function buildCalendar({ items = [], runs = [], now, tzOffset = 0 }) {
  const today = dayStart(now, tzOffset);
  const end = today + DAYS * DAY;
  const days = Array.from({ length: DAYS }, (_, i) => ({ start: today + i * DAY, events: [] }));
  const dayOf = (ms) => Math.floor((ms - today) / DAY);
  const paused = [];
  let planned = 0;
  let sending = 0;
  let next = null;

  for (const item of items) {
    const s = item.schedule;
    if (!s) continue;
    if (s.enabled === false) { paused.push({ workflowId: item.workflowId, name: item.name, when: describeSchedule(s) }); continue; }
    const base = { workflowId: item.workflowId, name: item.name, sends: s.allowWrites === true, when: describeSchedule(s) };
    const times = occurrences(s, now, end - 1);
    planned += times.length;
    if (base.sends) sending += times.length;
    if (times.length && (!next || times[0] < next.at)) next = { ...base, at: times[0] };
    if (s.frequency === "hourly") {
      const perDay = new Map();
      for (const at of times) {
        const i = dayOf(at);
        if (!perDay.has(i)) perDay.set(i, { kind: "hourly", at, count: 0, ...base });
        perDay.get(i).count += 1;
      }
      for (const [i, event] of perDay) days[i]?.events.push(event);
    } else {
      for (const at of times) days[dayOf(at)]?.events.push({ kind: "planned", at, ...base });
    }
  }

  for (const run of runs) {
    const at = Date.parse(run.t);
    if (!Number.isFinite(at) || at < today || at > now) continue;
    days[0].events.push({ kind: "ran", at, workflowId: run.workflowId, name: run.name, tone: run.tone });
  }

  for (const day of days) day.events.sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
  const busiest = days.reduce((best, day, i) => (day.events.filter((e) => e.kind !== "ran").length > days[best].events.filter((e) => e.kind !== "ran").length ? i : best), 0);
  const busiestCount = days[busiest].events.filter((e) => e.kind !== "ran").length;
  return { days, next, paused, stats: { planned, sending, agents: items.filter((i) => i.schedule && i.schedule.enabled !== false).length, busiest: busiestCount ? busiest : -1 } };
}

// "in 3 min", "in 2 h 5 min", "in 3 days"; "now" once it is due.
export function untilText(ms) {
  if (ms <= 30_000) return "now";
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  const days = Math.round(hours / 24);
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}
