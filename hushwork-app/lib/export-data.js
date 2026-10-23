// "Download my data": everything a person owns in Hushwork, as one JSON file they can keep as a backup. It reads with the PERSON'S OWN database
// client (so the database's privacy rules apply, and nobody else's rows can appear), and it leaves out saved connections completely: those hold
// sign-in tokens, which never leave the server. Runs are capped so the file stays a sensible size.
const MAX_RUNS = 500;

// Returns { data } (a plain object) or { error } (a sentence).
export async function buildExport(supabase, user) {
  const [workflows, runs, schedules] = await Promise.all([
    supabase.from("workflows").select("id, name, prompt, plan, created_at, updated_at").order("created_at", { ascending: true }),
    supabase.from("runs").select("id, workflow_id, workflow_name, mode, status, results, created_at").order("created_at", { ascending: false }).limit(MAX_RUNS),
    supabase.from("schedules").select("workflow_id, frequency, hour, minute, weekday, tz_offset, allow_writes, enabled, next_run_at, last_run_at, last_status"),
  ]);
  // A missing table (an older database) is simply an empty list; any other problem stops the export rather than hand over half of it.
  const rows = (result) => {
    if (result.error && result.error.code !== "42P01" && result.error.code !== "PGRST205") return null;
    return Array.isArray(result.data) ? result.data : [];
  };
  const parts = { workflows: rows(workflows), runs: rows(runs), schedules: rows(schedules) };
  if (Object.values(parts).some((part) => part === null)) return { error: "Could not read your data. Try again in a minute." };
  return {
    data: {
      exportedAt: new Date().toISOString(),
      account: { email: user.email ?? null },
      note: `Your workflows, your ${MAX_RUNS} newest runs and your schedules. Saved app connections are never included, because they hold sign-in tokens.`,
      ...parts,
    },
  };
}
