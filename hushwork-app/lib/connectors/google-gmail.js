// Asks Gmail for the latest mail in the person's inbox: who sent it, the subject and when. It never reads the body of an email.
// READ-ONLY: this file only ever sends GET requests, and the permission the person gave (gmail.readonly) cannot send, change
// or delete mail. Gmail answers at https://gmail.googleapis.com/gmail/v1. The Authorization value ("Bearer <token>") is handed
// in from lib/connections/store.js, and `fetchImpl` can be replaced so tests never call the real Google. Failures come back as
// short fixed sentences, never Google's own text, and never anything holding a token.
//
// Mail is written by strangers, so every value is cut short and flattened to plain text here. When the AI later reads it, the
// agent wraps it as data and ignores any instructions inside (lib/ai/agent.js).

import { refusalKind } from "./google-errors.js";

const TIMEOUT_MS = 10_000;
const HOW_MANY = 10;
const BASE = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

export const GMAIL_FAILED = {
  auth: "Google refused the connection. Check that the Gmail API is switched on in Google Cloud, then open Connections and press Connect Google again (it asks for the new Gmail permission).",
  apiOff: "The Gmail API is switched off in your Google Cloud project. Open console.cloud.google.com, then APIs & Services, then Library, find Gmail API and press Enable. Then try again.",
  scope: "Google did not give Hushwork the Gmail permission. Open Connections, press Disconnect under Google, then Connect Google, and tick every box on Google's screen (including Gmail).",
  busy: "Google is busy right now. Try again in a minute.",
  network: "Could not reach Google. Check your connection and try again.",
};

const flat = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

// '"Ana Lopez" <ana@x.com>' -> 'Ana Lopez'; 'ana@x.com' -> 'ana@x.com'
export function senderName(header) {
  const text = flat(header, 200);
  const named = text.match(/^"?([^"<]*?)"?\s*<[^>]*>$/);
  return (named && named[1].trim()) || text.replace(/[<>]/g, "").slice(0, 60);
}

// "Tue, 20 Oct 2026 09:15:00 +0530" -> "2026-10-20 03:45" (UTC); anything unreadable becomes ""
export function mailTime(header) {
  const time = Date.parse(flat(header, 60));
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 16).replace("T", " ") : "";
}

const headerOf = (headers, name) => headers.find((entry) => entry?.name?.toLowerCase() === name)?.value;

async function getJson(url, authorization, fetchImpl) {
  const response = await fetchImpl(url, { method: "GET", headers: { authorization }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 401 || response.status === 403) {
    const kind = await refusalKind(response);
    return { error: kind === "apiOff" ? GMAIL_FAILED.apiOff : kind === "scope" ? GMAIL_FAILED.scope : GMAIL_FAILED.auth };
  }
  if (response.status === 429 || response.status >= 500) return { error: GMAIL_FAILED.busy };
  if (!response.ok) return { error: GMAIL_FAILED.network };
  return { body: await response.json() };
}

// The latest 10 messages in the inbox, newest first.
// Returns { ok: true, mails: [{ time, from, subject }] } or { ok: false, error }.
export async function fetchInbox({ authorization, fetchImpl = fetch }) {
  try {
    const list = new URL(BASE);
    list.searchParams.set("labelIds", "INBOX");
    list.searchParams.set("maxResults", String(HOW_MANY));
    list.searchParams.set("fields", "messages(id)");
    const listed = await getJson(list.toString(), authorization, fetchImpl);
    if (listed.error) return { ok: false, error: listed.error };
    const messages = listed.body?.messages ?? [];
    if (!Array.isArray(messages)) return { ok: false, error: GMAIL_FAILED.network };
    const ids = messages.slice(0, HOW_MANY).map((message) => message?.id).filter((id) => typeof id === "string" && /^[A-Za-z0-9]{1,40}$/.test(id)); // an id goes into an address, so only plain ones are used

    const mails = await Promise.all(ids.map(async (id) => {
      const url = new URL(`${BASE}/${id}`);
      url.searchParams.set("format", "metadata");
      for (const name of ["From", "Subject", "Date"]) url.searchParams.append("metadataHeaders", name);
      url.searchParams.set("fields", "payload(headers(name,value))");
      return getJson(url.toString(), authorization, fetchImpl);
    }));
    const failed = mails.find((entry) => entry.error);
    if (failed) return { ok: false, error: failed.error };
    return {
      ok: true,
      mails: mails.map(({ body }) => {
        const headers = Array.isArray(body?.payload?.headers) ? body.payload.headers : [];
        return { time: mailTime(headerOf(headers, "date")), from: senderName(headerOf(headers, "from")) || "(unknown sender)", subject: flat(headerOf(headers, "subject"), 100) || "(no subject)" };
      }),
    };
  } catch {
    return { ok: false, error: GMAIL_FAILED.network };
  }
}
