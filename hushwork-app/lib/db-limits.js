// Limits kept in the database (supabase/usage.sql), so they hold across servers. Used for the AI, which costs real money.
// If the table has not been created yet, or the database does not answer, the request is ALLOWED (the in-memory limits still apply):
// a missing setup step must never lock people out. Only a short code is ever logged.
// The clock that runs scheduled workflows has no signed-in person (its client is flagged __hushworkAdmin), so it skips this check.

// Returns { ok: true } or { ok: false, why: "limit_minute" | "limit_day" }.
export async function takeDbSlot(supabase, bucket, perMinute, perDay) {
  if (supabase?.__hushworkAdmin === true) return { ok: true };
  try {
    const { data, error } = await supabase.rpc("take_usage", { p_bucket: bucket, p_per_minute: perMinute, p_per_day: perDay });
    if (error) {
      console.log(`usage-limit skipped code=${error.code ?? "unknown"}`);
      return { ok: true };
    }
    if (data === "limit_minute" || data === "limit_day") return { ok: false, why: data };
    return { ok: true };
  } catch {
    console.log("usage-limit skipped code=exception");
    return { ok: true };
  }
}
