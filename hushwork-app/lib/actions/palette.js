"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSavedResults } from "@/lib/run-engine";
import { AGENT_KIND } from "@/lib/agents/kinds";
import { buildWeekRecap, WEEK_MS } from "@/lib/week-recap";

// What the command palette (components/app/CommandPalette.js) can find besides the pages: the person's own workflows and agents (to run
// them) and the runs of the last 7 days that need them. Read only, the person's own rows only. Any failure gives empty lists: the palette
// then still finds every page and action.
export async function loadPalette() {
  const user = await requireUser();
  const out = { workflows: [], needsYou: [] };
  try {
    const supabase = await createClient();
    const [flows, runs] = await Promise.all([
      supabase.from("workflows").select("id, name, kind").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50),
      supabase.from("runs").select("id, workflow_id, workflow_name, mode, results, created_at").eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - WEEK_MS).toISOString()).order("created_at", { ascending: false }).limit(200),
    ]);
    if (!flows.error && Array.isArray(flows.data)) {
      out.workflows = flows.data.map((row) => ({ id: String(row.id ?? ""), name: String(row.name ?? ""), agent: row.kind === AGENT_KIND })).filter((row) => row.id);
    }
    if (!runs.error && Array.isArray(runs.data)) {
      const rows = runs.data.map((row) => ({ id: String(row.id ?? ""), workflowId: String(row.workflow_id ?? ""), name: String(row.workflow_name ?? ""), live: row.mode === "live", createdAt: String(row.created_at ?? ""), results: readSavedResults(row.results) }));
      out.needsYou = buildWeekRecap(rows).needsYou.map(({ id, name, tone }) => ({ id, name, tone }));
    }
  } catch {
    // empty lists
  }
  return out;
}
