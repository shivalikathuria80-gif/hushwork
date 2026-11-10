// START LINK DATA CONTROLS: "Download arrivals" (app/api/export/arrivals). Reads with the person's OWN database client, so the database's
// privacy rules decide what can be read; every query also names the person. Plain code with no Next.js imports, so tests hand in a fake client.
import { EXPORT_MAX, NO_DATA_SETUP as NO_COLUMN, exportRow } from "./hook-data.js";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (value) => (typeof value === "string" ? value : "");

// `linkId`: one link, or "" for all of the person's links. Returns { rows, workflow } or { error, status }.
export async function buildArrivalsExport(supabase, user, linkId = "") {
  if (linkId && !ID.test(linkId)) return { error: "That start link no longer exists.", status: 404 };
  let hooksQuery = supabase.from("hooks").select("id, workflow_id").eq("user_id", user.id);
  if (linkId) hooksQuery = hooksQuery.eq("id", linkId);
  const hooks = await hooksQuery.limit(50);
  if (hooks.error) return { error: "Could not read your start links. Try again.", status: 500 };
  if (!hooks.data?.length) return linkId ? { error: "That start link no longer exists.", status: 404 } : { rows: [], workflow: "" };

  const flowIds = [...new Set(hooks.data.map((row) => text(row.workflow_id)).filter(Boolean))];
  const flows = await supabase.from("workflows").select("id, name").eq("user_id", user.id).in("id", flowIds);
  const nameOfFlow = new Map((flows.data ?? []).map((row) => [text(row.id), text(row.name) || "Untitled workflow"]));
  const nameOfHook = new Map(hooks.data.map((row) => [text(row.id), nameOfFlow.get(text(row.workflow_id)) ?? "Untitled workflow"]));

  // Every field when the database keeps them (supabase/hook-fields.sql), otherwise the short preview.
  const read = (columns) => supabase.from("hook_events").select(columns).eq("user_id", user.id)
    .in("hook_id", [...nameOfHook.keys()]).order("created_at", { ascending: false }).limit(EXPORT_MAX);
  let events = await read("id, hook_id, status, run_id, preview, fields, test, created_at");
  if (events.error && NO_COLUMN.has(events.error.code)) events = await read("id, hook_id, status, run_id, preview, test, created_at");
  if (events.error) return { error: "Could not read your arrivals. Try again.", status: 500 };

  // The full words live on each run's Start step. Asked for only that step (results->0), 100 runs at a time.
  const runIds = [...new Set(events.data.map((row) => text(row.run_id)).filter((id) => ID.test(id)))];
  const startOf = new Map();
  for (let at = 0; at < runIds.length; at += 100) {
    const runs = await supabase.from("runs").select("id, start:results->0").eq("user_id", user.id).in("id", runIds.slice(at, at + 100));
    if (runs.error) return { error: "Could not read the runs of your arrivals. Try again.", status: 500 };
    for (const run of runs.data ?? []) startOf.set(text(run.id), run.start ?? null);
  }
  const rows = events.data.map((row) => exportRow(row, startOf.get(text(row.run_id)) ?? null, nameOfHook.get(text(row.hook_id))));
  return { rows, workflow: linkId ? nameOfHook.get(linkId) ?? "" : "" };
}
