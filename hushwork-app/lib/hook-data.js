// START LINK DATA CONTROLS: the rules (supabase/hooks-data.sql). Plain code with no imports, so the server, the browser and `node --test` all
// load it. What arrives at a start link was written by a stranger; the owner decides how long it is kept, how many runs one link may start a
// day, and can take it all out (export) or delete it now.

export const KEEP_DAYS = [1, 7, 30, 90]; // the choices; the database refuses anything else
export const DEFAULT_KEEP = 30;
export const CAP_MAX = 60; // = the account's own daily limit (HOOK_LIMITS.perDay): a link's cap can only be lower
export const EXPORT_MAX = 1000; // arrivals in one export file
export const HOOK_DATA_SETUP = "The data controls need one more setup step. Open supabase/hooks-data.sql and run it in Supabase. Your start links keep working meanwhile.";
// Postgres says 42703 for a column that does not exist and 42883 for a missing function; the Supabase API says PGRST204 / PGRST202.
export const NO_DATA_SETUP = new Set(["42703", "PGRST204", "42883", "PGRST202"]);

export const readKeep = (value) => (KEEP_DAYS.includes(value) ? value : DEFAULT_KEEP);
// A link's own cap: a whole number 1..CAP_MAX, or null for "only the account limit".
export const readCap = (value) => (Number.isInteger(value) && value >= 1 && value <= CAP_MAX ? value : null);

// What the browser sends for a cap: null / "" = no cap of its own. Returns { value } or { error }.
export function checkCap(input) {
  if (input === null || input === undefined || input === "") return { value: null };
  const number = typeof input === "string" && /^\s*\d+\s*$/.test(input) ? Number(input) : input;
  if (!Number.isInteger(number) || number < 1 || number > CAP_MAX) return { error: `A daily limit is a whole number from 1 to ${CAP_MAX}.` };
  return { value: number };
}

// The start of the owner's day, as an ISO time. `tzOffset` is minutes EAST of UTC (India +330), like every Hushwork clock.
export function dayStart(now = Date.now(), tzOffset = 0) {
  const DAY = 86_400_000;
  const shift = (Number.isFinite(tzOffset) ? tzOffset : 0) * 60_000;
  return new Date(Math.floor((now + shift) / DAY) * DAY - shift).toISOString();
}

// When an arrival will be deleted: its time plus the link's keep days. ISO, or "" for a time that cannot be read.
export function deletesAt(at, keepDays) {
  const then = Date.parse(at);
  return Number.isFinite(then) ? new Date(then + readKeep(keepDays) * 86_400_000).toISOString() : "";
}

// ---- EXPORT -------------------------------------------------------------------------------------------------------------------------
// One arrival as the export file has it. `row`: a hook_events row; `start`: the run's Start step (results[0]) or null; `name`: the workflow.
export function exportRow(row, start, name) {
  const list = Array.isArray(row?.fields) ? row.fields : row?.preview; // every field when kept, else the short preview
  const fields = Array.isArray(list) ? list.filter((one) => one && typeof one.name === "string" && typeof one.value === "string").map((one) => ({ name: one.name, value: one.value })) : [];
  const full = start && typeof start === "object" && typeof start.incoming === "string" ? start.incoming : "";
  return {
    time: typeof row?.created_at === "string" ? row.created_at : "",
    workflow: typeof name === "string" ? name : "",
    status: typeof row?.status === "string" ? row.status : "",
    test: row?.test === true,
    run_id: typeof row?.run_id === "string" ? row.run_id : "",
    fields,
    // The full words, as the run kept them (only for an arrival that started a run, and only until they are deleted).
    full_text: full,
  };
}

// A spreadsheet cell: quoted, and a value that a spreadsheet would run as a formula (=, +, -, @, tab, return) gets a ' in front. The words
// were written by a stranger, so opening the file must never run anything.
function cell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// The CSV file: one line per arrival, the fields as "name: value" lines in one cell, so every arrival keeps its own shape.
export function toCsv(rows) {
  const head = ["time", "workflow", "status", "test", "run_id", "fields", "full_text"];
  const lines = [head.map(cell).join(",")];
  for (const row of Array.isArray(rows) ? rows : []) {
    const fields = row.fields.map((one) => `${one.name}: ${one.value}`).join("\n");
    lines.push([row.time, row.workflow, row.status, row.test ? "yes" : "no", row.run_id, fields, row.full_text].map(cell).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`; // the mark at the start makes Excel read it as UTF-8
}

// A file name with only safe letters: hushwork-arrivals-<workflow>-<day>.csv
export function exportName(workflow, day, format) {
  const slug = String(workflow ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "all";
  return `hushwork-arrivals-${slug}-${String(day).slice(0, 10)}.${format === "json" ? "json" : "csv"}`;
}
