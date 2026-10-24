// The visitor's network address as the host reports it (Vercel sets x-forwarded-for). Only used to count tries (lib/auth-limits.js,
// lib/waitlist-core.js), never stored. `sent` is the result of `await headers()`.
export const visitorAddress = (sent) => (sent.get("x-forwarded-for") ?? "").split(",")[0].trim() || sent.get("x-real-ip") || "unknown";
