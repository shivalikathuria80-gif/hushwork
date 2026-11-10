// APP EVENTS: the rules. A workflow whose Start step says "When an email arrives" or "When a calendar event is added" is WATCHED
// (supabase/app-events.sql): every 2 minutes the clock looks for new mail or new events (lib/app-event-runner.js) and each new one starts the
// workflow by itself, as its owner, with writing switched OFF. Plain code with no Next.js and no database, so the server, the screens and
// `node --test` all load the same rules.
//
// What arrives is NEVER trusted: an email is written by a stranger and an event can be made by anyone who invites the person. It is cut to a few
// short fields by the start-link rules (lib/hooks.js readFields: card numbers and secret keys are left out) and handed to the AI as information only.
import { readFields, incomingText, previewOf } from "./hooks.js";

export const WATCH_SOURCES = {
  gmail: { start: "email", app: "Gmail", noun: "email", nouns: "emails", icon: "Mail", logo: "gmail", started: "Started by a new email in your Gmail", arrived: "The email that started it" },
  calendar: { start: "event", app: "Google Calendar", noun: "event", nouns: "events", icon: "Calendar", logo: "calendar", started: "Started by a new event in your Google Calendar", arrived: "The event that started it" },
};
export const SOURCE_IDS = Object.keys(WATCH_SOURCES);
export const isWatchSource = (value) => typeof value === "string" && Object.hasOwn(WATCH_SOURCES, value);

export const WATCH_LIMITS = {
  checkEveryMs: 2 * 60_000, // how often one watch looks
  perCheck: 3, // runs one look may start; more waits for the next look (2 minutes later)
  perMinute: 5, // runs all of one person's watches may start
  perDay: 40,
  maxWatches: 10, // watched workflows one person can keep
  seenKeep: 50, // ids remembered, so nothing starts twice
  filterChars: 80,
  slackMs: 60_000, // Gmail's "after:" counts in whole seconds and mail can land a little out of order: look a minute back, `seen` keeps it from repeating
  perCall: 20, // watches one clock call looks at
};
// How long a watch waits after a problem before it looks again, so a broken connection does not knock on Google every 2 minutes all day.
export const BACKOFF_MS = { not_connected: 30 * 60_000, busy: 5 * 60_000, failed: 10 * 60_000 };
export const WATCH_SETUP = "Starting from Gmail and Google Calendar needs one setup step that is not done yet. Open supabase/app-events.sql and run it in Supabase.";

// Which app a Start step watches: "gmail", "calendar" or null.
export function sourceOfStart(step) {
  if (step?.kind !== "trigger") return null;
  const how = step.fields?.how;
  return SOURCE_IDS.find((id) => WATCH_SOURCES[id].start === how) ?? null;
}
export const isAppEventStart = (step) => sourceOfStart(step) !== null;

// The optional filter the person writes in the Start step's second box. Gmail: Gmail's own search words (from:ana@example.com, subject:invoice,
// has:attachment, "quoted words", OR, a minus to leave something out). Calendar: words that must all be in the event's title.
// Returns { value } (possibly "", meaning everything) or { error }.
const GMAIL_FILTER = /^[\p{L}\p{N}\s@._:+\-"'()|*/&,!#]*$/u;
const CALENDAR_FILTER = /^[\p{L}\p{N}\s@._:+\-"'()&,!#/]*$/u;
export function checkFilter(source, raw) {
  const value = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (value.length > WATCH_LIMITS.filterChars) return { error: `Keep the filter under ${WATCH_LIMITS.filterChars} characters.` };
  if (!value) return { value: "" };
  if (source === "gmail") {
    if (!GMAIL_FILTER.test(value)) return { error: "Write the filter the way Gmail's own search box takes it, for example from:ana@example.com or subject:invoice." };
    // The watch sets the time and the inbox itself; a filter that moves them would make it miss or repeat mail.
    if (/\b(after|before|older|newer|older_than|newer_than):/i.test(value)) return { error: "Leave the time out of the filter (after:, before:, newer_than:): Hushwork looks only at mail that arrives from now on." };
    return { value };
  }
  if (!CALENDAR_FILTER.test(value)) return { error: "Write a few plain words that are in the event's title, for example interview." };
  return { value };
}

// The words of a filter that reads like a schedule ("every weekday at 9am"): the Start step's second box used to be only for times, and an old
// plan may still hold one. Such words mean "everything", not "only emails that say every weekday".
export function filterFromStart(step) {
  const raw = String(step?.fields?.when ?? "").trim();
  if (/^(every|each|daily|weekly|hourly|on |at \d|whenever|when |anytime|any time|always)/i.test(raw) || /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(raw)) return "";
  return raw;
}

// The Gmail search a look sends: new mail in the inbox, NEVER the person's own (a workflow that emails them must not start itself), after the
// cursor (a minute back, see slackMs), and the person's filter.
export function gmailQuery(filter, sinceMs) {
  const after = Math.max(0, Math.floor((Number(sinceMs) - WATCH_LIMITS.slackMs) / 1000));
  return `in:inbox -from:me after:${after}${filter ? ` (${filter})` : ""}`;
}

// Does an event's title hold every word of the filter (any capitals)? An empty filter matches everything.
export function titleMatches(filter, title) {
  const words = String(filter ?? "").toLowerCase().replace(/["']/g, " ").split(/\s+/).filter(Boolean);
  const haystack = String(title ?? "").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

const PLAIN_ID = /^[A-Za-z0-9_@.-]{1,120}$/;

// The ids a watch remembers, read back from its row (a person could have written anything into their own rows).
export function readSeen(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === "string" && PLAIN_ID.test(id)).slice(-WATCH_LIMITS.seenKeep) : [];
}
export const nextSeen = (seen, ids) => [...new Set([...readSeen(seen), ...ids.filter((id) => PLAIN_ID.test(id))])].slice(-WATCH_LIMITS.seenKeep);

// What is NEW in one look. `items` = [{ id, at (ms), fields }] in any order. New = a plain id not seen before, not from before the cursor (less the
// slack). Oldest first, at most `perCheck`; the rest waits for the next look (it is not marked seen, and the cursor stops at the last one taken).
// Returns { take, waiting, cursorMs }.
export function pickNew(items, { seen = [], cursorMs = 0, perCheck = WATCH_LIMITS.perCheck } = {}) {
  const known = new Set(readSeen(seen));
  const fresh = (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item.id === "string" && PLAIN_ID.test(item.id) && !known.has(item.id) && Number.isFinite(item.at) && item.at >= cursorMs - WATCH_LIMITS.slackMs)
    .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
    .sort((a, b) => a.at - b.at);
  const take = fresh.slice(0, perCheck);
  const last = take.at(-1);
  return { take, waiting: fresh.length - take.length, cursorMs: last ? Math.max(cursorMs, last.at) : cursorMs };
}

// ---- what one email or event hands the AI -------------------------------------------------------------------------------------------------------------------
// Both go through the start-link rules (readFields), so the same limits and the same "leave secrets out" apply. Returns { fields, text, preview }.
function shaped(payload) {
  const { fields } = readFields(payload);
  return { fields, text: incomingText(fields), preview: previewOf(fields) };
}

export function mailIncoming({ from, address, subject, at, snippet }) {
  return shaped({
    From: from || address || "(unknown sender)",
    Email: address || "", // {incoming.email} in an email step answers the sender (lib/hook-fields.js)
    Subject: subject || "(no subject)",
    Received: Number.isFinite(at) ? new Date(at).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "",
    "First words": snippet || "",
  });
}

export function eventIncoming({ title, start, end, where, organizer, guests }) {
  return shaped({
    Title: title || "(no title)",
    Starts: start || "",
    Ends: end || "",
    Where: where || "",
    "Made by": organizer || "",
    Guests: Number.isInteger(guests) && guests > 0 ? String(guests) : "",
  });
}

// The sentence the Builder shows after saving, for a watched Start step. `state`: "new" | "same" | "changed" | "off".
export function watchSentence(source, filter, state) {
  const s = WATCH_SOURCES[source];
  if (!s) return "";
  const which = filter ? (source === "gmail" ? ` matching "${filter}"` : ` with "${filter}" in the title`) : "";
  if (state === "off") return `Its watch on ${s.app} is switched off: switch it on on the Start links page.`;
  const lead = state === "same" ? `Watching ${s.app}.` : `Now watching ${s.app}: every new ${s.noun}${which} starts this workflow, checked every 2 minutes.`;
  return `${lead} It reads and drafts by itself; anything that sends still waits for your Approve.`;
}
