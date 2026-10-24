// The app's own brakes on signing in and creating accounts, on top of the ones Supabase has. Each try is counted BEFORE the password is checked,
// per email address (so one account cannot be guessed at) and per visitor address (so one computer cannot try many accounts):
//   sign in   8 tries per email and 30 per visitor, in 10 minutes
//   sign up   3 tries per email and 6 per visitor, in an hour
// The counts live in this server's memory, so on several servers each counts alone: this is friction against guessing, not a wall.
import { makeLimiter } from "./ai/limits.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function makeAuthLimits() {
  return {
    signIn: { email: makeLimiter({ max: 8, windowMs: 10 * MINUTE }), visitor: makeLimiter({ max: 30, windowMs: 10 * MINUTE }) },
    signUp: { email: makeLimiter({ max: 3, windowMs: HOUR }), visitor: makeLimiter({ max: 6, windowMs: HOUR }) },
  };
}

const shared = () => (globalThis.__hushworkAuthLimits ??= makeAuthLimits());

// True when this try may go ahead (and is counted); false when it is one too many (and nothing is counted).
export function allowAuthTry(kind, { email, visitor }, { now = Date.now(), limits = shared() } = {}) {
  const set = limits[kind];
  if (!set) return false;
  const who = String(email ?? "").trim().toLowerCase().slice(0, 254) || "none";
  const where = String(visitor ?? "").slice(0, 100) || "unknown";
  if (set.email.left(who, now) < 1 || set.visitor.left(where, now) < 1) return false;
  set.email.take(who, now);
  set.visitor.take(where, now);
  return true;
}
