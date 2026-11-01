import { nextCheckAt } from "./brain.js";

// The clock's part of the Hushwork Agent (called from lib/schedule-tick.js every minute). For each agent that is due:
//   1. CLAIM it: next_check_at moves to the next daytime slot in one update that only works if nobody moved it first, so two clock calls never look twice.
//   2. LOOK (`check`, which is checkAgent from check.js, run with the all-access client).
//   3. If it found a note the person has not seen, `nudge` emails them once. Looks happen only at 09:00, 13:00 and 17:00 their time, so that is
//      at most 3 emails a day and never at night.
// At most `limit` agents per call (a look reads several apps and asks the AI), so one clock call stays short; the rest are taken next minute.
// `check` and `nudge` are handed in, so tests never touch real services.
export async function runDueAgents({ admin, check, nudge = async () => {}, now = Date.now(), limit = 3 }) {
  const { data: due, error } = await admin
    .from("agent_state").select("user_id, tz_offset, next_check_at")
    .eq("enabled", true).lte("next_check_at", new Date(now).toISOString())
    .order("next_check_at", { ascending: true }).limit(limit);
  if (error) return { ok: false, looked: 0 }; // for example the table is not set up yet: schedules still run
  const summary = { ok: true, looked: 0, told: 0, failed: 0 };
  for (const row of due) {
    const claimed = await admin
      .from("agent_state").update({ next_check_at: new Date(nextCheckAt(now, row.tz_offset)).toISOString() })
      .eq("user_id", row.user_id).eq("next_check_at", row.next_check_at).select("user_id");
    if (claimed.error || !claimed.data?.length) continue; // another clock call took it
    try {
      const result = await check({ supabase: admin, userId: row.user_id, tzOffset: row.tz_offset, now });
      if (!result?.ok) { summary.failed += 1; continue; }
      summary.looked += 1;
      if (result.fresh) {
        await nudge({ userId: row.user_id, notes: result.notes });
        summary.told += 1;
      }
    } catch {
      summary.failed += 1;
      console.error("an agent look crashed"); // no detail: it could hold something private
    }
  }
  return summary;
}
