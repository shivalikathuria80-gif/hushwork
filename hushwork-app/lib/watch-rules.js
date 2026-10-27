// WATCH MODE rules. A "watch" workflow is a scheduled workflow that stays SILENT unless something is new, never speaks at night, speaks at most
// 3 times a day, and never acts alone (the one thing Hushwork does by itself is a plain email to the person, see notifyWatch in
// lib/schedule-notify.js). This file is plain code (no Next.js, no database) so the tests, the server and the screens all use the same rules.
// A person's local time is worked out from `tzOffset`: minutes EAST of UTC (India is +330), the same number a schedule stores as tz_offset.
export const DAILY_CAP = 3; // speak-ups per person per local day
export const QUIET_FROM = 20; // from 20:00 ...
export const QUIET_UNTIL = 8; // ... until 08:00 the next morning, in the person's own time

const MINUTE = 60_000;
const DAY = 86_400_000;
const offsetOf = (tzOffset) => (Number.isFinite(tzOffset) ? tzOffset : 0);

// The hour (0 to 23) it is for the person.
export const localHour = (nowMs, tzOffset) => new Date(nowMs + offsetOf(tzOffset) * MINUTE).getUTCHours();

export const inQuietHours = (nowMs, tzOffset) => {
  const hour = localHour(nowMs, tzOffset);
  return hour >= QUIET_FROM || hour < QUIET_UNTIL; // crosses midnight, so it is "late OR early"
};

// When the person's local day began, as a time in milliseconds (midnight for them, not for the server).
export const localDayStartMs = (nowMs, tzOffset) => {
  const shifted = nowMs + offsetOf(tzOffset) * MINUTE; // the clock on the person's wall, pretending it is UTC
  return shifted - (((shifted % DAY) + DAY) % DAY) - offsetOf(tzOffset) * MINUTE; // the double % keeps it right for times before 1970 too
};

// May Hushwork speak up now? `spokenToday` = how many times it already did since localDayStartMs.
export const canSpeak = ({ spokenToday, nowMs, tzOffset }) => Number(spokenToday) < DAILY_CAP && !inQuietHours(nowMs, tzOffset);

// A Start step that makes a real schedule ("On a schedule" or "Keep watching"), and one that is a watch.
export const isScheduledStart = (step) => step?.kind === "trigger" && (step.fields?.how === "schedule" || step.fields?.how === "watch");
export const isWatchStart = (step) => step?.kind === "trigger" && step.fields?.how === "watch";
// A workflow is a watch workflow when its saved first step says so (no extra column: the plan is the one source).
export const isWatchPlan = (plan) => Array.isArray(plan) && isWatchStart(plan[0]);

// The quiet marker: an answer that starts with NOTHING NEW (any capitals, spaces in front are ignored).
export const isNothingNew = (answer) => typeof answer === "string" && /^nothing new\b/i.test(answer.trim());

// Runs page: the practice runs that ended quietly. `runs` = [{ id, live, results }] with results read by readSavedResults; a quiet run has a saved
// "live" record with `quiet: true` that points back to it (`from`). Returns a Set of those practice run ids.
export const quietRunIds = (runs) => {
  const ids = new Set();
  for (const run of Array.isArray(runs) ? runs : []) {
    const first = run?.live ? run.results?.[0] : null;
    if (first?.quiet === true && first.from) ids.add(first.from);
  }
  return ids;
};

export const quietLine = (count) => `${count} quiet ${count === 1 ? "check" : "checks"}: nothing new`;
