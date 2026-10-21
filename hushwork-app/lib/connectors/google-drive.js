// Asks Google Drive for the files the person changed most recently: name, kind and when. It never opens a file or reads what is
// inside it. READ-ONLY: this file only ever sends one GET request, and the permission the person gave (drive.metadata.readonly)
// can only see file names and details; it cannot read the contents, add, change or delete anything. Drive answers at
// https://www.googleapis.com/drive/v3. The Authorization value ("Bearer <token>") is handed in from lib/connections/store.js, and
// `fetchImpl` can be replaced so tests never call the real Google. Failures come back as short fixed sentences, never Google's own
// text, and never anything holding a token.
//
// File names are written by other people, so every value is flattened and cut short here. When the AI later reads them, the agent
// wraps them as data and ignores any instructions inside (lib/ai/agent.js).

import { refusalKind } from "./google-errors.js";
import { niceTime } from "./time-format.js";

const TIMEOUT_MS = 10_000;
const HOW_MANY = 10;

export const DRIVE_FAILED = {
  auth: "Google refused the connection. Check that the Google Drive API is switched on in Google Cloud, then open Connections and press Connect Google again (it asks for the new Drive permission).",
  apiOff: "The Google Drive API is switched off in your Google Cloud project. Open console.cloud.google.com, then APIs & Services, then Library, find Google Drive API and press Enable. Then try again.",
  scope: "Google did not give Hushwork the Drive permission. Open Connections, press Disconnect under Google, then Connect Google, and tick every box on Google's screen (including Drive).",
  busy: "Google is busy right now. Try again in a minute.",
  network: "Could not reach Google. Check your connection and try again.",
};

const flat = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

const KINDS = {
  "application/vnd.google-apps.document": "Doc",
  "application/vnd.google-apps.spreadsheet": "Sheet",
  "application/vnd.google-apps.presentation": "Slides",
  "application/vnd.google-apps.form": "Form",
  "application/vnd.google-apps.folder": "Folder",
  "application/pdf": "PDF",
};
export const kindOf = (mimeType) => (typeof mimeType === "string" ? KINDS[mimeType] ?? (mimeType.startsWith("image/") ? "Image" : "File") : "File");

// "2026-10-20T03:45:12.000Z" -> "Tue 20 Oct 2026, 03:45 UTC"; anything unreadable becomes ""
const when = (value) => niceTime(Date.parse(flat(value, 40)));

// The 10 files changed most recently (not in the bin), newest first.
// Returns { ok: true, files: [{ time, kind, name }] } or { ok: false, error }.
export async function fetchRecentFiles({ authorization, fetchImpl = fetch }) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("pageSize", String(HOW_MANY));
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("q", "trashed = false");
  url.searchParams.set("fields", "files(name,mimeType,modifiedTime)");
  try {
    const response = await fetchImpl(url.toString(), { method: "GET", headers: { authorization }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status === 401 || response.status === 403) {
      const kind = await refusalKind(response);
      return { ok: false, error: kind === "apiOff" ? DRIVE_FAILED.apiOff : kind === "scope" ? DRIVE_FAILED.scope : DRIVE_FAILED.auth };
    }
    if (response.status === 429 || response.status >= 500) return { ok: false, error: DRIVE_FAILED.busy };
    if (!response.ok) return { ok: false, error: DRIVE_FAILED.network };
    const body = await response.json();
    if (!Array.isArray(body?.files)) return { ok: false, error: DRIVE_FAILED.network };
    return { ok: true, files: body.files.slice(0, HOW_MANY).map((file) => ({ time: when(file?.modifiedTime), kind: kindOf(file?.mimeType), name: flat(file?.name, 100) || "(no name)" })) };
  } catch {
    return { ok: false, error: DRIVE_FAILED.network };
  }
}
