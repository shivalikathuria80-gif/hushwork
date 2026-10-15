// Saves an email to the `waitlist` table in Supabase (setup: ../supabase/waitlist.sql).
// Returns 'ok', 'duplicate', 'error', or 'not-connected' when the settings in .env.local are missing.
// Only the public (publishable) key is used: the database rules let it add rows but never read them.
export async function joinWaitlist(email) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return "not-connected";
  try {
    const res = await fetch(`${url}/rest/v1/waitlist`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) return "ok";
    if (res.status === 409) return "duplicate";
    return "error";
  } catch {
    return "error";
  }
}
