import "server-only";
import { googleAuthorization } from "@/lib/run-core";
import { fetchNewMail, GMAIL_FAILED } from "@/lib/connectors/google-gmail";
import { fetchNewEvents, CALENDAR_FAILED } from "@/lib/connectors/google-calendar";
import { COMPOSIO_FAILED, runNewEvents, runNewMail } from "@/lib/connectors/composio";
import { findComposioApp } from "@/lib/connectors/composio-apps";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { eventIncoming, gmailQuery, mailIncoming, titleMatches } from "@/lib/app-events";

// APP EVENTS: one LOOK for one watch (lib/app-event-runner.js hands in this function). Hushwork's own Google connection is used when the person has
// it (read-only permission, and the Google gate in run-core's googleAuthorization applies); otherwise Composio's Gmail or Google Calendar, which
// everybody can connect. Returns { ok: true, items: [{ id, at, fields, text, preview, label }] } or { ok: false, kind, error } where kind is
// "not_connected", "busy" or "failed" (the runner waits longer after each). `error` is always one of our own short sentences.
const NOT_CONNECTED = {
  gmail: "Hushwork cannot read your Gmail. Open Connections and connect Google, or Gmail (send) under Composio.",
  calendar: "Hushwork cannot read your Google Calendar. Open Connections and connect Google, or Google Calendar (events) under Composio.",
};
const kindOf = (error) => (error === GMAIL_FAILED.busy || error === CALENDAR_FAILED.busy || error === COMPOSIO_FAILED.busy ? "busy" : [GMAIL_FAILED.auth, GMAIL_FAILED.scope, GMAIL_FAILED.apiOff, CALENDAR_FAILED.auth, COMPOSIO_FAILED.key].includes(error) || String(error).startsWith(COMPOSIO_FAILED.notConnected) ? "not_connected" : "failed");

const mailItem = (mail) => ({ id: mail.id, at: mail.at, label: mail.subject, ...mailIncoming(mail) });
const eventItem = (event) => ({ id: event.id, at: event.at, label: event.title, ...eventIncoming(event) });

export async function readWatch({ admin, watch, sinceMs }) {
  const userId = String(watch.user_id);
  const google = await googleAuthorization(admin, userId).catch(() => null);
  const key = getComposioKey();
  if (watch.source === "gmail") {
    const query = gmailQuery(watch.filter, sinceMs);
    const read = google ? await fetchNewMail({ authorization: google, query }) : key ? await runNewMail({ key, userId, app: findComposioApp("gmailsearch"), query }) : null;
    if (!read) return { ok: false, kind: "not_connected", error: NOT_CONNECTED.gmail };
    if (!read.ok) return { ok: false, kind: kindOf(read.error), error: kindOf(read.error) === "not_connected" ? NOT_CONNECTED.gmail : read.error };
    return { ok: true, items: read.mails.map(mailItem) };
  }
  if (watch.source === "calendar") {
    const read = google ? await fetchNewEvents({ authorization: google, sinceMs }) : key ? await runNewEvents({ key, userId, app: findComposioApp("gcalevents"), sinceMs }) : null;
    if (!read) return { ok: false, kind: "not_connected", error: NOT_CONNECTED.calendar };
    if (!read.ok) return { ok: false, kind: kindOf(read.error), error: kindOf(read.error) === "not_connected" ? (String(read.error).includes("Connect once more") ? read.error : NOT_CONNECTED.calendar) : read.error };
    return { ok: true, items: read.events.filter((event) => titleMatches(watch.filter, event.title)).map(eventItem) };
  }
  return { ok: false, kind: "failed", error: "This watch looks at an app Hushwork does not know." };
}
