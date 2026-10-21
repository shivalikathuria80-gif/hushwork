// One friendly way to write a moment, used for mail and file times: "Tue 20 Oct 2026, 03:45 UTC". It is always in UTC (the server does not
// know the person's time zone), and the words are spelled out so a reader (or the AI) cannot run a date and a time together.
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n) => String(n).padStart(2, "0");

// `milliseconds` is a number (Date.parse). Returns the text, or "" for anything that is not a real moment. Pass { offset: 330, suffix: "" } to
// write it on the clock of a person who is 330 minutes ahead of UTC (a saved schedule keeps that number) instead of in UTC.
export function niceTime(milliseconds, { offset = 0, suffix = " UTC" } = {}) {
  if (!Number.isFinite(milliseconds) || !Number.isFinite(offset)) return "";
  const d = new Date(milliseconds + offset * 60_000);
  if (Number.isNaN(d.getTime())) return "";
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}${suffix}`;
}
