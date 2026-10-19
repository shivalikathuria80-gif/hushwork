// Asks Google Calendar for the person's next events (read-only: this file only ever sends a GET, and the permission the
// person gave is read-only too). Calendar answers at https://www.googleapis.com/calendar/v3. The Authorization value
// ("Bearer <token>") is handed in from lib/connections/store.js, and `fetchImpl` can be replaced so tests never call the
// real Google. Failures come back as short fixed sentences, never Google's own text, and never anything holding a token.

const TIMEOUT_MS = 10_000;
const DAYS = 7;

export const CALENDAR_FAILED = {
  auth: "Google refused the connection. Open Connections and press Connect Google again.",
  busy: "Google is busy right now. Try again in a minute.",
  network: "Could not reach Google. Check your connection and try again.",
};

const text = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

// Events in the next 7 days, soonest first, at most 10. `now` is in milliseconds.
// Returns { ok: true, events: [{ start, title }] } or { ok: false, error }. `start` is Google's own start text (a date, or a
// date with a time), cut short; it is shown as it is.
export async function fetchUpcomingEvents({ authorization, fetchImpl = fetch, now = Date.now }) {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", new Date(now()).toISOString());
  url.searchParams.set("timeMax", new Date(now() + DAYS * 86_400_000).toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("fields", "items(summary,start)");
  try {
    const response = await fetchImpl(url.toString(), { method: "GET", headers: { authorization }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status === 401 || response.status === 403) return { ok: false, error: CALENDAR_FAILED.auth };
    if (response.status === 429 || response.status >= 500) return { ok: false, error: CALENDAR_FAILED.busy };
    if (!response.ok) return { ok: false, error: CALENDAR_FAILED.network };
    const body = await response.json();
    if (!Array.isArray(body?.items)) return { ok: false, error: CALENDAR_FAILED.network };
    return { ok: true, events: body.items.slice(0, 10).map((item) => ({ start: text(item?.start?.dateTime ?? item?.start?.date, 30), title: text(item?.summary, 100) || "(no title)" })) };
  } catch {
    return { ok: false, error: CALENDAR_FAILED.network };
  }
}
