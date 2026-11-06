// Limits kept in the database (supabase/usage.sql), so they hold across servers. Used for the AI, which costs real money.
// If the table has not been created yet, or the database does not answer, the request is ALLOWED (the in-memory limits still apply):
// a missing setup step must never lock people out. Only a short code is ever logged.
// The clock that runs scheduled workflows has no signed-in person (its client is flagged __hushworkAdmin), so it skips this check.
// A chatbot using the person's API token (lib/plugin/) also has no session, but it DOES count: its client also carries
// __hushworkUserId, and the count goes through take_usage_for (supabase/api-tokens.sql) for that one person.

// Returns { ok: true } or { ok: false, why: "limit_minute" | "limit_day" }.
export async function takeDbSlot(supabase, bucket, perMinute, perDay) {
  const forToken = supabase?.__hushworkAdmin === true && typeof supabase?.__hushworkUserId === "string";
  if (supabase?.__hushworkAdmin === true && !forToken) return { ok: true };
  try {
    const { data, error } = forToken
      ? await supabase.rpc("take_usage_for", { p_user: supabase.__hushworkUserId, p_bucket: bucket, p_per_minute: perMinute, p_per_day: perDay })
      : await supabase.rpc("take_usage", { p_bucket: bucket, p_per_minute: perMinute, p_per_day: perDay });
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
