import { isApprovable } from "./run-engine.js";
import { WATCH_LIMITS, WATCH_SETUP, WATCH_SOURCES, checkFilter, filterFromStart, sourceOfStart, watchSentence } from "./app-events.js";

// Makes a watched Start step REAL. A workflow whose Start says "When an email arrives" (or "When a calendar event is added") gets a watch row
// (supabase/app-events.sql) when it is saved in the Builder, so what is written there is what happens. Like lib/schedule-sync.js:
//   - it only reads the SAVED plan, never the browser's copy,
//   - it makes a watch only when the filter can be used and the workflow has a step that can really run,
//   - a NEW watch starts from this moment (old mail never starts anything) and is switched on,
//   - an existing watch keeps its on/off choice; a changed app or filter starts afresh (the database's trigger resets where it got to),
//   - a workflow that stops saying so has its watch switched OFF (not deleted: the Start links page still shows what it did).
// Returns { text }: one sentence for the Builder (empty when the Start step has nothing to do with app events).
const NO_TABLE = new Set(["42P01", "PGRST205"]);
const offsetOf = (value) => (Number.isInteger(value) && value >= -840 && value <= 840 ? value : 0);

export async function syncStartWatch({ supabase, userId, workflowId, plan, tzOffset }) {
  const start = Array.isArray(plan) ? plan[0] : null;
  const source = sourceOfStart(start);
  const { data: rows, error: loadError } = await supabase.from("app_watches").select("id, workflow_id, source, filter, enabled").eq("user_id", userId);
  if (loadError) {
    if (!source) return { text: "" }; // nothing to watch, and maybe not set up: say nothing
    if (!NO_TABLE.has(loadError.code)) console.error("loading app watches failed:", loadError.code);
    return { text: NO_TABLE.has(loadError.code) ? WATCH_SETUP : `The workflow was saved, but Hushwork could not start watching ${WATCH_SOURCES[source].app}. Save it again in a minute.` };
  }
  const existing = rows.find((row) => row.workflow_id === workflowId) ?? null;

  if (!source) {
    if (!existing?.enabled) return { text: "" };
    const { error } = await supabase.from("app_watches").update({ enabled: false }).eq("id", existing.id).eq("user_id", userId);
    if (error) console.error("switching off an app watch failed:", error.code);
    return { text: `This workflow no longer starts from ${WATCH_SOURCES[existing.source]?.app ?? "an app"}, so Hushwork stopped watching it.` };
  }

  const app = WATCH_SOURCES[source].app;
  const filter = checkFilter(source, filterFromStart(start));
  if (filter.error) return { text: `Not watching ${app} yet: ${filter.error}` };
  if (!plan.some((step) => isApprovable(step))) return { text: `The Start step says "${start.fields.how === "email" ? "When an email arrives" : "When a calendar event is added"}", but none of this workflow's steps can really run yet (they only describe a plan), so nothing is watched.` };
  if (!existing && rows.length >= WATCH_LIMITS.maxWatches) return { text: `You already have ${WATCH_LIMITS.maxWatches} workflows that start from your apps, so this one was not added. Change one of them on the Start links page first.` };

  if (existing && existing.source === source && existing.filter === filter.value) {
    if (existing.enabled) await supabase.from("app_watches").update({ tz_offset: offsetOf(tzOffset) }).eq("id", existing.id).eq("user_id", userId);
    return { text: watchSentence(source, filter.value, existing.enabled ? "same" : "off") };
  }
  const choices = { source, filter: filter.value, tz_offset: offsetOf(tzOffset) };
  const { error } = existing
    ? await supabase.from("app_watches").update(choices).eq("id", existing.id).eq("user_id", userId)
    : await supabase.from("app_watches").insert({ ...(supabase.__hushworkAdmin === true ? { user_id: userId } : {}), workflow_id: workflowId, ...choices });
  if (error) {
    console.error("saving an app watch failed:", error.code);
    if (NO_TABLE.has(error.code)) return { text: WATCH_SETUP };
    return { text: `The workflow was saved, but Hushwork could not start watching ${app}. Save it again in a minute.` };
  }
  return { text: watchSentence(source, filter.value, existing && !existing.enabled ? "off" : existing ? "changed" : "new") };
}
