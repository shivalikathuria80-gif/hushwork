import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanNotes } from "@/lib/agent/brain";
import AgentCard from "./AgentCard";

// Reads this person's agent row and hands the card what it may show. No row yet = the agent is off. If the table is missing (supabase/agent.sql
// not run yet) or the database does not answer, nothing is shown: the workspace must keep working. It reads the session, so the page wraps it in <Suspense>.
export default async function AgentPanel() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("agent_state").select("enabled, tz_offset, next_check_at, checked_at, status, notes").eq("user_id", user.id).limit(1);
  if (error) return null;
  const row = data?.[0];
  const state = row
    ? { enabled: row.enabled === true, tzOffset: Number.isInteger(row.tz_offset) ? row.tz_offset : 0, nextCheckAt: row.enabled ? row.next_check_at : null, checkedAt: row.checked_at, status: row.status, notes: cleanNotes(row.notes) }
    : null;
  return <AgentCard state={state} />;
}
