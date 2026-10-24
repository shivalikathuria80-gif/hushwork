// Reads the words of a Start step ("Every weekday at 17:30") as a real schedule, so what is written in the Builder is what runs.
// Understands the ways people (and the templates) write it:
//   every hour | hourly | every hour, 43 minutes past | every hour on the hour
//   every day at 9 | daily at 9:30 | every day at 5pm | every morning at 8
//   every weekday at 17:30 | weekdays at 8:30
//   every Monday at 9 | every week on Friday at 16:00 | mondays at 4pm
// Times can be 24-hour (17:30) or with am/pm (5:30 pm). A time of day is required, except for "every hour". Anything else gives null,
// and the Builder says it could not read it instead of guessing. Returns { frequency, hour, minute, weekday } or null.
import { WEEKDAYS } from "./schedule.js";

const DAY_NAMES = WEEKDAYS.map((name) => name.toLowerCase());

function readTime(text) {
  const match = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?!\d)/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const suffix = match[3]?.toLowerCase().replace(/\./g, "");
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    hour = suffix === "pm" ? (hour % 12) + 12 : hour % 12;
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function parseWhen(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.toLowerCase().replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
  if (!text || text.length > 80) return null;

  // every hour (optionally "N minutes past")
  if (/^(every hour|hourly)\b/.test(text)) {
    const past = text.match(/(\d{1,2})\s*minutes?\s*past/);
    const minute = past ? Number(past[1]) : 0;
    return minute >= 0 && minute <= 59 ? { frequency: "hourly", hour: 0, minute, weekday: 0 } : null;
  }

  // the part about the time of day, after "at" (or the first clock-like number)
  const timePart = text.includes(" at ") ? text.slice(text.indexOf(" at ") + 4) : text.replace(/^(every|each)\s+/, "").replace(/^(week on |weekdays?|days?|daily|mornings?|evenings?|afternoons?|[a-z]+s?)\b/, "");
  const time = readTime(timePart);
  if (!time) return null;

  const named = DAY_NAMES.findIndex((day) => new RegExp(`\\b${day}s?\\b`).test(text));
  if (named >= 0) return { frequency: "weekly", ...time, weekday: named };
  if (/\b(every weekday|weekdays?)\b/.test(text)) return { frequency: "weekdays", ...time, weekday: 0 };
  if (/\b(every day|daily|each day|every (morning|evening|afternoon|night))\b/.test(text)) return { frequency: "daily", ...time, weekday: 0 };
  return null;
}
