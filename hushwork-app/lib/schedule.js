// The rules of a schedule: what a person may choose, when the next run is, and how to say it in words. Pure code (no database, no clock of
// its own): the caller hands in the time, so tests can move it by hand.
//
// A schedule is "do this workflow at a time, how often". The time is the person's own local time (their browser says how far it is from
// UTC: tzOffset, in minutes east of UTC, so India is +330). Hushwork keeps one fixed offset per schedule.
// ponytail: a fixed offset does not follow daylight saving changes, so a schedule can drift by an hour twice a year in places that change
// their clocks; store a time zone name and use Intl if that ever matters.
export const FREQUENCIES = {
  hourly: "Every hour",
  daily: "Every day",
  weekdays: "Every weekday (Monday to Friday)",
  weekly: "Every week",
};
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MINUTE = 60_000;
const DAY = 86_400_000;
const two = (n) => String(n).padStart(2, "0");

// Checks what the form sent. Returns { value } (clean, safe to save) or { error } (a plain sentence).
export function checkSchedule(input) {
  const whole = (raw, min, max) => (Number.isInteger(raw) && raw >= min && raw <= max ? raw : null);
  const frequency = typeof input?.frequency === "string" && Object.hasOwn(FREQUENCIES, input.frequency) ? input.frequency : null;
  if (!frequency) return { error: "Choose how often it should run." };
  const minute = whole(input?.minute, 0, 59);
  const hour = frequency === "hourly" ? 0 : whole(input?.hour, 0, 23);
  if (hour === null || minute === null) return { error: "Choose a time of day." };
  const weekday = frequency === "weekly" ? whole(input?.weekday, 0, 6) : 0;
  if (weekday === null) return { error: "Choose the day of the week." };
  const tzOffset = whole(input?.tzOffset, -840, 840);
  if (tzOffset === null) return { error: "Your browser did not say which time zone you are in. Reload the page and try again." };
  return { value: { frequency, hour, minute, weekday, tzOffset, allowWrites: input?.allowWrites === true, enabled: input?.enabled !== false } };
}

// The first moment AFTER `fromMs` (milliseconds) when the schedule is due. Returns milliseconds.
export function nextRun(schedule, fromMs) {
  const offset = schedule.tzOffset * MINUTE; // local time = UTC time + offset; we read the "local" clock with the getUTC... methods
  const local = fromMs + offset;
  if (schedule.frequency === "hourly") {
    const thisHour = local - (local % (60 * MINUTE)) + schedule.minute * MINUTE;
    return (thisHour > local ? thisHour : thisHour + 60 * MINUTE) - offset;
  }
  const d = new Date(local);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  for (let days = 0; days <= 8; days += 1) {
    const candidate = midnight + days * DAY + schedule.hour * 60 * MINUTE + schedule.minute * MINUTE;
    if (candidate <= local) continue;
    const weekday = new Date(candidate).getUTCDay();
    if (schedule.frequency === "weekdays" && (weekday === 0 || weekday === 6)) continue;
    if (schedule.frequency === "weekly" && weekday !== schedule.weekday) continue;
    return candidate - offset;
  }
  return fromMs + DAY; // unreachable for valid schedules; a safe answer instead of a loop
}

// "Every weekday at 09:00", "Every week on Monday at 18:30", "Every hour at 15 minutes past".
export function describeSchedule(schedule) {
  const time = `${two(schedule.hour)}:${two(schedule.minute)}`;
  if (schedule.frequency === "hourly") return schedule.minute === 0 ? "Every hour, on the hour" : `Every hour, ${schedule.minute} minutes past`;
  if (schedule.frequency === "weekly") return `Every week on ${WEEKDAYS[schedule.weekday] ?? "Monday"} at ${time}`;
  if (schedule.frequency === "weekdays") return `Every weekday at ${time}`;
  return `Every day at ${time}`;
}
