// Asks Gmail for the latest mail in the person's inbox: who sent it, the subject and when. fetchInbox never reads the body of an email.
// fetchInboxText (below) is the ONE exception, used only by an Ask the AI step the person set to "with the text of each email": it reads the opening
// of the text of the 5 newest messages.
// READ-ONLY: this file only ever sends GET requests, and the permission the person gave (gmail.readonly) cannot send, change
// or delete mail. Gmail answers at https://gmail.googleapis.com/gmail/v1. The Authorization value ("Bearer <token>") is handed
// in from lib/connections/store.js, and `fetchImpl` can be replaced so tests never call the real Google. Failures come back as
// short fixed sentences, never Google's own text, and never anything holding a token.
//
// Mail is written by strangers, so every value is cut short and flattened to plain text here. When the AI later reads it, the
// agent wraps it as data and ignores any instructions inside (lib/ai/agent.js).

import { refusalKind } from "./google-errors.js";
import { niceTime } from "./time-format.js";

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

// Mail headers hold accented letters, emoji and non-English text as "encoded words" such as =?UTF-8?B?SGVsbG8=?= or =?UTF-8?Q?Caf=C3=A9?=.
// Shown as they are they look broken, so they are turned back into the real words. Never throws: a word that cannot be decoded is left as
// plain text. Spaces between two encoded words are not part of the text (RFC 2047), so they are dropped.
export function decodeMimeWords(value) {
  if (typeof value !== "string" || !value.includes("=?")) return typeof value === "string" ? value : "";
  const word = /=\?([A-Za-z0-9_-]{1,40})\?([BbQq])\?([^?\s]{0,500})\?=/g;
  const joined = value.replace(/(=\?[^?\s]+\?[BbQq]\?[^?\s]*\?=)\s+(?==\?[^?\s]+\?[BbQq]\?)/g, "$1");
  return joined.replace(word, (whole, charset, kind, text) => {
    try {
      const bytes = kind.toUpperCase() === "B"
        ? Buffer.from(text, "base64")
        : Buffer.from(text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16))), "latin1");
      return new TextDecoder(charset.toLowerCase(), { fatal: false }).decode(bytes);
    } catch {
      return whole;
    }
  });
}

const flat = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

// '"Ana Lopez" <ana@x.com>' -> 'Ana Lopez'; 'ana@x.com' -> 'ana@x.com'
export function senderName(header) {
  const text = flat(decodeMimeWords(header), 200);
  const named = text.match(/^"?([^"<]*?)"?\s*<[^>]*>$/);
  return (named && named[1].trim()) || text.replace(/[<>]/g, "").slice(0, 60);
}

// "Tue, 20 Oct 2026 09:15:00 +0530" -> "Tue 20 Oct 2026, 03:45 UTC"; anything unreadable becomes ""
export function mailTime(header) {
  return niceTime(Date.parse(flat(header, 60)));
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
        return { time: mailTime(headerOf(headers, "date")), from: senderName(headerOf(headers, "from")) || "(unknown sender)", subject: flat(decodeMimeWords(headerOf(headers, "subject")), 100) || "(no subject)" };
      }),
    };
  } catch {
    return { ok: false, error: GMAIL_FAILED.network };
  }
}

// ---- the text of the newest emails (opt-in) ------------------------------------------------------------------------------------------------------------------
const TEXT_HOW_MANY = 5;
const TEXT_CHARS = 450; // per email, so five emails and their headers stay inside what the AI is handed (3000 characters)

const decodeBody = (data) => Buffer.from(String(data).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
const ENTITIES = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const htmlToText = (html) => html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]);

// The first plain-text part of a message (else the first HTML part turned into text), searched through the nested parts. Returns "" when there is none.
export function bodyOf(payload) {
  const found = { plain: "", html: "" };
  const walk = (part, depth) => {
    if (!part || typeof part !== "object" || depth > 6) return;
    if (part.mimeType === "text/plain" && !found.plain && typeof part.body?.data === "string") found.plain = decodeBody(part.body.data);
    if (part.mimeType === "text/html" && !found.html && typeof part.body?.data === "string") found.html = htmlToText(decodeBody(part.body.data));
    for (const child of Array.isArray(part.parts) ? part.parts : []) walk(child, depth + 1);
  };
  walk(payload, 0);
  return found.plain || found.html;
}

// Mail text is written by strangers: quoted older messages ("> ..."), signatures ("-- ") and link-only lines are dropped, everything is flattened to plain
// text and cut short. (The AI later reads it as data and ignores any instructions inside: lib/ai/agent.js.)
export function tidyBody(text) {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n");
  const kept = [];
  for (const line of lines) {
    if (/^--\s*$/.test(line) || /^On .{5,120} wrote:\s*$/.test(line)) break; // a signature or the start of the quoted thread: the rest is not new
    if (line.trimStart().startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join(" ").replace(/https?:\/\/\S+/g, "[link]").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, TEXT_CHARS);
}

// The latest 5 messages in the inbox WITH the opening of their text, newest first.
// Returns { ok: true, mails: [{ time, from, subject, text }] } or { ok: false, error }.
export async function fetchInboxText({ authorization, fetchImpl = fetch }) {
  try {
    const list = new URL(BASE);
    list.searchParams.set("labelIds", "INBOX");
    list.searchParams.set("maxResults", String(TEXT_HOW_MANY));
    list.searchParams.set("fields", "messages(id)");
    const listed = await getJson(list.toString(), authorization, fetchImpl);
    if (listed.error) return { ok: false, error: listed.error };
    const messages = listed.body?.messages ?? [];
    if (!Array.isArray(messages)) return { ok: false, error: GMAIL_FAILED.network };
    const ids = messages.slice(0, TEXT_HOW_MANY).map((message) => message?.id).filter((id) => typeof id === "string" && /^[A-Za-z0-9]{1,40}$/.test(id));

    const mails = await Promise.all(ids.map(async (id) => {
      const url = new URL(`${BASE}/${id}`);
      url.searchParams.set("format", "full");
      url.searchParams.set("fields", "payload");
      return getJson(url.toString(), authorization, fetchImpl);
    }));
    const failed = mails.find((entry) => entry.error);
    if (failed) return { ok: false, error: failed.error };
    return {
      ok: true,
      mails: mails.map(({ body }) => {
        const payload = body?.payload ?? {};
        const headers = Array.isArray(payload.headers) ? payload.headers : [];
        return { time: mailTime(headerOf(headers, "date")), from: senderName(headerOf(headers, "from")) || "(unknown sender)", subject: flat(decodeMimeWords(headerOf(headers, "subject")), 100) || "(no subject)", text: tidyBody(bodyOf(payload)) };
      }),
    };
  } catch {
    return { ok: false, error: GMAIL_FAILED.network };
  }
}
