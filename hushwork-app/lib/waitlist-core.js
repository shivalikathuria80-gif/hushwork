// Adding an email to the waitlist, as plain testable steps (the Server Action in lib/actions/waitlist.js supplies the visitor's address and
// the settings). Only the public (publishable) key is used: the database rules let it add rows but never read them (supabase/waitlist.sql).
//   - a filled hidden "trap" field means a bot: it is told "ok" and nothing is saved,
//   - the email must look like an email and be at most 254 characters,
//   - each visitor address may try 5 times in 10 minutes and everybody together 100 times an hour (counted in this server's memory, so this
//     is friction rather than a wall: the database also refuses a second signup for the same address and bad formats).
// Returns "ok", "duplicate", "invalid", "slow", "not-connected" or "error".
import { makeLimiter } from "./ai/limits.js";

const sharedLimits = () => (globalThis.__hushworkWaitlistLimits ??= {
  perVisitor: makeLimiter({ max: 5, windowMs: 10 * 60_000 }),
  everyone: makeLimiter({ max: 100, windowMs: 60 * 60_000 }),
});

export async function joinWaitlistCore({ email, trap = "", visitor = "unknown", url, key, now = Date.now(), limits = sharedLimits(), fetchImpl = fetch }) {
  if (typeof trap === "string" && trap) return "ok"; // a hidden field only bots fill in
  const clean = typeof email === "string" ? email.trim() : "";
  if (clean.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return "invalid";
  if (!url || !key) return "not-connected";
  if (limits.perVisitor.left(visitor, now) < 1 || limits.everyone.left("everyone", now) < 1) return "slow";
  limits.perVisitor.take(visitor, now);
  limits.everyone.take("everyone", now);
  try {
    const res = await fetchImpl(`${url}/rest/v1/waitlist`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ email: clean }),
    });
    if (res.ok) return "ok";
    if (res.status === 409) return "duplicate";
    return "error";
  } catch {
    return "error";
  }
}
