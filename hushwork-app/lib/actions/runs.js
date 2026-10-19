"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import { practiceRun, SETUP_MESSAGE } from "@/lib/run-engine";

// Server Action behind the "Practice run" button. It loads the person's own workflow, walks its steps with the
// practice engine (lib/run-engine.js: nothing leaves the app) and saves the result as a row in the "runs" table.
// Same four habits as lib/actions/drafts.js: requireUser first, validate, talk to the database (user_id is filled in by
// the database), return a SMALL object. Raw database errors are never returned.

// "42P01" / "PGRST205" = the runs table does not exist yet (supabase/runs.sql has not been pasted into Supabase).
const NO_TABLE = new Set(["42P01", "PGRST205"]);

export async function startPracticeRun(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: id.error };

  const supabase = await createClient();
  const { data: rows, error: loadError } = await supabase.from("workflows").select("id, name, plan").eq("id", id.value).eq("user_id", user.id);
  if (loadError) {
    console.error("startPracticeRun load failed:", loadError.code);
    return { error: "Could not start the run. Check your connection and try again." };
  }
  const workflow = rows?.[0];
  if (!workflow) return { error: "That workflow no longer exists." };

  const run = practiceRun(workflow.plan);
  if (run.status === "failed") return { error: "This workflow has no steps to run. Add a step in the Builder first." };

  const { data, error } = await supabase
    .from("runs")
    .insert({ workflow_id: workflow.id, workflow_name: workflow.name, mode: "practice", status: run.status, results: run.results })
    .select("id");
  if (error) {
    console.error("startPracticeRun save failed:", error.code);
    return { error: NO_TABLE.has(error.code) ? SETUP_MESSAGE : "The run finished but could not be saved. Try again." };
  }
  revalidatePath("/app", "layout");
  return { ok: true, runId: String(data?.[0]?.id ?? "") };
}
