// Adds ONE row at the bottom of a Google Sheet. This is the only thing this file can do: it has no way to read a sheet, change
// a cell, or delete anything, because its single request is Google's "append" (https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append).
// The Authorization value ("Bearer <token>") is handed in from lib/connections/store.js, and `fetchImpl` can be replaced so
// tests never call the real Google. Failures come back as short fixed sentences, never Google's own text, and never anything
// holding a token.
//
// The sheet is named by its WEB ADDRESS (the person pastes it into the step). parseSheetUrl takes the long id out of it and
// refuses everything that is not a normal Google Sheets address, so the id can never carry anything else into the request.
// The cells are written as plain text (valueInputOption RAW): a cell that starts with "=" is stored as text, never run as a
// formula.

const TIMEOUT_MS = 10_000;
export const MAX_CELLS = 20;
export const MAX_CELL_LENGTH = 100;

export const SHEETS_FAILED = {
  auth: "Google refused. Open Connections and press Connect Google again (it must be allowed to add rows), and check that your Google account can edit that sheet.",
  missing: "Google could not find that sheet. Check the web address in the step.",
  busy: "Google is busy right now. Try again in a minute.",
  network: "Could not reach Google. Check your connection and try again.",
};

// "https://docs.google.com/spreadsheets/d/<id>/edit?gid=0" -> { id } or { error }. Only that address shape is accepted.
export function parseSheetUrl(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  const match = text.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})(?:[/?#][^\s]*)?$/);
  return match ? { id: match[1] } : { error: "Put the web address of your Google Sheet in this step first (it starts with https://docs.google.com/spreadsheets/d/)." };
}

// "Ana, 500, 20 Oct" -> ["Ana", "500", "20 Oct"], or { error }. Commas separate the boxes of the row.
export function parseCells(raw) {
  const text = typeof raw === "string" ? raw : "";
  const cells = text.split(",").map((cell) => cell.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim());
  while (cells.length && cells.at(-1) === "") cells.pop();
  if (cells.length === 0) return { error: "Write what to add in this step first, with commas between the boxes (for example: Ana, 500, 20 Oct)." };
  if (cells.length > MAX_CELLS) return { error: `A row can have up to ${MAX_CELLS} boxes.` };
  if (cells.some((cell) => cell.length > MAX_CELL_LENGTH)) return { error: `Each box can have up to ${MAX_CELL_LENGTH} characters.` };
  return { cells };
}

// A box may contain {answer}: it stands for what an Ask the AI step of the same workflow said (see lib/run-answer.js). The words are
// put in AFTER the row was cut into boxes, so commas inside the answer never make extra boxes; the answer is flattened to one line,
// cut short and written as plain text like everything else. Returns { cells } or { error } (no answer yet).
export const ANSWER_TAG = "{answer}";
export const MAX_ANSWER_LENGTH = 500;
export const NO_ANSWER = "This row uses {answer}. Approve the Ask the AI step of this workflow first (from the same practice run), then come back to this step.";
export function fillAnswer(cells, answer) {
  if (!cells.some((cell) => cell.includes(ANSWER_TAG))) return { cells };
  const text = typeof answer === "string" ? answer.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER_LENGTH) : "";
  if (!text) return { error: NO_ANSWER };
  return { cells: cells.map((cell) => cell.split(ANSWER_TAG).join(text)) };
}

// Returns { ok: true } or { ok: false, error }.
export async function appendRow({ authorization, spreadsheetId, cells, fetchImpl = fetch }) {
  const checked = parseSheetUrl(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  if (checked.error || !Array.isArray(cells) || cells.length === 0) return { ok: false, error: SHEETS_FAILED.missing };
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${checked.id}/values/A1:append`);
  url.searchParams.set("valueInputOption", "RAW");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");
  try {
    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify({ majorDimension: "ROWS", values: [cells.map(String)] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) return { ok: true };
    if (response.status === 401 || response.status === 403) return { ok: false, error: SHEETS_FAILED.auth };
    if (response.status === 404 || response.status === 400) return { ok: false, error: SHEETS_FAILED.missing };
    if (response.status === 429 || response.status >= 500) return { ok: false, error: SHEETS_FAILED.busy };
    return { ok: false, error: SHEETS_FAILED.network };
  } catch {
    return { ok: false, error: SHEETS_FAILED.network };
  }
}
